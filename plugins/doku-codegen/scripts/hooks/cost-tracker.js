#!/usr/bin/env node
/**
 * DOKU Codegen — Stop hook (async)
 *
 * Estimates token cost for the session and appends to ~/.claude/metrics/doku-costs.jsonl.
 * Cost estimates are based on Claude pricing (Opus 4.6 / Sonnet 4.6 rates).
 *
 * Input: Claude Code passes usage metadata in the Stop event's tool_output.
 * Falls back to file-count heuristic if no usage data is available.
 *
 * Profile: standard, strict
 */
'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const METRICS_DIR  = path.join(os.homedir(), '.claude', 'metrics');
const METRICS_FILE = path.join(METRICS_DIR, 'doku-costs.jsonl');

// Pricing per 1M tokens (USD) — update when Anthropic changes pricing
const PRICING = {
  'claude-opus-4-6':    { input: 15.00, output: 75.00 },
  'claude-sonnet-4-6':  { input:  3.00, output: 15.00 },
  'claude-haiku-4-5':   { input:  0.25, output:  1.25 },
  default:              { input:  3.00, output: 15.00 },
};

module.exports.run = function(rawInput) {
  let input;
  try { input = JSON.parse(rawInput); } catch { return { stdout: rawInput, exitCode: 0 }; }

  const usage  = input.tool_output && input.tool_output.usage;
  const model  = input.tool_output && (input.tool_output.model || '');

  const pricing = PRICING[model] || PRICING.default;
  const inputTokens  = usage && usage.input_tokens  || 0;
  const outputTokens = usage && usage.output_tokens || 0;

  const costUSD = inputTokens  / 1_000_000 * pricing.input
                + outputTokens / 1_000_000 * pricing.output;

  const record = {
    ts:            new Date().toISOString(),
    model:         model || 'unknown',
    inputTokens,
    outputTokens,
    totalTokens:   inputTokens + outputTokens,
    estimatedUSD:  +costUSD.toFixed(6),
    cwd:           process.cwd(),
  };

  try {
    fs.mkdirSync(METRICS_DIR, { recursive: true });
    fs.appendFileSync(METRICS_FILE, JSON.stringify(record) + '\n');
  } catch { /* never block */ }

  if (record.totalTokens > 0) {
    process.stderr.write(
      `[doku-codegen] Session cost estimate: ~$${record.estimatedUSD.toFixed(4)} ` +
      `(${(record.totalTokens / 1000).toFixed(1)}k tokens, model: ${record.model})\n`
    );
  }

  return { stdout: rawInput, exitCode: 0 };
};
