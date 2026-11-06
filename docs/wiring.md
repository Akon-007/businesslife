# Frontend ↔ backend wiring

What the browser actually calls, what the server exposes, and which side of the line each feature sits on.
`npm run verify:wiring` derives the "client calls" column from source and **fails if a client path has no
server route** — so this table cannot silently drift.

Last verified against the running suite: 23 client calls all resolve, 13 server routes have no client caller.

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
| Rubric | `fetchRubric` | `GET /api/rubric` | `verify:api` |
| Instructor cohorts | `listCohorts`, `createCohort`, `inviteStudents`, `setScenario`, `fetchRoster`, `gradeStudent`, `resetStudent`, `exportRoster` | `GET/POST /api/classes`, `POST /api/classes/:id/{invite,scenario,grade,reset}`, `GET /api/classes/:id/roster`, `GET …/export.csv` | `verify:api`, `verify:auth` |

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
| `GET /api/health` | Liveness | Used by CI and uptime monitors, not the browser |

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
