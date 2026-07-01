#!/usr/bin/env node
/**
 * DOKU Codegen — PostToolUse: Write (async)
 *
 * After any .py file is written, checks for common quality issues:
 *   - print() in non-test code (should use logging)
 *   - Hardcoded DOKU credentials
 *   - Missing input validation before API call (no Pydantic/manual checks)
 *
 * Profile: standard, strict
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CHECKS = [
  {
    pattern: /(?<!\w)print\s*\(/,
    message: 'Use logging module instead of print()',
    severity: 'WARN',
  },
  {
    pattern: /(?:client_id|secret_key|CLIENT_ID|SECRET_KEY)\s*=\s*["'][^$\{][^"']{3,}["']/,
    message: 'Possible hardcoded credential — use os.environ["DOKU_CLIENT_ID"] syntax',
    severity: 'FAIL',
  },
  {
    pattern: /def\s+\w+\s*\([^)]*request[^)]*\)/,
    antiPattern: /(?:\.model_validate|\.parse_obj|BaseModel|validate_|@validator|@field_validator)/,
    message: 'Handler accepts a request parameter but no Pydantic validation found in this file',
    severity: 'WARN',
  },
];

module.exports.run = function(rawInput) {
  let input;
  try { input = JSON.parse(rawInput); } catch { return { stdout: rawInput, exitCode: 0 }; }

  const filePath = input.tool_input && input.tool_input.file_path;
  if (!filePath || !filePath.endsWith('.py')) return { stdout: rawInput, exitCode: 0 };

  // Skip test files
  const base = path.basename(filePath);
  if (base.startsWith('test_') || base.endsWith('_test.py')) return { stdout: rawInput, exitCode: 0 };

  let content = input.tool_input.content;
  if (!content) {
    try { content = fs.readFileSync(filePath, 'utf8'); } catch { return { stdout: rawInput, exitCode: 0 }; }
  }

  const findings = [];
  for (const check of CHECKS) {
    if (check.pattern.test(content)) {
      if (check.antiPattern && check.antiPattern.test(content)) continue;
      findings.push(`  [${check.severity}] ${check.message}`);
    }
  }

  if (findings.length === 0) return { stdout: rawInput, exitCode: 0 };

  return {
    stdout: rawInput,
    stderr: `[doku-codegen] Quality check: ${base}\n` + findings.join('\n') + '\n',
    exitCode: 0,
  };
};
