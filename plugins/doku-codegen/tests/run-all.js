#!/usr/bin/env node
/**
 * doku-codegen hook script test runner
 * Usage: node tests/run-all.js
 */
'use strict';

const path = require('path');
let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}\n    ${e.message}`);
    failed++;
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function makeInput(toolName, filePath, content) {
  return JSON.stringify({
    tool_name: toolName,
    tool_input: { file_path: filePath, content: content || '' },
    tool_output: {},
  });
}

// ─── post-write-java-check ────────────────────────────────────────────────
console.log('\npost-write-java-check');
const javaCheck = require('../scripts/hooks/post-write-java-check');

test('passes clean Java file', () => {
  const input = makeInput('Write', '/src/DokuClient.java', 'logger.info("ok");');
  const r = javaCheck.run(input);
  assert(r.exitCode === 0);
  assert(!r.stderr, 'expected no stderr');
});

test('warns on System.out.println in Java', () => {
  const input = makeInput('Write', '/src/DokuClient.java', 'System.out.println("debug");');
  const r = javaCheck.run(input);
  assert(r.exitCode === 0);
  assert(r.stderr && r.stderr.includes('WARN'), `got: ${r.stderr}`);
});

test('fails on hardcoded credential in Java', () => {
  const input = makeInput('Write', '/src/DokuConfig.java', 'String clientId = "MCH-001-abc";');
  const r = javaCheck.run(input);
  assert(r.exitCode === 0);
  assert(r.stderr && r.stderr.includes('FAIL'), `got: ${r.stderr}`);
});

test('ignores non-Java files', () => {
  const input = makeInput('Write', '/src/main.py', 'System.out.println("x");');
  const r = javaCheck.run(input);
  assert(!r.stderr);
});

test('ignores Java test files', () => {
  const input = makeInput('Write', '/src/DokuClientTest.java', 'System.out.println("debug");');
  const r = javaCheck.run(input);
  assert(!r.stderr, 'test files should be skipped');
});

// ─── post-write-node-check ────────────────────────────────────────────────
console.log('\npost-write-node-check');
const nodeCheck = require('../scripts/hooks/post-write-node-check');

test('passes clean TS file', () => {
  const input = makeInput('Write', '/src/client.ts', 'logger.info("ok");');
  const r = nodeCheck.run(input);
  assert(r.exitCode === 0);
  assert(!r.stderr);
});

test('warns on console.log in TS', () => {
  const input = makeInput('Write', '/src/client.ts', 'console.log("debug");');
  const r = nodeCheck.run(input);
  assert(r.stderr && r.stderr.includes('WARN'));
});

test('fails on hardcoded CLIENT_ID in JS', () => {
  const input = makeInput('Write', '/src/config.js', "const clientId = 'MCH-001-abcde';");
  const r = nodeCheck.run(input);
  assert(r.stderr && r.stderr.includes('FAIL'));
});

test('ignores spec files', () => {
  const input = makeInput('Write', '/src/client.spec.ts', 'console.log("debug");');
  const r = nodeCheck.run(input);
  assert(!r.stderr);
});

// ─── post-write-python-check ──────────────────────────────────────────────
console.log('\npost-write-python-check');
const pyCheck = require('../scripts/hooks/post-write-python-check');

test('passes clean Python file', () => {
  const input = makeInput('Write', '/src/client.py', 'logger.info("ok")');
  const r = pyCheck.run(input);
  assert(!r.stderr);
});

test('warns on print() in Python', () => {
  const input = makeInput('Write', '/src/client.py', 'print("debug")');
  const r = pyCheck.run(input);
  assert(r.stderr && r.stderr.includes('WARN'));
});

test('ignores Python test files', () => {
  const input = makeInput('Write', '/src/test_client.py', 'print("debug")');
  const r = pyCheck.run(input);
  assert(!r.stderr);
});

// ─── config-protection ────────────────────────────────────────────────────
console.log('\nconfig-protection');
const configProtect = require('../scripts/hooks/config-protection');

test('blocks weakening ESLint config', () => {
  const input = JSON.stringify({
    tool_name: 'Write',
    tool_input: {
      file_path: '/project/.eslintrc.json',
      content: '{"rules": {"no-console": "off"}}',
    },
    tool_output: {},
  });
  const r = configProtect.run(input);
  assert(r.exitCode === 2, `expected exit 2, got ${r.exitCode}`);
});

test('warns on non-weakening ESLint edit', () => {
  const input = JSON.stringify({
    tool_name: 'Write',
    tool_input: {
      file_path: '/project/.eslintrc.json',
      content: '{"rules": {"eqeqeq": "error"}}',
    },
    tool_output: {},
  });
  const r = configProtect.run(input);
  assert(r.exitCode === 0);
  assert(r.stderr && r.stderr.includes('WARN'));
});

test('passes non-config file', () => {
  const input = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: '/project/src/App.java', content: 'class App {}' },
    tool_output: {},
  });
  const r = configProtect.run(input);
  assert(r.exitCode === 0);
  assert(!r.stderr);
});

// ─── pre-write-doku-config ────────────────────────────────────────────────
console.log('\npre-write-doku-config');
const preWrite = require('../scripts/hooks/pre-write-doku-config');

// Fixture helper for the credential-file guard: create a temp file with the
// specified content and return its path.
const fs = require('fs');
const os = require('os');
function makeConfigFixture(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'doku-codegen-test-'));
  const file = path.join(dir, 'doku-codegen.local.md');
  if (content !== null) fs.writeFileSync(file, content);
  return file;
}

test('allows non-destructive write to local.md (no existing creds)', () => {
  const file = makeConfigFixture(null); // file does not exist
  const input = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: file, content: '---\nLANGUAGE: Java\n---' },
    tool_output: {},
  });
  const r = preWrite.run(input);
  assert(r.exitCode === 0, `expected exit 0 (no existing file, nothing to protect), got ${r.exitCode}`);
  assert(!r.stderr, `expected no stderr, got: ${r.stderr}`);
});

test('allows non-destructive write to local.md (creds preserved)', () => {
  const file = makeConfigFixture(
    '---\nCLIENT_ID: BRN-0201-000\nSECRET_KEY: sk_live_xyz\nLANGUAGE: Java\n---\n'
  );
  const input = JSON.stringify({
    tool_name: 'Write',
    tool_input: {
      file_path: file,
      // New content still carries the credentials — allowed
      content: '---\nCLIENT_ID: BRN-0201-000\nSECRET_KEY: sk_live_xyz\nLANGUAGE: Python\n---\n',
    },
    tool_output: {},
  });
  const r = preWrite.run(input);
  assert(r.exitCode === 0, `expected exit 0 (creds preserved), got ${r.exitCode}`);
  assert(!r.stderr, `expected no stderr, got: ${r.stderr}`);
});

test('blocks credential-clearing overwrite of local.md', () => {
  const file = makeConfigFixture(
    '---\nCLIENT_ID: BRN-0201-000\nSECRET_KEY: sk_live_xyz\nLANGUAGE: Java\n---\n'
  );
  const input = JSON.stringify({
    tool_name: 'Write',
    tool_input: {
      file_path: file,
      // New content clears both credentials
      content: '---\nCLIENT_ID:\nSECRET_KEY:\nLANGUAGE: Java\n---\n',
    },
    tool_output: {},
  });
  const r = preWrite.run(input);
  assert(r.exitCode === 2, `expected exit 2 (destructive block), got ${r.exitCode}`);
  assert(r.stderr && /Blocked destructive write/.test(r.stderr), `expected block message, got: ${r.stderr}`);
});

test('warns on DokuSignatureInterceptor overwrite', () => {
  const input = JSON.stringify({
    tool_name: 'Write',
    tool_input: { file_path: '/src/DokuSignatureInterceptor.java', content: 'class X {}' },
    tool_output: {},
  });
  const r = preWrite.run(input);
  assert(r.exitCode === 0);
  assert(r.stderr && r.stderr.length > 0, `expected warning stderr, got: ${r.stderr}`);
});

// ─── session-start ────────────────────────────────────────────────────────
console.log('\nsession-start');
const sessionStart = require('../scripts/hooks/session-start');

test('passes when DOKU_HOOKS_DISABLED=1', () => {
  process.env.DOKU_HOOKS_DISABLED = '1';
  const input = JSON.stringify({ tool_name: 'SessionStart', tool_input: {}, tool_output: {} });
  const r = sessionStart.run(input);
  delete process.env.DOKU_HOOKS_DISABLED;
  assert(r.exitCode === 0);
  assert(!r.stderr);
});

test('warns when config file does not exist', () => {
  const origCwd = process.cwd;
  process.cwd = () => '/nonexistent/path/xyz';
  const input = JSON.stringify({ tool_name: 'SessionStart', tool_input: {}, tool_output: {} });
  const r = sessionStart.run(input);
  process.cwd = origCwd;
  assert(r.exitCode === 0);
  assert(r.stderr && r.stderr.includes('not configured'), `got: ${r.stderr}`);
});

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(40)}`);
console.log(`Tests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
if (failed > 0) process.exit(1);
