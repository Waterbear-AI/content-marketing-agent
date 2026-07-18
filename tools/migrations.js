/* =============================================================================
 * migrations.js — ordered data migrations, run by tools/migrate.js
 * -----------------------------------------------------------------------------
 * Each entry upgrades the data from version (to - 1) to version `to`. migrate.js reads
 * the user's current meta.schemaVersion, then applies every step with a higher `to`, in
 * order, until the data reaches tools/schema.js SCHEMA_VERSION.
 *
 * A step is a PURE function of the whole data set:
 *
 *   {
 *     to: 2,
 *     describe: "one line shown to the user during migration",
 *     migrate({ data, overlay }) {
 *       // data    = the parsed window.MKT_DATA object (meta / phases / posts)
 *       // overlay = the parsed overlay-state.json object ({ [postId]: {...} })
 *       // ...transform in place or rebuild...
 *       return { data, overlay };   // return whichever you changed (both is fine)
 *     },
 *   }
 *
 * Rules:
 *   • Never destroy data you can convert — reshape it. migrate.js backs up first, but a
 *     migration that drops fields silently is still a data-loss bug.
 *   • Don't set meta.schemaVersion yourself — migrate.js stamps it after each step.
 *   • Keep steps forward-only and deterministic. No network, no clocks, no randomness.
 *
 * There are no migrations yet — v1 is the baseline shape. The first schema change adds
 * the first `{ to: 2, ... }` entry here (and bumps SCHEMA_VERSION in schema.js).
 * =========================================================================== */

module.exports = [
  // Example — the shape a real step takes (kept commented; not applied):
  //
  // {
  //   to: 2,
  //   describe: "rename overlay 'calls'/'betas' fields to 'leads'/'signups'",
  //   migrate({ data, overlay }) {
  //     for (const id of Object.keys(overlay)) {
  //       const o = overlay[id];
  //       if ('calls' in o) { o.leads = o.calls; delete o.calls; }
  //       if ('betas' in o) { o.signups = o.betas; delete o.betas; }
  //     }
  //     return { data, overlay };
  //   },
  // },
];
