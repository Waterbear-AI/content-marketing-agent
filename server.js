#!/usr/bin/env node
'use strict';

/**
 * Local persistence server for the content-marketing dashboard.
 *
 * Serves content-calendar.html + calendar-data.js on loopback, and persists the
 * browser working-state overlay (localStorage key mkt.overlay.v1 — per-post
 * status + posted link + results notes) to a JSON file so it survives a
 * localStorage wipe and stays consistent across browsers/machines.
 *
 * Design constraints:
 *   - Zero dependencies (Node standard library only).
 *   - Binds 127.0.0.1 only — never network-exposed. No auth by design.
 *   - Atomic writes (temp file + rename), serialized in-process, so rapid
 *     toggles can't corrupt the state file.
 *   - Debounced git commit of overlay-state.json ONLY (never other files),
 *     no push, and only when the workspace is a git repo. Disable with MKT_NO_COMMIT=1.
 *
 * The overlay never touches calendar-data.js — that file stays agent-authored (the
 * content plan / source of truth). This server only reads/writes the ephemeral
 * status/results overlay layered on top of it.
 *
 * Run: `npm start` backgrounds this under `node --watch` (auto-restarts on server.js edits;
 * content-calendar.html/calendar-data.js are read fresh per-request already, no restart needed
 * for those) — logs land in server.log, pid in server.pid. `npm stop` sends SIGTERM (flushes any
 * pending overlay commit via the shutdown handler below) and cleans up the pid file. `npm run
 * logs` tails server.log. Or run `node server.js` directly for a plain foreground instance.
 * Then open http://127.0.0.1:24317/
 */

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');

// ---- configuration (secure defaults; opt-out is explicit) ----
const ROOT = __dirname;                                  // static root = repo dir
const HOST = '127.0.0.1';                                // fixed loopback; not operator-overridable
const PORT = Number(process.env.PORT) || 24317;
const STATE_FILE = process.env.STATE_FILE
  ? path.resolve(process.env.STATE_FILE)
  : path.join(ROOT, 'overlay-state.json');
const NO_COMMIT = process.env.MKT_NO_COMMIT === '1';
const COMMIT_DEBOUNCE_MS = Number(process.env.COMMIT_DEBOUNCE_MS) || 60000;

const OKEY = 'mkt.overlay.v1';
const MAX_BODY = 1_000_000;                              // 1 MB PUT body cap
const STATUS_SET = new Set(['idea', 'planned', 'drafting', 'ready', 'posted']);
// Allowlisted overlay fields. Unknown fields are dropped (not persisted);
// bad values on these fields are rejected. Keep in sync with the dashboard.
const ALLOWED_FIELDS = ['status', 'link', 'calls', 'betas', 'result'];

// Static serving: allowlist extensions, plus a basename allowlist for .js so
// that server internals (server.js) are never served.
const STATIC_EXT = new Set(['.html', '.css', '.svg', '.png', '.ico']);
const JS_ALLOWLIST = new Set(['calendar-data.js']);
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function log(msg) {
  console.log(`[mkt] ${new Date().toISOString()} ${msg}`);
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

// ---- state validation (allowlist; sanitize to known fields) ----
// Returns { ok: true, overlay } with only allowed fields, or { ok: false, error }.
function validateOverlay(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'body must be a JSON object' };
  }
  const overlay = body.overlay;
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
    return { ok: false, error: 'overlay must be an object' };
  }
  const clean = {};
  for (const [id, entry] of Object.entries(overlay)) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return { ok: false, error: `overlay["${id}"] must be an object` };
    }
    const out = {};
    for (const field of ALLOWED_FIELDS) {
      if (!(field in entry)) continue;
      const v = entry[field];
      if (field === 'status') {
        if (typeof v !== 'string' || !STATUS_SET.has(v)) {
          return { ok: false, error: `invalid status for "${id}"` };
        }
        out.status = v;
      } else if (field === 'calls' || field === 'betas') {
        // Dashboard stores raw <input type=number> values (strings) or '' when cleared.
        if (v === '' || v === null) { out[field] = ''; continue; }
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
          return { ok: false, error: `invalid ${field} for "${id}"` };
        }
        out[field] = v;
      } else { // link, result
        if (typeof v !== 'string') {
          return { ok: false, error: `${field} for "${id}" must be a string` };
        }
        out[field] = v;
      }
    }
    if (Object.keys(out).length) clean[id] = out; // drop entries left empty by the allowlist
  }
  return { ok: true, overlay: clean };
}

// ---- persistence: read + serialized atomic write ----
async function readState() {
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const overlay = parsed && typeof parsed.overlay === 'object' && !Array.isArray(parsed.overlay)
      ? parsed.overlay : {};
    return { _key: OKEY, updatedAt: parsed.updatedAt || null, overlay };
  } catch (err) {
    if (err.code === 'ENOENT') return { _key: OKEY, updatedAt: null, overlay: {} };
    // Corrupt/unreadable: degrade to empty for the client, leave the file untouched for inspection.
    log(`WARN could not read state file (${err.code || err.message}); serving empty overlay`);
    return { _key: OKEY, updatedAt: null, overlay: {} };
  }
}

let writeChain = Promise.resolve();
function writeStateAtomic(overlay) {
  const envelope = { _key: OKEY, updatedAt: new Date().toISOString(), overlay };
  const run = async () => {
    const tmp = `${STATE_FILE}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(envelope, null, 2));
    await fs.rename(tmp, STATE_FILE);
    return envelope;
  };
  // Serialize writes so concurrent PUTs can't interleave; keep the chain alive on failure.
  const result = writeChain.then(run, run);
  writeChain = result.catch(() => {});
  return result;
}

// ---- debounced git commit of the state file only (no push) ----
let commitTimer = null;
function scheduleCommit() {
  if (NO_COMMIT) return;
  if (commitTimer) clearTimeout(commitTimer);
  commitTimer = setTimeout(() => { commitTimer = null; commitNow(); }, COMMIT_DEBOUNCE_MS);
}

function git(args) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd: ROOT }, (err, stdout, stderr) => {
      resolve({ code: err ? (err.code || 1) : 0, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

// Cache whether ROOT is inside a git work tree. The default end-user setup is a zip
// download with no .git, where overlay auto-commit should quietly do nothing rather
// than log a failed `git commit` after every status change.
let gitRepoOk = null;
async function inGitRepo() {
  if (gitRepoOk !== null) return gitRepoOk;
  const res = await git(['rev-parse', '--is-inside-work-tree']);
  gitRepoOk = res.code === 0 && res.stdout.trim() === 'true';
  if (!gitRepoOk) log('not a git repo — overlay auto-commit disabled (state still saved to disk)');
  return gitRepoOk;
}

async function commitNow() {
  const rel = path.relative(ROOT, STATE_FILE);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    log('skip commit: state file is outside the repo');
    return;
  }
  if (!(await inGitRepo())) return;
  try {
    await git(['add', '--', rel]);
    const staged = await git(['diff', '--cached', '--quiet', '--', rel]);
    if (staged.code === 0) { log('nothing to commit'); return; }
    const res = await git(['commit', '-m', 'chore(dashboard): update overlay state [auto]', '--', rel]);
    if (res.code === 0) log('committed overlay state');
    else log(`commit failed: ${(res.stderr || res.stdout).split('\n')[0]}`);
  } catch (err) {
    log(`commit error: ${err.message}`);
  }
}

async function flushCommit() {
  if (NO_COMMIT || !commitTimer) return;
  clearTimeout(commitTimer);
  commitTimer = null;
  await commitNow();
}

// ---- request handlers ----
function handleGetState(res) {
  readState()
    .then((state) => sendJson(res, 200, state))
    .catch((err) => { log(`ERROR read state: ${err.message}`); sendJson(res, 500, { error: 'read_failed', message: 'Could not read state' }); });
}

function handlePutState(req, res) {
  let size = 0;
  const chunks = [];
  let aborted = false;
  req.on('data', (c) => {
    if (aborted) return;
    size += c.length;
    if (size > MAX_BODY) {
      aborted = true;
      sendJson(res, 413, { error: 'payload_too_large', message: 'State payload exceeds 1 MB' });
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on('end', () => {
    if (aborted) return;
    let body;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null');
    } catch (err) {
      sendJson(res, 400, { error: 'invalid_body', message: 'Malformed JSON' });
      return;
    }
    const v = validateOverlay(body);
    if (!v.ok) {
      sendJson(res, 400, { error: 'invalid_body', message: v.error });
      return;
    }
    writeStateAtomic(v.overlay)
      .then((env) => {
        scheduleCommit();
        const count = Object.keys(env.overlay).length;
        log(`saved ${count} ${count === 1 ? 'entry' : 'entries'}`);
        sendJson(res, 200, { ok: true, updatedAt: env.updatedAt, count });
      })
      .catch((err) => {
        log(`ERROR write state: ${err.message}`);
        sendJson(res, 500, { error: 'write_failed', message: 'Could not save state' });
      });
  });
  req.on('error', () => { /* client hangup; nothing to persist */ });
}

async function serveStatic(req, res, pathname) {
  const rel = pathname === '/' ? 'content-calendar.html' : pathname.replace(/^\/+/, '');
  const segments = rel.split('/');
  // Reject traversal and dotfiles (.git, .claude, .env, ...).
  if (segments.some((s) => s === '..' || s === '' || s.startsWith('.'))) {
    sendJson(res, 404, { error: 'not_found', message: 'Not found' });
    return;
  }
  const filePath = path.resolve(ROOT, rel);
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    sendJson(res, 403, { error: 'forbidden', message: 'Forbidden' });
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const allowed = ext === '.js'
    ? JS_ALLOWLIST.has(path.basename(filePath))
    : STATIC_EXT.has(ext);
  if (!allowed) {
    sendJson(res, 404, { error: 'not_found', message: 'Not found' });
    return;
  }
  try {
    const data = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (err) {
    sendJson(res, 404, { error: 'not_found', message: 'Not found' });
  }
}

function handler(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://${HOST}`).pathname);
  } catch (err) {
    sendJson(res, 400, { error: 'bad_request', message: 'Invalid URL' });
    return;
  }

  try {
    if (pathname === '/api/state') {
      if (req.method === 'GET') return handleGetState(res);
      if (req.method === 'PUT') return handlePutState(req, res);
      return sendJson(res, 405, { error: 'method_not_allowed', message: 'Use GET or PUT' });
    }
    if (pathname.startsWith('/api/')) {
      return sendJson(res, 404, { error: 'not_found', message: 'Unknown endpoint' });
    }
    if (req.method === 'GET' || req.method === 'HEAD') {
      return serveStatic(req, res, pathname);
    }
    return sendJson(res, 405, { error: 'method_not_allowed', message: 'Use GET' });
  } catch (err) {
    log(`ERROR unhandled: ${err.message}`);
    sendJson(res, 500, { error: 'server_error', message: 'Internal server error' });
  }
}

function main() {
  const server = http.createServer(handler);
  server.listen(PORT, HOST, () => {
    log(`serving http://${HOST}:${PORT}/  (state: ${path.relative(ROOT, STATE_FILE) || STATE_FILE}${NO_COMMIT ? ', commits off' : ', auto-commit on if git repo'})`);
  });

  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    log('shutting down; flushing pending commit…');
    server.close();
    flushCommit().finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (require.main === module) main();

module.exports = { validateOverlay, readState, writeStateAtomic };
