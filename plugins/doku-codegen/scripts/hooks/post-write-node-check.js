#!/usr/bin/env node
/**
 * DOKU Codegen — PostToolUse: Write (async)
 *
 * After any .ts / .js file is written, checks for common quality issues:
 *   - console.log() in non-test code (should use structured logger)
 *   - Hardcoded DOKU credentials
 *   - Missing input validation (no Zod/manual check before API call)
 *
 * Profile: standard, strict
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CHECKS = [
  {
    pattern: /console\.log\s*\(/,
    message: 'Use structured logger (pino/winston) instead of console.log()',
    severity: 'WARN',
  },
  {
    pattern: /(?:clientId|secretKey|client_id|secret_key|CLIENT_ID|SECRET_KEY)\s*=\s*["'][^$`][^"']{3,}["']/,
    message: 'Possible hardcoded credential — use process.env.DOKU_CLIENT_ID syntax',
    severity: 'FAIL',
  },
  {
    pattern: /(?:router\.|app\.)(?:post|put|patch)\s*\(/,
    antiPattern: /(?:\.parse\s*\(|\.safeParse\s*\(|z\.|validate\s*\(|Joi\.|yup\.|schema\.)/,
    message: 'Write route found but no input validation (Zod/Joi/manual) detected in this file',
    severity: 'WARN',
  },
];

module.exports.run = function(rawInput) {
  let input;
  try { input = JSON.parse(rawInput); } catch { return { stdout: rawInput, exitCode: 0 }; }

  const filePath = input.tool_input && input.tool_input.file_path;
  if (!filePath) return { stdout: rawInput, exitCode: 0 };
  if (!['.ts', '.js'].includes(path.extname(filePath))) return { stdout: rawInput, exitCode: 0 };

  // Skip test files
  const base = path.basename(filePath);
  if (base.includes('.test.') || base.includes('.spec.')) return { stdout: rawInput, exitCode: 0 };

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
