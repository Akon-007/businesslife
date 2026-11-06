# What you need to run BUSINESSLIFE for real

Everything a human has to supply — accounts, keys, DNS, decisions, content — to move this repo from
"runs on a laptop with a JSON file and a dev login" to a deployed product. Nothing here is a code change
I can make on my own; §12 lists what I *can* build with zero external accounts.

**Current reality check.** Today the app needs no external service at all: the API writes
`backend/data/*.json`, sessions are issued by a dev-login shortcut, there is no outbound email, Nova falls
back to deterministic text when no AI key is set, and exports are assembled in memory. Everything below is
what changes that.

---

## 1. Decisions to make first (they change everything else)

| # | Decision | Options | Why it matters |
|---|---|---|---|
| D1 | **Where the data lives** | Managed Postgres (Neon / Supabase / RDS), or self-hosted Postgres on a VPS | Replaces the JSON file store; decides backup, migration and region story |
| D2 | **Data residency / regulator** | Nigeria only (NDPA 2023), EU learners (GDPR), US institutions (FERPA), or "whatever is cheapest" | Picks the region and the paperwork. Lagos → `af-south-1` (Cape Town) or `eu-west-1` are the usual picks |
| D3 | **Who is the customer** | Individual learners, universities/cohorts, corporates | Decides whether you need LTI + SSO + roster import (§8) or just email auth |
| D4 | **Auth: build or buy** | Keep the current scrypt/session code and add email flows; or move to a hosted IdP (Better Auth / Clerk / Auth0 / Supabase Auth) | Buying costs money but removes recovery, MFA, SSO and account-enumeration work |
| D5 | **Currency & markets** | NGN only (today), or multi-currency | Multi-currency touches the whole money layer; single currency is a much smaller job |
| D6 | **AI provider & data policy** | OpenAI / Anthropic / OpenRouter / self-hosted; and: may learner text leave your infrastructure? | Sets the contract with the provider, the retention policy, and whether transcripts can be stored |
| D7 | **Commercial layer** | Free/teaching tool, per-seat licences, institution contracts | Only then do you need payments, entitlements and invoicing |
| D8 | **Environments** | Single prod, or dev → staging → prod | Staging needs its own database, keys and mail domain so a test run never emails a real student |

---

## 2. Accounts and keys — the checklist

Each row is something you create and hand over as a secret. Cost notes are current best estimates and
should be re-checked at signup.

| Area | Service (suggested) | What to create | Env / config it fills | Cost |
|---|---|---|---|---|
| **Database** | Neon, Supabase, RDS Postgres, or your own | Database + role, pooled connection string, read replica (optional) | `DATABASE_URL`, `DATABASE_POOL_URL` | Neon free: 100 CU-hours + ~1 GB per project, scales to zero; Launch billing beyond that |
| **DB migrations** | — | Nothing external; needs your approval of the tool | `drizzle`/`knex`/SQL migrations | — |
| **Transactional email** | **Resend** | API key, a **verified sending domain**, from-address, reply-to, webhook signing secret | `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`, `RESEND_WEBHOOK_SECRET` | Free: 3,000 emails/mo, 100/day, 3 domains; Pro $20/50k; Scale $90/100k |
| **Email DNS** | your domain registrar / DNS host | SPF, DKIM (2 records), DMARC, optional custom MAIL FROM subdomain | DNS only | free |
| **Session signing** | — | A 32+ byte random secret, rotated per environment | `SESSION_SECRET` | free |
| **Admin/instructor** | — | Long random instructor code and admin key, stored in the secrets manager | `INSTRUCTOR_CODE`, `ADMIN_KEY` | free |
| **Frontend hosting** | Vercel / Netlify / Cloudflare Pages / static + CDN | Project, custom domain, preview deployments | build env `VITE_API_URL` | free–low |
| **Backend hosting** | Railway / Render / Fly.io / Hetzner VPS / Docker anywhere | Service, region, health check, autoscaling policy | `PORT`, `HOST`, `NODE_ENV=production` | ~$5–25/mo entry |
| **Object storage** (optional) | S3 / Cloudflare R2 | Bucket + keys for PDF/CSV exports, data-room documents, avatars | `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | R2 free tier is generous |
| **Queue / cron** (optional) | Upstash Redis, or a Postgres-backed queue | Redis URL; a scheduler for retries and digests | `REDIS_URL` | free tier |
| **AI provider** | OpenAI / Anthropic / OpenRouter / vLLM | API key, model name, base URL, spend cap | `AI_PROVIDER=openai-compatible`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` | usage-based; set a hard cap |
| **Error tracking** | Sentry | DSN for frontend and backend | `SENTRY_DSN`, `VITE_SENTRY_DSN` | free tier |
| **Product analytics** (optional) | PostHog / Plausible | Project key | `VITE_POSTHOG_KEY` | free tier |
| **Uptime / status** | BetterStack / UptimeRobot | Monitor for `/api/health`, status page | — | free tier |
| **Secrets management** | Doppler / AWS Secrets Manager / 1Password | One vault per environment; nothing in the repo | — | free–low |
| **SSO** (if institutions) | Google Workspace / Microsoft Entra / WorkOS | OAuth client id + secret, or SAML metadata | `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | free (Google/Entra) |
| **LMS / LTI 1.3** (if universities) | Canvas / Moodle / Blackboard at the customer | Tool registration: issuer, client_id, deployment_id, JWKS URL, your public key | `LTI_*` | free, but needs the institution |
| **Payments** (only if D7 = paid) | Paystack or Flutterwave (NGN), Stripe (global) | Merchant account, price/product IDs, webhook secret | `PAYSTACK_SECRET_KEY`, `PAYSTACK_WEBHOOK_SECRET` | % per transaction |
| **Browser QA** (to close the visual-QA gap) | GitHub Actions + Playwright, or BrowserStack | Nothing if CI runs Playwright; a key if you rent devices | `BROWSERSTACK_KEY` | free in CI / paid for device cloud |
| **Domain** | registrar you already control | `app.`, `api.`, `docs.`, `status.`, plus a `send.` subdomain for Resend | — | ~$10–15/yr |

---

## 3. Database specifics (beyond "get a URL")

- **Pooling.** Serverless hosts (Vercel/Netlify functions, Neon) need a pooled connection string
  (`?pgbouncer=true` for Supabase, `-pooler` host for Neon) or you will exhaust connections at ~20 users.
- **Schema, not blobs.** The JSON store holds players, companies, classrooms, sessions, commits, rubric
  grades, audit-chain entries and (the big one) **decision journals up to 5,000 ops each**. Those need real
  tables, with journals as `jsonb` plus a row-size cap and an index on `(company_id, month)`.
- **Append-only audit chain.** The hash chain must live in a table that only gets inserts — no updates, no
  deletes, and no `ON DELETE CASCADE` from companies, or the tamper-evidence is decorative.
- **Migrations.** A migration directory committed to the repo and run on deploy; the first one is the
  export of the current JSON shape, so existing local saves can be imported.
- **Backups.** Daily automated backups **plus** point-in-time recovery (7–30 days). Neon's free tier gives
  ~6 hours of restore history — not enough for a graded cohort; budget for Launch/Scale.
- **Retention.** Decide how long journals, AI transcripts and graded runs are kept; the schema needs the
  timestamps to enforce it.
- **Region.** Lagos users → `af-south-1` or `eu-west-1`. Put the API in the same region as the database.

---

## 4. Email (Resend) — what "wired up" means

Resend is a good fit: simple HTTP API, free tier covers a pilot. What it needs from you:

1. **A domain you own**, with Resend's **DKIM** records, an **SPF** record, and a **DMARC** policy
   (start at `p=none`, move to `quarantine` once you're sure).
2. **A from-address and reply-to** (e.g. `hello@yourdomain.com`, `support@yourdomain.com`).
3. **A webhook endpoint** with its signing secret — bounce and complaint events must delete/mark addresses,
   or your domain reputation dies the first time a school imports a stale roster.
4. **Templates you approve**: verify email, password reset, magic-link sign-in, cohort invite, weekly
   digest, grade-published notice. I can write the HTML; you supply tone and copy.
5. **A daily-cap plan.** Free tier caps at 100/day. A class of 120 signing up on a Monday will hit it — either
   move to Pro ($20) or queue emails and send over 24h.

Emails the product needs: **address verification, password recovery, cohort invites, grade-published
notices, and (optional) weekly progress digests.**

---

## 5. Hosting and network

- **Frontend**: static build, CDN, TLS, preview URLs per PR. Needs `VITE_API_URL` pointing at the API origin.
- **Backend**: Node 22+, persistent process (not a serverless function that times out at 10s — the replay
  route re-executes months of simulation), health check on `/api/health`, log drain to your aggregator.
- **CORS**: today it is pinned to `127.0.0.1:5173`. Production needs an explicit allowlist of your real
  origins (`https://app.example.com`, previews), driven by an env var.
- **TLS + HSTS**, and a **WAF / edge rate limiting** (Cloudflare in front is the cheapest way to get both).
- **Domains**: `app.` (UI), `api.` (backend), `docs.` (README/AUDIT rendered), `status.` (uptime page),
  and the `send.` subdomain Resend uses for bounce handling.

---

## 6. Security posture you are signing off on

Fixing these is code I can write, but you own the choices:

| Item | Today | Needed before real learners |
|---|---|---|
| Admin key | defaults to `dev-admin` | long random secret per environment, rotated on staff change |
| Dev login | allowed unless `NODE_ENV=production` | `NODE_ENV=production` + `ALLOW_DEV_LOGIN` unset in prod |
| Passwords | scrypt, salted, timing-safe compare | + recovery, verification, MFA (TOTP) for instructors/admins |
| Rate limiting | per-email sign-in throttle only | edge/IP limits on auth, AI and replay endpoints |
| Audit log | student commit hash chain | + privileged-action log (grading, resets, role changes, exports) |
| RBAC | `learner / instructor / admin` | institution-admin, facilitator, observer; permission gates on high-impact actions |
| Data at rest | plaintext JSON file | encrypted database volume + encrypted backups |
| PII | email + name | retention policy, export/delete-on-request flow, DPA list |

---

## 7. Compliance and legal inputs

- **Nigeria (NDPA 2023)** — if you host Nigerian learners' data: lawful basis, privacy notice, data
  subject request handling, breach notification, and a named DPO contact.
- **EU/UK (GDPR)** — if EU learners enrol: DPA, lawful basis, cookie consent, data residency choice.
- **US institutions (FERPA)** — if sold to schools: "school official" agreement, no re-disclosure, access
  controls on education records.
- **Under-18 learners** — most business-school cohorts are adults, but if you target secondary schools you
  need parental consent and a stricter AI data policy.
- **Processor list** to name in the privacy notice: database host, mail (Resend), AI provider, error
  tracking, analytics, CDN.
- **Licences already fine**: Space Grotesk, Inter and JetBrains Mono are OFL — self-hosted, no attribution
  burden beyond the licence file.

---

## 8. Institution features (only if D3 includes schools)

- **LTI 1.3** registration in Canvas/Moodle/Blackboard: issuer, client_id, deployment_id, JWKS, and a
  public/private keypair you generate and store; plus deep-linking and **grade passback** to the LMS.
- **SSO**: Google Workspace or Microsoft Entra app registration per institution (or SAML through WorkOS).
- **Roster import**: your CSV column spec (student id, name, email, cohort), plus the rule for what happens
  when a student already has an account.
- **Term/calendar config**: cohort start, deadline policy, late-submission rule.
- **Grade export format**: the current CSV columns are documented; tell me if your registrar needs a
  different shape (e.g. percentage instead of score, or per-competency columns).

---

## 9. Content and brand assets from you

| Item | Why |
|---|---|
| Logo (SVG + PNG), favicon set, OG/social image | Landing page, app shell, link previews |
| Final brand palette confirmation | Tokens follow the brief today; any change is a one-file edit |
| Support inbox + incident contact | Footer, error states, status page |
| Tone-of-voice note for Nova and the crisis copy | Currently written in a neutral coaching voice |
| Parameters for the 4 missing industries (manufacturing, agriculture, healthcare, education) | Each needs margin, seasonality, customer noun, supplier pool, crisis set |
| Competency wording for the 6 weighted competencies | The rubric today is 4 criteria; the brief wants 25/20/15/15/15/10 weights |
| Scenario pack outline (which decisions, what deadline, learning objective) | Needed for data-driven scenarios and instructor packs |
| AI character briefs (customer, supplier, investor, regulator) + what they may never say | Drives prompts, guardrails and the dialogue UI |

---

## 10. QA infrastructure (to close the current honesty gap)

The only real blocker on "we have not looked at it in a browser" is infrastructure:

- **Playwright + browsers in CI** — GitHub Actions can run Chromium headless; that gives screenshots,
  keyboard walkthroughs and `axe-core` scans on every PR.
- **Lighthouse CI** with budgets (performance, a11y, best-practices).
- Optional: **BrowserStack/Sauce** key for real iOS/Android checks.
- A **staging environment with seeded data** so visual diffs are stable.

With that in place I can finally claim visual QA instead of only "server-rendered without throwing".

---

## 11. Recommended sequence

1. **Now, zero dependency** — finish product depth (supplier payment runs, marketing centre, sales funnel,
   operations), all testable locally (§12).
2. **Database slice** — Postgres schema + migrations + import from JSON; keep the JSON store as a
   `--local` fallback so the demo still runs with no services.
3. **Auth slice** — Resend + verification + recovery + MFA for staff; then rate limiting and CORS allowlist.
4. **Deploy slice** — frontend + API + managed Postgres + secrets manager + Sentry + uptime; staging first.
5. **Institution slice** — RBAC, roster import, CSV/PDF exports, cohort comparison; then SSO, then LTI.
6. **AI slice** — provider key, spend caps, transcript retention, guardrail review, character dialogue UI.
7. **Scale slice** — queue, background jobs, multiplayer/realtime (needs Redis + websockets), observability.

---

## 12. What I can build with none of the above

No accounts, no keys, no decisions required — all local and testable today:

- Supplier **payment runs** (pay now / pay all / negotiate terms) — closes the last §16.2 finance partial.
- **Marketing centre**: channels, campaigns, attribution, CAC/LTV/ROAS.
- **Sales funnel**: lead capture, qualification scoring, quotes, contracts.
- **Operations**: purchase orders, lead times, delivery, capacity scheduling, returns.
- **PDF export** of the month report and run-end scorecard (generated in-process).
- **Data-driven scenarios** + instructor scenario packs on top of the existing crisis/seed framework.
- **6-competency rubric** with configurable weights, plus judgement-vs-outcome separation.
- **Character dialogue UI** — the endpoint and guardrails already exist, nothing calls them yet.
- **Playwright + axe** test scaffolding (runs the moment CI has a browser).

---

## 13. Environment variable reference

**In use today**

| Var | Used by | Notes |
|---|---|---|
| `PORT`, `HOST` | API | default `8787` / `127.0.0.1` |
| `NODE_ENV` | API | `production` disables the dev-login bypass |
| `ALLOW_DEV_LOGIN` | API | explicit override for demo deployments |
| `INSTRUCTOR_CODE` | API | instructor access code |
| `ADMIN_KEY` | API | admin endpoints — **must change in prod** |
| `AI_PROVIDER`, `AI_BASE_URL`, `AI_MODEL`, `AI_API_KEY` | API | Nova; deterministic fallback when unset |
| `DEV_PORT`, `API_PROXY_TARGET` | dev server | local only |

**Needed for a real deployment (proposed names)**

`DATABASE_URL`, `DATABASE_POOL_URL`, `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`,
`RESEND_WEBHOOK_SECRET`, `SESSION_SECRET`, `CORS_ORIGINS`, `VITE_API_URL`, `SENTRY_DSN`,
`VITE_SENTRY_DSN`, `S3_*` (if exports/documents), `REDIS_URL` (if queues/multiplayer),
`OIDC_*` (if SSO), `LTI_*` (if LMS), `PAYSTACK_*` (if paid), `BROWSERSTACK_KEY` (if device cloud).

---

## 14. Cost sketch for a pilot (30–60 learners)

| Item | Monthly |
|---|---|
| Managed Postgres (Neon Launch / Supabase Pro) | $0–25 |
| API host (Railway/Render/Fly small instance) | $5–20 |
| Frontend CDN | $0 |
| Resend | $0–20 |
| AI provider (30 learners × a few hundred messages) | $10–50, cap it |
| Sentry / uptime / analytics | $0 |
| Domain (annualised) | ~$1 |
| **Total** | **≈ $20–120/month** |

Everything above is substitution-friendly: any Postgres, any SMTP/API mail provider, any object store.
