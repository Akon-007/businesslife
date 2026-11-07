# Frontend ↔ backend wiring

What the browser actually calls, what the server exposes, and which side of the line each feature sits on.
`npm run verify:wiring` derives the "client calls" column from source and **fails if a client path has no
server route** — so this table cannot silently drift.

Last verified against the running suite: 27 client calls all resolve, 14 server routes have no client caller.

## Player-facing features (wired)

| Feature | Client entry point | Server route(s) | Proven by |
|---|---|---|---|
| Sign up / sign in / dev sign-in | `src/lib/api.ts` `authenticate`, `signOut` | `POST /api/auth/register`, `/login`, `/dev-login`, `/logout` | `verify:api`, `verify:auth` |
| Unique business name | `checkName` | `GET /api/companies/name-availability` | `verify:api` |
| Create company | `createRemoteCompany` | `POST /api/companies` | `verify:api` |
| **Month commit + decision journal** | `store.syncRun` → `commitRun` | `PUT /api/companies/:id/run` | `verify:api`, `verify:replay`, `verify:legit` |
| **Server replay of a run** | `fetchReplay` (§ instructor) | `GET /api/companies/:id/replay` | `verify:replay` |
| Audit chain | `fetchAudit` (instructor) | `GET /api/companies/:id/audit` | `verify:api` |
| Missions | `syncMission` | `POST /api/companies/:id/missions/:missionId/complete` | `verify:api` |
| Funding decisions | `postFundingResponse` | `POST /api/funding/offers/:offerId/response` | `verify:api` |
| Generic company actions (supplier, branch, pipeline, mission evidence…) | `syncCompanyAction` | `POST /api/companies/:id/:action` | `verify:api` |
| Nova advice | `askAdvisor` (Nova panel) | `POST /api/companies/:id/ai/advice` | `verify:api` (AI guardrails) |
| **Character dialogue** | `CharacterDialogue` → `fetchCharacters` + `talkToCharacter` | `GET /api/companies/:id/ai/characters`, `POST …/ai/dialogue` | render test + `verify:api` |
| Rubric (six competencies) | `fetchRubric` (instructor grading) | `GET /api/rubric`; grades post to `POST /api/classes/:id/grade` | `verify:api`, `verify:pdf` |
| **Operations: purchase orders, expedite, capacity capex** | `OperationsPanel` → `placeOrder` / `expediteOrder` / `cancelOrder` / `investCapacity` (journaled) + `syncCompanyAction('operations/orders')` | `POST /api/companies/:id/operations/orders`, and the decisions ride in `PUT /run` | `verify:centres`, `verify:api` |
| **Sales funnel** | `SalesFunnel` → `qualifyLead` / `sendQuote` / `dropLead` (journaled) + `syncCompanyAction('sales/funnel')` | `POST /api/companies/:id/sales/funnel`, and the decisions ride in `PUT /run` | `verify:centres`, `verify:api` |
| **Scenario packs (8) + four new industries** | `Onboarding` pack picker → `store.start({ scenarioId })` → `startGame` (pack fixes industry, strategy, difficulty, seed, cash, demand); instructor `ScenarioPanel` assigns `packId` | `POST /api/classes/:id/scenario` (packId persisted); the run itself rides in `PUT /run` | `verify:scenarios`, `verify:statements` (all 8 industries), `verify:api` |
| **Roles & permissions** | `fetchRoleMatrix` → `RoleCard` in `Lecturer.tsx` renders the same matrix the server enforces | `GET /api/rbac`; `GET /api/me` also returns the caller's permissions | `verify:api` (13 checks) |
| **LTI Advantage passback** | `configureLti` / `passbackGrades` → `LtiCard` in `Lecturer.tsx` (preview is the default; sending asks for confirmation) | `POST /api/classes/:id/lti`, `POST …/lti/passback`; the LMS fetches `GET /api/lti/jwks` anonymously | `verify:api` (22 checks, including a stub platform that verifies our RS256 assertion) |
| **Cohort comparison + competency profiles** | `fetchComparison` (instructor) → `ComparisonCard` in `Lecturer.tsx` | `GET /api/classes/:id/comparison` (instructor only; 403 for students) | `verify:api` |
| Instructor cohorts | `listCohorts`, `createCohort`, `inviteStudents`, `setScenario`, `fetchRoster`, `gradeStudent`, `resetStudent`, `exportRoster` | `GET/POST /api/classes`, `POST /api/classes/:id/{invite,scenario,grade,reset}`, `GET /api/classes/:id/roster`, `GET …/export.csv` | `verify:api`, `verify:auth` |

**Payment runs, the marketing mix and the funnel decisions are journal ops**, carried inside the
`PUT /companies/:id/run` commit where the server re-executes them; `sales/funnel` additionally records the
decision on the company so an instructor can see it without replaying.

**Payment runs and the marketing mix need no new routes.** They are player decisions, so they travel as
journal ops (`payBill`, `payAllBills`, `setMarketingChannel`, `setMarketingMix`) inside the `PUT /run`
commit, and the server re-executes them. That is deliberate: a decision that only existed as a client-side
mutation would be invisible to replay and unverifiable.

## Server-only routes (built, no UI caller yet)

| Route | What it does | Why it is unwired |
|---|---|---|
| `GET /api/me` | Current player from the session | The client keeps its own session record after sign-in |
| `GET /api/stages`, `/api/stages/beginner`, `/api/progression` | Stage and level catalogue | Progression is bundled in the client (`src/game/progression.ts`); the server copy exists for the instructor side |
| `GET /api/apps` | Fictional in-game brand list | Apps panel uses the bundled list |
| `GET /api/city` | City districts and properties | The 2.5D city is drawn from bundled data |
| `GET /api/marketplace`, `/api/marketplace/businesses/:id`, `POST /api/marketplace/{enquiries,follow,message}`, `POST /api/marketplace/quotations/:id/accept` | Marketplace: browse, enquire, quote, order, message | Whole B2B marketplace is unbuilt in the UI (audit §3 item 6/16) |
| `GET/POST /api/admin/{config,city,activity,events}` | Platform admin | No admin console |
| `GET /api/lti/jwks` | Public signing keys for LTI assertions | The LMS fetches it, not the browser |
| `GET /api/health` | Liveness | Used by CI and uptime monitors, not the browser |

### Client-only by design

| Feature | Why there is no route |
|---|---|
| PDF month report and run scorecard (`src/lib/pdf.ts`, `src/game/report-pdf.ts`) | Rendered from state the browser already holds, so an offline run still exports. The one server-derived number on the scorecard — the authority score — is already fetched from `GET /api/companies/:id/run` and printed alongside the engine score |
| Scenario verdict (`src/game/scenarios.ts` `evaluateScenario`) | Computed from the run's own final state against the pack's objectives, using the pack's stamped `ruleVersion`. No server call is needed, and the scorecard and the run-end modal therefore cannot disagree. The *assignment* is server-side (`POST /classes/:id/scenario`); only the arithmetic is local |

## Server-side storage

Storage is not a route, so it does not appear in the tables above. The API talks to
`loadDatabase()` / `saveDatabase()`; the driver is chosen by `DATABASE_URL` (JSON
file by default, Postgres/Neon when set). The boot log names the live driver, and
`npm run verify:db` exercises the Postgres schema and driver against real Postgres
(PGlite). See `docs/database.md`.

## Known integration gaps (tracked, not hidden)

1. **Server `forecast`, `operations/overview`, `notifications`, `npcs`, `products`, `procurement`,
   `marketing/campaigns`, `financial-reports`, `compliance`, `business-plan`, `pitch-decks`, `popups`** —
   reachable through `POST /api/companies/:id/:action` and the special-company route, but no screen calls
   them. Several are thin stubs; wiring them without product design would just move the gap.
2. **`GET /api/companies/:id/run`** is used on instructor load only; the player's own state lives in
   `localStorage` and is committed, not fetched, each month.
3. The marketplace and admin surfaces are the two places where the backend is materially ahead of the UI.

## How this is kept honest

- `node scripts/verify-wiring.mjs` (in `npm run verify`) parses `backend/server.ts` for literal routes,
  regex matchers and `/:id/<action>` sub-actions, parses every `request()` / `fetch()` call under `src/`,
  and fails on any client path that does not resolve. It also prints the server-only list above.
- Guard: if extraction ever finds fewer than 15 literal routes or 8 regex routes it fails loudly instead of
  reporting a false pass.
- `npm run verify:render` then proves the panels that consume those routes render from a real game state.
- `npx playwright test` (CI job `e2e`) walks the real journeys in a real browser — the Instructor link, onboarding
  into a scenario pack, and the industry lock — and runs axe over the landing, onboarding and instructor pages.
