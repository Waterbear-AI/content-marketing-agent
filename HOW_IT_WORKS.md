# How it works

The technical companion to the [README](README.md). Read it if you're curious about the moving
parts. The tool runs perfectly well if you never do.

## Which agents does this work with?

Any coding agent that can read and edit local files and run shell commands in a folder. Claude Code
and Codex both work. The operating manual lives in `CLAUDE.md`, which follows Claude Code's naming
convention; `AGENTS.md` is a one-line pointer to it for agents that look for that name instead, like
Codex. Nothing in the manual assumes which agent is reading it.

The one piece specific to Claude Code is the `SessionStart` hook in `.claude/settings.json`, which
drops today's date into the session automatically. Other agents can be told the date, or read it
themselves, at the start of a session.

## Why not just use a scheduler / Notion / a spreadsheet?

Those are fine boards. What they don't do is the *making* — the ideas, the drafts, the on-voice
writing, the "have I said this before?" check. They're containers you still fill by hand. This works
the other way around: you talk in loose sentences ("draft a post about X," "what should I post this
week?"), and your agent turns that into on-brand drafts and a maintained plan. The dashboard just
shows the result. You're never the one keeping a board tidy — and you're not staring at a blank
composer either.

## Architecture

```
calendar-data.js  (truth, agent-authored)
   │
   ├──▶ content-calendar.html  (view: renders calendar-data.js, read-only except the overlay)
   │
   └──▶ server.js  (serves the dashboard + calendar-data.js; persists the overlay)
              │
              ▼
      overlay-state.json  (ephemeral UI state: per-post status, link, leads,
                            signups, and result note from the dashboard)
```

- **`calendar-data.js`** is the single source of truth: a schema-documented `window.MKT_DATA`
  object your agent reads and edits as your plan changes — every post, its pillar and goal, its
  schedule, hook, and full draft.
- **`content-calendar.html`** is a static viewer. It renders `calendar-data.js` and lets you change
  a post's status and record its results from the browser, but never writes back to
  `calendar-data.js` itself.
- **`server.js`** is a small Node HTTP server with no dependencies (standard library only, nothing to
  `npm install`). It serves the dashboard and `calendar-data.js`, and exposes `GET`/`PUT /api/state`
  so the dashboard can save the overlay. It binds to `127.0.0.1` only — your own machine, not the
  network — so there's no login to worry about.
- **`overlay-state.json`** holds only the overlay: the per-post status and results you set from the
  dashboard. It's small and git-trackable, and your agent folds it back into the plan.

Supporting pieces: `start.sh` / `stop.sh` / `package.json` run the server in the background
(`npm start` / `npm stop` / `npm run logs`) and auto-restart it if `server.js` itself ever changes.
`tools/validate-data.js` is a schema and integrity check for `calendar-data.js` that catches a stray
comma or a bad value before it silently breaks the dashboard.

## What's in here

| File | What it is |
|------|------------|
| `calendar-data.js` | Source of truth for your content plan (schema documented at the top of the file) |
| `content-calendar.html` | The dashboard you open in a browser |
| `server.js` | Local server: serves the dashboard + persists the overlay |
| `start.sh` / `stop.sh` / `package.json` | `npm start` / `npm stop` / `npm run logs` |
| `overlay-state.json` | Ephemeral dashboard UI state (per-post status, link, leads, signups, result) |
| `CLAUDE.md` | The operating manual; read it to see exactly how your agent behaves |
| `AGENTS.md` | One-line pointer to `CLAUDE.md`, for agents that look for this filename |
| `brand-voice.md` | Your positioning, audience, voice, do/don't — filled during onboarding |
| `offerings.md` | The products/services your content promotes — filled during onboarding |
| `content-roadmap.md` | The active plan: goals, phases, cadence, weekly template |
| `content-playbook.md` | Reusable, channel-agnostic craft: hooks, formats, funnel, anti-slop |
| `content-log.md` | What's been posted + results (read every session to avoid repeats) |
| `content-pipeline.md` | The rated backlog of post ideas |
| `MEMORY.md` | Durable cross-topic facts your agent accumulates over time |
| `journal.md` | Append-only session log |
| `tools/validate-data.js` | Integrity check for `calendar-data.js`, run before committing |
| `tools/package.sh` | Builds a clean, git-free `content-marketing-agent.zip` (`npm run package`) |
| `tools/sync-version.js` | Stamps `package.json`'s version into the README (`npm run version:sync`) |
| `.claude/settings.json` | Claude Code SessionStart hook that injects today's date |
| `.claude/launch.json` | Claude Code dev-server launch config (for editor preview tooling) |

## How you get it: a downloaded zip

The Quickstart tells your agent to **download a zip** of this repo instead of running `git clone`.
There's a reason. A clone leaves behind a `.git` directory still wired to the public template repo,
one you can't push to and wouldn't want holding your private drafts. The zip gives you a clean folder
with no git history in it. GitHub builds that zip automatically for any public repo
(`.../archive/refs/heads/main.zip`), so no build step is involved. If you'd rather cut one yourself
from a specific commit, `tools/package.sh` does it via `npm run package`.

## Privacy details

Your real marketing data ends up in a handful of files: `calendar-data.js`, the reference files,
`MEMORY.md`, `journal.md`, and `overlay-state.json`. Since you downloaded a zip and have no `.git`,
none of it is tracked or synced anywhere by default. For most people that's the right setup and the
end of the story.

If you do want history or a backup, make your own **private** git repo. That's up to you, and the
tool runs fine without one. The rule of thumb stays simple: keep your filled-in copy off anything
public. And if your agent ever finds itself in a git workspace pointed at a public remote, it's told
to stop and flag that before it writes any real data. The privacy section of `CLAUDE.md` has the
specifics.
