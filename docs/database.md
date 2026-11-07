# Data storage

The API keeps its working set in memory and persists it through one seam:
`loadDatabase()` / `saveDatabase(database)` in `backend/store.ts`. Which medium
those bytes land in is decided once, by `DATABASE_URL`.

| Driver | When | Where |
|---|---|---|
| JSON file | no `DATABASE_URL` — the default in development and tests | `backend/data/businesslife.json` |
| Postgres (Neon) | `DATABASE_URL` or `NEON_DATABASE_URL` is set | your Neon branch |

The server says which one it is using on boot:

```
storage: json file (backend/data/businesslife.json)
storage: postgres (DATABASE_URL)
```

## Why the schema looks like this

The domain is one object graph that the simulation reads and writes wholesale
(a month close touches the company, its NPCs, the city and the marketplace). The
honest mapping is therefore **one row per aggregate, the object in `jsonb`**,
with the fields that are actually queried lifted into real columns:

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

## Writes are incremental

`PostgresStore` remembers the canonical JSON of every row it has written. A save
only issues upserts for rows whose bytes changed, plus deletes for rows that
disappeared, inside one transaction in dependency order (players → companies →
npcs → classes → membership/records). A month commit that changes one company
writes **one row**; saving unchanged data writes **nothing**. This is asserted in
`verify:db`.

`canonicalJson` (keys sorted recursively) is what is compared, because `jsonb`
does not preserve key order — comparing raw strings would rewrite every row once
after each restart.

## Running it against Neon

1. Create a project and a branch at [neon.tech](https://neon.tech). Copy the
   **pooled** connection string (the host containing `-pooler`) for a Node server;
   the direct one is for migrations.
2. Put it in the environment, with TLS on:

   ```bash
   export DATABASE_URL='postgresql://USER:PASSWORD@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require'
   ```

3. Create the tables (idempotent, safe on every deploy):

   ```bash
   npm run db:migrate
   ```

4. Start the API as usual. It will print `storage: postgres (DATABASE_URL)`.

`PGPOOL_MAX` (default 8) sets the pool size. Neon's free tier allows a modest
number of connections; the pooled endpoint handles the rest.

### Proving the endpoint works

Once you have a URL, run the smoke test **from a machine that can reach Neon**
(not the sandbox this was built in):

```bash
DATABASE_URL='postgresql://…-pooler…/neondb?sslmode=require' npm run db:smoke
```

It checks the connection, that the connection is TLS, that all 12 tables exist,
the recorded schema version, then writes, reads and deletes one `app_meta` row,
printing timings. It leaves the data untouched.

### Migrations and rollback

`backend/db/schema.sql` is additive and uses `if not exists`, so running it twice
is a no-op. There is no automatic down-migration: to roll back, restore the Neon
branch (branching is the point of Neon — create a branch before a risky change
and switch `DATABASE_URL` to it).

## What is verified, and what is not

`npm run verify:db` (part of `npm run verify`) runs the schema, the store, the
upserts, the deletions and the jsonb round-trip against **a real Postgres** —
PGlite, Postgres compiled to WASM, running in the test process. It checks:

- the schema applies and every declared table exists
- a full database round-trips unchanged (including grade history and the LTI key)
- a one-row change issues one row's worth of writes; an unchanged save writes nothing
- deleting a company removes it and its NPCs, and leaves no orphan rows
- membership and grades are queryable as columns, players by email and role
- idempotency keys are unique **per player**, not globally
- the JSON driver and the Postgres driver return the same database for the same fixture

**Not verified here:** anything specific to a live Neon endpoint — TLS handshake,
pooled connection behaviour, cold-start latency, branch switching, or network
failure modes. This sandbox has no route to `*.neon.tech`, so the first real
deployment should be smoke-tested (`curl $API/api/health`, then sign in and commit
a month) with the driver line in the boot log as the confirmation.
