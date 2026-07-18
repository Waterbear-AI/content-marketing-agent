/* =============================================================================
 * schema.js — the data-format version the current code understands
 * -----------------------------------------------------------------------------
 * SINGLE SOURCE OF TRUTH for the data schema version. Two files read it:
 *   • validate-data.js — warns if the user's data is behind (or ahead of) the code.
 *   • migrate.js       — the target version migrations upgrade the data toward.
 *
 * This is DELIBERATELY separate from package.json's `version`:
 *   • package.json version  = the APP version (bumps every release; drives "update the code").
 *   • SCHEMA_VERSION        = the DATA-SHAPE version (bumps only when calendar-data.js /
 *                             overlay-state.json change structure; drives "migrate the data").
 *
 * When you change the shape of the data, do BOTH:
 *   1. Bump SCHEMA_VERSION below.
 *   2. Add a matching step in tools/migrations.js whose `to` equals the new number.
 * =========================================================================== */

module.exports = { SCHEMA_VERSION: 1 };
