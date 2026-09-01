# AGENTS.md

## Commands

```powershell
# Run the full test suite (stdlib-only, no install needed)
$env:PYTHONUTF8 = '1'
python -m unittest discover -s pipeline/tests -t . -v

# Run a single module's tests
python -m unittest pipeline.tests.test_morphology -v
```

No linter configured yet; keep the core pipeline stdlib-only so tests run
anywhere without pip installs. Heavy deps (numpy/gensim/sentence-transformers/
psycopg2/redis) are optional imports guarded with friendly errors.

## Conventions

- Product language is Mongolian Cyrillic first; do not introduce an English
  translation layer into user-facing strings.
- All LOCKED spec decisions live in README.md — ask before deviating.
- Data artifacts under `data/` are build outputs; never commit them.
- The answer word must never appear in any client-facing payload before
  solve/give-up — this applies to future API code too.

## Current phase

Phase 1 (`/web`). The §3.6 quality gate passed on 2026-08-26 (18/20, fastText
cc.mn.300 — see meta/GATE_VERDICT.md), so Next.js/API/UI work is open.

The app currently runs off `data/web/export.json.gz` (built by
`python -m pipeline.export_web`) with file-backed play state and an in-process
rate limiter. Postgres/Redis are the next swap: `db/migrations/001_init.sql`
is written but not yet wired, and `web/lib/store.ts` / `ratelimit.ts` /
`unknown.ts` are shaped to match the `plays` / `guesses` / `hints` /
`unknown_words` tables.

```powershell
cd web
npx vitest run       # 78 tests (9 need DATABASE_URL, else skipped)
npm run dev          # reads ../data/web/export.json.gz
```

## Accounts

Postgres (`DATABASE_URL`) backs accounts, sign-in sessions and subscriptions —
see `db/README.md`. Without it the daily game still runs anonymously and the
sign-in UI reports that accounts are disabled; keep that graceful path working.

- Passwords: scrypt via `node:crypto`, parameters stored with each hash.
- Sessions: random 256-bit cookie, only its SHA-256 is stored.
- Google sign-in is optional (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`) and the
  button hides itself when unset.
- Subscribed = `is_subscribed` AND the term has not lapsed. Subscribers get the
  archive and `HINTS_SUBSCRIBER` hints instead of `HINTS_FREE`.
- Play state is filed under an *identity*: `u:<id>` when signed in, else the
  anonymous cookie. Signing in adopts the anonymous game already in progress.

## Game rules that live in code

- A **hint** reveals a real word ranked closer to the answer than anything the
  player has seen, halving the remaining distance (`floor(best / 2)`). It never
  reveals rank 1 and never leaks letters. 3 free per day; it refuses before the
  player's first guess. See `hintAction` in `web/lib/actions.ts`.
- `today` returns the answer only once the play is solved or given up, so the
  result panel and share text survive a page reload.
- Rejected guesses go to the `unknown_words` queue (`web/lib/unknown.ts`).
- Today's puzzle is free for everyone. Past puzzles are the subscriber archive;
  future puzzles must never be reachable (`pickPuzzle` in `web/lib/actions.ts`).
- Once a game is finished the answer is pinned to the top of the board, whether
  it was solved or given up.

## UI

Single dark theme; tokens in `web/app/globals.css`, mapped to Tailwind names in
`tailwind.config.ts`. The board's bar widths come from `barWidth()` in
`web/lib/game.ts` (presentation only) — `progressFill()` stays the shared value
mirrored in `pipeline/gameutil.py`.

After changing the schedule or blocklist, re-export before the app sees it:

```powershell
python -m pipeline.schedule --swap    # replace blocklisted answers only
python -m pipeline.export_web         # rebuild data/web/export.json.gz
```
