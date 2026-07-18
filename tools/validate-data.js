#!/usr/bin/env node
/* =============================================================================
 * validate-data.js — integrity check for calendar-data.js (the source of truth)
 * -----------------------------------------------------------------------------
 * calendar-data.js is loaded in the browser as `window.MKT_DATA = {...}`. A single
 * stray comma or a bad value breaks the dashboard SILENTLY (it just renders blank or
 * stale, with no error the user would notice). This script turns that silent failure
 * into a loud one.
 *
 * Usage:   node tools/validate-data.js [path-to-calendar-data.js]
 * Exit:    0 = OK (warnings allowed)   1 = errors found (do not commit)
 *
 * It stubs `global.window` so it can `require()` the browser file in Node.
 * No dependencies. Run it before every commit.
 * =========================================================================== */

const path = require('path');
const { SCHEMA_VERSION } = require('./schema');

const DATA_PATH = path.resolve(process.argv[2] || path.join(__dirname, '..', 'calendar-data.js'));

const TYPE     = ['post', 'task'];
const STATUS   = ['idea', 'planned', 'drafting', 'ready', 'posted'];
const RATING   = ['A', 'B', 'C'];
// These mirror the dashboard's PILLAR / GOAL maps. Unknown values still render (the
// dashboard falls back), so they're WARN, not ERROR — retune both sides together.
const PILLARS  = ['educate', 'pov', 'story', 'product', 'proof', 'engage', 'personal', 'task'];
const GOALS    = ['leads', 'signups', 'authority', 'setup'];

const errors = [];
const warns  = [];
const err  = (m) => errors.push(m);
const warn = (m) => warns.push(m);

// ISO YYYY-MM-DD, and a real calendar date (rejects 2026-13-40).
function isISO(d) {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const [y, m, day] = d.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === day;
}
function checkDate(val, where) {
  if (val == null) return;
  if (!isISO(val)) err(`${where}: "${val}" is not a valid ISO date (YYYY-MM-DD)`);
}
function checkEnum(val, allowed, where, { required = true } = {}) {
  if (val == null) { if (required) err(`${where}: missing (expected one of ${allowed.join('|')})`); return; }
  if (!allowed.includes(val)) err(`${where}: "${val}" not in ${allowed.join('|')}`);
}

// ---- Load (catches syntax errors — the stray-comma case) --------------------
let D;
try {
  global.window = {};
  delete require.cache[DATA_PATH];
  require(DATA_PATH);
  D = global.window.MKT_DATA;
} catch (e) {
  console.error(`\n❌ calendar-data.js failed to parse — the dashboard would render blank.\n   ${e.message}\n`);
  process.exit(1);
}

if (!D || typeof D !== 'object') { console.error('\n❌ window.MKT_DATA is missing or not an object.\n'); process.exit(1); }

// ---- meta -------------------------------------------------------------------
if (!D.meta || typeof D.meta !== 'object') err('meta: missing');
else {
  const sv = D.meta.schemaVersion;
  if (sv == null) warn(`meta.schemaVersion: missing — run 'node tools/migrate.js' to stamp it (assumed 1).`);
  else if (typeof sv !== 'number' || !Number.isInteger(sv) || sv < 1) err('meta.schemaVersion: must be a positive integer');
  else if (sv < SCHEMA_VERSION) warn(`meta.schemaVersion is ${sv} but this code expects ${SCHEMA_VERSION} — run 'node tools/migrate.js' to upgrade.`);
  else if (sv > SCHEMA_VERSION) warn(`meta.schemaVersion is ${sv}, newer than this code (${SCHEMA_VERSION}) — update the app.`);
  if (!D.meta.owner) warn('meta.owner: missing (dashboard header will be blank)');
  checkDate(D.meta.updated, 'meta.updated');
  checkDate(D.meta.sprintStart, 'meta.sprintStart');
  checkDate(D.meta.sprintEnd, 'meta.sprintEnd');
  if (isISO(D.meta.sprintStart) && isISO(D.meta.sprintEnd) && D.meta.sprintEnd < D.meta.sprintStart)
    err(`meta: sprintEnd (${D.meta.sprintEnd}) is before sprintStart (${D.meta.sprintStart})`);
  if (D.meta.outreachWeeklyTarget != null && typeof D.meta.outreachWeeklyTarget !== 'number')
    err('meta.outreachWeeklyTarget: must be a number');
  if (D.meta.template === true)
    warn('meta.template is still true — this is the un-onboarded template; run onboarding (see CLAUDE.md).');
}

// ---- phases -----------------------------------------------------------------
const phaseIds = new Set();
if (D.phases != null && !Array.isArray(D.phases)) err('phases: must be an array');
(D.phases || []).forEach((ph, i) => {
  const tag = `phases[${i}]${ph && ph.id ? ` (${ph.id})` : ''}`;
  if (ph.id == null || ph.id === '') err(`${tag}: missing id`);
  else if (phaseIds.has(String(ph.id))) err(`${tag}: duplicate id "${ph.id}"`);
  else phaseIds.add(String(ph.id));
  if (!ph.name) err(`${tag}: missing name`);
  if (!ph.goal) warn(`${tag}: missing goal`);
});
if (D.meta && D.meta.currentPhase != null && phaseIds.size && !phaseIds.has(String(D.meta.currentPhase)))
  err(`meta.currentPhase "${D.meta.currentPhase}" does not match any phase id`);

// ---- posts ------------------------------------------------------------------
if (!Array.isArray(D.posts)) { console.error('\n❌ MKT_DATA.posts is not an array.\n'); process.exit(1); }

const ids = new Set();
D.posts.forEach((p, i) => {
  const tag = `posts[${i}]${p && p.id ? ` (${p.id})` : ''}`;

  if (!p.id) err(`${tag}: missing id`);
  else if (ids.has(p.id)) err(`${tag}: duplicate id "${p.id}"`);
  else ids.add(p.id);

  if (!p.title) err(`${tag}: missing title`);

  checkEnum(p.type, TYPE, `${tag}.type`);
  checkEnum(p.status, STATUS, `${tag}.status`);
  if (p.rating != null) checkEnum(p.rating, RATING, `${tag}.rating`, { required: false });

  if (p.pillar == null || p.pillar === '') err(`${tag}: missing pillar`);
  else if (!PILLARS.includes(p.pillar)) warn(`${tag}.pillar: "${p.pillar}" not a known pillar (dashboard will fall back to the default style)`);

  if (p.goal == null || p.goal === '') warn(`${tag}: missing goal`);
  else if (!GOALS.includes(p.goal)) warn(`${tag}.goal: "${p.goal}" not a known goal (no goal pill will render)`);

  checkDate(p.date, `${tag}.date`);
  if (p.phase != null && phaseIds.size && !phaseIds.has(String(p.phase)))
    warn(`${tag}.phase: "${p.phase}" does not match any phase id`);

  if (p.hashtags != null) {
    if (!Array.isArray(p.hashtags)) err(`${tag}.hashtags: must be an array`);
    else p.hashtags.forEach((h, j) => { if (typeof h !== 'string') err(`${tag}.hashtags[${j}]: must be a string`); });
  }
  for (const f of ['hook', 'draft', 'cta', 'format', 'product', 'firstComment', 'note']) {
    if (p[f] != null && typeof p[f] !== 'string') err(`${tag}.${f}: must be a string`);
  }
  if (p.type === 'post' && p.status === 'ready' && !p.draft)
    warn(`${tag}: status "ready" but no draft text present`);
});

// ---- report -----------------------------------------------------------------
const n = D.posts.length;
if (warns.length) { console.log(`\n⚠  ${warns.length} warning(s):`); warns.forEach(w => console.log(`   • ${w}`)); }
if (errors.length) {
  console.error(`\n❌ ${errors.length} error(s) in calendar-data.js:`);
  errors.forEach(e => console.error(`   • ${e}`));
  console.error(`\n   Fix these before committing — the dashboard relies on calendar-data.js.\n`);
  process.exit(1);
}
console.log(`\n✅ calendar-data.js valid — ${n} item(s), ${ids.size} unique id(s), ${phaseIds.size} phase(s)${warns.length ? `, ${warns.length} warning(s)` : ''}.\n`);
process.exit(0);
