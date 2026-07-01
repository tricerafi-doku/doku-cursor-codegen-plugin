#!/usr/bin/env node
/**
 * DOKU Codegen — PostToolUse: Write|Edit (async)
 *
 * Accumulates every source file written or edited during a session into
 * a temporary list at /tmp/doku-codegen-edited-files.json.
 * The stop-validate-generated.js hook reads this list at Stop time to run
 * cross-file batch validation (import consistency, missing pairs, etc.).
 *
 * Profile: standard, strict
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ACCUMULATOR_FILE = '/tmp/doku-codegen-edited-files.json';

const SOURCE_EXTENSIONS = new Set([
  '.java', '.kt', '.py', '.ts', '.js', '.go', '.php', '.rb'
]);

module.exports.run = function(rawInput) {
  let input;
  try { input = JSON.parse(rawInput); } catch { return { stdout: rawInput, exitCode: 0 }; }

  const filePath = input.tool_input && input.tool_input.file_path;
  if (!filePath) return { stdout: rawInput, exitCode: 0 };
  if (!SOURCE_EXTENSIONS.has(path.extname(filePath))) return { stdout: rawInput, exitCode: 0 };

  // Skip test files
  const base = path.basename(filePath);
  if (/test|spec/i.test(base)) return { stdout: rawInput, exitCode: 0 };

  try {
    let list = [];
    if (fs.existsSync(ACCUMULATOR_FILE)) {
      list = JSON.parse(fs.readFileSync(ACCUMULATOR_FILE, 'utf8'));
    }
    if (!list.includes(filePath)) {
      list.push(filePath);
      fs.writeFileSync(ACCUMULATOR_FILE, JSON.stringify(list));
    }
  } catch {
    // Never block on accumulator failures
  }

  return { stdout: rawInput, exitCode: 0 };
};
