/* =============================================================================
 * CONTENT MARKETING — SOURCE OF TRUTH
 * -----------------------------------------------------------------------------
 * This file is the single source of truth for your content plan.
 * The dashboard (content-calendar.html) reads this object and renders it. Your
 * agent (the content-marketing agent) reads + edits this file as you plan,
 * draft, schedule, and ship posts.
 *
 * Loaded into the browser as a global: window.MKT_DATA
 *
 * Your own working state — a post's status, its published link, and the
 * leads/signups/result it produced — is layered on top in the browser (and
 * persisted to overlay-state.json by the local server). That overlay NEVER edits
 * this file. So: the agent plans here, you track there, and neither overwrites
 * the other.
 *
 * ---- THIS IS A TEMPLATE ------------------------------------------------------
 * This file ships EMPTY: no phases, no posts, and a blank `meta`. `meta.template: true`
 * marks it as un-onboarded. On first run your agent runs an intake interview and fills
 * this in with your real brand, goals, and content — then removes the `template` flag.
 * The schema below documents every field; see CLAUDE.md for the onboarding flow.
 *
 * ---- SCHEMA -----------------------------------------------------------------
 * meta:
 *   owner            string   your name (shown in the dashboard header)
 *   brand            string   the brand/positioning line
 *   channel          string   primary channel (e.g. "LinkedIn", "X", "Newsletter")
 *   updated          ISO      date you last edited this file
 *   cadence          string   free-text posting rhythm
 *   split            string   free-text effort split across goals
 *   sprintStart      ISO|null start of the current push (powers "days left")
 *   sprintEnd        ISO|null end of the current push
 *   currentPhase     string   id of the active phase (see phases[])
 *   outreachWeeklyTarget number  weekly direct-outreach touches target (0 if unused)
 *   template         bool     true until onboarding replaces this sample (then delete)
 *   note             string   planning note / current status line
 *
 * phases[]: { id, name, window, goal }   // the content roadmap, in order
 *
 * posts[]:
 *   id           string   stable id (never reuse). "p-" prefix by convention.
 *   type         enum     "post" | "task"   (task = prep/outreach, not a post)
 *   title        string   internal name (not the post text)
 *   pillar       string   content pillar — must match a key in the dashboard's PILLAR
 *                         map (educate|pov|story|product|proof|engage|personal|task).
 *                         Retune those keys to your own brand-voice.md pillars.
 *   goal         string   funnel goal — matches the dashboard's GOAL map
 *                         (leads|signups|authority|setup)
 *   product      string?  which product/offer this spotlights (null if none)
 *   format       string?  playbook format label (see content-playbook.md)
 *   phase        string?  phase id this belongs to
 *   date         ISO|null scheduled day (null = backlog / unscheduled idea)
 *   status       enum     idea|planned|drafting|ready|posted  (default; the browser
 *                         overlay can override it without editing this file)
 *   rating       "A"|"B"|"C"|null   priority of the idea (see CLAUDE.md rating system)
 *   hook         string?  the opening line
 *   draft        string?  full post text (present once written)
 *   cta          string?  the single call-to-action
 *   hashtags     [string]?
 *   firstComment string?  what to drop in the first comment (e.g. links)
 *   note         string?  planning note
 * =========================================================================== */

window.MKT_DATA = {
  meta: {
    owner: "",
    brand: "",
    channel: "",
    updated: "2026-07-17",
    cadence: "",
    split: "",
    sprintStart: null,
    sprintEnd: null,
    currentPhase: null,
    outreachWeeklyTarget: 0,
    template: true,
    note: "Un-onboarded template — no content yet. On first run your agent interviews you and fills this in (see CLAUDE.md), then removes meta.template."
  },

  // Roadmap phases, in order — populated during onboarding. See the SCHEMA header.
  phases: [],

  // Every post / prep task lives here — populated as you plan. See the SCHEMA header.
  posts: []
};
