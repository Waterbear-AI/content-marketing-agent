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
 * Everything below is a clearly-fake worked example (persona: "Sam Rivera," a solo
 * maker) that shows the schema in use. `meta.template: true` marks it as un-onboarded.
 * On first run your agent runs an intake interview and REPLACES all of this with your
 * real brand, goals, and content — then removes the `template` flag. See CLAUDE.md.
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
    owner: "Sam Rivera",
    brand: "Indie maker of Tally",
    channel: "LinkedIn",
    updated: "2026-07-15",
    cadence: "3 posts/week — Mon educate · Wed point-of-view · Fri product or proof",
    split: "~60% authority / 40% signups",
    sprintStart: "2026-07-15",
    sprintEnd: "2026-09-08",
    currentPhase: "0",
    outreachWeeklyTarget: 5,
    template: true,
    note: "TEMPLATE — this is sample data showing the schema in use. Your agent replaces all of it during onboarding (see CLAUDE.md), then removes meta.template."
  },

  phases: [
    { id: "0", name: "Foundation",           window: "Days 1-3",  goal: "Fix the profile/bio, publish an anchor post, build a short warm-outreach list." },
    { id: "1", name: "Warm up + Authority",  window: "Weeks 1-2", goal: "Rebuild reach with useful, opinionated posts. Start soft product mentions." },
    { id: "2", name: "Convert",              window: "Weeks 3-5", goal: "Clear CTAs — offer/product invitations plus proof. Direct outreach intensifies." },
    { id: "3", name: "Sustain + Optimize",   window: "Weeks 6-8", goal: "Double down on whatever drove signups. Add case-study / testimonial posts." }
  ],

  posts: [
    // ---- Phase 0 — Foundation ----
    {
      id: "p-profile", type: "task", title: "Tighten profile/bio (do FIRST, before posting)",
      pillar: "task", goal: "setup", phase: "0", date: "2026-07-17", status: "ready", rating: null,
      hook: "Make the destination good before you drive traffic to it.",
      draft:
`Profile pass (~30 min), because your anchor post will send people here:
• Headline: who you help + how, in one line. "I help X do Y."
• Bio/About: the one-sentence version of what you make, who it's for, and the single next step.
• Featured/link: your site + one clear call-to-action (signup, waitlist, or booking link).`,
      note: "Do this before the anchor post — the post drives profile visits."
    },
    {
      id: "p-anchor", type: "post", title: "Anchor post — what I'm building and who it's for",
      pillar: "story", goal: "authority", phase: "0", date: "2026-07-17", status: "ready", rating: "A",
      format: "Story cold-open",
      hook: "A year ago I was tracking my habits in a spreadsheet and hating it. So I built the thing I wanted.",
      draft:
`A year ago I was tracking my habits in a spreadsheet and hating it.

So I built the thing I wanted: Tally. A habit tracker that takes ten seconds a day and never nags you.

I'm Sam — I make small software for people who want to change something without a life overhaul.

I'll be posting here about what I'm learning building it in the open: what works, what flops, the numbers.

If you've ever quit a habit app because it made you feel bad, tell me what went wrong. I'm listening.`,
      cta: "Soft — reply/DM: what made you quit your last habit app?",
      hashtags: ["#buildinpublic", "#indiehackers", "#habits"],
      firstComment: "Tally, if you're curious: https://example.com/tally"
    },
    {
      id: "p-warmlist", type: "task", title: "Build a warm-outreach list (15-25 people)",
      pillar: "task", goal: "setup", phase: "0", date: "2026-07-18", status: "planned", rating: null,
      note: "People who already know you and fit the audience. Personal notes, not a pitch blast."
    },

    // ---- Phase 1 — Warm up + Authority ----
    {
      id: "p-teardown-onboarding", type: "post", title: "How I cut onboarding to one screen",
      pillar: "educate", goal: "authority", phase: "1", date: "2026-07-21", status: "drafting", rating: "A",
      format: "The teardown",
      hook: "My signup flow had 4 screens. 60% of people never finished. Here's the one-screen version that fixed it.",
      note: "Concrete before/after with the real drop-off number. Ends soft — no hard CTA."
    },
    {
      id: "p-pov-streaks", type: "post", title: "Point of view — streaks are a dark pattern",
      pillar: "pov", goal: "authority", phase: "1", date: "2026-07-23", status: "idea", rating: "B",
      format: "The thesis",
      hook: "Streak counters don't build habits. They build anxiety, then guilt, then a deleted app.",
      note: "Opinionated take that doubles as positioning for Tally's no-nag design. Soft/no CTA."
    },
    {
      id: "p-product-tally", type: "post", title: "Product moment — the ten-second check-in",
      pillar: "product", goal: "signups", product: "Tally", phase: "1", date: "2026-07-25", status: "idea", rating: "A",
      format: "The product moment",
      hook: "The whole point of Tally: open it, tap, done. Ten seconds. Then it gets out of your way.",
      note: "Problem-first (habit apps demand too much), then the product as the answer. CTA: waitlist."
    },

    // ---- Phase 2 — Convert ----
    {
      id: "p-proof-numbers", type: "post", title: "Proof — 30 days of Tally, the real numbers",
      pillar: "proof", goal: "signups", product: "Tally", phase: "2", date: null, status: "idea", rating: "A",
      format: "The build log",
      hook: "30 days in: 210 signups, 41% still checking in daily. Here's what that taught me about retention.",
      note: "Only run once the numbers are real. Highest-trust content there is."
    },
    {
      id: "p-engage-question", type: "post", title: "Engagement — what habit stuck, and why?",
      pillar: "engage", goal: "authority", phase: "2", date: null, status: "idea", rating: "C",
      format: "The invitation",
      hook: "What's one habit that actually stuck for you — and what made it different from the ones that didn't?",
      note: "Community question. Harvest answers into a future educate post."
    },

    // ---- Backlog / nurture ----
    {
      id: "p-personal-why", type: "post", title: "Personal — why I quit my job to make small software",
      pillar: "personal", goal: "authority", phase: null, date: null, status: "idea", rating: "C",
      format: "The lesson",
      hook: "I left a stable job to build tiny apps almost nobody asked for. Best decision I've made.",
      note: "Humanizer. Use sparingly, tie back to a real lesson."
    }
  ]
};
