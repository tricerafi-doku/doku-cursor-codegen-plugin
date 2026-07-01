#!/usr/bin/env node
/**
 * DOKU Codegen — PreToolUse: Write|Edit
 *
 * Blocks the sdk-generator agent from weakening quality configuration files
 * (Checkstyle, PMD, ESLint, Pylint, golangci-lint, etc.) just to make
 * generated code pass checks silently.
 *
 * Rules enforced:
 *   BLOCK — Overwriting a config that raises max-line-length or lowers severity
 *   BLOCK — Adding rule suppressions (.eslintignore, pylintrc disable=)
 *   WARN  — Modifying any linter/formatter config at all (inform user)
 *
 * Profile: standard, strict
 */
'use strict';

const path = require('path');

// Files that MUST NOT be written/overwritten without user awareness
const PROTECTED_CONFIG_FILES = [
  'checkstyle.xml', 'checkstyle-config.xml',
  'pmd.xml', 'pmd-ruleset.xml',
  '.eslintrc', '.eslintrc.js', '.eslintrc.json', '.eslintrc.yaml', '.eslintrc.yml',
  'eslint.config.js', 'eslint.config.mjs',
  '.pylintrc', 'pylintrc',
  'setup.cfg',        // often contains [tool:pylint] or [flake8]
  '.flake8',
  'golangci.yml', 'golangci.yaml', '.golangci.yml', '.golangci.yaml',
  'phpcs.xml', 'phpmd.xml',
  'ktlint.xml', '.editorconfig',
];

// Content patterns that indicate weakening of a config
const WEAKENING_PATTERNS = [
  /max.?line.?length\s*[=:]\s*[2-9]\d{2,}/i,  // line length > 199 (too permissive)
  /severity\s*[=:]\s*(?:ignore|none|off)/i,
  /disable\s*[=:]/i,                            // pylint/eslint disable block
  /suppressWarnings/,
  /<!--\s*suppress\s/i,                         // IntelliJ suppression comment in XML
  /CHECKSTYLE:OFF/i,
  /nolint/i,                                    // golangci-lint inline disable
  /:\s*["']off["']/,                            // ESLint rule value set to "off" e.g. "no-console": "off"
  /:\s*0\b/,                                    // ESLint rule value set to 0 (off numeric)
];

module.exports.run = function(rawInput) {
  let input;
  try { input = JSON.parse(rawInput); } catch { return { stdout: rawInput, exitCode: 0 }; }

  const toolName = input.tool_name || '';
  if (!['Write', 'Edit'].includes(toolName)) return { stdout: rawInput, exitCode: 0 };

  const filePath = input.tool_input && input.tool_input.file_path;
  if (!filePath) return { stdout: rawInput, exitCode: 0 };

  const base = path.basename(filePath);
  const isProtectedConfig = PROTECTED_CONFIG_FILES.includes(base) ||
                             PROTECTED_CONFIG_FILES.some(p => filePath.endsWith('/' + p));

  if (!isProtectedConfig) return { stdout: rawInput, exitCode: 0 };

  // Check if the write contains weakening patterns
  const newContent = input.tool_input.content || input.tool_input.new_string || '';
  const hasWeakening = WEAKENING_PATTERNS.some(p => p.test(newContent));

  if (hasWeakening) {
    return {
      stdout: rawInput,
      stderr: `[doku-codegen] BLOCKED: Attempted to weaken linter/formatter config: ${base}\n` +
              `  This may be an attempt to silence quality warnings in generated code.\n` +
              `  Fix the generated code to comply with the existing config instead.\n` +
              `  If this is intentional, edit the file manually.\n`,
      exitCode: 2,
    };
  }

  // Just modifying a config — warn but allow
  return {
    stdout: rawInput,
    stderr: `[doku-codegen] WARN: Modifying quality config file: ${base}\n` +
            `  Verify this change doesn't lower code quality standards.\n`,
    exitCode: 0,
  };
};
