#!/usr/bin/env node
/**
 * DOKU Codegen — UserPromptSubmit hook
 *
 * Checks if the user's message is asking to generate DOKU payment code manually.
 * If yes, prints a reminder to use the plugin skills instead.
 *
 * Uses type: "command" (not type: "prompt") for reliability — prompt-type hooks
 * fire a full model call and can produce errors when the response format is unexpected.
 *
 * Profile: standard, strict
 */
'use strict';

// Only trigger when user is clearly asking to WRITE NEW payment code from scratch.
// Do NOT trigger on: questions, debugging, status checks, existing code discussion.
const PAYMENT_KEYWORDS = [
  'generate payment', 'create payment client', 'build payment',
  'integrate doku', 'add doku', 'implement doku',
  'create checkout client', 'build checkout', 'generate checkout',
  'create virtual account client', 'build virtual account',
  'create qris client', 'build qris',
];

module.exports.run = function(rawInput) {
  let input;
  try { input = JSON.parse(rawInput); } catch { return { stdout: rawInput, exitCode: 0 }; }

  const message = (
    (input.tool_input && input.tool_input.message) ||
    (input.message) ||
    ''
  ).toLowerCase();

  if (!message) return { stdout: rawInput, exitCode: 0 };

  const isPaymentRequest = PAYMENT_KEYWORDS.some(kw => message.includes(kw));
  if (!isPaymentRequest) return { stdout: rawInput, exitCode: 0 };

  const reminder =
    '[doku-codegen] Use the plugin skills for this task — do NOT generate DOKU payment code manually.\n' +
    '  To generate a client: /doku-codegen:generate [payment-method]\n' +
    '  To fetch spec first:  /doku-spec [payment-method]\n';

  return {
    stdout: rawInput,
    stderr: reminder,
    exitCode: 0,
  };
};

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', d => { raw += d; });
  process.stdin.on('end', () => {
    const r = module.exports.run(raw || '{}');
    if (r.stderr) process.stderr.write(r.stderr);
    process.exit(r.exitCode || 0);
  });
}
