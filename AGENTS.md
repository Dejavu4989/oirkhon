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

Phase 0 (`/pipeline`). Do not start Next.js/API/UI work until the §3.6
quality gate passes and the user signs off.
