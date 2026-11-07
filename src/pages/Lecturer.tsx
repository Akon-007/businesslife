import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Download,
  GraduationCap,
  Loader2,
  LogOut,
  Plus,
  RefreshCcw,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { clsx } from 'clsx'
import { Logo } from '../components/ui/Logo'
import { buttonClass } from '../components/ui/Button'
import {
  assignScenario,
  clearSession,
  createClass,
  downloadRosterCsv,
  configureLti,
  fetchComparison,
  fetchRoleMatrix,
  type RoleMatrix,
  fetchReplay,
  passbackGrades,
  type LtiPassbackResult,
  fetchRoster,
  gradeStudent,
  instructorLogin,
  instructorSession,
  inviteStudent,
  listClasses,
  resetStudent,
  type Cohort,
  type RosterEntry,
  type CohortComparison,
} from '../lib/api'
import { money, number } from '../lib/format'
import { DEFAULT_RUBRIC, MIN_RATIONALE, RUBRIC, RUBRIC_LEVELS, localGrade, type RubricId, type RubricScores } from '../game/rubric'
import { SCENARIOS, scenarioById } from '../game/scenarios'

const INDUSTRIES = [
  { id: 'saas', label: 'Technology / SaaS' },
  { id: 'fnb', label: 'Restaurant & hospitality' },
  { id: 'retail', label: 'Retail & e-commerce' },
  { id: 'logistics', label: 'Logistics & transport' },
  { id: 'manufacturing', label: 'Manufacturing' },
  { id: 'agriculture', label: 'Agriculture & agri-processing' },
  { id: 'healthcare', label: 'Health & wellness' },
  { id: 'education', label: 'Education & training' },
]

const REPLAY_COPY: Record<RosterEntry['replay'], { label: string; tone: string; title: string }> = {
  match: { label: 'Replay ✓', tone: 'bg-brand-50 text-brand-700', title: 'The server re-ran this journal and reproduced the same figures.' },
  mismatch: { label: 'Replay ✗', tone: 'bg-coral-soft text-coral', title: 'The server replay disagrees with the committed figures.' },
  error: { label: 'Replay error', tone: 'bg-gold-soft text-[#8a5b00]', title: 'The decision journal could not be replayed.' },
  none: { label: 'No replay', tone: 'bg-paper-3 text-ink-500', title: 'No decision journal has been committed yet.' },
}

const INTEGRITY_COPY: Record<RosterEntry['integrity'], { label: string; tone: string }> = {
  verified: { label: 'Verified', tone: 'bg-brand-50 text-brand-700' },
  flagged: { label: 'Flagged', tone: 'bg-gold-soft text-[#8a5b00]' },
  'broken-chain': { label: 'Chain broken', tone: 'bg-coral-soft text-coral' },
  'no-data': { label: 'No data', tone: 'bg-paper-3 text-ink-500' },
}

export default function Lecturer() {
  const [signedIn, setSignedIn] = useState(() => Boolean(instructorSession()))
  const [classes, setClasses] = useState<Cohort[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [roster, setRoster] = useState<RosterEntry[]>([])
  const [comparison, setComparison] = useState<CohortComparison | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selected = useMemo(() => classes.find((item) => item.id === selectedId) ?? null, [classes, selectedId])

  const refresh = useCallback(
    async (cohortId?: string) => {
      try {
        const list = await listClasses()
        setClasses(list)
        const target = cohortId ?? selectedId ?? list[0]?.id ?? ''
        setSelectedId(target)
        if (target) {
          const result = await fetchRoster(target)
          setRoster(result.roster)
        } else {
          setRoster([])
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : 'Could not load cohorts.')
        setSignedIn(false)
        clearSession('instructor')
      }
    },
    [selectedId],
  )

  useEffect(() => {
    if (signedIn) void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn])

  const run = async (action: () => Promise<unknown>, success?: string) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await action()
      if (success) setNotice(success)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'That action failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!signedIn) {
    return (
      <LecturerLogin
        onSignedIn={() => {
          setSignedIn(true)
        }}
      />
    )
  }

  return (
    <div className="min-h-svh bg-paper text-ink">
      <header className="border-b border-line bg-white">
        <div className="container-page flex flex-wrap items-center gap-3 py-4">
          <Link to="/" aria-label="BUSINESSLIFE home" className="shrink-0">
            <Logo />
          </Link>
          <span className="hidden h-7 w-px bg-line sm:block" />
          <div className="min-w-0 flex-1">
            <p className="font-display text-[15px] font-semibold">Instructor portal</p>
            <p className="text-[11px] text-ink-400">Cohorts, scenarios, verification and grades</p>
          </div>
          <Link to="/play" className={buttonClass('ghost', 'sm')}>
            <ArrowLeft className="size-3.5" />
            Player view
          </Link>
          <button
            type="button"
            onClick={() => {
              clearSession('instructor')
              setSignedIn(false)
              setClasses([])
              setRoster([])
            }}
            className={buttonClass('ghost', 'sm')}
          >
            <LogOut className="size-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <main id="main" className="container-page grid gap-4 py-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-3">
          <CreateCohort
            busy={busy}
            onCreate={(name) =>
              run(async () => {
                const cohort = await createClass(name)
                await refresh(cohort.id)
              }, 'Cohort created.')
            }
          />
          <section className="rounded-2xl border border-line bg-white p-3">
            <p className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">Your cohorts</p>
            <ul className="mt-2 space-y-1">
              {classes.length === 0 ? <li className="rounded-xl bg-paper-2 px-3 py-4 text-[11.5px] text-ink-500">No cohorts yet. Create one to begin.</li> : null}
              {classes.map((cohort) => (
                <li key={cohort.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(cohort.id)
                      void run(async () => {
                        const [result, stats] = await Promise.all([fetchRoster(cohort.id), fetchComparison(cohort.id)])
                        setRoster(result.roster)
                        setComparison(stats)
                      })
                    }}
                    className={clsx(
                      'flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[12px] font-semibold transition',
                      cohort.id === selectedId ? 'bg-ink text-white' : 'text-ink-600 hover:bg-paper-3',
                    )}
                  >
                    <span className="truncate">{cohort.name}</span>
                    <span className={clsx('shrink-0 text-[10px] font-bold', cohort.id === selectedId ? 'text-lime' : 'text-ink-400')}>
                      {cohort.studentIds.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        <section className="space-y-4">
          {error ? <Banner tone="bad" icon={AlertTriangle}>{error}</Banner> : null}
          {notice ? <Banner tone="good" icon={BadgeCheck}>{notice}</Banner> : null}

          {!selected ? (
            <div className="rounded-2xl border border-dashed border-line bg-white px-6 py-16 text-center">
              <GraduationCap className="mx-auto size-8 text-ink-300" />
              <p className="mt-3 font-display text-[16px] font-semibold">Create your first cohort</p>
              <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-ink-500">
                Cohorts share a scenario, a starting capital and a deadline. Students keep their own company; you see
                the server-verified score, not the number their browser claims.
              </p>
            </div>
          ) : (
            <>
              <ScenarioCard
                cohort={selected}
                busy={busy}
                onAssign={(scenario) =>
                  run(async () => {
                    await assignScenario(selected.id, scenario)
                    await refresh(selected.id)
                  }, 'Scenario assigned to the cohort.')
                }
              />
              <RosterCard
                cohort={selected}
                roster={roster}
                busy={busy}
                onInvite={(value) =>
                  run(async () => {
                    const payload = value.includes('@') ? { email: value } : { studentId: value }
                    await inviteStudent(selected.id, payload)
                    await refresh(selected.id)
                  }, 'Student added to the cohort.')
                }
                onGrade={(studentId, grade, rationale, rubric) =>
                  run(async () => {
                    const result = await gradeStudent(selected.id, { studentId, grade, rationale, rubric, feedback: rationale })
                    setRoster(result.roster)
                    setComparison(await fetchComparison(selected.id))
                  }, 'Grade and rationale recorded.')
                }
                onReset={(studentId) =>
                  run(async () => {
                    const result = await resetStudent(selected.id, studentId)
                    setRoster(result.roster)
                  }, 'Run reset to scenario start.')
                }
                onReplay={(_studentId, companyId) =>
                  run(async () => {
                    const verdict = await fetchReplay(companyId, 'instructor')
                    await refresh(selected.id)
                    if (verdict.status === 'match') return
                    throw new Error(verdict.error ?? `Replay returned ${verdict.status}.`)
                  }, 'Server replay reproduced the run.')
                }
                onExport={() =>
                  run(async () => {
                    await downloadRosterCsv(selected.id, `${selected.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}-roster.csv`)
                  })
                }
              />
              {comparison ? <ComparisonCard comparison={comparison} /> : null}
              <LtiCard cohort={selected} onSaved={() => void refresh(selected.id)} />
              <RoleCard />
            </>
          )}
        </section>
      </main>
    </div>
  )
}

function LecturerLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    if (password && password.length < 8) {
      setError('Use a password of at least 8 characters.')
      setBusy(false)
      return
    }
    try {
      await instructorLogin(name.trim(), email.trim() || undefined, password || undefined, code.trim() || undefined)
      onSignedIn()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign in failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-svh place-items-center bg-ink px-4 py-10 text-white">
      <div className="w-full max-w-md">
        <Link to="/" aria-label="BUSINESSLIFE home" className="inline-block">
          <Logo dark />
        </Link>
        <h1 className="mt-6 font-display text-[26px] font-semibold leading-tight">Instructor portal</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-white/60">
          Create cohorts, assign scenarios, review server-verified performance and export grades. Sign in with an
          institution email and password, or leave the password blank for a local dev session.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-300">Your name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              maxLength={60}
              placeholder="Dr Amaka Obi"
              className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-ink-950 px-3 text-[13px] text-white outline-none focus:border-lime"
            />
          </label>
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-300">Institution email (optional)</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={120}
              placeholder="amaka@business-school.edu"
              className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-ink-950 px-3 text-[13px] text-white outline-none focus:border-lime"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-300">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                autoComplete="current-password"
                placeholder="8+ characters"
                className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-ink-950 px-3 text-[13px] text-white outline-none focus:border-lime"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-300">Instructor code</span>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="from your school"
                className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-ink-950 px-3 text-[13px] text-white outline-none focus:border-lime"
              />
            </label>
          </div>
          {error ? <p className="rounded-xl bg-coral/20 px-3 py-2 text-[11.5px] font-semibold text-coral">{error}</p> : null}
          <button type="submit" disabled={busy} className={clsx(buttonClass('lime', 'md'), 'w-full justify-center')}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <GraduationCap className="size-4" />}
            Enter portal
          </button>
        </form>
        <p className="mt-4 text-[11px] leading-relaxed text-ink-300">
          Every grade, reset and scenario change is written to the student's audit chain by the server. Instructor
          accounts need the code your school configured; without one you get a dev session that is disabled in production.
        </p>
      </div>
    </div>
  )
}

function CreateCohort({ busy, onCreate }: { busy: boolean; onCreate: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (!name.trim()) return
        onCreate(name.trim())
        setName('')
      }}
      className="rounded-2xl border border-line bg-white p-3"
    >
      <p className="px-1 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-400">New cohort</p>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={60}
        placeholder="MBA 2027 · Section B"
        aria-label="Cohort name"
        className="mt-2 h-10 w-full rounded-xl border border-line bg-white px-3 text-[12px] outline-none focus:border-brand-400"
      />
      <button type="submit" disabled={busy || !name.trim()} className={clsx(buttonClass('primary', 'sm'), 'mt-2 w-full justify-center')}>
        <Plus className="size-3.5" />
        Create cohort
      </button>
    </form>
  )
}

function ScenarioCard({
  cohort,
  busy,
  onAssign,
}: {
  cohort: Cohort
  busy: boolean
  onAssign: (scenario: Record<string, unknown>) => void
}) {
  const current = cohort.scenario as { title?: string; industry?: string; difficulty?: string; startingCash?: number; months?: number; objectives?: string[]; seed?: number } | null
  const [title, setTitle] = useState(current?.title ?? 'Cash discipline sprint')
  const [industry, setIndustry] = useState(current?.industry ?? 'saas')
  const [difficulty, setDifficulty] = useState(current?.difficulty ?? 'standard')
  const [startingCash, setStartingCash] = useState(String(current?.startingCash ?? 5_000_000))
  const [months, setMonths] = useState(String(current?.months ?? 12))
  const [objectives, setObjectives] = useState((current?.objectives ?? ['Reach break-even', 'Hold churn under 5%']).join('\n'))
  const [seed, setSeed] = useState(current?.seed ? String(current.seed) : '')
  const [packId, setPackId] = useState<string>((current as { packId?: string | null } | null)?.packId ?? '')

  function applyPack(id: string) {
    setPackId(id)
    const chosen = scenarioById(id)
    if (!chosen) return
    setTitle(chosen.title)
    setIndustry(chosen.industry)
    setDifficulty(chosen.difficulty)
    setStartingCash(String(chosen.startingCash))
    setMonths(String(chosen.months))
    setSeed(String(chosen.seed))
    setObjectives(chosen.objectives.map((objective) => objective.label).join('\n'))
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-brand-700" />
        <p className="font-display text-[14px] font-semibold">Scenario</p>
        {current?.title ? <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[10px] font-bold text-ink-500">{current.title}</span> : null}
        {current?.seed ? (
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-800">seed #{current.seed}</span>
        ) : null}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onAssign({
            packId: packId || null,
            title,
            industry,
            difficulty,
            startingCash: Number(startingCash) || 0,
            months: Number(months) || 12,
            seed: Number(seed) || undefined,
            objectives: objectives.split('\n').map((line) => line.trim()).filter(Boolean),
          })
        }}
        className="mt-3 grid gap-3 sm:grid-cols-2"
      >
        <Field label="Start from a scenario pack" hint="Fills every field below from a fixed, versioned pack.">
          <select value={packId} onChange={(event) => applyPack(event.target.value)} className={inputClass}>
            <option value="">Custom scenario</option>
            {SCENARIOS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title} · {item.industry} · {item.months}mo
              </option>
            ))}
          </select>
        </Field>
        <Field label="Title">
          <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={70} className={inputClass} />
        </Field>
        <Field label="Industry">
          <select value={industry} onChange={(event) => setIndustry(event.target.value)} className={inputClass}>
            {INDUSTRIES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Difficulty">
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value)} className={inputClass}>
            {['gentle', 'standard', 'hard'].map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field label="Starting capital (₦)">
          <input
            type="number"
            min={0}
            step={100000}
            value={startingCash}
            onChange={(event) => setStartingCash(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Months">
          <input type="number" min={1} max={60} value={months} onChange={(event) => setMonths(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Replay seed (blank = generate)">
          <input
            type="number"
            min={1}
            placeholder="auto"
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Objectives (one per line)">
          <textarea
            value={objectives}
            onChange={(event) => setObjectives(event.target.value)}
            rows={3}
            className={clsx(inputClass, 'h-auto py-2')}
          />
        </Field>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className={clsx(buttonClass('primary', 'sm'), 'justify-center')}>
            <RefreshCcw className="size-3.5" />
            Assign to {cohort.studentIds.length} student{cohort.studentIds.length === 1 ? '' : 's'}
          </button>
          <p className="mt-2 text-[10px] leading-relaxed text-ink-400">
            The seed is shared by everyone in the cohort, so differences in the roster come from decisions,
            not luck. Students see the seed on their onboarding screen; the roster flags any run that used a different one.
          </p>
        </div>
      </form>
    </section>
  )
}

function RosterCard({
  cohort,
  roster,
  busy,
  onInvite,
  onGrade,
  onReset,
  onExport,
  onReplay,
}: {
  cohort: Cohort
  roster: RosterEntry[]
  busy: boolean
  onInvite: (value: string) => void
  onGrade: (studentId: string, grade: number, rationale: string, rubric: Record<string, number>) => void
  onReset: (studentId: string) => void
  onReplay: (studentId: string, companyId: string) => void
  onExport: () => void
}) {
  const [invite, setInvite] = useState('')
  const [grading, setGrading] = useState<string | null>(null)
  const [rubric, setRubric] = useState<RubricScores>(DEFAULT_RUBRIC)
  const [rationale, setRationale] = useState('')
  const previewGrade = localGrade(rubric)
  const rationaleReady = rationale.trim().length >= MIN_RATIONALE

  const average = roster.length ? Math.round(roster.reduce((total, entry) => total + entry.score, 0) / roster.length) : 0

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Users className="size-4 text-brand-700" />
        <p className="font-display text-[14px] font-semibold">Roster</p>
        <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[10px] font-bold text-ink-500">avg score {average}</span>
        <button type="button" onClick={onExport} disabled={busy || roster.length === 0} className={clsx(buttonClass('ghost', 'sm'), 'ml-auto')}>
          <Download className="size-3.5" />
          Export CSV
        </button>
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!invite.trim()) return
          onInvite(invite.trim())
          setInvite('')
        }}
        className="mt-3 flex flex-wrap gap-2"
      >
        <input
          value={invite}
          onChange={(event) => setInvite(event.target.value)}
          placeholder="Student id or account email"
          aria-label="Student id or account email"
          className={clsx(inputClass, 'min-w-[220px] flex-1')}
        />
        <button type="submit" disabled={busy || !invite.trim()} className={clsx(buttonClass('primary', 'sm'), 'justify-center')}>
          <Plus className="size-3.5" />
          Add student
        </button>
      </form>

      {roster.length === 0 ? (
        <p className="mt-3 rounded-xl bg-paper-2 px-3 py-6 text-center text-[11.5px] text-ink-500">
          No students yet. Add a student by id or the email they used to sign up.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-ink-400">
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">Company</th>
                <th className="px-2 py-2 text-right">Month</th>
                <th className="px-2 py-2 text-right">Engine score</th>
                <th className="px-2 py-2 text-right">Grade</th>
                <th className="px-2 py-2 text-right">Cash</th>
                <th className="px-2 py-2">Integrity</th>
                <th className="px-2 py-2">Seed</th>
                <th className="px-2 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((entry) => {
                const badge = INTEGRITY_COPY[entry.integrity]
                return (
                  <tr key={entry.studentId} className="border-t border-line align-top text-[11.5px]">
                    <td className="px-2 py-2">
                      <p className="font-semibold text-ink">{entry.name}</p>
                      <p className="text-[10px] text-ink-400">{entry.email || entry.studentId}</p>
                    </td>
                    <td className="px-2 py-2 text-ink-600">{entry.company ?? '—'}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{entry.month}</td>
                    <td className="px-2 py-2 text-right font-bold tabular-nums">{entry.score}</td>
                    <td className="px-2 py-2 text-right font-bold tabular-nums">
                      {entry.grade ?? '—'}
                      {entry.feedback ? <p className="max-w-[160px] whitespace-normal text-[10px] font-normal text-ink-400">{entry.feedback}</p> : null}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{money(entry.cash, { compact: true })}</td>
                    <td className="px-2 py-2">
                      <span className={clsx('rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.06em]', badge.tone)}>
                        {badge.label}
                      </span>
                      <p className="mt-1 text-[9.5px] text-ink-400">{number(entry.commits)} commits</p>
                      <span
                        title={REPLAY_COPY[entry.replay].title}
                        className={clsx('mt-1 inline-block rounded-full px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.05em]', REPLAY_COPY[entry.replay].tone)}
                      >
                        {REPLAY_COPY[entry.replay].label}
                      </span>
                    </td>
                    <td className="px-2 py-2">
                      {entry.seed === null ? (
                        <span className="text-[10px] text-ink-400">no run yet</span>
                      ) : (
                        <>
                          <span className="tabular-nums text-ink-600">#{entry.seed}</span>
                          <p
                            className={clsx(
                              'text-[9.5px] font-semibold',
                              entry.seedMatch === true ? 'text-emerald-700' : entry.seedMatch === false ? 'text-gold-ink' : 'text-ink-400',
                            )}
                          >
                            {entry.seedMatch === true ? 'assigned seed' : entry.seedMatch === false ? 'different seed' : 'no scenario seed'}
                          </p>
                        </>
                      )}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setGrading(grading === entry.studentId ? null : entry.studentId)
                            setRubric({ ...DEFAULT_RUBRIC, ...(entry.rubric as Partial<RubricScores> | null) })
                            setRationale(entry.rationale ?? '')
                          }}
                          className={buttonClass('ghost', 'sm')}
                        >
                          Grade
                        </button>
                        <button
                          type="button"
                          disabled={!entry.companyId || busy}
                          title="Re-run this student's decision journal on the server"
                          onClick={() => entry.companyId && onReplay(entry.studentId, entry.companyId)}
                          className={buttonClass('ghost', 'sm')}
                        >
                          Replay
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Reset ${entry.name}'s run to the scenario start? This is audited.`)) onReset(entry.studentId)
                          }}
                          className={buttonClass('ghost', 'sm')}
                        >
                          Reset
                        </button>
                      </div>
                      {grading === entry.studentId ? (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault()
                            if (!rationaleReady) return
                            onGrade(entry.studentId, previewGrade, rationale.trim(), rubric)
                            setGrading(null)
                          }}
                          className="mt-2 w-[300px] space-y-1.5 rounded-xl bg-paper-2 p-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-400">Rubric</span>
                            <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold text-lime">
                              {previewGrade} / 100
                            </span>
                          </div>
                          {RUBRIC.map((criterion) => (
                            <label key={criterion.id} className="block" title={criterion.hint}>
                              <span className="flex items-center justify-between text-[9.5px] font-semibold text-ink-500">
                                <span>{criterion.label}</span>
                                <span className="text-ink-300">{criterion.weight}%</span>
                              </span>
                              <select
                                value={rubric[criterion.id]}
                                onChange={(event) =>
                                  setRubric((current) => ({ ...current, [criterion.id]: Number(event.target.value) as RubricScores[RubricId] }))
                                }
                                aria-label={`${criterion.label} level for ${entry.name}`}
                                className={clsx(inputClass, 'mt-0.5 h-8 text-[11px]')}
                              >
                                {RUBRIC_LEVELS.map((option) => (
                                  <option key={option.level} value={option.level}>
                                    {option.level} · {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          ))}
                          <textarea
                            value={rationale}
                            onChange={(event) => setRationale(event.target.value)}
                            rows={3}
                            maxLength={800}
                            required
                            placeholder={`Rationale — required, at least ${MIN_RATIONALE} characters`}
                            aria-label={`Rationale for ${entry.name}`}
                            className={clsx(inputClass, 'h-auto py-1.5 text-[11px]')}
                          />
                          <p className={clsx('text-[9px]', rationaleReady ? 'text-ink-400' : 'text-gold-ink')}>
                            {rationale.trim().length}/{MIN_RATIONALE} characters — stored with the grade and hashed into the audit chain.
                          </p>
                          <button
                            type="submit"
                            disabled={!rationaleReady}
                            className={clsx(buttonClass('primary', 'sm'), 'w-full justify-center disabled:opacity-40')}
                          >
                            Save grade
                          </button>
                        </form>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[10.5px] leading-relaxed text-ink-400">
        Engine score is recomputed by the server from canonical figures. “Flagged” means a commit tried to move cash,
        revenue or customers beyond what the simulation could produce — the values were corrected and the attempt was
        written to the audit chain. Cohort: {cohort.name}.
      </p>
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-400">{label}</span>
      {hint ? <span className="mt-0.5 block text-[9.5px] leading-snug text-ink-400">{hint}</span> : null}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function Banner({ tone, icon: Icon, children }: { tone: 'good' | 'bad'; icon: typeof AlertTriangle; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        'flex items-start gap-2 rounded-2xl px-3 py-2.5 text-[11.5px] font-semibold',
        tone === 'good' ? 'bg-brand-50 text-brand-800' : 'bg-coral-soft text-coral',
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      {children}
    </div>
  )
}

const inputClass =
  'h-10 w-full rounded-xl border border-line bg-white px-2.5 text-[12px] text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100'

/**
 * Cohort comparison and the per-student profile over time.
 *
 * The roster answers "what did each student score"; this answers "where is the
 * group strong, who is improving, and can the marks be trusted". Everything is
 * derived server-side from the same roster and grade history the table shows, so
 * the two cannot disagree.
 */
function ComparisonCard({ comparison }: { comparison: CohortComparison }) {
  const graded = comparison.graded
  const maxBucket = Math.max(1, ...comparison.buckets.map((bucket) => bucket.count))

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-brand-700" />
          <p className="font-display text-[14px] font-semibold">Cohort comparison</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
          <span className="rounded-full bg-paper-3 px-2 py-0.5 text-ink-500">{comparison.size} enrolled</span>
          <span className="rounded-full bg-paper-3 px-2 py-0.5 text-ink-500">{comparison.active} trading</span>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-brand-800">{graded} graded</span>
          <span className="rounded-full bg-paper-3 px-2 py-0.5 text-ink-500">{comparison.rubricGraded} with rubric</span>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-3">
        <Stat label="Mean instructor grade" value={comparison.meanGrade === null ? '—' : `${comparison.meanGrade} / 100`} />
        <Stat label="Mean engine score" value={comparison.meanEngineScore === null ? '—' : `${comparison.meanEngineScore} / 100`} />
        <Stat
          label="Marking delta"
          value={comparison.meanDelta === null ? '—' : `${comparison.meanDelta > 0 ? '+' : ''}${comparison.meanDelta}`}
          hint="instructor minus engine"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Competency profile (1–4 mean)</p>
          <ul className="mt-2 space-y-1.5">
            {comparison.competencies.map((competency) => (
              <li key={competency.id}>
                <div className="flex items-center justify-between text-[10.5px]">
                  <span className="font-semibold text-ink-600">
                    {competency.label} <span className="text-ink-400">· {competency.weight}%</span>
                  </span>
                  <span className="font-bold tabular-nums text-ink-700">
                    {competency.mean === null ? '—' : competency.mean.toFixed(2)}
                    {competency.proficientShare === null ? '' : ` · ${competency.proficientShare}% ≥ 3`}
                  </span>
                </div>
                <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-paper-3">
                  {[1, 2, 3, 4].map((level) => {
                    const count = competency.distribution[level - 1] ?? 0
                    const total = Math.max(1, competency.distribution.reduce((sum, value) => sum + value, 0))
                    return count ? (
                      <div
                        key={level}
                        title={`level ${level}: ${count}`}
                        className={clsx('h-full', level === 1 ? 'bg-coral' : level === 2 ? 'bg-gold' : level === 3 ? 'bg-brand-400' : 'bg-brand-700')}
                        style={{ width: `${(count / total) * 100}%` }}
                      />
                    ) : null
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Engine score distribution</p>
          <ul className="mt-2 space-y-1.5">
            {comparison.buckets.map((bucket) => (
              <li key={bucket.label} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-[10px] font-bold tabular-nums text-ink-500">{bucket.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-paper-3">
                  <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(bucket.count / maxBucket) * 100}%` }} />
                </span>
                <span className="w-5 shrink-0 text-right text-[10px] font-bold tabular-nums text-ink-600">{bucket.count}</span>
              </li>
            ))}
          </ul>

          <div className="mt-3 grid grid-cols-2 gap-1.5 text-[9.5px] font-semibold text-ink-500">
            <span>Integrity: {comparison.integrity.verified} verified</span>
            <span>{comparison.integrity.flagged} flagged</span>
            <span>Seed: {comparison.seedMatch.matched} matched</span>
            <span>{comparison.seedMatch.different} different</span>
            <span>Replay: {comparison.replay.match} reproduced</span>
            <span>{comparison.replay.mismatch} mismatched</span>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Profiles over time</p>
      {comparison.students.length === 0 ? (
        <p className="mt-2 text-[11px] text-ink-500">No students yet. Invite a student to see their profile.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-[10.5px]">
            <thead>
              <tr className="text-[9px] uppercase tracking-[0.1em] text-ink-400">
                <th className="pb-1 pr-2 font-bold">Student</th>
                <th className="pb-1 pr-2 font-bold">Grade</th>
                <th className="pb-1 pr-2 font-bold">Engine</th>
                <th className="pb-1 pr-2 font-bold">Trend</th>
                <th className="pb-1 font-bold">Latest competency levels</th>
              </tr>
            </thead>
            <tbody>
              {comparison.students.map((student) => (
                <tr key={student.studentId} className="border-t border-line/70">
                  <td className="py-1.5 pr-2">
                    <span className="block font-semibold text-ink-700">{student.name}</span>
                    <span className="block text-[9.5px] text-ink-400">{student.company ?? 'no company yet'}</span>
                  </td>
                  <td className="py-1.5 pr-2 font-bold tabular-nums text-ink-700">{student.grade ?? '—'}</td>
                  <td className="py-1.5 pr-2 tabular-nums text-ink-500">{student.engineScore ?? '—'}</td>
                  <td className="py-1.5 pr-2 tabular-nums">
                    {student.trend === null ? (
                      <span className="text-ink-400">—</span>
                    ) : (
                      <span className={student.trend >= 0 ? 'font-bold text-success-strong' : 'font-bold text-coral'}>
                        {student.trend > 0 ? '+' : ''}
                        {student.trend}
                      </span>
                    )}
                    <span className="ml-1 text-[9px] text-ink-400">{student.history.length > 1 ? `${student.history.length} grades` : ''}</span>
                  </td>
                  <td className="py-1.5">
                    {student.levels ? (
                      <span className="flex gap-1">
                        {RUBRIC.map((criterion) => (
                          <span
                            key={criterion.id}
                            title={`${criterion.label}: ${student.levels?.[criterion.id] ?? '—'}`}
                            className="inline-block h-1.5 w-5 rounded-full bg-paper-3 align-middle"
                          >
                            <span
                              className="block h-full rounded-full bg-brand-600"
                              style={{ width: `${((student.levels?.[criterion.id] ?? 0) / 4) * 100}%` }}
                            />
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-ink-400">no rubric grade</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-paper-3/70 px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-ink-400">{label}</p>
      <p className="mt-0.5 font-display text-[15px] font-semibold tabular-nums text-ink">{value}</p>
      {hint ? <p className="text-[9px] text-ink-400">{hint}</p> : null}
    </div>
  )
}

/**
 * LTI Advantage passback.
 *
 * The LMS gradebook is where a course's marks have to end up. This card holds
 * the platform configuration and the two deliberate actions: preview what would
 * be sent, or send it. Preview is the default because a grade that leaves the
 * building cannot be recalled.
 */
function LtiCard({ cohort, onSaved }: { cohort: Cohort; onSaved: () => void }) {
  const [issuer, setIssuer] = useState(cohort.lti?.issuer ?? '')
  const [clientId, setClientId] = useState(cohort.lti?.clientId ?? '')
  const [deploymentId, setDeploymentId] = useState(cohort.lti?.deploymentId ?? '')
  const [tokenUrl, setTokenUrl] = useState(cohort.lti?.tokenUrl ?? '')
  const [lineItemUrl, setLineItemUrl] = useState(cohort.lti?.lineItemUrl ?? '')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [results, setResults] = useState<LtiPassbackResult[] | null>(null)

  const configured = Boolean(cohort.lti?.issuer)

  const call = async (action: () => Promise<void>) => {
    setBusy(true)
    setMessage('')
    try {
      await action()
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-brand-700" />
          <p className="font-display text-[14px] font-semibold">LTI passback</p>
        </div>
        <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-bold', configured ? 'bg-brand-50 text-brand-800' : 'bg-paper-3 text-ink-500')}>
          {configured ? `linked to ${cohort.lti?.issuer}` : 'not configured'}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
        Grades leave as a signed OAuth2 client-credentials exchange (RS256 assertion → access token → AGS score).
        The platform verifies us against the public keys at <code className="rounded bg-paper-3 px-1 py-0.5 text-[10px]">/api/lti/jwks</code>.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Field label="Issuer">
          <input value={issuer} onChange={(event) => setIssuer(event.target.value)} placeholder="https://lms.school.edu" className={inputClass} />
        </Field>
        <Field label="Client id">
          <input value={clientId} onChange={(event) => setClientId(event.target.value)} placeholder="businesslife-prod" className={inputClass} />
        </Field>
        <Field label="Token URL">
          <input value={tokenUrl} onChange={(event) => setTokenUrl(event.target.value)} placeholder="https://lms.school.edu/login/oauth2/token" className={inputClass} />
        </Field>
        <Field label="Line item URL">
          <input value={lineItemUrl} onChange={(event) => setLineItemUrl(event.target.value)} placeholder="https://lms.school.edu/ags/lineitems/42" className={inputClass} />
        </Field>
        <Field label="Deployment id (optional)">
          <input value={deploymentId} onChange={(event) => setDeploymentId(event.target.value)} className={inputClass} />
        </Field>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            call(async () => {
              await configureLti(cohort.id, { issuer, clientId, deploymentId, tokenUrl, lineItemUrl })
              onSaved()
              setMessage('Platform saved. Preview a passback before sending.')
            })
          }
          className={buttonClass('primary', 'sm')}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
          Save platform
        </button>
        <button
          type="button"
          disabled={busy || !configured}
          onClick={() =>
            call(async () => {
              const result = await passbackGrades(cohort.id, { dryRun: true })
              setResults(result.results)
              setMessage(`Preview: ${result.sent} grade(s) ready, ${result.skipped} ungraded student(s) skipped. Nothing was sent.`)
            })
          }
          className={buttonClass('secondary', 'sm')}
        >
          Preview passback
        </button>
        <button
          type="button"
          disabled={busy || !configured}
          onClick={() => {
            if (!window.confirm('Send the recorded grades to the LMS gradebook? This cannot be undone.')) return
            void call(async () => {
              const result = await passbackGrades(cohort.id, { dryRun: false })
              setResults(result.results)
              setMessage(`Sent ${result.sent}, failed ${result.failed}, skipped ${result.skipped}.`)
              onSaved()
            })
          }}
          className={buttonClass('dark', 'sm')}
        >
          Send grades
        </button>
        {configured ? (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              call(async () => {
                await configureLti(cohort.id, { clear: true })
                setResults(null)
                onSaved()
                setMessage('Platform configuration cleared.')
              })
            }
            className={buttonClass('ghost', 'sm')}
          >
            Unlink
          </button>
        ) : null}
      </div>

      {message ? <p className="mt-2 text-[11px] font-semibold text-ink-600">{message}</p> : null}
      {results && results.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {results.map((result) => (
            <li key={result.studentId} className="rounded-lg bg-paper-3/70 px-2.5 py-1.5 text-[10.5px]">
              <span className="font-semibold text-ink-700">{result.studentId.slice(0, 12)}…</span>{' '}
              <span className={result.status === 'failed' ? 'text-coral' : 'text-success-strong'}>{result.status}</span>
              {result.request ? (
                <span className="text-ink-500">
                  {' '}
                  · score {String((result.request.score as { scoreGiven?: number }).scoreGiven)} / 100 · aud{' '}
                  {String((result.request.assertion.claims as { aud?: string }).aud ?? '')}
                </span>
              ) : null}
              {result.error ? <span className="block text-coral">{result.error}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

/**
 * The permission matrix, on screen.
 *
 * Access rules that only exist in code are rules nobody can check. This renders
 * the same table the server enforces (`backend/rbac.ts`), so an instructor can
 * see that grading is theirs and that platform settings are not.
 */
function RoleCard() {
  const [matrix, setMatrix] = useState<RoleMatrix | null>(null)
  useEffect(() => {
    let alive = true
    fetchRoleMatrix()
      .then((result) => { if (alive) setMatrix(result) })
      .catch(() => { if (alive) setMatrix(null) })
    return () => { alive = false }
  }, [])

  if (!matrix) return null

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-brand-700" />
        <p className="font-display text-[14px] font-semibold">Who can do what</p>
        <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[10px] font-bold text-ink-500">you are {matrix.mine.role}</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-[10.5px]">
          <thead>
            <tr className="text-[9px] uppercase tracking-[0.1em] text-ink-400">
              <th className="pb-1 pr-2 font-bold">Permission</th>
              {matrix.roles.map((entry) => (
                <th key={entry.role} className="pb-1 pr-2 font-bold">{entry.role}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.permissions.map((permission) => (
              <tr key={permission} className="border-t border-line/70">
                <td className="py-1 pr-2 font-medium text-ink-700">{permission}</td>
                {matrix.roles.map((entry) => (
                  <td key={entry.role} className="py-1 pr-2">
                    {entry.permissions.includes(permission) ? (
                      <span className="font-bold text-success-strong">yes</span>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
