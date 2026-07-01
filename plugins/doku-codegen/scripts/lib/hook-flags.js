#!/usr/bin/env node
/**
 * DOKU Codegen — Hook enable/disable controls.
 *
 * Controls:
 *   DOKU_HOOK_PROFILE=minimal|standard|strict  (default: standard)
 *   DOKU_DISABLED_HOOKS=comma,separated,ids
 */
'use strict';

const VALID_PROFILES = new Set(['minimal', 'standard', 'strict']);

function normalizeId(value) {
  return String(value || '').trim().toLowerCase();
}

function getHookProfile() {
  const raw = String(process.env.DOKU_HOOK_PROFILE || 'standard').trim().toLowerCase();
  return VALID_PROFILES.has(raw) ? raw : 'standard';
}

function getDisabledHookIds() {
  const raw = String(process.env.DOKU_DISABLED_HOOKS || '');
  if (!raw.trim()) return new Set();
  return new Set(raw.split(',').map(v => normalizeId(v)).filter(Boolean));
}

function parseProfiles(rawProfiles, fallback = ['standard', 'strict']) {
  if (!rawProfiles) return [...fallback];
  const list = Array.isArray(rawProfiles) ? rawProfiles : String(rawProfiles).split(',');
  const parsed = list.map(v => String(v).trim().toLowerCase()).filter(v => VALID_PROFILES.has(v));
  return parsed.length > 0 ? parsed : [...fallback];
}

function isHookEnabled(hookId, options = {}) {
  const id = normalizeId(hookId);
  if (!id) return true;
  if (getDisabledHookIds().has(id)) return false;
  return parseProfiles(options.profiles).includes(getHookProfile());
}

module.exports = { VALID_PROFILES, normalizeId, getHookProfile, getDisabledHookIds, parseProfiles, isHookEnabled };
