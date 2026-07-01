#!/usr/bin/env node
/**
 * DOKU Codegen — PreCompact hook
 *
 * Fires before Claude Code compacts the conversation context.
 * Saves critical generation state to /tmp/doku-codegen-session.json so that
 * setup-project can recover after compaction without losing progress.
 *
 * Saved state:
 *   - API_NAME, API_ENDPOINT from .claude/doku-codegen.local.md
 *   - Files written so far (from accumulator)
 *   - LANGUAGE / FRAMEWORK
 *   - Timestamp
 *
 * Profile: standard, strict
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SESSION_FILE = '/tmp/doku-codegen-session.json';
const ACCUMULATOR_FILE = '/tmp/doku-codegen-edited-files.json';
const CONFIG_PATHS = [
  '.claude/doku-codegen.local.md',
  path.join(process.env.HOME || '', '.claude/doku-codegen.local.md'),
];

function parseField(content, field) {
  const m = content.match(new RegExp(`${field}:\\s*(.+)`));
  return m ? m[1].trim() : null;
}

module.exports.run = function(rawInput) {
  const state = {
    savedAt: new Date().toISOString(),
    config: {},
    filesWritten: [],
  };

  // Load config
  for (const configPath of CONFIG_PATHS) {
    try {
      const content = fs.readFileSync(configPath, 'utf8');
      state.config = {
        LANGUAGE:    parseField(content, 'LANGUAGE'),
        FRAMEWORK:   parseField(content, 'FRAMEWORK'),
        API_NAME:    parseField(content, 'API_NAME'),
        API_ENDPOINT:parseField(content, 'API_ENDPOINT'),
        CLIENT_ID:   parseField(content, 'CLIENT_ID') ? '***' : null,
        ENVIRONMENT: parseField(content, 'ENVIRONMENT') || parseField(content, 'BASE_URL'),
      };
      break;
    } catch { /* try next */ }
  }

  // Load accumulated file list
  try {
    if (fs.existsSync(ACCUMULATOR_FILE)) {
      state.filesWritten = JSON.parse(fs.readFileSync(ACCUMULATOR_FILE, 'utf8'));
    }
  } catch { /* ignore */ }

  // Save session state
  try {
    fs.writeFileSync(SESSION_FILE, JSON.stringify(state, null, 2));
  } catch { /* never block on save failure */ }

  const summary = state.config.API_NAME
    ? `[doku-codegen] Context saved before compaction — API: ${state.config.API_NAME}, Files: ${state.filesWritten.length}\n`
    : `[doku-codegen] Context saved before compaction — ${state.filesWritten.length} files tracked\n`;

  return {
    stdout: rawInput,
    stderr: summary,
    exitCode: 0,
  };
};
