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
npm run verify          # integrity + scoring parity + legitimate-play checks (API must be running)
npm run verify:api      # server authority, AI guardrails, cohorts, CSV, audit chain
npm run verify:scoring  # client score == server score across industries/strategies/months
npm run verify:legit    # six months of honest play is never flagged as tampering
npm run build           # production build
npm run lint            # oxlint
```

## Architecture notes

| Concern | Where |
|---|---|
| Monthly simulation (client engine) | `src/game/engine.ts` |
| Protected game state, bounds, tamper-evident audit chain | `backend/authority.ts` |
| AI gateway, characters, guardrails, grounding | `backend/ai.ts` |
| Cohorts, roster, CSV export | `backend/classroom.ts`, `routes` in `backend/server.ts` |
| Instructor portal | `src/pages/Lecturer.tsx` |

### Server authority

The simulation still runs in the browser, but the server owns the fields that matter for
assessment: **score, month, cash, customers, revenue, valuation**. Every month close commits a
snapshot (`PUT /api/companies/:id/run`), which is checked against economic plausibility bounds
(cash movement, customer growth, revenue vs price, quality/reputation drift, per-month stability),
corrected to the canonical value where it fails, and recorded in a SHA-256 hash chain
(`GET /api/companies/:id/audit`). A hand-edited browser save therefore cannot produce a forged
balance or a forged score — it produces a `flagged` commit and a corrected figure. Scores are
always recomputed server-side; the client's number is never trusted.

### AI gateway

`AI_PROVIDER=openai-compatible AI_BASE_URL=… AI_MODEL=… AI_API_KEY=…` enables any OpenAI-compatible
provider. Without those variables the gateway runs a deterministic provider that answers from the
same authoritative figures, so the product works offline and in CI. Guardrails are enforced
regardless of provider: prompt-injection refusal, per-character knowledge scoping (a customer never
sees your cash), numeric grounding (a reply may only cite supplied figures or it is rejected and
falls back), rate limiting, and trace logging. No provider receives a tool that can change state.

### Cohorts

Instructors create cohorts, invite students by id or account email, assign a scenario (industry,
difficulty, starting capital, months, objectives), review server-verified scores and integrity
flags, grade with feedback, reset a run to its scenario start, and export CSV. Every grade and
reset is written to the student's audit chain. A dev instructor session stands in for
institutional SSO.

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `HOST` | `8787` / `127.0.0.1` | API bind |
| `ADMIN_KEY` | `dev-admin` | Admin endpoints (development only) |
| `AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY` | unset | Enables the OpenAI-compatible provider |
| `DEV_PORT` / `API_PROXY_TARGET` | `5173` / `http://127.0.0.1:8787` | Vite server port and API proxy target |
| `API` | `http://127.0.0.1:8788` | Target for verification scripts |

## Status

See `AUDIT.md` for the implementation audit against the comprehensive development scope, including
what is implemented, partial and not implemented.
