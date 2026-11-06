# BUSINESSLIFE — The Global Business Simulator

An educational business simulation. You build a company in Meridian City, make monthly operating
decisions, and live with the consequences. The simulation is rules-based; an advisor layer explains
your numbers through a provider-agnostic AI gateway.

## Run it

```bash
npm install
npm run dev:backend   # API on 127.0.0.1:8787 (override with PORT / HOST)
npm run dev           # game on http://localhost:5173 (override with DEV_PORT / API_PROXY_TARGET)
```

Player: **/play** · Instructor portal: **/lecturer**

## Verify it

```bash
npm run verify          # everything below, in order (API must be running on 8788)
npm run verify:api      # server authority, AI guardrails, cohorts, seeds, CSV, rubric, audit chain
npm run verify:auth     # registration, sign-in, session revocation, throttling, dev-login gate
npm run verify:scoring  # client score == server score across industries/strategies/months
npm run verify:determinism  # same seed + same decisions = identical run
npm run verify:cash     # invoices move cash when they fall due, not when the sale is booked
npm run verify:statements  # P&L, balance sheet and cash flow balance and tie to cash every month
npm run verify:contrast # the design tokens clear WCAG AA for the text pairs the UI uses
npm run verify:wiring   # every path the client calls exists on the server
npm run verify:render  # the finance UI server-renders from a real game state with correct figures
npm run verify:centres # payment runs, marketing mix, attribution and unit economics + journal replay
npm run verify:replay   # the API re-executes the seed + decision journal and agrees
npm run verify:legit    # six months of honest play is never flagged as tampering
npm run build           # production build
npm run lint            # oxlint
```

GitHub Actions runs the same suite on every push and pull request
(`.github/workflows/verify.yml`): install, lint, typecheck, build, boot the API, `npm run verify`.

## Architecture notes

| Concern | Where |
|---|---|
| Monthly simulation (client engine) | `src/game/engine.ts` |
| Protected game state, bounds, tamper-evident audit chain | `backend/authority.ts` |
| AI gateway, characters, guardrails, grounding | `backend/ai.ts` |
| Cohorts, roster, CSV export | `backend/classroom.ts`, `routes` in `backend/server.ts` |
| Seeded randomness (one source of truth) | `src/game/random.ts` |
| Decision journal (`applyOp`) and replay projection | `src/game/ops.ts` |
| Supplier bills, payables, P&L / balance sheet / cash flow | `src/game/accounting.ts` |
| Finance centre (statements, invoices, bills, what-if) | `src/components/game/FinancePanel.tsx` |
| Marketing channels, attribution, CAC/LTV | `src/game/marketing.ts`, `src/components/game/MarketingPanel.tsx` |
| Sales funnel: leads, qualification, quotes, retainers | `src/game/sales.ts`, `src/components/game/SalesFunnel.tsx` |
| Frontend ↔ backend wiring matrix | `docs/wiring.md`, `scripts/verify-wiring.mjs` |
| Server-side execution of the journal | `backend/replay.ts`, `backend-dist/engine.mjs` |
| Accounts, sessions, password hashing | `backend/auth.ts` |
| Grading rubric and rationale rules | `backend/rubric.ts` (client mirror: `src/game/rubric.ts`) |
| Instructor portal | `src/pages/Lecturer.tsx` |
| External requirements (DB, email, DNS, keys, compliance) | `docs/requirements.md` |
| Design tokens, fonts, contrast gate | `src/index.css`, `scripts/verify-contrast.mjs` |

### Server authority

The simulation still runs in the browser, but the server owns the fields that matter for
assessment: **score, month, cash, customers, revenue, valuation**. Every month close commits a
snapshot (`PUT /api/companies/:id/run`), which is checked against economic plausibility bounds
(cash movement, customer growth, revenue vs price, quality/reputation drift, per-month stability),
corrected to the canonical value where it fails, and recorded in a SHA-256 hash chain
(`GET /api/companies/:id/audit`). A hand-edited browser save therefore cannot produce a forged
balance or a forged score — it produces a `flagged` commit and a corrected figure. Scores are
always recomputed server-side; the client's number is never trusted.

### The books

Revenue is booked when you sell, but only part of it reaches the bank that month. Invoices run on
industry terms (0–45 days) and are collected when due; late payers recover about 80% and the rest is
written off as bad debt. On the cost side, 45% of stock is bought on 30-day supplier terms, so it lands
as a **bill** rather than a cash payment. Bills are settled at the next month close if cash allows; if
it does not, the bill rolls over as `overdue` with a one-time 2% late fee.

Every close produces three statements, kept for 24 months and readable in the **Finance centre**
(profit & loss, balance sheet, cash flow, invoices, bills, what-if):

- **Profit & loss** — revenue − COGS = gross profit, then payroll, overhead, depreciation, spoilage, bad
  debt, late fees, other costs/income, interest → net profit.
- **Balance sheet** — cash + receivables + inventory + fixed assets = payables + debt + paid-in capital +
  retained earnings. The panel shows whether the sheet balances instead of hiding it.
- **Cash flow** — operating + investing + financing = the change in cash, and it always ends at the cash
  the engine reports.

The panel also carries a **budget vs actual** view (what you planned to spend against what the close
charged) and a **forecast** tab that repeats the last three months forward and turns them into a runway
estimate — both labelled as arithmetic on your own history rather than a model.

Capital structure moves post to the same ledger: opening a market capitalises fixed assets and counts as
capex, investor money is financing, loans and repayments are borrowing/repayment, and crisis, deal and
hiring cash are one-off operating items.

### Server-side execution

The simulation code is bundled for the API (`npm run build:engine` → `backend-dist/engine.mjs`,
built from `src/game`), so there is exactly one engine. Every state-changing player action is
recorded in an append-only journal (`src/game/ops.ts`: `advanceDay`, `setPrice`, `hireCandidate`,
`resolveCrisis`, …), and each monthly commit sends the seed, the starting profile and that journal.
The server re-runs `startGame` + the journal itself and:

- adopts **its own** figures and score, ignoring the client's reported numbers;
- compares them with the claim and records `replay: match | mismatch | error` on the company;
- adds a `replay_mismatch` violation (and flags the commit) when they disagree;
- refuses unknown operation types, out-of-range arguments and journals over 5,000 operations;
- stores the journal so an instructor can press **Replay** in the roster to re-verify at any time —
  that check is itself written to the student's audit chain.

A forged balance therefore has to be accompanied by a fabricated, self-consistent decision history
that replays to the same numbers under the same bounds — which is the point: decisions, not numbers,
are the input.

### Reproducible runs

The engine is deterministic. `startGame({ seed })` seeds every random draw through
`rngFor(seed, label, …)` streams (`bootstrap`, `candidates`, `pipeline`, `crisis`, `micro`,
`invoices`, `attrition`, `offers`), so the same seed plus the same decisions replays the same
company — same market, same crises, the same candidates. `Replay this scenario from the start`
in the archive dialog restarts a run on the same seed, and instructors assign a **scenario seed**
that every student in the cohort starts from. The roster shows each student's run seed and flags
any run that used a different one, so a cohort comparison measures decisions rather than luck.

### Authentication

Accounts are real: `POST /api/auth/register` and `POST /api/auth/login` issue seven-day sessions.
Passwords are stored as salted scrypt hashes and never returned by any endpoint; the prototype's
bare SHA-256 digests still verify and are upgraded on next sign-in. Failed sign-ins are throttled
(8 attempts per 10 minutes per email) and never reveal whether the email exists. `POST
/api/auth/logout` revokes the session. Instructor accounts require the `INSTRUCTOR_CODE` shared
secret at registration. `POST /api/auth/dev-login` stays available for local demos and the
verification harnesses but is disabled when `NODE_ENV=production` or `ALLOW_DEV_LOGIN=false`.

### Invoices and cash timing

Revenue is accrued when a customer buys; cash arrives when the invoice falls due. B2B industries
sell on account (`saas` 52% on 30-day terms, `logistics` 44% on 45-day terms) while `retail` and
`fnb` mostly collect at the till. Each month close issues that month's invoice, settles everything
now due, and carries the rest as receivables — with late payers marked overdue, recovering about
80% the following month, the remainder written off. The monthly report shows the accrual gap
(invoiced / collected / still receivable) and the Bank panel lists open invoices with due dates.

### AI gateway

`AI_PROVIDER=openai-compatible AI_BASE_URL=… AI_MODEL=… AI_API_KEY=…` enables any OpenAI-compatible
provider. Without those variables the gateway runs a deterministic provider that answers from the
same authoritative figures, so the product works offline and in CI. Guardrails are enforced
regardless of provider: prompt-injection refusal, per-character knowledge scoping (a customer never
sees your cash), numeric grounding (a reply may only cite supplied figures or it is rejected and
falls back), rate limiting, and trace logging. No provider receives a tool that can change state.

### Cohorts

Instructors create cohorts, invite students by id or account email, assign a scenario (industry,
difficulty, starting capital, months, objectives, optional replay seed), review server-verified
scores and integrity flags, grade against a four-criterion rubric, reset a run to its scenario
start, and export CSV.

Grading uses `GET /api/rubric`: cash discipline (30%), customers & revenue (30%), team &
operations (20%), decision quality (20%), each scored 1–4 and weighted into the 0–100 grade. A
rubric grade is rejected unless every criterion is present and a rationale of at least 40
characters is supplied. The stored record keeps the levels, the rationale, the engine score at
grading time and the resulting delta; the audit chain receives a SHA-256 digest of the rationale.
CSV export includes the rubric columns, the rationale and `grade_minus_engine`.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `HOST` | `8787` / `127.0.0.1` | API bind |
| `ADMIN_KEY` | `dev-admin` | Admin endpoints (development only) |
| `AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY` | unset | Enables the OpenAI-compatible provider |
| `DEV_PORT` / `API_PROXY_TARGET` | `5173` / `http://127.0.0.1:8787` | Vite server port and API proxy target |
| `API` | `http://127.0.0.1:8788` | Target for verification scripts |
| `INSTRUCTOR_CODE` | unset | Required for instructor self-registration |
| `ALLOW_DEV_LOGIN` | enabled outside production | Set to `false` to disable dev sign-in entirely |
| `NODE_ENV` | unset | `production` disables dev sign-in and expects real accounts |

## Status

See `AUDIT.md` for the implementation audit against the comprehensive development scope, including
what is implemented, partial and not implemented.
