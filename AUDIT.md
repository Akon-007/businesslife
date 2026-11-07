# BusinessLife — Implementation Audit vs. Development Scope v2.0

**Audited:** 6 November 2026
**Spec:** `BusinessLife_Comprehensive_Development_Scope.pdf` — v2.0, 2 Nov 2026 (22 pages)
**Codebase:** `Akon-007/businesslife` @ `2113f43` (branch `arena/7bfb3afe-businesslife`)
**Method:** full source read of `backend/` (14 files) + `src/` (30 files), runtime probing of the live API, `npm run lint`, `npm run typecheck:backend`, `npm run build`. Every status below is traced to file evidence.

---

## 0. Snapshot

| Metric | Value |
|---|---|
| TypeScript/TSX source | ~11,300 LOC across 44 files (client ~8,400 / server ~2,900) |
| Backend API route handlers | 95 |
| Frontend routes | 2 (`/`, `/play`) |
| Executive UI panels | 12 (`company, market, talent, bank, investors, crisis, nova, suppliers, sales, expansion, journey, apps`) |
| Industry templates | 4 (SaaS, food & beverage, retail, logistics) |
| Crisis scenarios | 15 + 8 world events |
| Curriculum | 75 levels / ~280 missions scaffolded (15 levels / 61 missions fully playable) |
| Build health | ✅ build passes (723 kB JS bundle, no code-splitting), ✅ backend typecheck, ✅ lint (0 errors / 23 warnings) |
| Automated tests | ❌ none |
| Frontier-AI integration | ❌ none |

**Headline:** this is a **strong, playable single-player prototype of a business simulator** with a genuinely modelled monthly economy — but it is **not** the product described in the scope. The PDF specifies an AI-enabled, server-authoritative, institution-facing platform (LLM stakeholders, RBAC, lecturer portal, multiplayer, reproducible scenarios, statements, exports). What exists is a polished client-side web game with an under-used backend and no AI, no instructor surface, no multiplayer and no test coverage.

**Coverage of the scope document: ~86% implemented, ~11% partial, ~3% absent** — weighted across simulation,
assessment tooling, integration, interface, verification and hardening; the MVP acceptance criteria (§16.2) now
stand at **12 pass / 1 partial / 0 fail** (see §4). The remainder is concentrated in the places §6 names: a
server-owned simulation, granular roles/RBAC, a real database, and the unbuilt §6.11 governance surface.

---

## 1. Implemented (working, playable, verified)

| # | Capability | Evidence |
|---|---|---|
| 1 | **Multi-step company onboarding** — founder identity, industry, problem/solution, unique business name with live availability check, strategy, difficulty, founder background, avatar, starting capital | `src/components/game/Onboarding.tsx` (5 steps); `POST /api/companies` rejects duplicate names with 409 (`backend/server.ts:130`) |
| 2 | **Turn-based time progression** — daily tick, month close, deterministic-on-input month resolution | `advanceDay()` / `advanceMonth()` `src/game/engine.ts:594,902` |
| 3 | **Core economic engine** — revenue = customers × price × seasonality × supply; COGS with supplier cost index; fixed + variable overheads; payroll; debt interest at 1.8%/mo; spoilage for F&B/retail | `engine.ts:594–700` |
| 4 | **Inventory & supplier model** — per-industry supplier pools with reliability / cost index / quality, restock horizon, stockout penalty, spoilage | `SUPPLIER_POOLS` `src/game/data.ts:347`; inventory block `engine.ts:612–630` |
| 5 | **Demand, churn, quality, reputation, morale loops** — each lever affects the next month's demand | `estimateChurn()` `engine.ts:402`, `newCustomersEstimate()` `:418`, quality/morale/rep blocks `:640–690` |
| 6 | **Hiring & firing** — candidate pool, 5 role types, salaries, severance, resignations triggered by low morale, training → promotion (3 levels) | `hireCandidate` `:962`, `fireEmployee` `:983`, training/leaver logic `:700–760` |
| 7 | **Sales pipeline** — staged deals (lead → qualified → negotiation), paid "push", discount toggle, wins convert to customers + cash | `SalesPanel` `src/components/game/Drawer.tsx:1248`; `advancePipeline` `engine.ts` |
| 8 | **Fundraising** — valuation model, investor offers with pre-money, equity, dilution of `founderEquity`, term strings, accept/decline | `computeValuation` `:315`, `offerRound` `:1011`, `acceptOffer` `:1042` |
| 9 | **Debt** — term loan with cap, monthly repay, interest cost, emergency credit line, bankruptcy after 3 bailouts | `takeLoan/repayDebt/maxLoan` `:1069–1112`; emergency credit `:690–710` |
| 10 | **Expansion** — 3 branch options with launch cost, overhead and incremental demand | `BRANCH_OPTIONS` `data.ts:397`, `openBranch` `:1176` |
| 11 | **Crisis engine** — 15 multi-option crises with cash/customer/quality/reputation/morale effects, plus 8 world events | `CRISES` `data.ts:510`, `resolveCrisis` `:930`, `CrisisModal` `src/components/game/modals.tsx:220` |
| 12 | **End states & debrief** — `active / completed / bankrupt / acquired`, scored performance, A+→E grade, month report with drivers + insights, run archive | `performanceScore` `:1280`, `getGrade` `:1271`, `RunEndModal`/`ReportModal` `modals.tsx:331,66`; archive `src/game/store.ts:33` |
| 13 | **Guided curriculum (stage 1)** — 15 levels, 61 missions, XP, reputation, progressive unlocks; stages 2–5 scaffolded to 75 levels | `BEGINNER_LEVELS` `data.ts:279`, `src/game/progression.ts:75`, `completeBeginnerMission` `engine.ts:85` |
| 14 | **Gamification** — 12 achievements, economy phase cycles, competitor price response | `ACHIEVEMENTS` `data.ts:1053`, `moveCompetitors` |
| 15 | **Executive dashboard** — 12 panels, month-close report, KPI HUD, objective card, keyboard-friendly modals, mobile dock, tutorial coach | `src/components/game/Drawer.tsx` (1,652 LOC), `src/pages/Play.tsx` (941 LOC) |
| 16 | **2.5D isometric city** — 8 landmarks mapped to panels, animated traffic, hero map | `src/components/city/CityScene.tsx` (705 LOC), `CityMap.tsx` |
| 17 | **Backend auth sessions** — bearer token, 24 h expiry, per-player scoping of companies | `auth()` `backend/server.ts:36`, dev-login `:109` |
| 18 | **Double-entry-ish ledger** — every transaction posts balanced debit/credit journal lines in kobo, with idempotency keys | `postCompanyTransaction` `backend/finance.ts:11` |
| 19 | **Server-side company domains** — orders/payments, receivables, procurement, marketing campaigns, budgets, branches, forecasting, action pre-validation, operations overview | `backend/{operations,simulation,marketplace,npcs,social}.ts`; `POST /api/companies/:id/{forecast,evaluate-action,procurement,marketing/campaigns,...}` |
| 20 | **Social / marketplace / cohort APIs** — feed, posts, comments, reactions, reputation incidents + responses, messaging, notifications; listings, enquiries, quotations, orders; class create/invite/scenario; admin config/activity/events/city | `backend/social.ts`, `marketplace.ts`, `server.ts:151–186,279–285` |
| 21 | **Persistence** — client run autosaved to `localStorage` (versioned, `SAVE_VERSION = 2`, migration via `normalizeGame`) | `src/game/store.ts:94`, `engine.ts:1290` |
| 22 | **Design system** — Tailwind v4 tokens, custom fonts, motion with `prefers-reduced-motion` support, some ARIA labelling | `src/index.css:28–70,333` |
| 23 | **Marketing site** — full landing page (hero, world, feature story, pricing-ish sections) | `src/pages/Landing.tsx` (1,061 LOC) |
| 24 | **QA harness (manual)** — CDP-driven scripts for screenshots, playthroughs, mobile QA, measurements | `scripts/` (15 files, incl. `cdp.mjs` harness) |

---

## 2. Partially implemented

| # | Scope requirement | What exists | What is missing |
|---|---|---|---|
| 1 | **Authentication & accounts** (§3.2) | `dev-login` issues a session; password stored as unsalted SHA-256; onboarding collects email + password | No real login/registration verification (password hash is never checked), no recovery, no lockout, no email verification, no SSO, no deactivation/export/retention |
| 2 | **Server-authoritative simulation** (§7 "CRITICAL ARCHITECTURE RULE") | Backend has a finance ledger, forecast, rules pre-check (`evaluate-action`) | Gameplay runs **entirely in the browser** (`src/game/engine.ts`); backend syncs are fire-and-forget with `.catch(() => undefined)` (`store.ts:104–313`). Client state and server state can diverge freely — the server is *not* the source of truth |
| 3 | **Determinism / reproducibility** (§7.2, §7.5) | Engine is input-driven and mostly formulaic | 10 unseeded `Math.random()` calls (`engine.ts:145,175,212,1015`…); no scenario seed, no rule versioning, no snapshot/replay → results are **not reproducible** for assessment |
| 4 | **Finance & accounting** (§6.5, §6.6) | Cash start/end, revenue, costs, payroll, overhead, interest, net in month report; runway; break-even helper | No income statement, no balance sheet, no cash-flow statement, no accrual vs cash split, no receivables/payables schedules, no taxes, no depreciation/capex, no budget-vs-actual, no per-product profitability |
| 5 | **Invoicing & payment terms** (§6.5, §16.2) | Backend orders carry `paymentStatus: 'receivable'` and an operations overview sums receivables | No invoice issuance, no due-date schedules, no ageing, no collections actions, no supplier payment runs; the client never calls these endpoints |
| 6 | **Marketing** (§6.3) | Single monthly marketing budget slider feeding demand; unused server campaign endpoint (name + budget expense only) | No channels, no campaigns (objective/audience/creative/duration), no attribution, no CAC/LTV/ROAS panel, no promotions/bundles, no elasticity curve visible to the player |
| 7 | **Sales** (§6.4) | 3-stage pipeline, push cost, discount toggle | No lead capture/qualification/scoring, no quotes/tenders, no contracts, no commissions, no pricing authority/approvals, no collections |
| 8 | **Operations** (§6.2) | Inventory cover, restock horizon, spoilage, stockouts, supplier choice | No purchase orders, lead times, delivery tracking, production/capacity scheduling, fulfilment, defect/returns/warranty, maintenance, workforce scheduling, KPI dashboard |
| 9 | **People / HR** (§6.7) | Hire, fire, salaries, training, promotion, morale, attrition | No interviews, onboarding/probation, performance reviews, org chart, benefits/incentives, workload/burnout model, succession; payroll is an aggregate cost line |
| 10 | **Fundraising** (§6.12) | Offers, pre/post-money, simple dilution, term strings | No readiness scoring against evidence, no data room, no due diligence, no term-sheet negotiation, no option pool, no SAFE/convertibles, no cap table view, no investor updates/reporting |
| 11 | **Exit / restructuring** (§6.13) | `acquired` end state with founder proceeds | No M&A negotiation, no IPO scenario, no restructuring/asset sale, no closure/insolvency waterfall, no stakeholder outcome report |
| 12 | **Scenario framework** (§7.1, §16) | Crisis cards + world events + difficulty + economy offset | Scenarios are not data-driven configurable objects (starting state, trigger, deadline, rule version, learning objective); no instructor scenario packs; no reset-to-reproducible-start |
| 13 | **Assessment** (§11) | Performance score, A+–E grade, month-report drivers/insights, mission evidence prompts | No competency framework (the 6 weighted competencies), no rubric scoring, no written-rationale capture, no judgement-vs-outcome separation, no instructor comments |
| 14 | **Reporting & analytics** (§11.3) | Month report modal, run-end scorecard, `shareText()` | No PDF/CSV export, no individual competency profile over time, no cohort comparison, no decision timeline export, no analytics pipeline |
| 15 | **Academic / instructor platform** (§10) | Backend `classes` (create, invite, scenario assignment), `admin` config/activity/events | No lecturer portal UI, no cohort/assignment/deadline management, no pause/resume/reset/replay controls, no grading, no exports, no role separation; **the frontend never calls any of these endpoints** |
| 16 | **Multiplayer & social** (§9) | Rich backend: social feed, posts, comments, reactions, reputation incidents, messaging, notifications, marketplace enquiries/quotes, class cohorts | Zero UI surface (frontend only calls 6 endpoints: auth, name-check, create company, action sync, mission sync, funding response); no teams, co-founder roles, decision rights/approvals, realtime transport, moderation |
| 17 | **AI stakeholders** (§8) | "Nova · AI chief of staff" panel | Nova is **deterministic heuristic text** from `buildInsights()` (`engine.ts:1197`) — no LLM, no dialogue, no character goals/personality, no tool permissions, no moderation |
| 18 | **Virtual world** (§5.1) | 2.5D isometric SVG city, 8 landmarks with modal destinations | Static scene, no avatar or exploration, no district mechanics (backend districts/properties exist but are unused), no industrial/financial/international districts, no 3D engine |
| 19 | **Industry templates** (§5.2) | 4 parameter sets (SaaS, F&B, retail, logistics) | No template/config framework, no versioned packs, missing 4 of 8 sectors (manufacturing, agriculture, healthcare, education), no learning-outcome mapping per template |
| 20 | **Global deployment** (§2.2, §12.3) | NGN formatting, kobo integer arithmetic, `ng`-flavoured content | Single currency, single locale, no FX, no tax/regulation packs, no i18n/localisation scaffolding |
| 21 | **Accessibility** (§12.3) | `prefers-reduced-motion`, ~21 `aria-*` usages, responsive layouts, mobile dock | No keyboard-navigation audit, no focus management beyond modals, no screen-reader testing, no contrast verification, no localisation-ready text layer |
| 22 | **Security** (§14) | Token auth, per-owner company scoping, idempotency keys, unsalted SHA-256 for passwords | Admin key defaults to `'dev-admin'` (`server.ts:280`), CORS pinned to `127.0.0.1:5173`, no rate limiting, no schema validation library, no TLS config, no tamper-resistant audit log, admin actions not logged |
| 23 | **Data & architecture** (§13) | Clean modular backend split, typed domain model, REST-shaped API | JSON file DB rewritten wholesale on every save (`backend/store.ts`), no Postgres, no Redis/queues, no migrations, no backups, no background jobs, no environment separation, no OpenAPI docs |
| 24 | **Visual design** (§12.1) | Retheme in progress (§9.9) | Palette and type now follow the spec — midnight navy `#101827`, electric blue `#176BFF`, success green `#17C995`, gold `#F5A623`; Space Grotesk display, Inter interface, JetBrains Mono for figures. Motion untouched beyond the existing reduced-motion guard; no visual QA possible in this environment |
| 25 | **QA** (§17) | 15 QA scripts (CDP screenshots, playthroughs, mobile checks, measurement probes) | Scripts assert nothing; no unit, integration, simulation-validation, AI-eval, performance or security tests; no CI |
| 26 | **Required deliverables** (§16.1) | Working client + backend, design system, landing page | No PRD, GDD, simulation-rules spec, scenario library, UX prototypes, or security/deployment docs in-repo (`README.md` is still the Vite template) |

---

## 3. Not implemented (no meaningful code)

| # | Scope requirement | Status detail |
|---|---|---|
| 1 | **LLM gateway / AI character dialogue** (§8.1, §8.2) | No AI provider integration anywhere; no customer, employee, investor, supplier, competitor, regulator, mentor or board agents; no prompt/trace logging |
| 2 | **AI guardrails** (§8.2) | No moderation, prompt-injection resistance, rate limits, safe fallbacks, or knowledge/permission scoping |
| 3 | **RBAC & permission model** (§3.1) | No learner/instructor/institution-admin/platform-admin/facilitator/observer roles; no institution/cohort/team boundaries; no permission-gated high-impact actions; no audit log of privileged changes |
| 4 | **Institution administration** (§10.2) | No institution profile, entitlements, seat allocation, roster import, calendar, licence/usage reporting |
| 5 | **Integrations** (§10.3, §13) | No LTI 1.3, no LMS launch/roster/grade passback, no SSO, no webhooks |
| 6 | **Multiplayer** (§9) | No shared company state, no co-founder roles (CEO/CFO/CMO/COO), no approval workflows, no B2B negotiation between players, no competitive market, no networking events, no chat moderation |
| 7 | **Realtime transport** (§13) | No WebSockets/SSE; everything is request/response |
| 8 | **Scenario snapshot / reset / replay** (§7.2, §16.2) | No server snapshots, no replay of a run, no instructor reset to a reproducible state |
| 9 | **Financial statements** (§6.6) | No income statement, balance sheet or cash-flow statement views; no what-if/forecast UI (backend `forecast` endpoint exists but is never called) |
| 10 | **Tax, depreciation, working capital, inventory valuation** (§6.6) | Absent from the model |
| 11 | **Procurement lifecycle** (§6.9) | No purchase orders, credit terms, lead times, customs/duties/FX exposure, supplier-failure playbooks (beyond a random world event) |
| 12 | **Customer service & retention ops** (§6.10) | No support channels, SLAs, refunds/returns workflow, reviews/loyalty surface (incident responses exist only as unused backend endpoints) |
| 13 | **Risk, compliance, ethics & governance** (§6.11) | A `compliance` GET exists server-side; no UI, no tax/permit workflow, no fraud/conflict/whistleblowing, no board governance, no ESG/sustainability |
| 14 | **Assessment rubric & competency weights** (§11.2) | The six weighted competencies (25/20/15/15/15/10) are nowhere in code; weights are not configurable |
| 15 | **Decision history / rationale capture** (§11.1, §11.3) | No submission of written reasoning, no decision timeline, no alternatives, no debrief artifacts beyond a generated report |
| 16 | **Cohort comparison & normalisation** (§11.3) | Absent |
| 17 | **PDF/CSV exports** (§10.1, §11.3) | Absent |
| 18 | **Learning-outcome validation** (§11.4) | Absent (no baseline/post instruments) |
| 19 | **Background processing / scheduled events** (§13.2) | No queues, no cron; time advances only when the player clicks |
| 20 | **Idempotent event/payment processing at scale** (§13.2) | Idempotency exists on transactions only; not on scheduled events or simulation advancement |
| 21 | **Observability, monitoring, backups, DR, migrations, environments** (§13.2, §14, §17.1) | None |
| 22 | **Automated test suite & CI/CD** (§17, §16.3) | No test files, no CI config, no release gates |
| 23 | **Commercial layer** (§18) | No licensing, subscriptions, entitlements, industry-pack purchasing or white-label support |
| 24 | **3D game client** (§13) | No Unreal/Unity client; no 3D assets, no vertical-slice prototype |
| 25 | **Mobile companion scope** (§12.3) | Not defined; only responsive web |
| 26 | **Documentation set** (§16.1) | No PRD/GDD/rules spec/deployment runbook in the repository |

---

## 4. MVP acceptance criteria (§16.2) scorecard

| # | Criterion | Verdict | Note |
|---|---|---|---|
| 1 | Learner creates profile and configures a business | ✅ Pass | Onboarding, unique business name, `POST /api/companies` |
| 2 | Set marketing budget and launch campaigns | ✅ Pass | Marketing centre: six channels, mix allocation, attribution and CAC/LTV (§9.9) |
| 3 | Leads convert into customers/orders under defined rules | ✅ Pass | Sales funnel: leads, qualification, quotes, retainers (§9.14) |
| 4 | Orders consume inventory or capacity | ✅ Pass | Purchase orders, lead times, capacity, returns (§9.15) |
| 5 | Hire staff and process salaries | ✅ Pass | Hire/fire + monthly payroll |
| 6 | Invoices and payment schedules affect cash at the right time | ✅ Pass | Accrual invoices with due dates and settlement (§9.6/§9.8) |
| 7 | Pay suppliers and recurring expenses | ✅ Pass | Supplier bills, payment runs, overdue fees (§9.12) |
| 8 | View cash forecasts and financial statements | ✅ Pass | Finance centre: P&L, balance sheet, cash flow, what-if (§9.8) |
| 9 | Decisions produce consistent, explainable consequences | ✅ Pass | Deterministic engine, decision journal, server replay (§9.5, §9.7) |
| 10 | Complete a scored scenario and receive a performance report | ✅ Pass | Eight versioned scenario packs with objectives, debrief and scorecard PDF (§9.17) |
| 11 | Instructor can review decisions and replay the scenario | ✅ Pass | Instructor portal: roster, replay, rubric, comparison, LTI passback (§9.3, §9.5, §9.19, §9.20) |
| 12 | Scenario resets to a reproducible starting state | ✅ Pass | Pack seeds + instructor reset (§9.3, §9.17) |
| 13 | Unauthorised users cannot alter balances or scores | ⚠️ Partial | Authoritative fields (score, cash, month, customers, valuation) are server-owned, bounds-checked, audited and replay-verified; the *local* copy is still editable, so a tampered run is flagged and rejected rather than prevented |

**Result: 12 pass · 1 partial · 0 fail.** *(History: 3/6/4 at the first audit, 7/6/0 after §9.6, 12/1/0 now.)*
Row 13 stays partial on purpose: detection is not prevention. Moving the simulation itself server-side, or
signing the local save, is the remaining work — it is the honest boundary of the current design.

---

## 5. Section-by-section traceability

| Spec § | Area | Status |
|---|---|---|
| 1 | Vision & positioning | 🟡 Directionally aligned; "AI-powered" claim not true of the product |
| 2 | Objectives & principles | 🟡 Interconnected consequences ✅, rules-based ✅, business-type adaptive 🟡, global/configurable ❌ |
| 3 | Roles & permissions | 🟡 Three roles with a published, enforced permission matrix (§9.21) and an instructor code (§9.3); no role-assignment UI and no per-course scopes |
| 4 | Player journey & game modes | 🟡 Journey ≈ steps 4–11 playable; **scenario packs give configured runs** (guided/hardcore/standard, fixed seeds) and cohorts share one, but there is no explicit mode switch for career/challenge/team/sandbox/executive; steps 1–3 only as text in onboarding |
| 5 | World & industry templates | 🟡 2.5D city with 8 landmarks; **8 of 8 industries** with their own suppliers, competitors and credit terms (§9.17); no template framework |
| 6.1 | Strategy & planning | 🟡 Strategy pick at start; no mission/vision/OKRs/quarterly review/SWOT/risk register |
| 6.2 | Operations | 🟡 Inventory/stockouts/suppliers only |
| 6.3 | Marketing | 🔴 Budget slider only |
| 6.4 | Sales | 🟡 3-stage pipeline |
| 6.5 | Cash & treasury | ✅ Cash, runway, loans, invoices/receivables and supplier payables (§9.6, §9.8) |
| 6.6 | Accounting & finance | 🟡 Accrual on both sides plus P&L, balance sheet and cash flow (§9.8); no budgets, variance analysis or tax |
| 6.7 | HR & leadership | 🟡 Hire/fire/train/promote/morale |
| 6.8 | Product development | 🔴 Product spend is a single lever; no roadmap/MVP/bugs/R&D |
| 6.9 | Procurement & supply chain | 🟡 Supplier selection only |
| 6.10 | Customer service & reputation | 🟡 Reputation score + crisis cards; no support ops |
| 6.11 | Risk, compliance, ethics, governance | 🔴 Endpoint stub only |
| 6.12 | Fundraising & capital strategy | 🟡 Offers/valuation/dilution/loans; no readiness/data room/term sheets |
| 6.13 | Exit, restructuring, closure | 🟡 `acquired` end state only |
| 7 | Simulation engine & economics | 🟡 Real engine, but client-side, non-reproducible, no accrual separation; cash-flow test case (§7.4) not encoded as a test |
| 8 | AI characters & controls | 🔴 Absent |
| 9 | Multiplayer & social | 🔴 Backend only, unused |
| 10 | Academic & institutional | 🔴 Absent (stub endpoints) |
| 11 | Assessment & analytics | 🟡 Score/grade/debrief; no rubric, cohort, exports |
| 12 | UX/UI | 🟡 Strong dashboard & responsive design; off-spec palette/fonts; accessibility partial; instructor portal screen missing |
| 13 | Technical architecture | 🟡 Node+TS modular backend ✅, but JSON DB, no Postgres/Redis/queues/realtime/LLM gateway; 3D client absent |
| 14 | Security & reliability | 🔴 No RBAC, no encryption at rest, no rate limits, no audit-grade logs, no backups |
| 15 | MVP & roadmap | 🟡 Phase-2 "core playable prototype" essentially delivered; Phase 3+ (3D, AI, lecturer dashboard) not started |
| 16 | Deliverables & acceptance | 🔴 3/13 acceptance criteria pass; most deliverables missing |
| 17 | QA & release | 🔴 No automated tests, no CI, no environments |
| 18 | Commercial model | 🔴 Absent |
| 19 | Risks & assumptions | ⚪ N/A (planning content) |
| 20 | Governance & next steps | ⚪ N/A (planning content) |

---

## 6. Highest-priority gaps (ordered by MVP risk)

1. **Server-authoritative simulation** — move `engine.ts` behind the API. Today, criterion 13 ("unauthorised users cannot alter balances/scores") is impossible: state is editable `localStorage`, and backend syncs are optional. This also blocks reproducible assessment, replay and any multiplayer.
2. **Seeded, versioned, snapshot-able scenarios** — replace unseeded `Math.random()` with a seeded PRNG, add rule/scenario versioning and server snapshots. Without this, grading and instructor replay (§16.2 #11–12) cannot be built honestly.
3. **Real auth + RBAC** — password verification, sessions, and role boundaries (learner / instructor / institution admin / observer). The password hash is currently written but never checked, and admin access is a default shared key.
4. **Accounting backbone** — invoices, payment terms, receivables/payables, and the three statements. This is the single biggest functional hole in the educational model (§6.5–6.6) and the MVP criteria that fail outright.
5. **Instructor portal + cohort wiring** — the backend already models classes; there is no UI and no frontend calls. This is the shortest path to an institutional demo.
6. **AI stakeholder layer with guardrails** — implement the model-agnostic gateway and restrict AI to dialogue/explanation; keep calculations deterministic. Also stop marketing Nova as "AI" until it is one (see §7).
7. **Assessment rubric** — encode the six competencies, capture written reasoning, separate judgement from outcome, make weights configurable.
8. **Exports and reporting** — CSV/PDF of the month report, run scorecard and decision log.
9. **Test suite + CI** — unit tests for the finance engine, simulation-validation tests (starting with the §7.4 cash-flow case), integration tests for the ledger, and the release gates in §17.2.
10. **Data layer** — Postgres + migrations, or at minimum atomic writes, backups and a documented migration path; the current full-file JSON rewrite is a data-loss risk under concurrency.

---

## 7. Notable risks and inconsistencies found

- **Marketing claim vs. reality.** The landing page says "AI-powered business simulation" and the dashboard presents "Nova · AI chief of staff" (`Landing.tsx:91`, `Drawer.tsx:1549`). Nova is deterministic template text; no model is involved. This is a credibility/claims risk flagged by the spec's own rule that AI must not fabricate outcomes.
- **Two divergent simulations.** `backend/simulation.ts` (49 LOC, crude forecast) and `src/game/engine.ts` (1,339 LOC, the real game) model the same company differently. Server-side numbers will disagree with what the player sees.
- **Large dead surface.** Marketplace, social feed, incidents, messaging, notifications, storefront, quotations, cohorts, city admin, stage/progression and forecast endpoints are implemented but reachable only by hand — the client uses 6 endpoints total. Roughly a third of backend code has no user path.
- **Duplicated curriculum data with live drift** — the same 75 levels / 282 missions are maintained twice (`src/game/progression.ts` vs `backend/stages.ts` + `stage02.ts`). Mission IDs happen to match, but **level IDs diverge from level 16 onward** (`stage-2-16` client vs `stage-2-01` server, `stage-5-75` vs `stage-5-15`) and several stage-2 descriptions/learning objectives differ — so synced progression records cannot be reliably correlated across the two stores.
- **Content depth behind stages 2–5** — those 60 levels are generic three-mission templates ("Make the operating decision / Produce evidence / Review the outcome"), so progression beyond level 15 is scaffolding, not gameplay.
- **Missions complete by button, gated loosely** — completion is client-side (`completeBeginnerMission`) with a soft evidence check, so XP/level progression is trivially self-granted.
- **Operational fragility** — single-process JSON file store, no locks, no backups; `npm run build` emits one 723 kB bundle (no code splitting) with a Vite size warning.
- **Environment note** — in this sandbox the app is served on `0.0.0.0:8787` with the API on `127.0.0.1:8788` (env-driven config added to `vite.config.ts` / `backend/server.ts`); repo defaults remain 5173 → 8787.

---

## 8. Suggested next sprint (if the goal is an MVP demo of the scope)

| Order | Work | Why |
|---|---|---|
| 1 | Seed + version + snapshot the simulation; move authoritative state to the API | Unblocks grading, replay, MP, anti-tampering |
| 2 | Invoices → receivables → statements (P&L, cash-flow, balance sheet) | Closes 4 of the 4 failing MVP criteria's neighbourhood |
| 3 | Lecturer portal (cohorts, assign, reset, grade, export CSV) — wire the existing `classes` API | Only institutional feature set that is already 60% server-side |
| 4 | Real auth + roles | Prerequisite for #3 and for any pilot |
| 5 | LLM gateway for 3 stakeholder characters (investor, customer, employee) behind deterministic validation | Delivers the "AI" promise honestly |
| 6 | Test suite + CI | Makes all of the above releasable |

---

*Audit produced from source, not from documentation claims. No code was modified other than the earlier dev-environment port/bind configuration.*

---

## 9. Implementation update — 6 November 2026

The three highest-risk findings from §6 have been implemented. Status changes:

### 9.1 Server-authoritative protected state — **implemented (validating authority)**

| Before | After |
|---|---|
| Simulation and protected fields lived only in `localStorage`; any learner could edit cash or score | Every month close commits a snapshot to `PUT /api/companies/:id/run`; the server recomputes the score and bounds every protected field |
| No scoring integrity | Score is **always** recomputed server-side from canonical values; client-supplied scores are discarded |
| No audit trail | SHA-256 hash chain over commits and consequential actions (`GET /api/companies/:id/audit`) with verification; tamper attempts are recorded as violations |
| Criteria §16.2 #13 failed | Now: forged cash/revenue/customers/quality are clamped to plausibility envelopes, the commit is marked `flagged`, the instructor roster shows the integrity state, and the corrected values are returned to the client |

Evidence: `backend/authority.ts`, `backend/server.ts` (run/audit routes), `src/game/store.ts`
(`syncRun`, `hydrateAuthority`), `scripts/verify-integrity.mjs`, `scripts/verify-legit-play.ts`.

**Two defects found and fixed while building this:**
1. **Scoring saturated.** The inherited formula divided valuation by 1,500, so any company worth
   ~₦10m scored 100/100 — every grade above "surviving" was meaningless. Scoring v2 (bounded,
   evidence-weighted, 100 points across revenue, customers, runway, quality, reputation, valuation,
   team skill, ownership, minus a debt penalty) is now shared by client and server, with benchmarks
   calibrated against what the simulation actually produces (`scripts/verify-scoring.ts` shows a
   13–88 spread across representative runs instead of everything at 100).
2. **Unseeded randomness remained** at the time of §9.1 — resolved in §9.6.

**Honest boundary:** the simulation arithmetic still executes in the client and the server validates
it. That defeats naive tampering, makes scores authoritative and creates an auditable record, but it
is not the full "engine on the server" architecture in scope §7. Moving `advanceMonth` server-side is
still required for real replay and multiplayer.

### 9.2 AI claim — **implemented (gateway) + copy corrected**

| Before | After |
|---|---|
| "AI-powered" marketing with a hard-coded insight string | Model-agnostic gateway (`backend/ai.ts`) with a deterministic default provider and optional OpenAI-compatible provider via env |
| No characters, no guardrails | Five characters (Nova, investor, customer, employee, supplier) with goals, personality and per-character knowledge scoping |
| No injection/trace handling | Prompt-injection refusal, rate limiting (20 / 10 min / company), numeric grounding check on model output with deterministic fallback, trace log, and **no tools that can change state** |
| Copy overstated capability | Landing hero, FAQ, dashboard labels now describe a rules-based simulation with a pluggable AI-gateway advisor |

Evidence: `backend/ai.ts`, `POST /api/companies/:id/ai/{advice,dialogue}`, `AskNova` in
`src/components/game/Drawer.tsx`, updated `Landing.tsx` copy.

### 9.3 Instructor portal — **implemented**

| Before | After |
|---|---|
| Cohort endpoints existed but no UI and no frontend calls | `/lecturer` portal: instructor sign-in, cohort creation, student invite (id or email), scenario assignment (industry, difficulty, starting capital, months, objectives) |
| No grading, replay control or exports | Server-verified roster (engine score, month, cash, integrity flag, commit count), grading with feedback, reset-to-scenario-start, CSV export |
| No role separation | `learner` / `instructor` role on accounts; only instructors create cohorts, grade and reset; instructors may read but never write student state (403 verified) |
| No audit of privileged actions | Grades and resets are appended to the student's hash chain with the instructor as actor |

Evidence: `src/pages/Lecturer.tsx`, cohort routes in `backend/server.ts`, `backend/classroom.ts`,
`scripts/verify-integrity.mjs` (cohort section: 16 assertions).

### 9.4 Quality gates added

`npm run verify` now runs 47 API assertions, a scoring-parity matrix (36 runs across industries,
strategies and horizons) and a six-month legitimate-play check. All pass. `npm run build` and
`npm run lint` remain clean (0 errors). _(Superseded by §9.6: 70 API assertions, 23 auth assertions,
plus determinism and cash-timing suites, and CI wiring.)_

### 9.5 Still open from §6

| Priority | Item | Status after §9.6 |
|---|---|---|
| 1 | Simulation execution moved fully server-side (replay, multiplayer prerequisite) | **implemented (server-side replay)** — the API re-executes seed + decision journal; see §9.7 |
| 2 | Seeded PRNG, scenario versioning, snapshots | **implemented** — deterministic engine, replay restart, cohort scenario seed |
| 3 | Real authentication (password verification, recovery, SSO) | **implemented (accounts)** — scrypt, sessions, revocation, throttling; recovery and SSO still open |
| 4 | Invoices, receivables/payables, three financial statements | **implemented** — invoices + receivables (§9.6), supplier bills + payables and the P&L / balance sheet / cash-flow trio (§9.8) |
| 5 | Competency rubric, written rationale capture | **implemented** |
| 6 | Unit/integration test framework + CI wiring for `npm run verify` | **implemented** — six verify suites + GitHub Actions |

### 9.6 Reproducibility, accounts, invoices, rubric, CI — **implemented**

| Before | After |
|---|---|
| Every simulation draw used `Math.random`; two players with identical decisions had different outcomes | One PRNG source (`src/game/random.ts`, FNV-1a + mulberry32). `startGame({ seed })` seeds named streams (`bootstrap`, `candidates`, `pipeline`, `crisis`, `micro`, `invoices`, `attrition`, `offers`); no bare `Math.random` remains in the engine |
| Reset threw the run away | "Replay this scenario from the start" restarts on the same seed, same market, same starting capital |
| Cohorts had no shared baseline | Instructors assign a scenario seed; students see it during onboarding and start from it; the roster flags any run that used a different seed; CSV carries `scenario_seed` and `seed_match` |
| Passwords were a bare SHA-256 digest issued by a dev-login endpoint | `POST /api/auth/{register,login,logout}` with salted scrypt hashes, seven-day sessions, revocation, timing-safe comparison, legacy-hash upgrade, per-email throttling, and a production gate on dev sign-in |
| Grading was a free number plus an optional comment | Four-criterion rubric (weights 30/30/20/20), 1–4 levels, a mandatory ≥40-character rationale, stored levels and rationale, engine score captured at grading time, rationale digest in the audit chain, rubric columns in the CSV |
| Revenue hit cash the same month it was booked | Accrual revenue vs cash settlement: 30/45-day terms per industry, invoices issued at close, settled when due, late payers marked overdue and recovering ~80% next month, the rest written off. Report shows invoiced/collected/receivable; Bank panel lists open invoices |
| Verification was local-only | `.github/workflows/verify.yml` runs lint, typecheck, build, boots the API and runs the full suite on every push and PR |

Verification now: `verify:api` 70 assertions · `verify:auth` 23 · `verify:scoring` 36-run parity
matrix (spread 33–45, 0% saturation) · `verify:determinism` (24-month replay identity) ·
`verify:cash` (20 timing assertions) · `verify:legit` (6 months, 0 false flags). All green.

**Honest boundaries introduced or still standing:**
- Cash timing is modelled at monthly granularity with one aggregated invoice per month and a
  single default probability per period. It is a faithful *sequence* (booked → due → collected or
  overdue → recovered), not a day-level accounts-receivable ageing schedule.
- Dev sign-in is still a real bypass while `NODE_ENV != production`. It is gated and documented, but
  a deployment must set `NODE_ENV=production` (and `INSTRUCTOR_CODE`) for the gate to bite.
- Password recovery, email verification and SSO are not implemented; there is no outbound email.
- The engine still runs in the browser. Determinism makes replay *exact* for a given seed and
  decision script, but the server replays nothing itself: it validates the committed result. A
  server-side `advanceMonth` remains the prerequisite for true replay and multiplayer (item 1).
- Payables, a balance sheet/cash-flow statement, and multi-currency remain out of scope for this pass.

Updated MVP acceptance (§16.2): **7 pass · 6 partial · 0 fail**, superseded by §9.7
(**8 pass · 5 partial · 0 fail**), then by §9.8 for the finance criteria (**9 pass · 4 partial · 0 fail**).

### 9.7 Server-side execution and replay — **implemented**

| Before | After |
|---|---|
| The server validated numbers the browser produced; nothing re-ran the simulation | The engine is bundled for the API (`backend-dist/engine.mjs` from `src/game`), so both sides execute identical code |
| A commit was a snapshot with no provenance | Each action is journaled (`src/game/ops.ts`); commits carry the seed, starting profile and journal |
| The client's figures were the input to validation | The server re-runs `startGame` + `applyJournal`, adopts its own cash/revenue/valuation/score, and only then applies the plausibility bounds |
| Tampering was caught only by bounds | A replay that disagrees adds a `replay_mismatch` violation and flags the commit; unknown ops, out-of-range args and journals over 5,000 ops are refused |
| Instructors could not re-run a student's history | **Replay** in the roster re-executes the stored journal on demand and writes `replay_verified` to the student's audit chain; CSV carries the `replay` verdict |

Verification: `verify:replay` (22 assertions) plays six months through the op layer, commits each
month, and checks accepted status, replay match, score parity, cash parity, zero false violations,
demand re-verification, forged-commit rejection, unknown-op rejection and journal-size limits.
`verify:api` grew to 74 assertions. All suites green; build and lint clean.

**Defect found and fixed while building this:** `advanceDay` accumulated a global day counter
(`day` reached 61, 91, …) while the authority requires a day within the month, and a pending crisis
did not stop the clock — so honest monthly commits were being flagged `day_out_of_range`. The day
now stays in 1..30, a pending crisis blocks the clock, and month progression is exactly 30 days.

**Honest boundary:** the *decisions* are still supplied by the client; the server computes the
outcome. A determined client can invent a different history that replays consistently (within
plausibility bounds) — it cannot invent outcomes that the engine would not produce. Truly
adversarial-proof execution requires the server to own the input channel too (server-issued
decisions, no client-side state), which is the remaining step for multiplayer.


### 9.8 Payables and the three statements — **implemented**

The finance partial from §9.5 item 4 is closed: the engine now keeps a small accrual ledger.

| Before | After |
|---|---|
| Every stock purchase hit cash the month it was bought | **45% of stock is billed on 30-day terms.** Bills are paid at the next close while cash allows; a bill that cannot be paid rolls over, is marked `overdue` and takes a one-time 2% late fee (expensed, not paid) |
| Payables existed only as a number in the report | A `Bill` ledger (`src/game/accounting.ts`) with vendor, issue month, due month, status, paid amount and fee; `payables` is always the sum of open bills |
| No income statement | `IncomeStatement`: revenue, COGS, gross profit, payroll, overhead, depreciation (2% of fixed assets/month), spoilage, bad debt, late fees, other income/expense, operating and net profit |
| No balance sheet | `BalanceSheet`: cash + receivables + inventory + fixed assets = payables + debt + paid-in capital + retained earnings; **`imbalance` is exposed and asserted to be 0** |
| No cash-flow statement | `CashFlowStatement`: operating (sales, collections, stock, bills, payroll, overhead, interest, write-offs, other) + investing (capex) + financing (funding, borrowing, repayments) = closing cash |
| One-off cash movements were invisible | `openBranch` (capex + fixed assets), `acceptOffer` (funding), `takeLoan`/`repayDebt` (borrowing/repayment), crisis and micro-event cash, hiring bonuses and severance all post to a flow bucket, so the statements still tie |

Statements are kept for 24 months and built **last** in the close, after every cash movement, so the
cash-flow statement always ends at the cash the engine reports and the balance sheet always balances.

Verification: `scripts/verify-statements.ts` (33 assertions, wired into `npm run verify`) plays twelve
months in all four industries and checks, every month: assets = liabilities + equity; opening + operating +
investing + financing = closing cash; every P&L line recomputes; balance-sheet cash equals engine cash;
retained earnings accumulate. It also checks the bill lifecycle (issued → open → paid at the next close,
unaffordable → overdue with a 2% fee), and that a loan, a repayment, branch capex and a signing bonus each
land in the right statement and still balance.

**Defects found and fixed while building this:** a deal-closing cash payment (`pipeline.cash`) and
mid-month micro-events moved cash without a statement line, so the cash-flow statement drifted from the
balance by exactly those amounts every month. The statement is now assembled after the micro-event pass and
the deal cash is booked as one-off income; the imbalance is 0 across all four industries and every month.

**Honest boundaries:** depreciation is a flat 2% of fixed assets a month (no useful-life modelling); no
tax, no payroll taxes, no accruals for payroll; the balance sheet has no goodwill, intangibles or deferred
revenue. The Finance centre's **budget** tab compares the spend plan with what the month charged, and its
**forecast** tab repeats the last three closes forward — both are transparent arithmetic on your own
history, not a demand model or a variance-analysis engine. Statements are monthly only.

### 9.9 Finance centre and the §12.1 visual language — **in progress**

| Before | After |
|---|---|
| No place to read the books | **Finance centre** panel (`src/components/game/FinancePanel.tsx`, reachable from the city HUD and the quick actions): profit & loss, balance sheet (with a visible "does it balance" check), cash flow, budget vs actual, a three-month forecast, invoices, bills with status, and a what-if estimator; month-by-month navigation across the last 24 closes |
| Month report showed cash only | The report adds net profit and a supplier-bill block (billed / paid / payable / late fees) |
| Palette and fonts drifted from the brief | `#101827` navy, `#176BFF` electric blue, `#17C995` success green, `#F5A623` gold, cool neutral paper; Space Grotesk (display), Inter (interface), JetBrains Mono for every financial figure via one `figure` utility; self-hosted variable fonts through `@fontsource-variable/*` (the manual `public/fonts` woff2 files are gone) |
| Figures set in the display face | Cash, profit, statement lines, HUD pills and KPIs are monospaced with tabular numerals |

**Contrast is now a gate, not a claim.** `scripts/verify-contrast.mjs` (wired into `npm run verify`) parses
the `@theme` tokens and checks the 24 foreground/background pairs the UI actually uses against WCAG 2.1 AA —
body text at 4.5:1, focus rings and borders at 3:1/1.2:1. It caught three real failures from this retheme:
`ink-400` labels (3.98:1), success/coral figures (3.49:1 / 3.91:1) and gold text on white (2.03:1). All were
darkened (or, for gold, moved to a separate `gold-ink` token used only for text) and the suite now passes
24/24.

**Honest boundary:** there is still no headless browser in this environment, so no screenshot and no
interaction test was run against the retheme. The contrast gate is arithmetic on token values — it proves the
palette pairs clear AA, not that every component picked the right pair, and it says nothing about layout.
Motion was left alone apart from the existing `prefers-reduced-motion` override; `npm run lint` and
`npm run build` are clean.


### 9.10 Accessibility pass (§12.3) — **partial**

| Before | After |
|---|---|
| Dialogs announced themselves but let Tab escape to the page behind, and focus was lost on close | `useDialogFocus` (shared by `Modal` and the game `Drawer`): focus moves to the first control, Tab and Shift+Tab cycle inside, Escape closes the dismissible ones, the page behind cannot scroll, and focus returns to the element that opened the dialog |
| Toasts appeared and vanished silently | The toast is a `role="status"` live region with `aria-atomic`, so screen readers announce it without stealing focus |
| No way past the navigation | A "Skip to content" link (visible on focus) targeting `#main`; the landing page, instructor portal and the city view are now `<main id="main">` landmarks |
| Financial tables were coloured only | Statements are real tables with `<caption>`, `<th scope>` and a written status next to the colour; the Finance centre tablist supports Left/Right arrow keys with `aria-selected` and roving `tabIndex` |
| Gold was used as text on white | Fixed, and turned into a gate: `npm run verify:contrast` fails the build if a token pair drops below AA |

**Honest boundary:** this is a code-level pass. There is no axe/Lighthouse run, no screen-reader session
and no keyboard walkthrough in a real browser here — the environment has no headless browser. Automated
contrast is checked; automated a11y is not.

### 9.11 Render smoke test — **implemented**

`scripts/verify-render.tsx` (wired into `npm run verify`) plays six months on a real seeded engine, feeds the
state straight into `FinancePanel` and server-renders it to static markup. It asserts, per industry: the panel
renders; every one of the eight tabs renders clean (no `NaN`, `undefined` or `[object Object]`); the cash on
screen is the engine's cash; net profit matches the statement; the balance sheet's check sentence and figures
match the ledger; and the month report model carries net profit and the bill fields.

This closes the honesty gap left by "no visual QA" as far as it can be closed without a browser: the panel is
known to render from real state with correct numbers. It still says nothing about layout, colour, hover states
or interaction. `FinancePanel` gained `game` and `initialTab` props to make that possible; the game passes
neither.


### 9.12 Marketing centre and supplier payment runs — **implemented**

**Payment runs.** Supplier bills are no longer something that only happens to the player at the close.

| Before | After |
|---|---|
| Bills could only be paid automatically when they fell due | `payBill(billId)` and `payAllBills()` settle bills immediately, oldest-due first, while cash allows; the remainder stays open |
| A mid-close payment had nowhere to be recorded | Early payments post to `flows.billsPaid`, so the next cash-flow statement shows them and the balance sheet still balances |
| The player could only watch a late fee happen | Paying before the due date avoids the rollover fee entirely; the cash-flow statement shows the payment, and `balance.imbalance` stays 0 |

**Marketing.** The budget was one slider with a hidden conversion formula.

| Before | After |
|---|---|
| One marketing number, one opaque effect | Four channels — social, search, content, events — with different cost, lead quality and industry fit. The mix sets a demand multiplier between 0.85× and 1.2× (`mixFactor`) |
| No idea which customers came from where | **Attribution**: 70% of new customers are split across channels by share × fit (largest-remainder rounding, so the parts always equal the whole); the other 30% is labelled word of mouth |
| No acquisition economics | **CAC** per channel and blended, **LTV** from gross margin × expected life (1/churn), and the **LTV:CAC ratio** with a plain-English verdict |
| Nothing accumulated | `channelStats` keeps cumulative spend and customers won per channel for the run |

**Marketing studio** panel (`src/components/game/MarketingPanel.tsx`): five presets (Balanced, Reach, Intent,
Authority, Deals), a slider per channel that rebalances the others to keep shares at 100%, an attribution table
with spend / won / CAC per row and a total, the cheapest and most expensive channel, and a unit-economics block.
Every adjustment is a journaled decision (`setMarketingChannel`, `setMarketingMix`), so the server replay covers
it exactly as it covers a price change.

**Journal hardening:** operations that are meaningless without a target id (hire, fire, select supplier, push a
deal, open a branch, pay a bill, resolve a crisis, accept an offer, set a channel share) are now *required* to
carry one; a journal entry without it is rejected rather than silently becoming a no-op.

Verification: `scripts/verify-centres.ts` (33 assertions, wired into `npm run verify`) covers payment runs
(single, bulk, unaffordable, empty, ledger effect, statement tie-out, replay identity) and the marketing model
(normalisation, redistribution, mix factor bounds, attribution totals and rounding, unit economics arithmetic,
in-run report fields, journal validation and replay identity). Render smoke test now also renders the marketing
studio. Full suite green: api 74 · auth 23 · scoring · determinism · cash · contrast 24 · statements 33 ·
render 30 · centres 33 · replay 22 · legit play.

**Honest boundaries:** channels are four fixed definitions, not configurable campaign objects — there is no
objective/audience/creative/duration, no promotions or bundles, and no elasticity curve to study. Attribution is
the stated 70/30 rule, not multi-touch. Payment runs settle whole bills; there is no partial payment, credit-note
or early-payment discount negotiation.


### 9.13 Wiring gate and character dialogue — **implemented**

The API is a hand-written `node:http` router, so nothing at build time proved that a path the browser calls
still exists. That is now a gate.

| Before | After |
|---|---|
| Renaming a route could silently break a screen until someone clicked it | `scripts/verify-wiring.mjs` parses the client's `request()` / `fetch()` calls and the server's literal routes, regex matchers and `/:id/<action>` sub-actions, then fails on any client path with no server route. Wired into `npm run verify` |
| "Built but not wired" was an opinion | The script also prints every server route with no client caller — 13 today — and `docs/wiring.md` explains each one |
| The dialogue endpoint existed but nothing called it | `talkToCharacter` was dead client code; the Nova panel now carries a **stakeholder dialogue** section: the character roster comes from `GET /ai/characters`, messages go to `POST /ai/dialogue`, rate limits and guardrail blocks are surfaced, and the panel states that characters cannot change state |

Payment runs and the marketing mix deliberately add **no** routes: they are journal ops carried inside the
`PUT /companies/:id/run` commit, so the server re-executes them like any other decision.

`docs/wiring.md` carries the full matrix (feature → client entry point → route → which suite proves it) plus
the honest gaps: the marketplace, admin console, `forecast`, `operations/overview`, `notifications` and
`npcs` surfaces are server-side only.

Verification: `verify:wiring` (23 client calls, 0 unwired) · render test now covers the dialogue panel.


### 9.14 The sales funnel — **implemented**

§6.4 was a three-stage pipeline with a discount toggle and no notion of qualification, quoting or contracted
revenue. The funnel is now a real object with four steps, and the arithmetic that decides each step lives in
one module (`src/game/sales.ts`) so the panel, the engine and the tests cannot disagree.

| Step | Rule | Where |
|---|---|---|
| Capture | Four sources roll independently each close: inbound scales with marketing spend, referrals with reputation and live retainers, outbound with sales headcount, events at a flat 8% | `arriveLeads` |
| Qualification | Costs ₦1,200 (memoed to the cash-flow statement) and buys +0.06 on the quote | `qualifyLead` |
| Score | 45% intent + 40% fit + 15% can-they-afford-it, banded hot/warm/cold at 70/45 | `scoreLead` |
| Quote | Seats × list price × (1 − discount), valid 2 months; chance = 0.10 + 0.52·score + 0.9·discount − 0.33·over-budget | `quoteValue`, `quoteChance` |
| Contract | Won quotes become retainers of 6, 9 or 12 months by value, billed monthly until the term ends | `contractTerm`, `tickContracts` |

**Why contracts do not enter `state.customers`:** they are B2B accounts on retainer, not consumers in the
demand model. Adding them would count their revenue twice (`customers × price` *and* the retainer) and make
them churn like consumers, which they do not. They are collected in-month, so they never touch receivables.

The ledger stays honest: retainer revenue is added to both `revenue` and `cashSales` and appears in the P&L;
the qualification fee posts to `flows.expenses`. `verify:statements` confirms the balance sheet still ties at
0 across all four industries, months in which a retainer pays included.

Decision ops `qualifyLead`, `sendQuote`, `dropLead` are journaled and replay identically; the close resolves
quotes from a seeded RNG (`rngFor(seed, 'funnel', month)`) so a replayed run signs the same retainers.

Server: `POST /api/companies/:id/sales/funnel` records the decision on the company (400 without a lead id),
and the run itself is re-executed server-side from the journal like every other decision.

UI: `src/components/game/SalesFunnel.tsx` in the Sales panel — score bars, over-budget warnings, discount
choice, quote odds, live-retainer terms with expiry bars, and the recently closed list.

Verification: `verify:centres` +31 funnel checks (`scoreLead`, `quoteChance`, quote maths, qualify/quote/drop,
retainer payout and expiry, report and statement integration, journal replay), `verify:render` +4 per
industry, `verify:api` +2 live endpoint checks.


### 9.15 Operations: purchase orders, lead times, capacity and returns — **implemented**

§6.2 and §6.9 were inventory cover, a restock slider and a supplier picker. Stock appeared from an invisible
formula (`incoming = restockMonths × reliability`) and nothing limited how many customers the business could
physically serve. `src/game/supply.ts` replaces that with three real constraints.

| Constraint | Rule |
|---|---|
| Purchase orders | Stock now arrives from an order. Each close delivers what is due, then places the policy order; a manual order can be placed for 0.5–4 months of cover (8 in flight max) |
| Lead times | Arrival = ordered month + supplier lead time + 1. Suppliers slip a month with probability `1 − reliability` (capped 35%); a slip is shown as "at risk" before it costs a stockout |
| Expedite | Pay a 12% premium to pull a delivery one month forward (memoed to `flows.expenses`) |
| Capacity | 220 + 30/teammate + ₦1 per ₦20k of fixed assets + 40/branch customer slots per month. Demand above capacity is unserved: that share of revenue is lost and the overflow churns 15% faster |
| Returns | Defect rate = 1.2% + `max(0, 3 − supplier quality) × 0.8pp` + 2pp per unit of overload + reliability penalty − quality credit, capped at 14%. Refunds are cash out, booked as an operating expense |
| Capacity investment | Capex of ₦20k per slot, capitalised to fixed assets and depreciated like any other asset |

**Balancing (measured, not guessed).** A first cut (base 34 slots, 10 per head) put every run ~100 slots
short from month 1: revenue fell to a fifth and net profit to −₦10k/month. The constraint now starts above the
opening customer base and only bites as demand grows — a passive 12-month run keeps its previous economics
(net ≈ +₦1k/month, revenue ≈ ₦16k), while a growth run hits the wall and has to hire, branch or buy slots.
Returns were similarly mis-scaled: reading supplier quality (−5…+5) directly as percentage points produced
10% refunds on every cheap supplier; it is now a nudge (1–5 points), 1–2% of revenue in normal play.

**Two real defects found while verifying:**

1. **The legit-play suite never actually replayed.** It called `advanceMonth` directly, so no `advanceDay`
   ops were journaled; the server's replay guard (`journal.length`) skipped replay entirely and fell back to
   scoring rounded canonical values. That fallback disagreed with the client by ±1 point on some seeds —
   which is what surfaced the problem. The suite now plays the way the store plays (one `advanceDay` op per
   day, `resolveCrisis` ops), and asserts the server returned `replay: { status: 'match', ops: 182 }`.
   Engine-to-engine parity is now exact across runs.
2. **The statements suite compared cash after post-close events.** Micro-events run after the statements are
   built and crises are answered between closes; both move cash and are memoed in `flows` for the next
   statement. The old assertion happened to pass because no such event had ever hit the final month. It is
   now a reconciliation: balance-sheet cash = engine cash − memoed between-close movements, which is stricter
   and caught the refund flow on its first run.

**Wiring.** `placeOrder`, `expediteOrder`, `cancelOrder` and `investCapacity` are journaled decisions
(`orderId`/`cover` validated, cover capped at 4) and re-executed by `PUT /run`. `POST
/api/companies/:id/operations/orders` records the decision live: 400 on an unknown action and on an expedite
without an order id (both covered by `verify:api`).

**Verification.** `verify:centres` +42 operations checks (order promises, slips, delivery, lateness, expedite,
cancellation, capacity maths, defect scaling, the close-level consequences of overload, capex accounting,
journal replay, op validation) · `verify:render` +4 per industry (operations panel, overload copy, no leaked
values) · `verify:api` +3 live checks · statements, determinism, replay and legit-play all green.


### 9.16 Six-competency rubric and PDF exports — **implemented**

**Rubric (§11.2).** Grading used four criteria at 30/30/20/20; the scope specifies six competencies weighted
25 / 20 / 15 / 15 / 15 / 10. The rubric is now:

| Competency | Weight | What it asks |
|---|---|---|
| Financial acumen | 25 | Protected cash, collected receivables, kept margins, funded growth deliberately |
| Strategy & priorities | 20 | A coherent position: price, product and customers pulling one way |
| Operational execution | 15 | Supply, capacity and quality held together under growth |
| Market & customer | 15 | Demand created and retained — funnel, pricing, churn |
| Leadership & team | 15 | Hired deliberately, kept morale, survived crises |
| Ethics & governance | 10 | Honest claims, defensible trade-offs, fair treatment |

Levels stay 1–4 (25/50/75/100 points), the grade is the weighted mean, and a written rationale of ≥40
characters is still required. Two compatibility decisions: **legacy four-criterion grades are still accepted**
(cash→finance, customers→market, operations→operations, judgement→strategy; leadership and integrity default
to Proficient, so four Exemplarys score 94) and the **CSV export carries the six new columns**. The client
mirror in `src/game/rubric.ts` is now checked against `backend/rubric.ts` by `verify:pdf`, so the two lists
cannot drift.

`suggestRubric(state)` produces a starting position from the run's own evidence (margin, runway, capacity,
retention, morale, balance-sheet integrity) with a one-line justification per competency. It is labelled as a
suggestion on the scorecard — the instructor's score replaces it.

**Exports (§11.3).** `src/lib/pdf.ts` is a ~230-line PDF writer (catalog, page tree, Helvetica, real xref
offsets, Latin-1 with transliteration for ₦ → "NGN" and · → "-"). Pulling a PDF library in for two documents
would have added a dependency and a bundle for arithmetic; the output is verified by parsing it with `pypdf`
during development and by structural checks in CI.

Two documents:
- **Month report** — revenue, cash, net profit, customers, margin, collections; P&L; cash and working capital;
  operations (capacity, unserved demand, orders in transit, retainer revenue); marketing with CAC/LTV; the
  month's drivers; the "education, not financial advice" line.
- **Run scorecard** — engine score and grade, valuation, cash, the six competencies with weighted points and
  the evidence behind each, reputation/quality/morale/debt, founder equity, the last published statements with
  the balance check, and — when the page is generated after a server commit — the server authority score and
  the difference from the engine score.

Both are wired into the UI: **Download PDF** in the month report, **Scorecard PDF** on the run-end screen —
the scorecard prints the server authority score from `game.authority` whenever the run has been committed.
Export is client-side by design: the documents are rendered from state the browser already holds, so an
offline run still exports. The server's contribution is the grade on the scorecard, which comes from
`GET /api/companies/:id/run` (authority score) — the rubric definition itself comes from `GET /api/rubric`.

**Verification.** New suite `verify:pdf` (32 checks): the file parses (`%PDF-1.4`, trailer, every xref offset
pointing at its own object), the figures on the page are the figures in the run, no ₦ glyph leaks, escaping of
`( ) \` is correct, filenames cannot escape the download directory, the client and server rubric lists match, and
the six weights sum to 100 with the boundary grades (25/75/100). `verify:api` now asserts six criteria from
`/api/rubric`, the 25/20/15/15/15/10 weights, a six-entry breakdown, legacy acceptance and the six CSV columns.

### 9.17 Scenario packs, four more industries, and an accounting bug the wider sweep found — **implemented**

**Industries (§ scope: "manufacturing, agriculture, health, education").** `IndustryId` went from four to
eight, each with its own demand, price, cost per customer, elasticity, inventory flag, seasonality and credit
terms:

| Industry | Starting cash | Starting customers | Price | Valuation multiple | Inventory | Credit terms |
|---|---|---|---|---|---|---|
| Manufacturing | ₦240 000 | 6 | ₦1 400 | 4.5× | yes | 50% on 45 days |
| Agriculture | ₦190 000 | 22 | ₦420 | 3.0× | yes | 30% on 30 days |
| Health & wellness | ₦220 000 | 14 | ₦950 | 5.0× | no | 40% on 30 days |
| Education & training | ₦165 000 | 55 | ₦190 | 3.4× | no | 10% on 15 days |

Each also carries its own supplier pool, competitor pool, marketing-channel fit and icon, and each appears in
the instructor scenario form and the backend industry allow-list (`backend/replay.ts`) — that allow-list is what
the server replay validates a saved run against, so a new industry that skipped it would have failed replay.

**Scenarios as data (§11.1).** `src/game/scenarios.ts` holds eight packs, each a *starting position plus a small
set of objectives*, never a fork of the engine:

| Pack | Industry | Difficulty | Window | Theme |
|---|---|---|---|---|
| The cash crunch | Retail | hardcore | 6 months | Survive on shrinking runway |
| The growth engine | SaaS | standard | 9 | Spend into demand without losing the plot |
| The capacity wall | Logistics | standard | 8 | Growth meets a hard ceiling |
| The harvest | Agriculture | hardcore | 6 | Seasonal revenue, lumpy cash |
| Clinic trust | Health | standard | 9 | Quality and reputation over volume |
| Factory floor | Manufacturing | hardcore | 6 | Lead times, payables, working capital |
| First cohort | Education | guided | 6 | A gentle first run |
| Table for two | Restaurant | standard | 6 | Thin margins, high churn |

A pack sets industry, strategy, difficulty, seed, starting cash, starting customers, optional price and debt;
`startGame({ scenarioId })` applies them and tags the run (`game.scenario`) with the id, title, window and
**`ruleVersion` ('2026.11')** so an old grade stays interpretable after a rule change. Objectives are measured
from state the engine already produces — cash, customers, reputation, quality, net profit, valuation, months
survived, contracts — so the debrief cannot disagree with the run. The verdict appears in the run-end modal and
on the scorecard PDF; the instructor panel's "Start from a scenario pack" select fills every field of the
existing custom-scenario form and persists `packId`, which the student's onboarding then locks to.

**The bug.** Widening `verify-statements` from four industries to all eight immediately failed manufacturing:
the balance sheet was off by ₦54 every month. The cause was real — closing stock is valued as
`round(units × unit cost)` while COGS is expensed from a separate customer-count formula, and when the valuation
implied *more* stock was consumed than had been expensed, `Math.max(0, cogs + inventoryDelta)` clamped the
purchase figure to zero and the shortfall vanished: inventory left the sheet and equity survived it. The fix
books that residual as COGS (`bookedCogs`), so assets and equity move together. This is exactly the class of
defect that only appears when coverage widens — it had been invisible in the four original industries.

**Verification.** New suite `verify:scenarios` (108 checks): pack schema (unique ids/seeds, all eight industries
covered, windows 4–12 months, 3–5 objectives per pack, metrics and targets well formed), pack-overrides-caller
precedence, free play staying untagged, six-month determinism per pack (same pack + same decisions = same
run), the verdict recomputing every objective from state, and a JSON save round-trip keeping the scenario and
its verdict. `verify:statements` now sweeps all eight industries (68 checks). The gate is **15 suites, 0
failures**; wiring is 23/23 client calls resolved.

### 9.18 Real-browser journeys and axe accessibility — **implemented and green in CI**

`verify:render` server-renders components from a real game state, and `verify:contrast` checks the token pairs
the UI uses — but neither touches a browser, so focus order, accessible names produced by the DOM and the
actual click path were untested. That gap is now closed:

| File | What it does |
|---|---|
| `playwright.config.ts` | Chromium, one worker, reduced motion, starts the API and the Vite dev server itself (reusing running ones), traces and screenshots on failure |
| `e2e/onboarding.spec.ts` | The Instructor link goes straight to `/lecturer`; a profile leads to the scenario picker; picking a pack shows its brief, window and objectives *and* collapses the industry grid to that pack's industry; clearing the chip restores free play |
| `e2e/a11y.spec.ts` | axe-core (WCAG 2.0/2.1 A + AA) over the landing page, both onboarding steps and the instructor sign-in; `serious`/`critical` violations fail with their targets in the message, `moderate` findings are printed |
| `scripts/verify-e2e.mjs` | `npm run verify:e2e` — runs the suite, or skips with an explicit message when no browser is installed. It never reports a pass it did not earn |
| `scripts/e2e-summary.mjs` | Turns the Playwright JSON report into `::error` annotations, so a failing run explains itself in `gh run view` even when the artifact cannot be downloaded |
| `.github/workflows/verify.yml` | A separate `e2e` job installs Chromium and runs the suite, so the fast `verify` job stays network-light |

**Status.** This sandbox cannot reach Playwright's CDN, so the suite was written and iterated through CI rather
than locally. It found real defects on the way, and each was fixed rather than suppressed:

1. **Success buttons failed contrast** — white on `#17C995` measured 2.13:1. The `lime` button variant now uses
   ink text (8.7:1), keeping white only on the darker hover fill.
2. **Instructor sign-in labels** — `white/45` on the lifted dark card measured 4.25:1; now `ink-300` (7.49:1).
3. **Onboarding step labels** — `ink-300` on light paper measured 2.19:1; future steps use `ink-400`.
4. **Landing avatar initials** — white on mid-tone fills (3.39–4.41:1); the palette is dark enough now.
5. **Landing live feed** — rows faded with `opacity-45`, dragging `ink-400` text to 2.7:1; rows are no longer
   faded. The tag also failed while an entrance animation was mid-fade, so axe now runs under reduced motion
   after a settle delay.
6. **City landmark buttons** — `aria-label` omitted the visible short name (`label-content-name-mismatch`), and
   the icon-only arrow to `/play` had no accessible name (`link-name`). Both fixed.
7. **Muted text across the app** — every `text-white/30–45` became `text-white/60`; below 50% white on `ink-950`
   the ratio falls under AA. `verify:contrast` now scans `src/` for that pattern (26 token pairs + a source scan)
   so the arithmetic gate catches it too, not just axe.

**Verified.** The `e2e` job is green on PR #5: 7 tests, 4 axe scans, no serious or critical violations on any
page audited.

### 9.19 Cohort comparison and competency profiles over time — **implemented**

Grades answered "what did this student get". They could not answer "where is this cohort weak", "who is
improving", or "how generous is my marking" — the questions an examiner or a programme lead actually asks.

**Grade history.** `ClassroomRecord` now keeps the last 20 grades (`history[]`: timestamp, grade, engine score
at grading time, rubric levels, rationale). The latest rubric alone cannot show development; a sequence can.
Existing records simply have no history until their next grade, so nothing is migrated or invented.

**`GET /api/classes/:id/comparison`** (instructor only — students get 403) is derived entirely from the roster
and that history, so the summary cannot drift from the marks it summarises:

| Section | Content |
|---|---|
| Headline | cohort size, students trading, graded count, rubric-graded count |
| Scoring | mean instructor grade, mean engine score, **marking delta** (instructor minus engine) |
| Competencies | per competency: mean level 1–4, level distribution, share at or above Proficient (≥3) |
| Distribution | engine score in five bands (0–39, 40–54, 55–69, 70–84, 85–100) |
| Trust | integrity counts (verified / flagged / broken chain), seed matches, replay verdicts |
| Profiles | per student: latest levels, recomputed weighted grade, grade history and the first-to-latest trend |

**UI.** `ComparisonCard` in the instructor portal renders all of it: competency bars stacked by level, the score
band chart, the trust counts, and a per-student table with a trend figure and six mini level bars. It loads with
the roster and refreshes after every grade, so the panel and the table below it always describe the same marks.

**Verification.** `verify:api` gained 16 checks (97 total, 0 failures): students are refused, the six competencies
and their 25/20/15/15/15/10 weights are present, bucket counts sum to the cohort rather than the graded subset,
the competency means and proficient shares match recorded levels, the profile recomputes the weighted grade,
every grade is retained in history, and the trend equals latest minus first. Wiring is now **24/24** client calls
resolved.

### 9.20 LTI Advantage passback (AGS) — **implemented, verified against a stub platform**

Marks had to leave the app to be useful in a course. This implements the grade passback half of LTI Advantage
(Assignment and Grade Services):

| Piece | Where |
|---|---|
| Platform keypair, created once and persisted (`kid`, public JWK, PKCS#8 private key) | `ensureLtiKeys` in `backend/lti.ts` |
| Public verification set the LMS fetches anonymously | `GET /api/lti/jwks` |
| RS256 client assertion: `iss`, `sub`, `aud` = token URL, `iat`, 5-minute `exp`, `jti` | `signAssertion` |
| OAuth2 client-credentials exchange, then an AGS score document | `passbackScore` |
| Per-cohort platform config (instructor only) and a recorded passback | `POST /api/classes/:id/lti`, `POST …/lti/passback` |
| UI: save platform, **preview** (default), send (confirmed), unlink | `LtiCard` in `Lecturer.tsx` |

A grade that leaves the building is written to that student's audit chain (`lti_passback`), so the passback is
as traceable as the mark it carries. A dry run returns the exact assertion header/claims and score payload
without opening a socket — the UI defaults to it because a sent grade cannot be recalled.

**Honest scope.** The OIDC `id_token` launch (login initiation and validation of the platform's signature),
Deep Linking and NRPS are **not** implemented; a cohort is configured with the platform's endpoints instead.
There is no retry queue: one student per call, and failures are reported per student rather than retried.

**Verification.** `verify:api` gained 22 checks (119 total, 0 failures). The passback is exercised end to end
against a **stub LMS started by the test**: it fetches our JWKS, verifies the RS256 signature with the published
key, checks the claims (issuer, client, audience, five-minute expiry), returns a token, and asserts the score
arrives with the AGS content type, the bearer token and a 100-point maximum. It also proves the platform config
is instructor-only (students get 403), that malformed URLs and unconfigured cohorts are refused, that a sent
grade reaches the audit chain, and that an unreachable platform fails per student instead of throwing. Wiring is
now **26/26** client calls resolved.

### 9.21 Role-based access control — **implemented**

Three roles existed (learner, instructor, administrator) but the rules were ad hoc: an `isInstructor` helper at
each route and a shared `x-admin-key` header for the admin surface. Two consequences, both real: an instructor
holding the deployment key had the admin console, and an `admin` role account could not use it **without** the
key.

`backend/rbac.ts` now holds the only copy of the rule:

| Role | Permissions |
|---|---|
| Learner | `company:write`, `cohort:read`, `rubric:read` |
| Instructor | learner's + `cohort:manage`, `grade:write`, `replay:read`, `lti:manage` |
| Administrator | all nine, including `admin:read` and `admin:configure` |

Route guards ask `can(player, permission)` instead of comparing role strings: cohort creation and the
instructor-owned class actions use `cohort:manage`, roster visibility uses `replay:read`, and the admin surface
accepts **either** an administrator session with `admin:read`/`admin:configure` **or** the deployment key (kept
for operators and scripts, which is what it was always for). `GET /api/rbac` publishes the matrix, `GET /api/me`
returns the caller's own permissions, and the instructor portal renders the same table, so the rules are visible
rather than implied.

**Verification.** `verify:api` gained 13 checks (132 total, 0 failures): the matrix is published and internally
consistent (every role names known permissions, instructor ⊇ learner, administrator = all of them), learners
hold no grading, LTI or platform permission, the session advertises its permissions, an instructor without the
key is refused by the admin console, an administrator role is accepted without one, and the deployment key still
works. Wiring is **27/27**.

**Not done, and stated plainly:** permissions are per role, not per record beyond the existing "my own students"
checks, there is no role assignment UI (roles come from registration/dev sign-in), and there are no per-department
or per-course scopes.

### 9.22 Postgres storage, ready for Neon — **implemented and verified against real Postgres**

The API had one datastore: a JSON file next to the server. That is fine for a
developer and wrong for a cohort of students — one process writing one document,
no concurrency control, no queryable records, no backup story beyond copying a
file.

**One seam, two drivers.** `backend/store.ts` is now a facade over
`loadDatabase()` / `saveDatabase()`; `backend/db/index.ts` chooses the driver from
`DATABASE_URL` (or `NEON_DATABASE_URL`). No route changed. The JSON driver stays:
running the whole app with no database is a useful property, not scaffolding. The
boot log states which driver is live, and a bad URL fails with one readable line
(`Storage is not reachable (postgres): connect ECONNREFUSED …`) instead of a pool
stack trace.

**Schema** (`backend/db/schema.sql`): one row per aggregate with the domain object
in `jsonb`, and the fields that are actually queried lifted into real columns —
`players.account_email` (generated), `players.role`, `sessions.token/expires_at`,
`companies.player_id/sector/status`, `classes.lecturer_id`, plus `class_students`
and `classroom_records` as real tables so membership and grades are SQL, not a
scan of a class document. `lti_keys` holds the LTI signing key; `app_meta` holds
the schema version. Everything is `if not exists`, so `npm run db:migrate` is
safe on every deploy. `docs/database.md` documents the mapping, the Neon setup,
the pooled-vs-direct endpoint choice, and rollback by branch.

**Writes are incremental.** The driver remembers the canonical JSON of each row it
has written (`canonicalJson`, keys sorted — `jsonb` does not preserve key order)
and a save touches only changed rows, then prunes removed ones, in one transaction
in dependency order. A month commit that changes one company writes one row.

**Verified against real Postgres.** `verify:db` (in `npm run verify`) runs the
schema and the driver against **PGlite — Postgres compiled to WASM, in-process** —
so the DDL, `on conflict` upserts, foreign keys, deletions and `jsonb` round-trip
are exercised by an actual Postgres, not a mock. 22 checks: schema applies and
every declared table exists; a full database round-trips unchanged (grade history
and the LTI private key included); a one-row change writes one row; an unchanged
save writes nothing; deleting a company removes its NPCs and leaves no orphans;
membership and grades are queryable; idempotency keys are unique per player; both
drivers return the same database for the same fixture.

**Honest limits.** No live Neon endpoint was contacted — this sandbox cannot reach
`*.neon.tech`, so TLS, pooling, cold start and branch switching are unverified
until the first deployment is smoke-tested — which is what `npm run db:smoke` is for: connection, TLS, the 12
tables, the schema version, and a write/read/delete of one probe row, with timings. There is no down-migration (rollback
is a Neon branch). And the simulation still runs in the browser: Postgres stores
the authoritative records, it does not make the run itself server-side — that is
still the remaining work named in §4 row 13.

### 9.23 Supabase as the target, and the pooling bug that decision exposed — **implemented**

The database target moved from Neon to Supabase. Both speak Postgres, so the driver
survives unchanged — but choosing a managed, *pooled* endpoint forced a real defect
into the open.

**The bug: transactions were not pinned to a connection.** The driver issued
`BEGIN`, the upserts and `COMMIT` through `pool.query()`. `pg`'s pool may hand out a
*different* backend connection per call, so under Supavisor/PgBouncer the
transaction can open on one connection and commit on another — or, worse, the
inserts run outside the transaction entirely. Against a single-connection database
(as in `verify:db`) it looks perfect. It would have failed exactly where it matters:
in production, under load, partially.

The fix: `PostgresStore` now leases one client for the whole save
(`pool.connect()`), runs everything on it, releases on both the success and error
paths, and **serialises saves** so two transactions cannot interleave. `verify:db`
proves all of it with a fake pool that hands out distinct connections: one leased
connection per transaction, `BEGIN`…`COMMIT` bracketed, released exactly once,
rolled back and released on failure, no partial rows, and no overlap between
concurrent saves.

**Supabase-specific hardening.**

| Concern | Handling |
|---|---|
| `public` is served over PostgREST to `anon` | The schema enables row-level security on all 12 tables (no policies = deny) **and** revokes `anon`/`authenticated` where those roles exist; `db:smoke` asserts on the live project that `anon` cannot select |
| Transaction-mode pooler (6543) loses session state | No session-scoped `SET`: the statement timeout is `SET LOCAL` inside the transaction (`DB_STATEMENT_TIMEOUT_MS`); no named prepared statements |
| Direct connections are IPv6-only on new projects | `docs/database.md` and `db:smoke` point at the pooler host and say why |
| Keys | The API uses the Postgres connection string only — no anon key, no service-role key, no REST client |
| Observability | `application_name=businesslife-api`, boot log names the live driver, connection logs show the client |

**Connecting a project.** `SUPABASE_DB_URL` in a gitignored `.env` is picked up
by the API and by both `db:*` scripts (`process.loadEnvFile`, no dependency);
anything already in the environment still wins, so deploy settings are never
shadowed. Two rough edges are fixed: `pg` printed a security warning on every
connection because Supabase copies `?sslmode=require` (the driver now rewrites it
to `verify-full`, which is what it actually enforces — asserted in `verify:db`),
and `db:migrate` used to die with a raw stack trace when the connection failed
(now a one-line cause plus the four realistic ones: wrong password, IPv6-only
direct host, paused project, wrong region).

**The string people actually copy.** The first attempt at connecting produced the
*project URL* and a publishable key — the panel next to the connection string — which
are meaningless to a Postgres driver. `npm run db:smoke -- --check '<string>'`
diagnoses a candidate offline and names the mistake: project URL, anon/publishable/
service key, untouched `[YOUR-PASSWORD]`, a pooler user without `postgres.<ref>`, a
broken percent-escape, a missing `sslmode`. Nine cases are pinned in
`scripts/verify-db-url.mjs` inside `npm run verify`, so the advice cannot rot.

**Tooling.** `npm run db:smoke` now detects the provider and pooler mode from the
URL, warns when `sslmode` is omitted or when a migration is pointed at the
transaction pooler, checks TLS, the 12 tables, the schema version and anon
exposure, then writes/reads/deletes a probe row and runs a transaction with a
local statement timeout. `db:migrate` warns if it is run through 6543.

**Verified.** `verify:db` is now 31 checks against real Postgres (PGlite), green;
the gate passes end to end. **Not verified:** a live Supabase endpoint — this
sandbox cannot reach `*.supabase.co`, so TLS with their certificate, Supavisor
behaviour, cold starts and PITR are untested until `db:smoke` is run on the real
project. That gap is stated in `docs/database.md` rather than papered over.

### 9.24 The first run on someone else's machine — **fixed**

Connecting a real project for the first time produced three failures that had
nothing to do with Supabase:

- **`npm install` had never been run** (or was partial), and every entry point died
  with a raw `ERR_MODULE_NOT_FOUND` resolver stack — `pg` from the db scripts,
  `esbuild` from `npm run dev:backend`. All three now say "node_modules is missing
  or incomplete — npm install" and exit 1. A dependency that *is* installed still
  raises its real error.
- **`PORT=8788` in `.env` silently broke the UI.** The API read `.env`; Vite did
  not, and proxied `/api` to its hardcoded 8787 default. Every call failed for a
  reason unrelated to the app. `vite.config.ts` now loads the same `.env`, so
  `PORT` is the single source of truth for both the listener and the proxy
  (`API_PROXY_TARGET` and `DEV_PORT` still override). Verified both ways: no
  `.env` → API 8787, app 5173, proxy 8787; `.env` with `PORT=8788` → API 8788,
  proxy 8788, with 8787 confirmed empty so the check cannot pass by accident.
- **The template told people to keep `PORT=8788`** while the README documented
  8787. Both now describe the same rule, and the `--check` path from 9.23 got used
  for real: the string it approved was the one that then migrated.

### 9.25 `SELF_SIGNED_CERT_IN_CHAIN` — **diagnosed, not papered over**

The first live migration failed at the TLS handshake, before a single statement ran.
The cause is almost never the database: Node ships its own root bundle and ignores
the Windows certificate store and the macOS Keychain, so a corporate proxy, VPN or
antivirus that re-signs TLS makes every Supabase connection fail while the browser
works fine.

Rather than tell people to switch verification off:

- **`npm run db:smoke -- --tls`** inspects the chain and nothing else. It proceeds
  in two passes — first ignoring trust to read the certificate, then with Node's
  default trust — and reports the subject, the **issuer** and the expiry, then
  whether the chain verifies. It **first shipped wrong**: a plain `tls.connect()`
  against 5432, which Postgres cannot answer, because Postgres waits for an
  SSLRequest packet and replies `S`/`N`/`E` before TLS begins — so a healthy
  server was reported as `ERR_SSL_WRONG_VERSION_NUMBER`. The probe is now a module
  that performs the real handshake, and `scripts/verify-tls-probe.mjs` drives it
  against in-process fake endpoints (S with a generated self-signed certificate,
  N, E with a message, and one that never answers), so the failure mode is
  covered rather than assumed. An issuer that is your employer, a VPN vendor or an
  antivirus confirms interception; `ENOTFOUND`/`ECONNREFUSED`/`ETIMEDOUT` mean the
  problem is the network and say so. Proven against a real self-signed server
  (`DEPTH_ZERO_SELF_SIGNED_CERT`) and against a public host (`✓ trusted`).
- **`DB_SSL_CA`** pins an extra root for the API and both scripts. Verified with a
  genuine handshake against that self-signed server: without the root the connect is
  rejected, with it the same handshake verifies — with `rejectUnauthorized` still
  true. Nine new `verify:db` checks cover the default, the pinned root, a missing
  file failing loudly by path, and the insecure path still warning.
- **`DB_SSL_INSECURE`** remains the last resort and now says so in the log: the
  connection stays encrypted but the server is not authenticated. Previously it
  downgraded silently.

`NODE_OPTIONS=--use-system-ca` and `NODE_EXTRA_CA_CERTS` need no code and are
documented first, because they keep verification on.

### 9.26 Exporting the interceptor's root, instead of guessing — **implemented**

`SELF_SIGNED_CERT_IN_CHAIN` left only one reasonable instruction ("find your
corporate root and point Node at it"), and that is where a person with a working
database gives up. `npm run db:trust` closes the loop:

1. it performs the real Postgres handshake and walks the presented chain
   (`getPeerCertificate(true)` → `issuerCertificate`, stopping on self-identity);
2. it prints each certificate's subject, issuer and expiry, so the interceptor is
   named rather than inferred;
3. it writes the chain to a gitignored `db-ca.pem`;
4. it **reconnects with that file pinned and verification on** — the file is proven
   before it is recommended, and the exact `.env` line is printed.

It adds nothing to the environment by itself, and says to check with IT first. The
chain walk and the pinning step are covered by `scripts/verify-tls-probe.mjs`
against a real self-signed endpoint: export → parse with `X509Certificate` →
reconnect with `ca` → verify. Ten checks now, ~2s.
