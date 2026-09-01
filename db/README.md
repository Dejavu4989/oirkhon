# Database

Postgres backs **accounts, sessions and subscriptions**. The daily game itself
does not need it — puzzles, ranks and the lexicon are served from
`data/web/export.json.gz`, and play state lives in `data/web/state.json` until
the plays/guesses tables are wired up (roadmap §11 step 3).

With no `DATABASE_URL` the app still runs: the game works anonymously and the
sign-in page says accounts are disabled.

## Setup

```powershell
# 1. create the database (as a superuser)
createdb -U postgres oirkhon

# 2. apply migrations, in order
psql -U postgres -d oirkhon -f db/migrations/001_init.sql
psql -U postgres -d oirkhon -f db/migrations/002_auth.sql

# 3. point the web app at it
#    web/.env.local
#    DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/oirkhon
```

Passwords containing `@` `:` `/` must be percent-encoded in the URL
(`@` becomes `%40`).

> **Windows:** set `$env:PGCLIENTENCODING = "UTF8"` before running `psql`.
> The console defaults to WIN1252, and `001_init.sql` seeds a Cyrillic row —
> without it psql aborts partway and you end up with a half-applied schema.
> A correct run leaves 15 tables; check with:
>
> ```powershell
> psql -U postgres -d oirkhon -tAc "select count(*) from information_schema.tables where table_schema='public';"
> ```

## Migrations

| File | Contents |
|---|---|
| `001_init.sql` | Platform schema: users, sessions, subscriptions, payments, games, lemmas, word_forms, puzzles, puzzle_ranks, plays, guesses, hints, unknown_words |
| `002_auth.sql` | Sign-in columns on `users` (password_hash, google_sub, avatar_url, is_subscribed, subscription_expires_at), the `auth_sessions` table, and the `active_subscribers` view |

Both are idempotent — re-running them is safe.

## Subscriptions

A user counts as subscribed when `is_subscribed` is true **and** the term has
not lapsed; `subscription_expires_at IS NULL` means a lifetime plan. Until QPay
is wired up (roadmap §11 step 7), grant one by hand:

```sql
UPDATE users
   SET is_subscribed = TRUE,
       subscription_expires_at = now() + interval '30 days'
 WHERE email = 'someone@example.mn';
```

Subscribers get the archive of past puzzles and 10 hints a day instead of 3.

## Tests

`web/lib/__tests__/auth.pg.test.ts` runs against a real database and is skipped
when `DATABASE_URL` is unset:

```powershell
cd web
$env:DATABASE_URL = "postgresql://postgres:PASSWORD@localhost:5432/oirkhon"
npx vitest run
```

It deletes every row in `users` and `auth_sessions` between cases, so point it
at a scratch database — never at production data.
