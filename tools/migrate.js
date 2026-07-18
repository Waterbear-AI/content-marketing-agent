#!/usr/bin/env node
/* =============================================================================
 * migrate.js — upgrade the user's data to the current schema version
 * -----------------------------------------------------------------------------
 * The data files (calendar-data.js, overlay-state.json) have a shape that evolves as the
 * app grows. Each shape is tagged by meta.schemaVersion. This script reads that version,
 * applies every step in tools/migrations.js needed to reach the version the current code
 * understands (tools/schema.js SCHEMA_VERSION), and writes the files back.
 *
 * Usage:
 *   node tools/migrate.js            apply pending migrations (backs up first)
 *   node tools/migrate.js --dry-run  report what would happen; write nothing
 *
 * Safe to run anytime:
 *   • If the data is already current, it's a no-op.
 *   • Before writing, it snapshots calendar-data.js + overlay-state.json into
 *     .backups/<timestamp>/ — the safety net, since installs usually have no git.
 *   • It refuses to run if the data is NEWER than the code (you updated data, not code).
 *
 * Run `node tools/validate-data.js` afterward to confirm the result is well-formed.
 * =========================================================================== */

const fs = require('fs');
const path = require('path');
const { SCHEMA_VERSION } = require('./schema');
const migrations = require('./migrations');

const root = path.join(__dirname, '..');
const DATA_PATH = path.resolve(root, 'calendar-data.js');
const OVERLAY_PATH = path.resolve(root, 'overlay-state.json');

const DRY = process.argv.includes('--dry-run');
const log = (...a) => console.log(...a);

// ---- load calendar-data.js (stub window, like validate-data.js) -------------
function loadData() {
  global.window = {};
  delete require.cache[require.resolve(DATA_PATH)];
  require(DATA_PATH);
  const d = global.window.MKT_DATA;
  if (!d || typeof d !== 'object') throw new Error('window.MKT_DATA is missing or not an object');
  if (!d.meta || typeof d.meta !== 'object') throw new Error('meta is missing');
  return d;
}
function loadOverlay() {
  if (!fs.existsSync(OVERLAY_PATH)) return { existed: false, data: {} };
  const txt = fs.readFileSync(OVERLAY_PATH, 'utf8').trim();
  return { existed: true, data: txt ? JSON.parse(txt) : {} };
}

// ---- write calendar-data.js: keep the existing header comment verbatim -------
// The file is `<header comment>\nwindow.MKT_DATA = {...};`. We preserve the header (it's
// documentation, owned by the code side) and re-emit only the data object. NOTE: the data
// block is emitted as pretty JSON — valid JS, but a multi-line `draft` becomes one escaped
// line. Migrations are rare and backed up, and the agent reformats on its next edit; swap
// in a richer serializer here if that churn ever matters.
function writeData(data) {
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  // Anchor on the ASSIGNMENT (a line starting with `window.MKT_DATA =`), not any mention of
  // the token — the header comment references "window.MKT_DATA" in prose, and a plain
  // indexOf would split the file mid-comment and corrupt it.
  const m = raw.match(/^window\.MKT_DATA\s*=/m);
  if (!m) throw new Error('could not find the `window.MKT_DATA =` assignment in calendar-data.js');
  const header = raw.slice(0, m.index);
  fs.writeFileSync(DATA_PATH, `${header}window.MKT_DATA = ${JSON.stringify(data, null, 2)};\n`);
}

// ---- backup -----------------------------------------------------------------
function backup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(root, '.backups', stamp);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(DATA_PATH, path.join(dir, 'calendar-data.js'));
  if (fs.existsSync(OVERLAY_PATH)) fs.copyFileSync(OVERLAY_PATH, path.join(dir, 'overlay-state.json'));
  return path.relative(root, dir);
}

// ---- run --------------------------------------------------------------------
try {
  const data = loadData();
  const overlayLoad = loadOverlay();
  let overlay = overlayLoad.data;

  const stamped = data.meta.schemaVersion != null;
  const from = stamped ? data.meta.schemaVersion : 1; // unstamped data is baseline v1

  if (typeof from !== 'number' || !Number.isInteger(from) || from < 1) {
    console.error(`\n❌ meta.schemaVersion must be a positive integer (got ${JSON.stringify(data.meta.schemaVersion)}).\n`);
    process.exit(1);
  }
  if (from > SCHEMA_VERSION) {
    console.error(`\n❌ Data is at schemaVersion ${from}, newer than this code (${SCHEMA_VERSION}).\n   Update the app before migrating — an older codebase can't downgrade data.\n`);
    process.exit(1);
  }

  const pending = migrations.filter(m => m.to > from).sort((a, b) => a.to - b.to);

  // Already current AND already stamped → nothing to do.
  if (pending.length === 0 && stamped && from === SCHEMA_VERSION) {
    log(`\n✅ Data already at schemaVersion ${from} (latest). Nothing to migrate.\n`);
    process.exit(0);
  }

  log(`\nData schemaVersion: ${stamped ? from : `unstamped (treated as ${from})`}`);
  log(`Code SCHEMA_VERSION: ${SCHEMA_VERSION}`);
  if (pending.length) {
    log(`\nPending migrations:`);
    pending.forEach(m => log(`   • → v${m.to}: ${m.describe}`));
  } else {
    log(`\nNo structural migrations pending — will stamp schemaVersion ${SCHEMA_VERSION}.`);
  }

  if (DRY) { log(`\n(dry run — no files written)\n`); process.exit(0); }

  const backupDir = backup();
  log(`\nBacked up current data to ${backupDir}/`);

  let d = data;
  for (const m of pending) {
    const out = m.migrate({ data: d, overlay }) || {};
    if (out.data) d = out.data;
    if (out.overlay) overlay = out.overlay;
    d.meta.schemaVersion = m.to;
    log(`   applied → v${m.to}`);
  }
  d.meta.schemaVersion = SCHEMA_VERSION;

  writeData(d);
  // Only touch the overlay file if it already existed or a migration produced entries —
  // don't materialize an empty overlay on installs that never opened the dashboard.
  if (overlayLoad.existed || Object.keys(overlay).length) {
    fs.writeFileSync(OVERLAY_PATH, `${JSON.stringify(overlay, null, 2)}\n`);
  }

  log(`\n✅ Migrated to schemaVersion ${SCHEMA_VERSION}. Run 'node tools/validate-data.js' to confirm.\n`);
  process.exit(0);
} catch (e) {
  console.error(`\n❌ Migration failed (data left untouched unless a backup line printed above): ${e.message}\n`);
  process.exit(1);
}
