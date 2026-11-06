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

**Rough coverage of the scope document: ~30% implemented, ~25% partial, ~45% absent** — weighted by MVP acceptance criteria (§16.2), where it is **3 pass / 6 partial / 4 fail** (see §4).

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
| 1 | Learner creates profile and configures a business | ✅ Pass | Onboarding + company creation |
| 2 | Set marketing budget and launch campaigns | ⚠️ Partial | Client exposes a budget slider only; a server campaign endpoint exists (`POST /marketing/campaigns`) but has no demand model and is never called by the UI |
| 3 | Leads convert into customers/orders under defined rules | ⚠️ Partial | Pipeline deals + demand model; no lead funnel |
| 4 | Orders consume inventory or capacity | ⚠️ Partial | Inventory affects supply factor; capacity is a soft overload penalty |
| 5 | Hire staff and process salaries | ✅ Pass | Hire/fire + monthly payroll cost |
| 6 | Invoices and payment schedules affect cash at the right time | ❌ Fail | No invoices, no schedules |
| 7 | Pay suppliers and recurring expenses | ⚠️ Partial | Costs are automatic; no payment actions |
| 8 | View cash forecasts and financial statements | ⚠️ Partial | Runway/burn metrics only; no statements |
| 9 | Decisions produce consistent, explainable consequences | ⚠️ Partial | Good month-report drivers, but random and client-side |
| 10 | Complete a scored scenario and receive a performance report | ✅ Pass | Score + grade + debrief (but free-form run, not a configured scenario) |
| 11 | Instructor can review decisions and replay the scenario | ❌ Fail | No instructor surface, no replay |
| 12 | Scenario resets to a reproducible starting state | ❌ Fail | Reset exists; reproducibility does not |
| 13 | Unauthorised users cannot alter balances or scores | ❌ Fail | State lives in `localStorage`; any user can edit balances/score directly |

**Result: 3 pass · 6 partial · 4 fail.** *(Superseded: 5 pass · 7 partial · 1 fail after §9,
then 7 pass · 6 partial · 0 fail after §9.6. Rows 6 and 8 now pass after §9.6/§9.8 —
invoices and schedules move cash at the right time, and the three statements exist.)*

---

## 5. Section-by-section traceability

| Spec § | Area | Status |
|---|---|---|
| 1 | Vision & positioning | 🟡 Directionally aligned; "AI-powered" claim not true of the product |
| 2 | Objectives & principles | 🟡 Interconnected consequences ✅, rules-based ✅, business-type adaptive 🟡, global/configurable ❌ |
| 3 | Roles & permissions | 🔴 Missing (single player role; admin key only) |
| 4 | Player journey & game modes | 🟡 Journey ≈ steps 4–11 playable; **no guided/career/challenge/cohort/team/sandbox/executive mode switch**; steps 1–3 (discovery, validation) only as text in onboarding |
| 5 | World & industry templates | 🟡 2.5D city with 8 landmarks; 4 of 8 industries; no template framework |
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
