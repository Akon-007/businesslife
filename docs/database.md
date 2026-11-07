# Data storage

The API keeps its working set in memory and persists it through one seam:
`loadDatabase()` / `saveDatabase(database)` in `backend/store.ts`. Which medium
those bytes land in is decided once, by the environment.

| Driver | When | Where |
|---|---|---|
| JSON file | no database URL — the default in development and tests | `backend/data/businesslife.json` |
| Postgres | `SUPABASE_DB_URL`, `DATABASE_URL` or `NEON_DATABASE_URL` is set | your Supabase project (or any Postgres) |

The server says which one it is using on boot:

```
storage: json file (backend/data/businesslife.json)
storage: postgres (DATABASE_URL)
```

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com). Wait for the
   database to finish provisioning.
2. **Project → Settings → Database → Connection string → URI.** Pick the pooler:
   - **Transaction pooler, port 6543** — best for a serverless/edge deploy or many
     short-lived processes.
   - **Session pooler, port 5432** — best for a long-running Node server, and the
     right choice for `db:migrate` (the schema is one multi-statement transaction).
   - The **direct** connection (port 5432 on `db.<ref>.supabase.co`) is IPv6-only
     on new projects; use it only if your network supports IPv6.
3. URL-encode the password — a `@`, `#`, `:` or `/` in it otherwise breaks the
   URL (`@` → `%40`). Keep `?sslmode=require`; the driver rewrites it to
   `verify-full` (what it actually does) so `pg` stops printing its security
   warning on every connection.

4. Put it in `.env` at the repo root — the API and both `db:*` scripts load that
   file, and real environment variables still win over it:

   ```bash
   # .env — gitignored
   SUPABASE_DB_URL=postgresql://postgres.abcdefgh:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require
   ```

   Prefer exporting it by hand? `export SUPABASE_DB_URL=…` works identically.
   Never commit it: `.env` is in `.gitignore`.

5. Sanity-check the string before it touches the network — this catches the two
   usual mistakes, pasting the project URL or an API key from the page next to
   the connection string:

   ```bash
   npm run db:smoke -- --check 'postgresql://postgres.abcdefgh:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require'
   ```

6. Create the tables (idempotent, safe on every deploy):

   ```bash
   npm run db:migrate
   ```

7. Prove it, from a machine that can reach Supabase:

   ```bash
   npm run db:smoke
   ```

   It prints the host, user, database and pooler mode it detected, warns about a
   missing `sslmode` or a migration aimed at port 6543, checks TLS, the 12 tables,
   the schema version, **whether the `anon` role can read anything**, and does a
   write/read/delete with timings. If the tables do not exist yet it says so and
   tells you to run `db:migrate`., checks TLS, the 12 tables, the schema
   version, **whether the `anon` role can read anything**, and does a
   write/read/delete with timings.

8. Start the API. The boot log must say `storage: postgres (DATABASE_URL)`.
   Then `npm run dev` for the UI: nothing in the frontend talks to Supabase —
   the browser only ever calls `/api` on the API, so no key reaches the bundle.

You do **not** need the anon key or the service-role key: the API talks to
Postgres directly with the project's database user. The REST/JS clients are not
used.

## Exposure: why the schema touches RLS

Supabase serves the `public` schema over PostgREST to the `anon` and
`authenticated` roles. Tables created there are therefore reachable by anyone
holding the project's anon key unless they are protected. `backend/db/schema.sql`
ends with a block that, for every table:

- enables **row level security** (no policies — deny everything except the owner), and
- **revokes** all privileges from `anon` and `authenticated`, when those roles exist.

On a plain Postgres the roles do not exist and only RLS is enabled. `verify:db`
asserts RLS is on, and `npm run db:smoke` asserts on the live project that the
`anon` role cannot select from any table. If you add a table, add it to that block.

Tokens live in `sessions` and the LTI private key in `lti_keys`: treat a leak of
the anon key as harmless by construction, not by hope.

## Why the schema looks like this

The domain is one object graph that the simulation reads and writes wholesale (a
month close touches the company, its NPCs, the city and the marketplace). The
honest mapping is **one row per aggregate, the object in `jsonb`**, with the fields
that are actually queried lifted into real columns:

| Table | Row | Key columns |
|---|---|---|
| `players` | one player | `id`, generated `account_email`, `role` |
| `sessions` | one session | `token`, `player_id`, `expires_at` |
| `companies` | one company | `id`, `player_id`, `sector`, `status` |
| `classes` | one cohort (without members/records) | `id`, `lecturer_id`, `name` |
| `class_students` | one membership | `(class_id, student_id)` |
| `classroom_records` | one graded record, grade history inside | `(class_id, student_id)`, `grade` |
| `npcs` | one NPC | `id`, `company_id` |
| `idempotency` | one request key | `(player_id, key)` |
| `city_state`, `marketplace_state` | singletons | `id = 'default'` |
| `lti_keys` | the LTI signing key | `kid` |
| `app_meta` | schema version | `key` |

That buys the queries that matter — player by email, sessions by token and
expiry, companies by owner, cohort membership, grades — without pretending a
document store is a normalised schema.

## Writes, pooling and transactions

**One connection per transaction.** `pool.query()` may use a *different* backend
connection for each call, so `BEGIN` on one connection and `COMMIT` on another is
a silent bug that works perfectly against a single-connection database and breaks
under Supavisor or PgBouncer. `PostgresStore` therefore leases a client for the
whole save (`pool.connect()` → run → `release()`), releases it on the error path
too, and **serialises saves** so two transactions can never interleave. All three
are asserted in `verify:db` with a fake pool that hands out distinct connections.

**Incremental writes.** The driver remembers the canonical JSON of every row it
has written (`canonicalJson`, keys sorted — `jsonb` does not preserve key order)
and a save touches only changed rows, then prunes removed ones. A month commit
that changes one company writes one row; an unchanged save writes nothing.

**No session state.** In transaction mode a connection is not yours between
statements, so the driver never uses `SET` at session scope: the statement timeout
is `SET LOCAL` inside the transaction (`DB_STATEMENT_TIMEOUT_MS`, default 20s).
There are no named prepared statements, which transaction mode could not reuse.

**Sensible pool defaults.** `PGPOOL_MAX` (default 8), 10s connect timeout, 30s
idle timeout, `application_name=businesslife-api` so the client shows up in
Supabase's connection logs.

## What is verified, and what is not

`npm run verify:db` (part of `npm run verify`) runs the schema and the store
against **a real Postgres** — PGlite, Postgres compiled to WASM, in-process. It
checks (31 checks):

- the schema applies, every declared table exists, and RLS is enabled on the
  tables that hold personal data
- a full database round-trips unchanged (grade history and the LTI key included)
- a one-row change writes one row; an unchanged save writes nothing
- deleting a company removes its NPCs and leaves no orphans
- membership and grades are queryable as columns; players by email and role
- idempotency keys are unique **per player**, not globally
- a transaction runs on exactly one leased connection, is bracketed by
  `BEGIN`/`COMMIT`, releases the lease once, rolls back and releases on failure,
  and overlapping saves never interleave
- the JSON and Postgres drivers return the same database for the same fixture

**Not verified:** anything specific to a live Supabase endpoint — the TLS
handshake with their certificate, Supavisor's behaviour under load, cold starts,
IPv6-only direct connections, or PITR/backups. This sandbox has no route to
`*.supabase.co`, which is exactly why `npm run db:smoke` exists: run it once on
the real project and paste the output back.

## Operations

- **Backups** — Supabase takes daily backups on paid plans and offers PITR; for a
  course, that is the safety net. Nothing in this app keeps its own copy.
- **Staging** — use a second Supabase project (or Supabase branching, where
  available) and point `SUPABASE_DB_URL` at it. Migrations are idempotent.
- **Migrations and rollback** — `backend/db/schema.sql` is additive; there is no
  down-migration. Roll forward, or restore from a backup/branch.
- **Monitoring** — `GET /api/health`, plus Supabase's own connection and query
  metrics. The API logs `storage: postgres` on boot and one readable line when the
  database is unreachable.

## Neon (still supported)

Neon is the same Postgres protocol: set `NEON_DATABASE_URL` (or `DATABASE_URL`) to
the **pooled** connection string containing `-pooler` and keep `?sslmode=require`.
`npm run db:migrate` and `npm run db:smoke` work unchanged; the smoke test simply
skips the Supabase-specific checks.
