-- BUSINESSLIFE schema — Postgres 15+ (Supabase, Neon, or any Postgres).
--
-- Shape: one row per aggregate, the domain object in `jsonb`, and the columns
-- that are actually queried lifted out as real columns with indexes. That keeps
-- the existing in-memory `Database` as the source of truth while making the
-- stored data addressable by SQL (find a player by email, a session by token, a
-- company by owner) instead of "load the whole document and search it".
--
-- Migrations are idempotent: `npm run db:migrate` can run on every deploy.

create table if not exists players (
  id          text primary key,
  account_email text generated always as (lower(coalesce(data->>'accountEmail', ''))) stored,
  role        text not null default 'learner',
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
create index if not exists players_email_idx on players (account_email);
create index if not exists players_role_idx on players (role);

create table if not exists sessions (
  token       text primary key,
  player_id   text not null references players (id) on delete cascade,
  expires_at  timestamptz not null,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
create index if not exists sessions_player_idx on sessions (player_id);
create index if not exists sessions_expiry_idx on sessions (expires_at);

create table if not exists companies (
  id          text primary key,
  player_id   text not null references players (id) on delete cascade,
  sector      text not null default '',
  status      text not null default 'active',
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
create index if not exists companies_player_idx on companies (player_id);
create index if not exists companies_sector_idx on companies (sector);

create table if not exists classes (
  id          text primary key,
  lecturer_id text not null references players (id) on delete cascade,
  name        text not null default '',
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
create index if not exists classes_lecturer_idx on classes (lecturer_id);

-- Cohort membership is a join table, so "which cohorts is this student in" is a
-- query rather than a scan of every class document.
create table if not exists class_students (
  class_id    text not null references classes (id) on delete cascade,
  student_id  text not null references players (id) on delete cascade,
  primary key (class_id, student_id)
);
create index if not exists class_students_student_idx on class_students (student_id);

-- One row per graded record, with the grade history in the document. Instructors
-- query these directly (`verify:api`, the roster, the comparison).
create table if not exists classroom_records (
  class_id    text not null references classes (id) on delete cascade,
  student_id  text not null references players (id) on delete cascade,
  grade       integer,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  primary key (class_id, student_id)
);

create table if not exists npcs (
  id          text primary key,
  company_id  text not null references companies (id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);
create index if not exists npcs_company_idx on npcs (company_id);

create table if not exists idempotency (
  player_id   text not null,
  key         text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  primary key (player_id, key)
);

-- Singleton documents.
create table if not exists city_state (
  id          text primary key default 'default',
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

create table if not exists marketplace_state (
  id          text primary key default 'default',
  data        jsonb not null,
  updated_at  timestamptz not null default now()
);

-- LTI signing key. Private key material lives here and only here; the public
-- half is served from /api/lti/jwks.
create table if not exists lti_keys (
  kid         text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now()
);

create table if not exists app_meta (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

insert into app_meta (key, value) values ('schema_version', '{"version": 1}'::jsonb)
  on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- Exposure control (Supabase, and any Postgres with a REST layer in front).
--
-- Supabase serves the `public` schema over PostgREST to the `anon` and
-- `authenticated` roles. This application talks to Postgres directly with the
-- project's database user, so those roles have no business reading players,
-- sessions or grades. Row level security with no policies denies everyone except
-- the owner, and the grants are revoked as well — belt and braces, because RLS
-- can be disabled by a future migration but a missing grant does not come back.
--
-- On a plain Postgres (no such roles) the block simply enables RLS.
-- ---------------------------------------------------------------------------
do $$
declare
  target text;
  restricted text[] := array[
    'players', 'sessions', 'companies', 'classes', 'class_students',
    'classroom_records', 'npcs', 'idempotency', 'city_state',
    'marketplace_state', 'lti_keys', 'app_meta'
  ];
  has_anon boolean := exists (select 1 from pg_roles where rolname = 'anon');
  has_authenticated boolean := exists (select 1 from pg_roles where rolname = 'authenticated');
begin
  foreach target in array restricted loop
    execute format('alter table %I enable row level security', target);
    if has_anon then
      execute format('revoke all on %I from anon', target);
    end if;
    if has_authenticated then
      execute format('revoke all on %I from authenticated', target);
    end if;
  end loop;
end $$;
