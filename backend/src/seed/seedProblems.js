/**
 * One-time (idempotent) migration: loads seed/problems.raw.json — the
 * exact SEED_PROBLEMS array extracted verbatim from frontend/index.html —
 * into the Problem collection.
 *
 * Rules enforced here (see PHASE 2/3 of the audit):
 *  - No test data is invented. Every publicTests/hiddenTests entry is
 *    copied byte-for-byte from the source `tests` array.
 *  - A problem with 0 source tests gets hasJudge=false and
 *    needsManualTests=true. It is still created (so all 956 problems
 *    stay browsable), but /submit will refuse to grade it.
 *  - A problem with >=1 source test gets ALL of its tests copied into
 *    hiddenTests (used for grading) and its FIRST test copied into
 *    publicTests (shown to the browser as a worked example). Problems
 *    with exactly 1 test therefore have weak coverage (their only test
 *    doubles as the public example) — these are called out separately
 *    in the migration report below rather than silently treated the
 *    same as well-covered problems.
 *
 * Usage:  node src/seed/seedProblems.js
 * Safe to re-run: upserts by problemId, does not duplicate.
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Problem = require('../models/Problem');

const RAW_PATH = path.join(__dirname, 'problems.raw.json');
const REPORT_PATH = path.join(__dirname, 'migration-report.json');

async function main() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/CodeMentorAI';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log(`[seed] Connected to ${mongoUri}`);

  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
  console.log(`[seed] Loaded ${raw.length} problems from problems.raw.json`);

  const report = {
    totalSource: raw.length,
    migrated: 0,
    failed: [],
    withJudge: 0,
    needsManualTests: 0,
    weakCoverageSingleTest: [],
    duplicateIdsSkipped: [],
  };

  const seenIds = new Set();
  const ops = [];

  for (const p of raw) {
    if (!p.id || seenIds.has(p.id)) {
      report.duplicateIdsSkipped.push(p.id);
      continue;
    }
    seenIds.add(p.id);

    if (!p.title || !p.description || !p.difficulty || !p.fnName || !p.returnType) {
      report.failed.push({ id: p.id, reason: 'missing required metadata field' });
      continue;
    }

    const tests = Array.isArray(p.tests) ? p.tests : [];
    const validTests = tests.filter(
      (t) => t && typeof t.input === 'string' && typeof t.expected === 'string'
    );
    if (validTests.length !== tests.length) {
      report.failed.push({ id: p.id, reason: 'malformed test entry (missing input/expected)' });
      // Still migrate the problem itself, just without the malformed tests.
    }

    const hasJudge = validTests.length > 0;
    if (hasJudge) {
      report.withJudge += 1;
      if (validTests.length === 1) report.weakCoverageSingleTest.push(p.id);
    } else {
      report.needsManualTests += 1;
    }

    const doc = {
      problemId: p.id,
      title: p.title,
      description: p.description,
      difficulty: p.difficulty,
      tags: Array.isArray(p.tags) ? p.tags : [],
      starter: p.starter || '',
      fnName: p.fnName,
      paramTypes: Array.isArray(p.paramTypes) ? p.paramTypes : [],
      returnType: p.returnType,
      publicTests: validTests.length > 0 ? [validTests[0]] : [],
      hiddenTests: validTests, // full set used for grading; select:false in schema
      hasJudge,
      needsManualTests: !hasJudge,
      sourceTestCount: validTests.length,
    };

    ops.push({
      updateOne: {
        filter: { problemId: p.id },
        update: { $set: doc },
        upsert: true,
      },
    });
  }

  if (ops.length > 0) {
    const result = await Problem.bulkWrite(ops, { ordered: false });
    report.migrated = (result.upsertedCount || 0) + (result.modifiedCount || 0) + (result.matchedCount || 0);
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

  console.log('\n===== MIGRATION REPORT =====');
  console.log(`Total problems in source file : ${report.totalSource}`);
  console.log(`Successfully migrated         : ${ops.length}`);
  console.log(`  - with judge tests          : ${report.withJudge}`);
  console.log(`  - needing manual tests      : ${report.needsManualTests}`);
  console.log(`  - weak coverage (1 test)    : ${report.weakCoverageSingleTest.length}`);
  console.log(`Failed / skipped              : ${report.failed.length + report.duplicateIdsSkipped.length}`);
  console.log(`Full report written to        : ${REPORT_PATH}`);
  console.log('=============================\n');

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('[seed] Migration failed:', err);
  process.exit(1);
});
