#!/usr/bin/env node
/* =============================================================================
 * update.js — manually pull a newer version of this tool over your install
 * -----------------------------------------------------------------------------
 * Installs are plain folders with no git link back to the source repo, so there's no
 * `git pull`. This script fetches a newer version (a GitHub zip by default, or a local
 * directory/zip via --source), and applies it over your install WITHOUT touching your
 * data. Two things make that safe:
 *
 *   • default-preserve — only files listed in update-manifest.json's `code` array are
 *     ever overwritten. Anything not listed (calendar-data.js, overlay-state.json,
 *     MEMORY.md, journal.md, brand-voice.md, offerings.md, content-roadmap.md,
 *     content-pipeline.md, content-log.md, content-playbook.md, .claude/settings.json,
 *     .compounds/, .backups/, ...) is left alone, even if the manifest itself is stale
 *     or wrong.
 *   • backup-first — the ENTIRE install is snapshotted to .backups/<timestamp>/ before
 *     anything is overwritten, so a bad update can always be undone by hand.
 *
 * After the code is replaced, it delegates to tools/migrate.js (upgrade the data shape,
 * if needed) and tools/validate-data.js (confirm the result is well-formed), then
 * restarts the server if it was running.
 *
 * Usage:
 *   node tools/update.js                          fetch the latest release and apply it
 *   node tools/update.js --dry-run                 report the plan; write nothing
 *   node tools/update.js --force                   re-apply even if not newer
 *   node tools/update.js --source <dir|zip|url>    use a specific source instead of the
 *                                                   default GitHub main-branch zip
 *
 * MANUAL ONLY — nothing in server.js/start.sh/the startup path calls this or checks for
 * updates on its own. It runs only when you (or your agent, on your behalf) invoke it.
 * =========================================================================== */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const DEFAULT_SOURCE_URL = 'https://github.com/Waterbear-AI/content-marketing-agent/archive/refs/heads/main.zip';
// Never swept into the whole-install backup — either not "install" state (git/temp
// artifacts, node_modules) or explicitly out of scope for update.js (.compounds/,
// previous .backups/ snapshots).
const EXCLUDE_FROM_BACKUP = ['.git', '.compounds', '.backups', 'node_modules'];

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry-run');
const FORCE = argv.includes('--force');
const sourceIdx = argv.indexOf('--source');
const SOURCE_ARG = sourceIdx !== -1 ? argv[sourceIdx + 1] : null;

const log = (...a) => console.log(...a);

// ---- version compare (plain major.minor.patch integers) ---------------------
function parseVersion(v) {
  const parts = String(v).split('.').map((n) => parseInt(n, 10) || 0);
  return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
}
function isNewer(a, b) {
  const [a1, a2, a3] = parseVersion(a);
  const [b1, b2, b3] = parseVersion(b);
  if (a1 !== b1) return a1 > b1;
  if (a2 !== b2) return a2 > b2;
  return a3 > b3;
}
function readVersion(dir) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) throw new Error(`no package.json found in ${dir}`);
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  if (!pkg.version) throw new Error(`package.json in ${dir} has no version`);
  return pkg.version;
}

// ---- resolve + fetch the source ---------------------------------------------
// Returns { newDir, tempRoot, source }. tempRoot is a scratch dir to remove afterward
// (null when the source was already a local directory — nothing was downloaded).
function fetchLatest() {
  const source = SOURCE_ARG || DEFAULT_SOURCE_URL;

  // A local directory — use it directly, nothing to fetch or unpack.
  if (fs.existsSync(source) && fs.statSync(source).isDirectory()) {
    return { newDir: path.resolve(source), tempRoot: null, source };
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mkt-update-'));
  let zipPath;

  if (fs.existsSync(source) && fs.statSync(source).isFile() && source.endsWith('.zip')) {
    zipPath = path.resolve(source);
  } else {
    // Treat anything else as a URL.
    zipPath = path.join(tempRoot, 'src.zip');
    log(`Fetching ${source} ...`);
    execFileSync('curl', ['-fsSL', source, '-o', zipPath], { stdio: 'inherit' });
  }

  const unpackDir = path.join(tempRoot, 'unpacked');
  fs.mkdirSync(unpackDir, { recursive: true });
  execFileSync('unzip', ['-q', zipPath, '-d', unpackDir]);

  // GitHub's archive zip wraps everything in one top-level dir (e.g.
  // content-marketing-agent-main/) — detect and descend into it (flatten).
  let newDir = unpackDir;
  const entries = fs.readdirSync(unpackDir);
  if (entries.length === 1 && fs.statSync(path.join(unpackDir, entries[0])).isDirectory()) {
    newDir = path.join(unpackDir, entries[0]);
  }

  return { newDir, tempRoot, source };
}

// ---- the code allowlist -------------------------------------------------------
// Prefer the INCOMING version's manifest (it best knows what it wants updated); fall
// back to the installed one if the new version doesn't ship one.
function loadManifest(newDir) {
  const incoming = path.join(newDir, 'update-manifest.json');
  const chosen = fs.existsSync(incoming) ? incoming : path.join(root, 'update-manifest.json');
  return JSON.parse(fs.readFileSync(chosen, 'utf8'));
}
function walkFiles(dirAbs, newDir, out) {
  for (const name of fs.readdirSync(dirAbs)) {
    const abs = path.join(dirAbs, name);
    if (fs.statSync(abs).isDirectory()) walkFiles(abs, newDir, out);
    else out.push(path.relative(newDir, abs));
  }
}
function expandManifestPaths(manifest, newDir) {
  const files = [];
  for (const entry of manifest.code) {
    if (entry.endsWith('/*')) {
      const dirAbs = path.join(newDir, entry.slice(0, -2));
      if (fs.existsSync(dirAbs)) walkFiles(dirAbs, newDir, files);
    } else {
      files.push(entry);
    }
  }
  return files;
}

// ---- backup (the whole install, not just calendar-data.js/overlay) ----------
function backupInstall() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(root, '.backups', stamp);
  fs.mkdirSync(dir, { recursive: true });
  fs.cpSync(root, dir, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(root, src);
      if (rel === '') return true;
      return !EXCLUDE_FROM_BACKUP.includes(rel.split(path.sep)[0]);
    },
  });
  return path.relative(root, dir);
}

// ---- apply only the manifest's code paths, never anything else --------------
function applyCode(newDir, relPaths) {
  const updated = [];
  const missing = [];
  for (const rel of relPaths) {
    const src = path.join(newDir, rel);
    if (!fs.existsSync(src)) { missing.push(rel); continue; }
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    updated.push(rel);
  }
  return { updated, missing };
}

// ---- delegate to the other tools, rather than importing them ----------------
function runMigrate() {
  const res = spawnSync(process.execPath, [path.join(root, 'tools', 'migrate.js')], { cwd: root, stdio: 'inherit' });
  return res.status === 0;
}
function runValidate() {
  const res = spawnSync(process.execPath, [path.join(root, 'tools', 'validate-data.js')], { cwd: root, stdio: 'inherit' });
  return res.status === 0;
}

// ---- restart the server, but only if it was already running -----------------
function runningServerPid() {
  const pidPath = path.join(root, 'server.pid');
  if (!fs.existsSync(pidPath)) return null;
  const pid = parseInt(fs.readFileSync(pidPath, 'utf8').trim(), 10);
  if (!pid) return null;
  try { process.kill(pid, 0); return pid; } catch { return null; }
}
function restartIfRunning() {
  const pid = runningServerPid();
  if (!pid) return 'not running — skipped';
  log(`\nRestarting server (was pid ${pid}) ...`);
  spawnSync(path.join(root, 'stop.sh'), [], { cwd: root, stdio: 'inherit' });
  spawnSync(path.join(root, 'start.sh'), [], { cwd: root, stdio: 'inherit' });
  return runningServerPid() ? 'restarted' : 'restart FAILED — start it manually with `npm start`';
}

function report(s) {
  log(`\n=============================================`);
  log(`Update summary: v${s.from} → v${s.to}`);
  log(`Files updated:  ${s.filesUpdated}`);
  log(`Backup:         ${s.backupDir}/`);
  log(`Migrate:        ${s.migrateOk ? 'ok' : 'FAILED — see output above'}`);
  log(`Validate:       ${s.validateOk ? 'ok' : 'FAILED — see output above'}`);
  log(`Server restart: ${s.restartStatus}`);
  log(`=============================================\n`);
}

// ---- run ----------------------------------------------------------------------
let tempRoot = null;
let backupDir = null;
try {
  const installedVersion = readVersion(root);
  log(`Installed version: v${installedVersion}`);

  const fetched = fetchLatest();
  tempRoot = fetched.tempRoot;
  const { newDir, source } = fetched;
  const newVersion = readVersion(newDir);
  log(`Source: ${source}`);
  log(`Available version: v${newVersion}`);

  if (!FORCE && !isNewer(newVersion, installedVersion)) {
    log(`\n✅ Already current (v${installedVersion}). Nothing to update.\n`);
    process.exit(0);
  }

  const manifest = loadManifest(newDir);
  const relPaths = expandManifestPaths(manifest, newDir);

  if (DRY) {
    log(`\n--- DRY RUN — no changes will be made ---`);
    log(`Would back up the full install to .backups/<timestamp>/`);
    log(`Would overwrite ${relPaths.length} file(s):`);
    relPaths.forEach((p) => log(`   • ${p}`));
    log(`Would run: node tools/migrate.js`);
    log(`Would run: node tools/validate-data.js`);
    log(`Would restart the server if it's currently running.\n`);
    process.exit(0);
  }

  backupDir = backupInstall();
  log(`\nBacked up current install to ${backupDir}/`);

  const { updated, missing } = applyCode(newDir, relPaths);
  log(`Updated ${updated.length} file(s).`);
  if (missing.length) log(`Note: ${missing.length} manifest path(s) not present in the new version — skipped: ${missing.join(', ')}`);

  log(`\nRunning migrate ...`);
  const migrateOk = runMigrate();
  log(`\nRunning validate ...`);
  const validateOk = runValidate();

  const restartStatus = restartIfRunning();

  report({
    from: installedVersion,
    to: newVersion,
    filesUpdated: updated.length,
    migrateOk,
    validateOk,
    restartStatus,
    backupDir,
  });

  process.exit(migrateOk && validateOk ? 0 : 1);
} catch (e) {
  console.error(`\n❌ Update failed: ${e.message}`);
  if (backupDir) console.error(`   Your previous install was backed up to ${backupDir}/ before this step — restore from there if needed.`);
  console.error('');
  process.exit(1);
} finally {
  if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
}
