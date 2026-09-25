const { executeCode } = require('./dockerExecutor');

/**
 * Data-driven Python test harness — ported 1:1 from the frontend's
 * buildHarness()/parserFor() (frontend/index.html), so migrated problem
 * data keeps behaving exactly as it did client-side. The only supported
 * judge language today is Python, matching every existing problem's
 * `starter`/`fnName` metadata.
 */
const SUPPORTED_JUDGE_LANGUAGES = ['python'];

function pyStr(s) {
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

function parserFor(t) {
  return (
    {
      int: '__parse_int',
      float: '__parse_float',
      string: '__parse_str',
      bool: '__parse_bool',
      'int[]': '__parse_int_arr',
      'string[]': '__parse_str_arr',
      'int[][]': '__parse_int_matrix',
    }[t] || '__parse_str'
  );
}

function buildHarness(problem, test) {
  const lines = test.input.split('\n');
  const argLines = problem.paramTypes
    .map((t, i) => `__args.append(${parserFor(t)}(${pyStr(lines[i] !== undefined ? lines[i] : '')}))`)
    .join('\n');

  return `
def __parse_int(s): return int(s.strip())
def __parse_float(s): return float(s.strip())
def __parse_str(s): return s
def __parse_bool(s): return s.strip().lower() == 'true'
def __parse_int_arr(s): return [int(x) for x in s.split()] if s.strip() else []
def __parse_str_arr(s): return s.split()
def __parse_int_matrix(s): return [[int(x) for x in row.split()] for row in s.split(';')] if s.strip() else []

__args = []
${argLines}
__result = ${problem.fnName}(*__args)

def __fmt(v):
    if isinstance(v, bool): return str(v)
    if isinstance(v, list):
        if v and isinstance(v[0], list):
            return ';'.join(' '.join(str(x) for x in row) for row in v)
        return ' '.join(str(x) for x in v)
    return str(v)

print(__fmt(__result))
`;
}

/**
 * Runs `code` against every test in `tests` inside the existing Docker
 * sandbox (one container per test case, same as the editor's Run button).
 * Unlike an early-exit judge, this runs ALL tests (matching the original
 * frontend UX, which showed every case's pass/fail) and returns both an
 * aggregate verdict AND a per-case breakdown in `cases`.
 *
 * SECURITY: `cases[i].actual`/`expected`/`input` are only safe to send to
 * the browser when `tests` are PUBLIC tests. When `tests` are hidden
 * judge tests, the caller (problemController) MUST strip those fields
 * before responding — only `pass`/`error` are safe to expose in that
 * case. This function itself does not know whether its `tests` argument
 * is public or hidden, so it always returns full detail; redaction is
 * the controller's responsibility, documented at the call site.
 */
async function judgeSubmission({ problem, code, language, tests }) {
  if (!SUPPORTED_JUDGE_LANGUAGES.includes(language)) {
    return {
      status: 'Compilation Error',
      passed: 0,
      total: tests.length,
      executionTime: null,
      error: `The judge currently only supports Python solutions for practice problems (got "${language}").`,
      cases: [],
    };
  }

  if (!tests || tests.length === 0) {
    // Stage 3 fix: an empty test array must NEVER be able to produce
    // "Accepted". There is no `.every()` over an empty array anywhere
    // in this path — we short-circuit before any comparison happens.
    return {
      status: 'No Judge Tests',
      passed: 0,
      total: 0,
      executionTime: null,
      error: 'This problem does not have judge tests yet and cannot be graded.',
      cases: [],
    };
  }

  let passed = 0;
  let totalTimeMs = 0;
  const cases = [];
  // Priority for the aggregate status when multiple cases fail differently:
  // a crash/timeout outranks a plain wrong answer, since it's the more
  // actionable signal for the student.
  const STATUS_RANK = { 'Wrong Answer': 1, 'Runtime Error': 2, 'Time Limit Exceeded': 3, 'Compilation Error': 4 };
  let worstStatus = null;
  let worstError = null;

  for (const test of tests) {
    const harness = buildHarness(problem, test);
    const fullCode = `${code}\n${harness}`;

    // eslint-disable-next-line no-await-in-loop
    const result = await executeCode(language, fullCode, '');
    const execMs = parseInt(result.executionTime, 10) || 0;
    totalTimeMs += execMs;

    if (!result.success) {
      const isTimeout = /timed out/i.test(result.error || '');
      const caseStatus = result.stage === 'compile'
        ? 'Compilation Error'
        : isTimeout
          ? 'Time Limit Exceeded'
          : 'Runtime Error';
      const err = sanitizeError(result.error);

      cases.push({ pass: false, actual: null, expected: test.expected, error: err });
      if (!worstStatus || STATUS_RANK[caseStatus] > STATUS_RANK[worstStatus]) {
        worstStatus = caseStatus;
        worstError = err;
      }
      continue;
    }

    const actual = (result.output || '').trim();
    const pass = actual === test.expected.trim();
    cases.push({ pass, actual, expected: test.expected, error: null });

    if (pass) {
      passed += 1;
    } else if (!worstStatus || STATUS_RANK['Wrong Answer'] > STATUS_RANK[worstStatus]) {
      worstStatus = 'Wrong Answer';
      worstError = null;
    }
  }

  const status = worstStatus || 'Accepted';

  return {
    status,
    passed,
    total: tests.length,
    executionTime: `${totalTimeMs}ms`,
    error: worstError,
    cases,
  };
}

// Strip anything that looks like our internal harness plumbing so a
// runtime traceback never confuses the user with `__parse_int` etc.
function sanitizeError(message) {
  if (!message) return null;
  return String(message).slice(0, 2000);
}

module.exports = { judgeSubmission, buildHarness, SUPPORTED_JUDGE_LANGUAGES };
