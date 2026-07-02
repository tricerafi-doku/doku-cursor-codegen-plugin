#!/usr/bin/env node
/**
 * DOKU Codegen — PostToolUse: Write (async)
 *
 * After any .py file is written, checks for common quality issues:
 *   - print() in non-test code (should use logging)
 *   - Hardcoded DOKU credentials
 *   - Missing input validation before API call (no Pydantic/manual checks)
 *   - Reads DOKU_* env vars without load_dotenv() / pydantic_settings.BaseSettings
 *     (see standards/python.md — Configuration & Environment Variables)
 *
 * Profile: standard, strict
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Common Python app-entry filenames. If any of these live near the file
// being written and already call `load_dotenv()`, we consider the .env
// loader to be wired up project-wide — even if the file we're checking is
// a shared config module that just calls os.environ.get.
const ENTRY_CANDIDATES = [
  ['app', 'main.py'],
  ['main.py'],
  ['manage.py'],
  ['wsgi.py'],
  ['asgi.py'],
  ['src', 'main.py'],
];

const LOADER_SIGNAL = /(?:from\s+dotenv\s+import\s+load_dotenv|load_dotenv\s*\(|from\s+pydantic_settings\s+import|class\s+\w+\s*\(\s*BaseSettings)/;

function projectHasDotenvLoader(startDir) {
  let dir = startDir;
  for (let depth = 0; depth < 6; depth++) {
    for (const parts of ENTRY_CANDIDATES) {
      const candidate = path.join(dir, ...parts);
      try {
        const body = fs.readFileSync(candidate, 'utf8');
        if (LOADER_SIGNAL.test(body)) return true;
      } catch {
        // missing / unreadable — continue
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return false;
}

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
  {
    // Flags any file that reads a DOKU_* env var via os.environ.get / os.environ[...] / os.getenv
    // unless the file also wires up a .env loader (python-dotenv) or pydantic-settings BaseSettings.
    // See standards/python.md — Configuration & Environment Variables.
    pattern: /os\.(?:environ\.get|environ\[|getenv)\s*\(?\s*["']DOKU_/,
    antiPattern: /(?:from\s+dotenv\s+import\s+load_dotenv|load_dotenv\s*\(|from\s+pydantic_settings\s+import|class\s+\w+\s*\(\s*BaseSettings)/,
    message: 'Reads DOKU_* env var without load_dotenv() or pydantic_settings.BaseSettings — see standards/python.md',
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

  // Cache the "project-wide loader" answer: it's a filesystem walk, and we
  // only need it if the DOKU_* env-read check triggers.
  let projectLoaderChecked = false;
  let projectLoaderPresent = false;

  const findings = [];
  for (const check of CHECKS) {
    if (!check.pattern.test(content)) continue;
    if (check.antiPattern && check.antiPattern.test(content)) continue;
    // Special case: for the DOKU_* env-var check, before warning, look for a
    // loader in a sibling entry-point file (main.py / wsgi.py / etc.). The
    // recommended pattern in standards/python.md puts load_dotenv() in the
    // app entry and DOKU_* reads in a config module — we should not flag
    // the config module when the entry point already loads .env.
    if (check.message && check.message.startsWith('Reads DOKU_*')) {
      if (!projectLoaderChecked) {
        projectLoaderPresent = projectHasDotenvLoader(path.dirname(filePath));
        projectLoaderChecked = true;
      }
      if (projectLoaderPresent) continue;
    }
    findings.push(`  [${check.severity}] ${check.message}`);
  }

  if (findings.length === 0) return { stdout: rawInput, exitCode: 0 };

  return {
    stdout: rawInput,
    stderr: `[doku-codegen] Quality check: ${base}\n` + findings.join('\n') + '\n',
    exitCode: 0,
  };
};
