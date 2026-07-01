#!/usr/bin/env node
/**
 * DOKU Codegen — Universal hook wrapper.
 *
 * Usage:
 *   node run-with-flags.js <hookId> <scriptRelativePath> [profilesCsv]
 *
 * Reads stdin, checks DOKU_HOOK_PROFILE / DOKU_DISABLED_HOOKS,
 * then runs the hook script (via require() if possible, else child process).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { isHookEnabled } = require('../lib/hook-flags');

const MAX_STDIN = 1024 * 1024;

function readStdinRaw() {
  return new Promise(resolve => {
    let raw = '';
    let truncated = false;
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      if (raw.length < MAX_STDIN) {
        const remaining = MAX_STDIN - raw.length;
        raw += chunk.substring(0, remaining);
        if (chunk.length > remaining) truncated = true;
      } else {
        truncated = true;
      }
    });
    process.stdin.on('end', () => resolve({ raw, truncated }));
    process.stdin.on('error', () => resolve({ raw, truncated }));
  });
}

function emitHookResult(raw, output) {
  if (typeof output === 'string' || Buffer.isBuffer(output)) {
    process.stdout.write(String(output));
    return 0;
  }
  if (output && typeof output === 'object') {
    if (output.stderr) process.stderr.write(output.stderr.endsWith('\n') ? output.stderr : output.stderr + '\n');
    if (Object.prototype.hasOwnProperty.call(output, 'stdout')) {
      process.stdout.write(String(output.stdout ?? ''));
    } else if (!Number.isInteger(output.exitCode) || output.exitCode === 0) {
      process.stdout.write(raw);
    }
    return Number.isInteger(output.exitCode) ? output.exitCode : 0;
  }
  process.stdout.write(raw);
  return 0;
}

function getPluginRoot() {
  if (process.env.CLAUDE_PLUGIN_ROOT && process.env.CLAUDE_PLUGIN_ROOT.trim()) {
    return process.env.CLAUDE_PLUGIN_ROOT;
  }
  return path.resolve(__dirname, '..', '..');
}

async function main() {
  const [, , hookId, relScriptPath, profilesCsv] = process.argv;
  const { raw, truncated } = await readStdinRaw();

  if (!hookId || !relScriptPath) { process.stdout.write(raw); process.exit(0); }

  if (!isHookEnabled(hookId, { profiles: profilesCsv })) {
    process.stdout.write(raw); process.exit(0);
  }

  const pluginRoot = getPluginRoot();
  const resolvedRoot = path.resolve(pluginRoot);
  const scriptPath = path.resolve(pluginRoot, relScriptPath);

  if (!scriptPath.startsWith(resolvedRoot + path.sep)) {
    process.stderr.write(`[doku-hook] Path traversal rejected: ${scriptPath}\n`);
    process.stdout.write(raw); process.exit(0);
  }

  if (!fs.existsSync(scriptPath)) {
    process.stderr.write(`[doku-hook] Script not found for ${hookId}: ${scriptPath}\n`);
    process.stdout.write(raw); process.exit(0);
  }

  // Fast path: require() hook if it exports run()
  const src = fs.readFileSync(scriptPath, 'utf8');
  if (/\bmodule\.exports\b/.test(src) && /\brun\b/.test(src)) {
    let mod;
    try { mod = require(scriptPath); } catch (e) {
      process.stderr.write(`[doku-hook] require() failed for ${hookId}: ${e.message}\n`);
    }
    if (mod && typeof mod.run === 'function') {
      try {
        const output = mod.run(raw, { truncated, maxStdin: MAX_STDIN });
        process.exit(emitHookResult(raw, output));
      } catch (e) {
        process.stderr.write(`[doku-hook] run() error for ${hookId}: ${e.message}\n`);
        process.stdout.write(raw); process.exit(0);
      }
    }
  }

  // Legacy path: spawn child process
  const result = spawnSync(process.execPath, [scriptPath], {
    input: raw, encoding: 'utf8',
    env: { ...process.env, DOKU_HOOK_INPUT_TRUNCATED: truncated ? '1' : '0' },
    cwd: process.cwd(), timeout: 30000
  });
  if (result.stdout) process.stdout.write(result.stdout);
  else if (!result.status) process.stdout.write(raw);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(Number.isInteger(result.status) ? result.status : 0);
}

main().catch(err => {
  process.stderr.write(`[doku-hook] run-with-flags error: ${err.message}\n`);
  process.exit(0);
});
