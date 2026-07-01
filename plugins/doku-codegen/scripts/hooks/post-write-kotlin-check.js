#!/usr/bin/env node
/**
 * DOKU Codegen — PostToolUse: Write (async)
 *
 * After any .kt file is written, checks for common quality issues:
 *   - println() in non-test code (should use SLF4J/kotlin-logging)
 *   - Hardcoded DOKU credentials
 *   - !! (non-null assertion) on env var / credential reads
 *   - Spring controller write endpoint missing @Valid
 *
 * Profile: standard, strict
 */
'use strict';

const fs = require('fs');
const path = require('path');

const CHECKS = [
  {
    pattern: /(?<!\w)println\s*\(/,
    message: 'Use SLF4J/kotlin-logging instead of println()',
    severity: 'WARN',
  },
  {
    pattern: /(?:clientId|secretKey|CLIENT_ID|SECRET_KEY)\s*=\s*"[^$][^"]{3,}"/,
    message: 'Possible hardcoded credential — use System.getenv("DOKU_CLIENT_ID") ?: throw IllegalStateException(...)',
    severity: 'FAIL',
  },
  {
    pattern: /System\.getenv\([^)]+\)!!/,
    message: 'Avoid !! on env var read — use ?: throw IllegalStateException("VAR not configured") instead',
    severity: 'WARN',
  },
  {
    pattern: /@(?:PostMapping|PutMapping|PatchMapping)/,
    antiPattern: /@Valid/,
    message: 'Controller write endpoint is missing @Valid on @RequestBody parameter',
    severity: 'WARN',
  },
];

module.exports.run = function(rawInput) {
  let input;
  try { input = JSON.parse(rawInput); } catch { return { stdout: rawInput, exitCode: 0 }; }

  const filePath = input.tool_input && input.tool_input.file_path;
  if (!filePath || path.extname(filePath) !== '.kt') return { stdout: rawInput, exitCode: 0 };

  // Skip test files
  const base = path.basename(filePath);
  if (base.endsWith('Test.kt') || base.endsWith('Spec.kt')) return { stdout: rawInput, exitCode: 0 };

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
