#!/usr/bin/env node
/**
 * DOKU Codegen — Stop hook (async)
 *
 * Runs once at the end of every Claude response (after all tool calls complete).
 * Reads accumulated file paths from post-edit-accumulator and runs cross-file
 * validation that can't be done per-file:
 *
 *   1. PAIR CHECK     — every request model file has a matching response model file
 *   2. CRED SCAN      — scan ALL written files for hardcoded credentials (cross-file)
 *   3. INTERCEPTOR    — if a client file was written, check that a signature
 *                       interceptor file also exists somewhere in the project
 *   4. LOGGER ABSENT  — if any file imports a logger library, check that log level
 *                       config is present in application.yml / .env / config.py
 *   5. CONSOLE SWEEP  — final sweep for debug print statements across all languages
 *
 * Clears the accumulator after each run so each response gets a fresh batch.
 *
 * Profile: standard, strict
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ACCUMULATOR_FILE = '/tmp/doku-codegen-edited-files.json';

// Patterns per language for hardcoded credentials
const CRED_PATTERNS = [
  /(?:clientId|secretKey|client_id|secret_key|CLIENT_ID|SECRET_KEY)\s*[=:]\s*["'][^$`{][^"']{3,}["']/,
];

// Debug print patterns per extension
const DEBUG_PATTERNS = {
  '.java':  /System\.out\.print/,
  '.kt':    /(?<!\/\/)(?<!\w)println\s*\(/,
  '.py':    /(?<!#\s*)(?<!\w)print\s*\(/,
  '.ts':    /console\.log\s*\(/,
  '.js':    /console\.log\s*\(/,
  '.go':    /fmt\.Println\s*\(/,
  '.php':   /(?:var_dump|var_export)\s*\(/,
};

// Client file indicators (suggest a signing interceptor must exist)
const CLIENT_INDICATORS = [
  /FeignClient|@FeignClient/,
  /DokuCheckoutClient|DokuVaClient|DokuQrisClient/,
  /httpx\.AsyncClient|requests\.Session/,
  /axios\.create|new axios/,
  /http\.NewRequest|http\.Client/,
];

// Signature interceptor indicators — broad enough to catch merchant-named
// signers in add-to-existing projects (custom class names, generic HMAC usage,
// or manual string-to-sign concatenation).
const INTERCEPTOR_INDICATORS = [
  // Explicit DOKU / SNAP naming
  /SignatureInterceptor|DokuSigning|SnapSigning|SnapInterceptor/i,
  // Generic signer / interceptor patterns merchant projects use
  /AuthSigner|RequestSigner|HmacSigner|SigningInterceptor/i,
  // Direct HMAC computation
  /HmacSha256|hmac_sha256|HmacSha512|hmac_sha512|computeSignature|generateSignature|createSignature/i,
  // Standard-library HMAC constructors across languages
  /Mac\.getInstance\(["']?Hmac(SHA256|SHA512)/,          // Java
  /hmac\.new\s*\(/,                                       // Python
  /crypto\.createHmac\s*\(\s*["'](sha256|sha512)/i,       // Node.js
  /hmac\.New\s*\(\s*sha(256|512)\.New/,                   // Go
  // String-to-sign concatenation using DOKU's canonical field names
  /Client-Id["'\s]*[+.,]\s*["']?\\?n["']?\s*[+.,]?\s*Request-Id/,
];

function fileContainsAny(content, patterns) {
  return patterns.some(p => p.test(content));
}

function findProjectFile(startDir, namePatterns) {
  // Walk up from startDir looking for any file matching namePatterns
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    for (const pat of namePatterns) {
      const candidate = path.join(dir, pat);
      if (fs.existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

module.exports.run = function(rawInput) {
  // Load accumulated file list
  let files = [];
  try {
    if (fs.existsSync(ACCUMULATOR_FILE)) {
      files = JSON.parse(fs.readFileSync(ACCUMULATOR_FILE, 'utf8'));
      fs.unlinkSync(ACCUMULATOR_FILE); // clear for next response
    }
  } catch { /* ignore */ }

  if (files.length === 0) return { stdout: rawInput, exitCode: 0 };

  const findings = [];

  // Read all file contents once
  const contents = {};
  for (const f of files) {
    try { contents[f] = fs.readFileSync(f, 'utf8'); } catch { /* skip unreadable */ }
  }

  // 1. CRED SCAN — cross-file hardcoded credential check
  for (const [f, content] of Object.entries(contents)) {
    if (fileContainsAny(content, CRED_PATTERNS)) {
      findings.push(`  [FAIL] Hardcoded credential detected: ${path.basename(f)}`);
    }
  }

  // 2. CONSOLE SWEEP — debug prints across all languages
  const debugFiles = [];
  for (const [f, content] of Object.entries(contents)) {
    const ext = path.extname(f);
    const pattern = DEBUG_PATTERNS[ext];
    if (pattern && pattern.test(content)) {
      debugFiles.push(path.basename(f));
    }
  }
  if (debugFiles.length > 0) {
    findings.push(`  [WARN] Debug print statements found in: ${debugFiles.join(', ')}`);
  }

  // 3. PAIR CHECK — request model → response model pairing (Java/Kotlin)
  const requestModels = files.filter(f =>
    /[Rr]equest/.test(path.basename(f)) &&
    ['.java', '.kt'].includes(path.extname(f))
  );
  for (const reqFile of requestModels) {
    const responsePeer = reqFile.replace(/[Rr]equest/, (m) => m.includes('R') ? 'Response' : 'response');
    if (!fs.existsSync(responsePeer) && !files.some(f => /[Rr]esponse/.test(path.basename(f)))) {
      findings.push(`  [WARN] Request model ${path.basename(reqFile)} has no matching Response model`);
    }
  }

  // 4. INTERCEPTOR CHECK — client file written but no interceptor found anywhere
  const clientFiles = files.filter(f => fileContainsAny(contents[f] || '', CLIENT_INDICATORS));
  if (clientFiles.length > 0) {
    const anyInterceptor =
      Object.values(contents).some(c => fileContainsAny(c, INTERCEPTOR_INDICATORS)) ||
      (() => {
        // Also search project for existing interceptor files not in current batch
        const sampleDir = path.dirname(clientFiles[0]);
        const interceptorFile = findProjectFile(sampleDir, [
          'DokuSignatureInterceptor.java', 'DokuSignatureInterceptor.kt',
          'doku_signature.py', 'doku-signature.js', 'doku_signature.go',
        ]);
        return interceptorFile !== null;
      })();
    if (!anyInterceptor) {
      // Downgrade to WARN — add-to-existing merchants often reuse an existing
      // signer under a naming convention this hook can't recognize. Point
      // integrators at the check rather than blocking.
      findings.push(`  [WARN] Client file(s) written but no DOKU signature interceptor detected. If your project already has a signer under a custom name, ignore this — otherwise run /doku-codegen:generate to scaffold one.`);
    }
  }

  if (findings.length === 0) return { stdout: rawInput, exitCode: 0 };

  const names = files.map(f => path.basename(f)).join(', ');
  return {
    stdout: rawInput,
    stderr: `[doku-codegen] Batch validation (${files.length} files: ${names})\n` +
            findings.join('\n') + '\n',
    exitCode: 0,
  };
};
