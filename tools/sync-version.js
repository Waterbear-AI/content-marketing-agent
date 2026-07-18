#!/usr/bin/env node
/* =============================================================================
 * sync-version.js — stamp package.json's version into README.md
 * -----------------------------------------------------------------------------
 * package.json is the single source of truth for the version. GitHub renders the
 * README as static markdown (no build step), so instead of a live badge this script
 * writes the current version into the README between two markers:
 *
 *   <!-- version:start -->`v1.0.0`<!-- version:end -->
 *
 * Run it after bumping the version:  npm run version:sync
 * Exit: 0 = README already in sync or updated; 1 = markers missing.
 * =========================================================================== */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pkg = require(path.join(root, 'package.json'));
const readmePath = path.join(root, 'README.md');

const START = '<!-- version:start -->';
const END = '<!-- version:end -->';
const block = `${START}\`v${pkg.version}\`${END}`;
const re = new RegExp(`${START}[\\s\\S]*?${END}`);

let readme = fs.readFileSync(readmePath, 'utf8');
if (!re.test(readme)) {
  console.error(`❌ version markers not found in README.md — add:\n   ${block}`);
  process.exit(1);
}

const updated = readme.replace(re, block);
if (updated === readme) {
  console.log(`✅ README already shows v${pkg.version}.`);
} else {
  fs.writeFileSync(readmePath, updated);
  console.log(`✅ README version set to v${pkg.version}.`);
}
