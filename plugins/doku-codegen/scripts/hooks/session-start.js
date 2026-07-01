#!/usr/bin/env node
/**
 * DOKU Codegen — SessionStart hook
 *
 * Checks if the project has doku-codegen configured.
 * Skippable via: DOKU_HOOKS_DISABLED=1 or DOKU_DISABLED_HOOKS=session-start
 *
 * Profile: standard, strict
 */
'use strict';

const fs   = require('fs');
const path = require('path');

function check(cwd) {
  const configPath = path.join(cwd, '.claude', 'doku-codegen.local.md');
  try {
    const content = fs.readFileSync(configPath, 'utf8');
    const hasClientId = content.includes('CLIENT_ID:');
    const hasLanguage = content.includes('LANGUAGE:');
    if (!hasClientId || !hasLanguage) {
      return 'DOKU Codegen: project not fully configured. Run /doku-codegen:setup-credentials and /doku-codegen:detect-stack to get started.';
    }
    return null; // configured correctly
  } catch {
    return 'DOKU Codegen: project not configured. Run /doku-codegen:detect-stack and /doku-codegen:setup-credentials to get started.';
  }
}

module.exports.run = function(rawInput) {
  if (process.env.DOKU_HOOKS_DISABLED === '1') return { stdout: rawInput, exitCode: 0 };

  const message = check(process.cwd());
  if (!message) return { stdout: rawInput, exitCode: 0 };

  return {
    stdout: rawInput,
    stderr: message + '\n',
    exitCode: 0,
  };
};

// Allow direct execution (legacy path via spawnSync)
if (require.main === module) {
  if (process.env.DOKU_HOOKS_DISABLED === '1') process.exit(0);
  const message = check(process.cwd());
  if (message) process.stdout.write(message + '\n');
  process.exit(0);
}
