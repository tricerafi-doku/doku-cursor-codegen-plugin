#!/usr/bin/env node
/**
 * DOKU Codegen — PostToolUse: Write (async)
 *
 * After any .java file is written, checks for common quality issues:
 *   - System.out.println (should use SLF4J)
 *   - Hardcoded DOKU credentials
 *   - Missing @Valid on controller @RequestBody params
 *
 * Runs async so it never blocks the write. Prints warnings to stderr only.
 * Profile: standard, strict
 */
'use strict';

const fs   = require('fs');
const path = require('path');

const CHECKS = [
  {
    pattern: /System\.out\.println/,
    message: 'Use SLF4J logger instead of System.out.println',
    severity: 'WARN',
  },
  {
    pattern: /(?:clientId|secretKey|CLIENT_ID|SECRET_KEY)\s*=\s*"[^$"][^"]{3,}"/,
    message: 'Possible hardcoded credential — use ${ENV_VAR:placeholder} syntax',
    severity: 'FAIL',
  },
  {
    pattern: /@PostMapping|@PutMapping|@PatchMapping/,
    antiPattern: /@Valid/,
    message: 'Controller write endpoint is missing @Valid on @RequestBody parameter',
    severity: 'WARN',
  },
];

module.exports.run = function(rawInput) {
  let input;
  try { input = JSON.parse(rawInput); } catch { return { stdout: rawInput, exitCode: 0 }; }

  const filePath = input.tool_input && input.tool_input.file_path;
  if (!filePath || !filePath.endsWith('.java')) return { stdout: rawInput, exitCode: 0 };

  // Skip test files
  const base = path.basename(filePath);
  if (base.includes('Test') || base.includes('Spec')) return { stdout: rawInput, exitCode: 0 };

  // Prefer tool_input.content (passed by Claude Code in PostToolUse); fall back to disk read
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

  const fileName = filePath.split('/').pop();
  const header = `[doku-codegen] Quality check: ${fileName}\n`;
  return {
    stdout: rawInput,
    stderr: header + findings.join('\n') + '\n',
    exitCode: 0
  };
};
