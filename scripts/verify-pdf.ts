#!/usr/bin/env node
/**
 * The exported documents have to be real PDFs, not text with a .pdf extension:
 * the file must parse (xref offsets, trailer, page tree), and the figures on it
 * must be the figures in the run. Text is uncompressed, so the checks read it.
 *
 *   npx tsx scripts/verify-pdf.ts
 */
import { advanceMonth, performanceScore, resolveCrisis, startGame } from '../src/game/engine'
import { exportFilename, monthReportPdf, scorecardPdf } from '../src/game/report-pdf'
import { DEFAULT_RUBRIC, RUBRIC, localGrade, suggestRubric } from '../src/game/rubric'
import { RUBRIC as SERVER_RUBRIC } from '../backend/rubric'
import { buildPdf, pdfSafe } from '../src/lib/pdf'
import type { GameState } from '../src/game/types'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

const text = (bytes: Uint8Array) => new TextDecoder('latin1').decode(bytes)

const base = {
  founder: 'Ada Obi',
  company: 'Paper Trail Ltd',
  industry: 'retail' as const,
  strategy: 'product' as const,
  founderBackground: 'operator' as const,
  difficulty: 'standard' as const,
  firstName: 'Ada',
  lastName: 'Obi',
  nickname: 'ada',
  avatar: 'founder-1',
  accountEmail: 'ada@test.local',
  startingCash: 2_000_000,
}

function play(seed: number, months: number): GameState {
  let game = startGame({ ...base, seed })
  for (let index = 0; index < months; index += 1) {
    game = advanceMonth(game)
    while (game.pendingCrisis) game = resolveCrisis(game, game.pendingCrisis.options[0].id)
    if (game.status !== 'active') break
  }
  return game
}

/** Verify the xref table: every offset must point at its own object header. */
function xrefOk(raw: string) {
  const startxref = Number(raw.slice(raw.lastIndexOf('startxref') + 9).trim().split('\n')[0])
  if (!Number.isFinite(startxref) || raw.slice(startxref, startxref + 4) !== 'xref') return { ok: false, detail: `startxref ${startxref}` }
  const entries = raw.slice(startxref).split('\n').filter((line) => /^\d{10} \d{5} n $/.test(line))
  const bad: number[] = []
  for (const [index, entry] of entries.entries()) {
    const offset = Number(entry.slice(0, 10))
    const objectNumber = index + 1
    if (raw.slice(offset, offset + `${objectNumber} 0 obj`.length) !== `${objectNumber} 0 obj`) bad.push(objectNumber)
  }
  return { ok: bad.length === 0, detail: `${entries.length} entries, bad ${bad.join(',')}` }
}

console.log('\nPDF export\n')

const game = play(20260101, 8)
const report = game.lastReport
check('the run produced a month report', Boolean(report))

if (report) {
  const bytes = monthReportPdf(game, report)
  const raw = text(bytes)
  check('the month report is a PDF', raw.startsWith('%PDF-1.4'))
  check('the month report ends with EOF', raw.trimEnd().endsWith('%%EOF'))
  check('the month report has a valid xref table', xrefOk(raw).ok, xrefOk(raw).detail)
  check('the month report names the company', raw.includes(pdfSafe(game.company).replace(/\s+/g, ' ').split(' ')[0]))
  check('the month report carries the month', raw.includes(`Month ${report.month} report`))
  check('the month report prints the net profit', raw.includes(`NGN ${Math.round(report.netProfit).toLocaleString('en-NG')}`), `${report.netProfit}`)
  check('the month report states the capacity position', raw.includes('Capacity'))
  check('the month report has a disclaimer', raw.includes('not financial advice'))
  check('no raw naira glyph leaks into the PDF', !raw.includes('₦'))
  check('the report is a single page', (raw.match(/\/Type \/Page /g) ?? []).length === 1, `${(raw.match(/\/Type \/Page /g) ?? []).length}`)
}

const scorecard = scorecardPdf(game)
const scorecardRaw = text(scorecard)
check('the scorecard is a PDF', scorecardRaw.startsWith('%PDF-1.4'))
check('the scorecard has a valid xref table', xrefOk(scorecardRaw).ok, xrefOk(scorecardRaw).detail)
check('the scorecard names all six competencies', RUBRIC.every((criterion) => scorecardRaw.includes(criterion.label)), RUBRIC.map((criterion) => criterion.label).join(', '))
check('the scorecard prints the engine score', scorecardRaw.includes(`${Math.round(performanceScore(game))} / 100`), `${performanceScore(game)}`)
check('the scorecard prints the weighted weights', scorecardRaw.includes('25 / 20 / 15 / 15 / 15 / 10'))
check('the scorecard states the balance check', scorecardRaw.includes('Balance check'))

const withAuthority = text(scorecardPdf(game, { authorityScore: 61, instructorGrade: 74, rubric: { ...DEFAULT_RUBRIC, finance: 4 } }))
check('the scorecard prints the server score when given one', withAuthority.includes('Server authority score'))
check('the scorecard prints the instructor grade', withAuthority.includes('Instructor grade'))

check('no leaked values in either document', !/NaN|undefined|\[object Object\]/.test(text(monthReportPdf(game, game.lastReport!)) + scorecardRaw))

console.log('\nRubric\n')
const weights = RUBRIC.map((criterion) => criterion.weight)
check('the six weights are 25/20/15/15/15/10', weights.join('/') === '25/20/15/15/15/10', weights.join('/'))
check('the weights sum to 100', weights.reduce((sum, weight) => sum + weight, 0) === 100)
check('all-Proficient scores 75', localGrade(DEFAULT_RUBRIC) === 75, `${localGrade(DEFAULT_RUBRIC)}`)
check('all-Exemplary scores 100', localGrade({ finance: 4, strategy: 4, operations: 4, market: 4, leadership: 4, integrity: 4 }) === 100)
check('all-Emerging scores 25', localGrade({ finance: 1, strategy: 1, operations: 1, market: 1, leadership: 1, integrity: 1 }) === 25)
check(
  'finance carries more weight than integrity',
  localGrade({ ...DEFAULT_RUBRIC, finance: 4, integrity: 1 }) > localGrade({ ...DEFAULT_RUBRIC, finance: 1, integrity: 4 }),
)
const suggested = suggestRubric(game)
check('the suggested rubric covers every competency', RUBRIC.every((criterion) => [1, 2, 3, 4].includes(suggested.scores[criterion.id])))
check('the suggestion explains itself', RUBRIC.every((criterion) => (suggested.evidence[criterion.id] ?? '').length > 20))

check(
  'the client rubric mirror matches the server rubric',
  JSON.stringify(RUBRIC.map((item) => [item.id, item.weight])) ===
    JSON.stringify(SERVER_RUBRIC.map((item) => [item.id, item.weight])),
  `${RUBRIC.map((item) => item.id).join(',')} vs ${SERVER_RUBRIC.map((item) => item.id).join(',')}`,
)

check('month exports are named by company and month', exportFilename('Paper Trail Ltd', 'month', 8) === 'paper-trail-ltd-month-8.pdf')
check('scorecard exports are named by company', exportFilename('Paper Trail Ltd', 'scorecard') === 'paper-trail-ltd-scorecard.pdf')
check('file names cannot escape the download directory', !exportFilename('../../etc/passwd', 'scorecard').includes('/'))

check('a blank PDF is refused', (() => {
  try {
    buildPdf([], { title: 'empty' })
    return false
  } catch {
    return true
  }
})())
check('dangerous characters are escaped', (() => {
  const page = { width: 200, height: 200, items: [{ kind: 'text' as const, x: 10, y: 10, text: 'a (b) \\ c ₦', size: 10 }] }
  const raw = new TextDecoder('latin1').decode(buildPdf([page], { title: 'x' }))
  return raw.includes('(a \\(b\\) \\\\ c NGN )') && !raw.includes('₦')
})(), 'string escaping')

console.log(failures ? `\n${failures} failure(s)` : '\nAll PDF and rubric checks passed')
process.exit(failures ? 1 : 0)
