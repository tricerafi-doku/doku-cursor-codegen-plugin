#!/usr/bin/env node
/**
 * DOKU Codegen — PostToolUse: Write (async)
 *
 * After any .php file is written, checks for common quality issues:
 *   - var_dump() / echo in non-test code (should use PSR-3 logger)
 *   - Hardcoded DOKU credentials
 *   - Missing input validation before API call
 *
 * Profile: standard, strict
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CHECKS = [
  {
    pattern: /(?:var_dump|var_export)\s*\(/,
    message: 'Use PSR-3 logger instead of var_dump()/var_export()',
    severity: 'WARN',
  },
  {
    pattern: /\becho\b/,
    message: 'Avoid raw echo in service/client code — use PSR-3 logger',
    severity: 'WARN',
  },
  {
    pattern: /(?:clientId|secretKey|client_id|secret_key|CLIENT_ID|SECRET_KEY)\s*=\s*["'][^$][^"']{3,}["']/,
    message: 'Possible hardcoded credential — use $_ENV["DOKU_CLIENT_ID"] or getenv() syntax',
    severity: 'FAIL',
  },
  {
    pattern: /function\s+\w+\s*\(\s*(?:array|\$request|\$data)/,
    antiPattern: /(?:filter_var|filter_input|Validator::|validate\s*\(|\$request->validate)/,
    message: 'Handler accepts request data but no input validation found in this file',
    severity: 'WARN',
  },
];

module.exports.run = function(rawInput) {
  let input;
  try { input = JSON.parse(rawInput); } catch { return { stdout: rawInput, exitCode: 0 }; }

  const filePath = input.tool_input && input.tool_input.file_path;
  if (!filePath || path.extname(filePath) !== '.php') return { stdout: rawInput, exitCode: 0 };

  // Skip test files
  const base = path.basename(filePath);
  if (base.toLowerCase().includes('test')) return { stdout: rawInput, exitCode: 0 };

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
