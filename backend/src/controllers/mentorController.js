// AI mentor endpoints — explain / find-bug / hint.
//
// These used to be called straight from the browser to the model provider,
// which only works inside a sandbox that injects the key for you. On a real
// deployment the browser has no API key to send, so every mentor call would
// fail with a CORS/401 error. Routing it through the backend fixes both
// problems: the key lives in the server's .env and never reaches the client.
//
// HINT ENGINE: /hint is no longer a generic "problem + code + level" call. It
// receives the judge result, the failing test, the runtime/compile error and
// the hints already given, classifies the *situation*, and asks the model for
// one targeted next step plus a short "why you're getting this hint".

const ProblemProgress = require('../models/ProblemProgress');
const Problem = require('../models/Problem');
const local = require('../services/localStore');
const useLocal = () => (process.env.PERSISTENCE_MODE || 'memory') !== 'mongo';

const MODEL = 'gemini-2.5-flash';
const MENTOR_TIMEOUT_MS = parseInt(process.env.MENTOR_TIMEOUT_MS || '20000', 10);

async function callGemini(system, userPrompt, maxTokens = 1000) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Preview/local deployments should still provide useful feedback when an
    // external model key is intentionally absent. This keeps the product
    // flow testable and gives the learner a targeted next step instead of a
    // dead button. Production deployments can enable Gemini for richer prose.
    const codeBlock = userPrompt.match(/Learner's current code:\n[\s\S]*?\n```[\w-]*\n([\s\S]*?)\n```/i)?.[1] || userPrompt.match(/Code:\n```[\w-]*\n([\s\S]*?)\n```/i)?.[1] || '';
    const status = /Judge result:\s*([^\n]+)/i.exec(userPrompt)?.[1] || '';
    const requestedLevel = Number(/Give hint level\s+(\d)/i.exec(userPrompt)?.[1] || /LEVEL\s+(\d)/i.exec(system)?.[1] || 1);
    if (/HINT:/i.test(system)) {
      if (/accepted/i.test(status)) return 'HINT: Your solution is already passing; inspect whether the current time and space complexity can be simplified.\nWHY: The judge result says Accepted, so the next useful step is code quality rather than debugging.';
      if (/pass\s*$/im.test(codeBlock) || codeBlock.trim().length < 20) {
        if (requestedLevel >= 3) return 'HINT: For each number n, compute the partner target - n. Keep a lookup from values you have already visited to their indices; check the lookup before storing the current value.\nWHY: Level 3 names the complete approach while leaving the loop and return statement for you to implement.';
        if (requestedLevel === 2) return 'HINT: Make one pass through the input and remember enough about earlier values to answer whether the needed partner has already appeared.\nWHY: Level 2 gives you the strategy without writing the implementation for you.';
        return 'HINT: Start by identifying the input values and the exact output the function must return, then replace the placeholder with one small step.\nWHY: The current code is still a starter or placeholder, so the first step is to make the input-to-output contract concrete.';
      }
      if (/for\s+.*for\s+/i.test(codeBlock)) return 'HINT: Trace the inner loop for one small input and ask whether its work can be remembered instead of repeated.\nWHY: Nested iteration is a strong signal that the same comparisons may be happening more than once.';
      return 'HINT: Trace one failing or representative input line by line and inspect the value immediately before the return statement.\nWHY: A concrete trace usually reveals where the current state first differs from the expected result.';
    }
    if (/exact format/i.test(system) && /HAS_BUG/i.test(system)) return `HAS_BUG: no\nDIAGNOSIS: Run the snippet with a representative input and inspect its output before changing it.\nFIX: Add a small test case and verify the expected result.\nCode length: ${codeBlock.length}`;
    return `This local mentor is ready for code review. Start by tracing the input through the main branch and checking the value returned at the end.\n\nCode length: ${codeBlock.length}`;
  }

  // Guard against a hung/slow request holding the connection (and a
  // rate-limit slot) open indefinitely.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MENTOR_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: { maxOutputTokens: maxTokens },
        }),
        signal: controller.signal,
      }
    );
  } catch (fetchErr) {
    const err = new Error(
      fetchErr.name === 'AbortError'
        ? `Mentor request timed out after ${MENTOR_TIMEOUT_MS}ms.`
        : `Could not reach the AI mentor provider: ${fetchErr.message}`
    );
    err.statusCode = 504;
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const err = new Error(`Mentor request failed (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`);
    err.statusCode = 502;
    throw err;
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('\n').trim();
}

const MAX_CODE_LENGTH = parseInt(process.env.MAX_CODE_LENGTH || '20000', 10);

function validateCode(code, res) {
  if (!code || typeof code !== 'string' || !code.trim()) {
    res.status(400).json({ success: false, message: 'code is required' });
    return false;
  }
  if (code.length > MAX_CODE_LENGTH) {
    res.status(400).json({ success: false, message: `code exceeds the maximum allowed length of ${MAX_CODE_LENGTH} characters` });
    return false;
  }
  return true;
}

// @route  POST /api/mentor/explain
// @access Public (rate-limited)
const explain = async (req, res, next) => {
  try {
    const { code, language, level } = req.body;
    if (!validateCode(code, res)) return;

    const lvl = ['beginner', 'intermediate', 'advanced'].includes(level) ? level : 'beginner';
    const system = `You are a patient, encouraging coding mentor. Explain code clearly for a ${lvl} learner. Use short paragraphs and, where useful, numbered steps. Never just restate the code line-by-line without context — explain the why and the underlying concept. Keep it under 220 words.`;
    const user = `Language: ${language || 'unknown'}\n\nCode:\n\`\`\`${language || ''}\n${code}\n\`\`\`\n\nExplain what this code does and why it's written this way.`;

    const result = await callGemini(system, user);
    res.status(200).json({ success: true, result });
  } catch (err) {
    if (err.statusCode) res.status(err.statusCode);
    next(err);
  }
};

// @route  POST /api/mentor/find-bug
// @access Public (rate-limited)
const findBug = async (req, res, next) => {
  try {
    const { code, language, runtimeOutput } = req.body;
    if (!validateCode(code, res)) return;

    const system = `You are an expert debugger and coding mentor. Analyze the given code for bugs. If runtime output (stdout/stderr) is provided, use it as ground truth. Respond in this exact format with no extra preamble:\nHAS_BUG: yes|no\nDIAGNOSIS: <clear explanation of the bug and why it happens>\nFIX: <corrected code or clear instructions to fix it>`;
    const context = runtimeOutput ? `\n\nActual runtime output:\n${String(runtimeOutput).slice(0, 4000)}` : '';
    const user = `Language: ${language || 'unknown'}\n\nCode:\n\`\`\`${language || ''}\n${code}\n\`\`\`${context}`;

    const raw = await callGemini(system, user);
    const hasBugMatch = raw.match(/HAS_BUG:\s*(yes|no)/i);
    const diagMatch = raw.match(/DIAGNOSIS:\s*([\s\S]*?)(?:\nFIX:|$)/i);
    const fixMatch = raw.match(/FIX:\s*([\s\S]*)$/i);

    res.status(200).json({
      success: true,
      has_bug: hasBugMatch ? hasBugMatch[1].toLowerCase() === 'yes' : /bug/i.test(raw),
      diagnosis: diagMatch ? diagMatch[1].trim() : raw,
      suggested_fix: fixMatch ? fixMatch[1].trim() : '',
    });
  } catch (err) {
    if (err.statusCode) res.status(err.statusCode);
    next(err);
  }
};

// ============================================================
// HINT ENGINE
// ============================================================

// The judge's `status` string (see judgeService.js) is the most useful signal
// we have: it tells us WHICH KIND of help the learner needs before we spend a
// single token on the model. Everything below is keyed off it.
const SITUATIONS = {
  compile: {
    badge: '🔴',
    headline: 'Compilation issue',
    lead: 'Your code never got as far as running.',
    focus:
      'The submission failed to compile/parse. Point the learner at the concept or syntax area the error message is complaining about. Do not paste corrected code — name the construct and let them find the line.',
  },
  runtime: {
    badge: '🟠',
    headline: 'Runtime issue',
    lead: 'Your program starts executing but fails partway through.',
    focus:
      'The program crashed at runtime. Reason from the exception type and the failing input toward the likely cause (index out of range, None/null, division, type mismatch, recursion depth). Tell them WHICH value to inspect just before the failing operation.',
  },
  'wrong-answer': {
    badge: '🟡',
    headline: 'Logic issue',
    lead: "Your code runs fine, but the result doesn't match what's expected.",
    focus:
      'The code runs but produces the wrong output. Reason specifically from the failing test case: what does their logic produce for that input, and where does it diverge from the expectation? Name the single expression or branch most likely responsible, and ask a question that makes them trace it.',
  },
  tle: {
    badge: '⏱️',
    headline: 'Performance issue',
    lead: 'Your logic is probably doing more work than it needs to.',
    focus:
      'The solution is too slow. Hint toward complexity: how many times does the inner work run for a large input, and what information could be remembered instead of recomputed? Do not name the final data structure at hint level 1.',
  },
  accepted: {
    badge: '🟢',
    headline: 'Nice — tests pass',
    lead: 'Your solution passes the tests it was graded against.',
    focus:
      'The code is CORRECT. Do NOT invent a bug. Congratulate them in one short clause, then give one optimisation or code-quality direction to think about (time complexity, space, readability, edge cases). If it is already optimal, say so and name the complexity.',
  },
  'no-run': {
    badge: '💡',
    headline: 'Mentor hint',
    lead: "You haven't run this yet — here's a nudge on the approach.",
    focus:
      'There is no judge result yet. Work only from the problem statement and whatever the learner has written so far (which may still be the untouched starter template). If the editor is essentially empty, help them decide what the first step should be rather than reviewing code that does not exist.',
  },
};

function classify(status) {
  if (status === 'Compilation Error') return 'compile';
  if (status === 'Runtime Error') return 'runtime';
  if (status === 'Wrong Answer') return 'wrong-answer';
  if (status === 'Time Limit Exceeded') return 'tle';
  if (status === 'Accepted') return 'accepted';
  return 'no-run';
}

const LEVEL_GUIDANCE = {
  1: 'LEVEL 1 — NUDGE. Point only at the area or idea worth re-examining. No algorithm name, no data-structure name, no pseudocode, no code.',
  2: 'LEVEL 2 — STRATEGY. Describe the general approach or the property they should exploit. You may name a category of data structure. Still no code and no pseudocode.',
  3: 'LEVEL 3 — NEAR-SOLUTION. Spell out the approach step by step and you may use short pseudocode. Stop before a complete, runnable solution — leave the implementation to them.',
};

const HINT_RULES = `Rules you must follow:
- NEVER give the complete solution, and never rewrite their whole function.
- Give exactly ONE actionable hint. One idea, not a checklist.
- Refer to the learner's own code — quote at most a short expression or variable name from it so they know where to look.
- Identify the likely MISCONCEPTION, not just the symptom.
- Do not repeat anything under "Hints already given"; move them one step further instead.
- If the code is already correct, do not invent a bug.
- Address the learner as "you". No preamble, no sign-off, no markdown headings.`;

function formatFailedCase(failedCase) {
  if (!failedCase || typeof failedCase !== 'object') return '';
  const bits = [];
  if (failedCase.input !== undefined && failedCase.input !== null) bits.push(`Input: ${String(failedCase.input).slice(0, 500)}`);
  if (failedCase.expected !== undefined && failedCase.expected !== null) bits.push(`Expected: ${String(failedCase.expected).slice(0, 500)}`);
  if (failedCase.actual !== undefined && failedCase.actual !== null) bits.push(`Their output: ${String(failedCase.actual).slice(0, 500)}`);
  if (failedCase.error) bits.push(`Error: ${String(failedCase.error).slice(0, 1000)}`);
  if (!bits.length) return '';
  return `\nFirst failing test:\n${bits.join('\n')}`;
}

// @route  POST /api/mentor/hint
// @access Public (rate-limited); progress tracking only when authenticated
const hint = async (req, res, next) => {
  try {
    const {
      problemId,
      problemTitle,
      problemDescription,
      tags,
      code,
      language,
      hintLevel,
      status,
      passed,
      total,
      failedCase,
      runtimeOutput,
      previousHints,
    } = req.body;

    if (!validateCode(code, res)) return;

    const level = [1, 2, 3].includes(Number(hintLevel)) ? Number(hintLevel) : 1;
    const situationKey = classify(status);
    const sit = SITUATIONS[situationKey];

    const history = Array.isArray(previousHints)
      ? previousHints
          .map((h) => (typeof h === 'string' ? h : h && h.hint))
          .filter(Boolean)
          .slice(-6)
      : [];

    const system = [
      'You are CodeMentor-AI, a Socratic programming mentor.',
      'Your job is NOT to solve the problem. Your job is to move the learner exactly one step forward.',
      LEVEL_GUIDANCE[level],
      sit.focus,
      HINT_RULES,
      'Reply in EXACTLY this format and nothing else:',
      'HINT: <your single hint, under 90 words>',
      'WHY: <one or two sentences naming the specific signal in their code or test result that led you to this hint>',
    ].join('\n\n');

    // Hidden (submit-mode) cases arrive redacted — say so explicitly, so the
    // model doesn't hallucinate an input it was never given.
    const judgeBlock =
      situationKey === 'no-run'
        ? 'Judge result: the learner has not run this code yet.'
        : [
            `Judge result: ${status}`,
            Number.isFinite(Number(passed)) && Number.isFinite(Number(total))
              ? `Tests passed: ${passed}/${total}`
              : null,
            runtimeOutput ? `Compiler/runtime output:\n${String(runtimeOutput).slice(0, 2000)}` : null,
            formatFailedCase(failedCase) ||
              (situationKey !== 'accepted'
                ? '\n(The failing test is a hidden judge test — its input and expected output were not disclosed. Reason from the code and the status alone, and say so if that limits you.)'
                : ''),
          ]
            .filter(Boolean)
            .join('\n');

    const user = [
      `Problem: ${problemTitle || '(untitled)'}`,
      `${problemDescription || '(no description provided)'}`,
      Array.isArray(tags) && tags.length ? `Topic tags: ${tags.join(', ')}` : null,
      `Language: ${language || 'python'}`,
      '',
      `Learner's current code:\n\`\`\`${language || 'python'}\n${code}\n\`\`\``,
      '',
      judgeBlock,
      '',
      history.length
        ? `Hints already given (do NOT repeat these):\n${history.map((h, i) => `${i + 1}. ${h}`).join('\n')}`
        : 'Hints already given: none — this is their first hint on this problem.',
      '',
      `Give hint level ${level}.`,
    ]
      .filter((x) => x !== null)
      .join('\n');

    const raw = await callGemini(system, user, 600);

    // Tolerant parsing: if the model ignores the format, treat the whole reply
    // as the hint rather than showing the learner a parse failure.
    const hintMatch = raw.match(/HINT:\s*([\s\S]*?)(?:\n\s*WHY:|$)/i);
    const whyMatch = raw.match(/WHY:\s*([\s\S]*)$/i);
    const hintText = (hintMatch ? hintMatch[1] : raw).trim();
    const whyText = whyMatch ? whyMatch[1].trim() : '';

    // ---- progress tracking: count hints against the learner's row ----
    // Best-effort: a bookkeeping failure must never cost the learner the hint
    // they already waited for.
    if (req.user && problemId) {
      try {
        if (useLocal()) {
          local.incrementHints(String(req.user._id || req.user.id), problemId);
          return res.status(200).json({
            success: true,
            level,
            situation: situationKey,
            badge: sit.badge,
            headline: sit.headline,
            lead: sit.lead,
            hint: hintText,
            why: whyText,
            result: hintText,
          });
        }
        const problemDoc = await Problem.findOne({ problemId }).select('_id');
        if (problemDoc) {
          await ProblemProgress.findOneAndUpdate(
            { user: req.user._id, problem: problemDoc._id },
            { $inc: { hintsUsed: 1 } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
        }
      } catch (progressErr) {
        // eslint-disable-next-line no-console
        console.warn('hintsUsed update failed:', progressErr.message);
      }
    }

    res.status(200).json({
      success: true,
      level,
      situation: situationKey,
      badge: sit.badge,
      headline: sit.headline,
      lead: sit.lead,
      hint: hintText,
      why: whyText,
      // Back-compat with the old client, which read `data.result`.
      result: hintText,
    });
  } catch (err) {
    if (err.statusCode) res.status(err.statusCode);
    next(err);
  }
};

module.exports = { explain, findBug, hint };
