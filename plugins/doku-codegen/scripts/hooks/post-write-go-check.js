#!/usr/bin/env node
/**
 * DOKU Codegen — PostToolUse: Write (async)
 *
 * After any .go file is written, checks for common quality issues:
 *   - fmt.Println() in non-test code (should use slog/zap/zerolog)
 *   - Hardcoded DOKU credentials
 *   - Exported function missing context.Context as first parameter
 *
 * Profile: standard, strict
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CHECKS = [
  {
    pattern: /fmt\.Println\s*\(/,
    message: 'Use slog/zap/zerolog instead of fmt.Println()',
    severity: 'WARN',
  },
  {
    pattern: /(?:clientId|secretKey|ClientID|SecretKey)\s*:?=\s*"[^$][^"]{3,}"/,
    message: 'Possible hardcoded credential — use os.Getenv("DOKU_CLIENT_ID") syntax',
    severity: 'FAIL',
  },
  {
    pattern: /^func [A-Z]\w+\s*\(/m,
    antiPattern: /^func [A-Z]\w+\s*\(ctx context\.Context/m,
    message: 'Exported function(s) found without context.Context as first parameter',
    severity: 'WARN',
  },
];

module.exports.run = function(rawInput) {
  let input;
  try { input = JSON.parse(rawInput); } catch { return { stdout: rawInput, exitCode: 0 }; }

  const filePath = input.tool_input && input.tool_input.file_path;
  if (!filePath || path.extname(filePath) !== '.go') return { stdout: rawInput, exitCode: 0 };

  // Skip test files
  const base = path.basename(filePath);
  if (base.endsWith('_test.go')) return { stdout: rawInput, exitCode: 0 };

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
