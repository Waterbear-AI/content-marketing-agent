# Content Roadmap — the active plan

Your agent reads this first for "what should I post" and "where are we." **Ships as a
skeleton — onboarding fills it in.** Keep the **Current status** line current as the plan moves.

**Current status:** TODO — not yet onboarded. (After onboarding: which phase you're in and the
next highest-leverage post.)

---

## Goals, ranked
Most content serves one of three levers. Rank them and note the effort split — this decides the
weekly mix. (Mirror the split into `meta.split` in `calendar-data.js`.)

1. **TODO — Convert** (leads / sales / signups) — the money goal.
2. **TODO — Grow** (followers / subscribers / list) — the audience goal.
3. **TODO — Authority** (trust that makes 1 and 2 easier).

> Effort split: TODO — e.g. "~60% authority while the audience is small, 40% convert."

## Channel & cadence
- **Primary channel:** TODO — e.g. LinkedIn, X, a newsletter, YouTube. The methodology in
  `content-playbook.md` is channel-agnostic; adapt formats to where you post.
- **Cadence:** TODO — how many posts/week you can *sustain*. Consistency beats volume.
- **Theme days (optional):** assign a pillar to a day so drafting is a fill-in-the-blank, not a
  blank page. e.g. Mon = educate, Wed = point of view, Fri = product/proof. Retune as goals shift.

## Phases
A content push usually moves through phases. Adjust to your situation; keep them in
`calendar-data.js`'s `phases[]` so the dashboard roadmap renders them.

- **Phase 0 — Foundation.** Fix the profile/bio, publish an anchor post, build a short
  warm-outreach list. Do the destination before driving traffic to it.
- **Phase 1 — Warm up + authority.** Rebuild reach with useful, opinionated posts. Soft CTAs.
- **Phase 2 — Convert.** Clear CTAs — offer/product invitations plus proof. Outreach intensifies.
- **Phase 3 — Sustain + optimize.** Double down on what actually drove the ranked goal; add
  case-study / testimonial posts as results come in.

## Default weekly template
Tune days to when your audience is active. Balance the mix toward your top-ranked goal without
running two hard CTAs of the same type back-to-back.

| Day | Pillar / Format | Serves | CTA |
|---|---|---|---|
| **TODO** | Educate / teardown | Authority | Soft / none |
| **TODO** | Point of view / thesis | Reach + authority | None |
| **TODO** | Product or proof | Convert / grow | One clear ask |
| **+1 (rotating)** | Story / personal / engagement | Trust + reach | None |

## Two tracks (optional but effective)
- **Track 1 — Content (air cover):** builds authority and warms the audience; generates inbound.
- **Track 2 — Direct outreach (the fast path):** personalized 1:1 messages to people who fit,
  and follow-up with anyone who engages. This is often where near-term conversions actually come
  from. Set a weekly target in `meta.outreachWeeklyTarget`; log outcomes in `content-log.md`.

## Success metrics (track in content-log.md)
Vanity → real, in priority order for *your* ranked goals:
1. TODO — the #1 KPI (e.g. signups, calls booked, sales).
2. TODO — the #2 KPI (e.g. new subscribers).
3. Meaningful comments / DMs from people who fit the audience.
4. Impressions & profile views (leading indicators only).

Weekly review: which pillar/format/hook produced #1 and #2? Do more of that; cut what only got likes.
