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
  fetchRoster,
  gradeStudent,
  instructorLogin,
  instructorSession,
  inviteStudent,
  listClasses,
  resetStudent,
  type Cohort,
  type RosterEntry,
} from '../lib/api'
import { money, number } from '../lib/format'

const INDUSTRIES = [
  { id: 'saas', label: 'Technology / SaaS' },
  { id: 'fnb', label: 'Restaurant & hospitality' },
  { id: 'retail', label: 'Retail & e-commerce' },
  { id: 'logistics', label: 'Logistics & transport' },
]

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

      <main className="container-page grid gap-4 py-6 lg:grid-cols-[300px_1fr]">
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
                        const result = await fetchRoster(cohort.id)
                        setRoster(result.roster)
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
                onGrade={(studentId, grade, feedback) =>
                  run(async () => {
                    const result = await gradeStudent(selected.id, { studentId, grade, feedback })
                    setRoster(result.roster)
                  }, 'Grade recorded.')
                }
                onReset={(studentId) =>
                  run(async () => {
                    const result = await resetStudent(selected.id, studentId)
                    setRoster(result.roster)
                  }, 'Run reset to scenario start.')
                }
                onExport={() =>
                  run(async () => {
                    await downloadRosterCsv(selected.id, `${selected.name.replace(/[^a-z0-9-_]+/gi, '-').toLowerCase()}-roster.csv`)
                  })
                }
              />
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await instructorLogin(name.trim(), email.trim() || undefined)
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
          Create cohorts, assign scenarios, review server-verified performance and export grades. This sandbox uses a
          dev instructor session — production replaces it with institutional SSO.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-3 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Your name</span>
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
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">Institution email (optional)</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              maxLength={120}
              placeholder="amaka@business-school.edu"
              className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-ink-950 px-3 text-[13px] text-white outline-none focus:border-lime"
            />
          </label>
          {error ? <p className="rounded-xl bg-coral/20 px-3 py-2 text-[11.5px] font-semibold text-coral">{error}</p> : null}
          <button type="submit" disabled={busy} className={clsx(buttonClass('lime', 'md'), 'w-full justify-center')}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <GraduationCap className="size-4" />}
            Enter portal
          </button>
        </form>
        <p className="mt-4 text-[11px] leading-relaxed text-white/40">
          Every grade, reset and scenario change is written to the student's audit chain by the server.
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
  const current = cohort.scenario as { title?: string; industry?: string; difficulty?: string; startingCash?: number; months?: number; objectives?: string[] } | null
  const [title, setTitle] = useState(current?.title ?? 'Cash discipline sprint')
  const [industry, setIndustry] = useState(current?.industry ?? 'saas')
  const [difficulty, setDifficulty] = useState(current?.difficulty ?? 'standard')
  const [startingCash, setStartingCash] = useState(String(current?.startingCash ?? 5_000_000))
  const [months, setMonths] = useState(String(current?.months ?? 12))
  const [objectives, setObjectives] = useState((current?.objectives ?? ['Reach break-even', 'Hold churn under 5%']).join('\n'))

  return (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-brand-700" />
        <p className="font-display text-[14px] font-semibold">Scenario</p>
        {current?.title ? <span className="rounded-full bg-paper-3 px-2 py-0.5 text-[10px] font-bold text-ink-500">{current.title}</span> : null}
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onAssign({
            title,
            industry,
            difficulty,
            startingCash: Number(startingCash) || 0,
            months: Number(months) || 12,
            objectives: objectives.split('\n').map((line) => line.trim()).filter(Boolean),
          })
        }}
        className="mt-3 grid gap-3 sm:grid-cols-2"
      >
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
}: {
  cohort: Cohort
  roster: RosterEntry[]
  busy: boolean
  onInvite: (value: string) => void
  onGrade: (studentId: string, grade: number, feedback: string) => void
  onReset: (studentId: string) => void
  onExport: () => void
}) {
  const [invite, setInvite] = useState('')
  const [grading, setGrading] = useState<string | null>(null)
  const [grade, setGrade] = useState('')
  const [feedback, setFeedback] = useState('')

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
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setGrading(grading === entry.studentId ? null : entry.studentId)
                            setGrade(entry.grade !== null ? String(entry.grade) : '')
                            setFeedback(entry.feedback ?? '')
                          }}
                          className={buttonClass('ghost', 'sm')}
                        >
                          Grade
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
                            const value = Number(grade)
                            if (!Number.isFinite(value)) return
                            onGrade(entry.studentId, value, feedback)
                            setGrading(null)
                          }}
                          className="mt-2 space-y-1.5 rounded-xl bg-paper-2 p-2"
                        >
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={grade}
                            onChange={(event) => setGrade(event.target.value)}
                            aria-label={`Grade for ${entry.name}`}
                            className={inputClass}
                          />
                          <textarea
                            value={feedback}
                            onChange={(event) => setFeedback(event.target.value)}
                            rows={2}
                            maxLength={500}
                            placeholder="Feedback (optional)"
                            aria-label={`Feedback for ${entry.name}`}
                            className={clsx(inputClass, 'h-auto py-1.5')}
                          />
                          <button type="submit" className={clsx(buttonClass('primary', 'sm'), 'w-full justify-center')}>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[9.5px] font-bold uppercase tracking-[0.12em] text-ink-400">{label}</span>
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
