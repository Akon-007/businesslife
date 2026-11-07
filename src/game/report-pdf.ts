/**
 * The two documents the product has to hand out on paper: a month report and a
 * run scorecard. Both are built from the same state the screens show, so what a
 * student prints cannot say something different from what they saw.
 */
import { A4, BRAND, CORAL, GOLD, INK, MUTED, PageBuilder, RULE, SUCCESS, buildPdf } from '../lib/pdf'
import { RUBRIC, criterionPoints, localGrade, suggestRubric, type RubricScores } from './rubric'
import { industryById } from './data'
import { getGrade, performanceScore } from './engine'
import type { GameState, MonthReport } from './types'

const ngn = (value: number) => `NGN ${Math.round(value).toLocaleString('en-NG')}`
const pct = (value: number, digits = 1) => `${(Number.isFinite(value) ? value * 100 : 0).toFixed(digits)}%`
const tone = (value: number) => (value > 0 ? SUCCESS : value < 0 ? CORAL : MUTED)

function header(page: PageBuilder, title: string, subtitle: string) {
  page.move(-18)
  page.line(title, { size: 20, bold: true, gap: 16 })
  page.line(subtitle, { size: 9.5, color: MUTED, gap: 10 })
  page.rule({ color: BRAND, thickness: 1.4, gap: 18 })
}

function footer(page: PageBuilder, note: string) {
  const y = 40
  page.page.items.push({ kind: 'rule', x: 56, y: y + 14, width: page.page.width - 112, thickness: 0.6, color: RULE })
  page.page.items.push({
    kind: 'text',
    x: 56,
    y,
    text: note,
    size: 7.5,
    color: MUTED,
  })
  page.page.items.push({
    kind: 'text',
    x: 400,
    y,
    text: 'BusinessLife - education, not financial advice',
    size: 7.5,
    color: MUTED,
  })
}

function section(page: PageBuilder, title: string) {
  page.move(4)
  page.line(title, { size: 11.5, bold: true, gap: 14 })
}

function tiles(page: PageBuilder, items: Array<[string, string, number?]>) {
  const width = (page.page.width - 112 - 12 * 2) / 3
  items.slice(0, 3).forEach(([label, value, delta], index) => {
    page.tile(56 + index * (width + 12), width, label, value, delta === undefined ? INK : tone(delta))
  })
  page.move(56)
  if (items.length > 3) {
    items.slice(3, 6).forEach(([label, value, delta], index) => {
      page.tile(56 + index * (width + 12), width, label, value, delta === undefined ? INK : tone(delta))
    })
    page.move(56)
  }
}

/**
 * The file name a download gets. Kept here so the UI never invents its own
 * naming — two code paths, one convention.
 */
export function exportFilename(company: string, kind: 'month' | 'scorecard', month?: number): string {
  const slug = String(company ?? 'company')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'company'
  return kind === 'month' ? `${slug}-month-${month ?? 1}.pdf` : `${slug}-scorecard.pdf`
}

/** One month, as the student sees it on screen. */
export function monthReportPdf(game: GameState, report: MonthReport): Uint8Array {
  const industry = industryById(game.industry)
  const page = new PageBuilder()
  header(page, `Month ${report.month} report`, `${game.company} · ${industry.name} · ${game.founder}`)

  tiles(page, [
    ['Revenue', ngn(report.revenue)],
    ['Cash at close', ngn(report.cashEnd), report.cashEnd - report.cashStart],
    ['Net profit', ngn(report.netProfit), report.netProfit],
    ['Customers', `${Math.round(report.customersEnd)}`, report.customersEnd],
    ['Gross margin', pct(report.revenue > 0 ? (report.revenue - report.costs * 0.42) / report.revenue : 0)],
    ['Cash collected', ngn(report.collected)],
  ])

  section(page, 'Profit and loss')
  page.pair('Trading revenue', ngn(report.revenue))
  page.pair('Cost of sales, payroll and overhead', ngn(report.costs))
  page.pair('Payroll', ngn(report.payroll))
  page.pair('Depreciation', ngn(report.depreciation))
  page.pair('Interest', ngn(report.interest))
  page.pair('Refunds', ngn(report.returns))
  page.pair('Net profit', ngn(report.netProfit))

  section(page, 'Cash and working capital')
  page.pair('Opening cash', ngn(report.cashStart))
  page.pair('Closing cash', ngn(report.cashEnd))
  page.pair('Invoiced, not yet collected', ngn(report.invoiced))
  page.pair('Receivables outstanding', ngn(report.receivables))
  page.pair('Bills paid', ngn(report.billsPaid))
  page.pair('Payables outstanding', ngn(report.payables))

  section(page, 'Operations')
  page.pair('Capacity', `${Math.round(report.capacity)} account slots · ${pct(report.customersEnd / Math.max(1, report.capacity), 0)} used`)
  page.pair('Unserved demand', `${Math.round(report.unserved)} accounts`)
  page.pair('Orders in transit', `${report.ordersInTransit} · ${report.lateDeliveries} late`)
  page.pair('Retainer revenue', ngn(report.contractRevenue))
  page.pair('Retainers active', `${report.contractsActive}`)

  section(page, 'Marketing')
  page.pair('Cost per customer won', ngn(report.cac))
  page.pair('Lifetime value', ngn(report.ltv))
  for (const channel of report.channels.filter((row) => row.spend > 0).slice(0, 4)) {
    page.pair(`  ${channel.channel}`, `${ngn(channel.spend)} · ${Math.round(channel.customers)} won`, { size: 9 })
  }

  if (report.drivers.length) {
    section(page, 'What moved the month')
    for (const driver of report.drivers.slice(0, 6)) {
      page.line(`- ${driver}`, { size: 8.5, color: MUTED, gap: 12 })
    }
  }

  footer(page, `${game.company} · month ${report.month} · generated locally from the player's own run`)
  return buildPdf([page.page], { title: `${game.company} month ${report.month} report`, subject: 'Month report' })
}

/**
 * The run scorecard: what the player built, how the engine scored it, and the
 * competency profile an instructor starts from. The instructor's own grade, when
 * there is one, is printed alongside rather than overwriting the evidence.
 */
export function scorecardPdf(
  game: GameState,
  options: { rubric?: RubricScores; authorityScore?: number | null; instructorGrade?: number | null } = {},
): Uint8Array {
  const industry = industryById(game.industry)
  const page = new PageBuilder()
  const suggested = suggestRubric(game)
  const rubric = options.rubric ?? suggested.scores
  const gradeLabel = getGrade(performanceScore(game))

  header(page, `${game.company} - run scorecard`, `${industry.name} · ${game.founder} · ${game.month} months · ${game.status}`)

  tiles(page, [
    ['Engine score', `${Math.round(performanceScore(game))} / 100`],
    ['Grade', `${gradeLabel.grade} · ${gradeLabel.label}`],
    ['Valuation', ngn(game.valuation)],
    ['Cash', ngn(game.cash)],
    ['Customers', `${Math.round(game.customers)}`],
    ['Rubric grade', `${localGrade(rubric)} / 100`],
  ])

  section(page, 'Six competencies (weights 25 / 20 / 15 / 15 / 15 / 10)')
  if (!options.rubric) {
    page.line('Suggested levels, derived from the run. An instructor score replaces them.', { size: 7.5, color: MUTED, gap: 11 })
  }
  for (const criterion of RUBRIC) {
    const level = rubric[criterion.id]
    page.pair(
      `${criterion.label} (${criterion.weight}%)`,
      `Level ${level} · ${criterionPoints(rubric, criterion.id)} pts`,
      { size: 9 },
    )
    page.line(`    ${suggested.evidence[criterion.id]}`, { size: 7.5, color: MUTED, gap: 11 })
  }

  section(page, 'Where it stands')
  page.pair('Revenue in the last month', ngn(game.lastReport?.revenue ?? 0))
  page.pair('Net profit in the last month', ngn(game.lastReport?.netProfit ?? 0))
  page.pair('Reputation', `${Math.round(game.reputation)} / 100`)
  page.pair('Quality', `${Math.round(game.quality)} / 100`)
  page.pair('Team morale', `${Math.round(game.morale)} / 100`)
  page.pair('Debt', ngn(game.debt ?? 0))
  page.pair('Emergency bailouts', `${game.emergencyLoans ?? 0}`)
  page.pair('Founder equity', `${Math.round(game.founderEquity ?? 100)}%`)

  if (options.authorityScore !== undefined && options.authorityScore !== null) {
    section(page, 'Server-verified')
    page.pair('Server authority score', `${Math.round(options.authorityScore)} / 100`)
    page.pair(
      'Difference from the engine',
      `${Math.round(performanceScore(game)) - Math.round(options.authorityScore)} points`,
    )
    page.line('The server re-executes the decision journal, so its score is the canonical one for grading.', {
      size: 7.5,
      color: MUTED,
      gap: 12,
    })
  }

  if (options.instructorGrade !== undefined && options.instructorGrade !== null) {
    page.pair('Instructor grade', `${Math.round(options.instructorGrade)} / 100`)
  }

  const statements = game.statements ?? []
  const lastStatement = statements.at(-1)
  if (lastStatement) {
    section(page, 'Last published statements')
    page.pair('Revenue (P&L)', ngn(lastStatement.income.revenue))
    page.pair('Net profit (P&L)', ngn(lastStatement.income.netProfit))
    page.pair('Total assets', ngn(lastStatement.balance.totalAssets))
    page.pair('Total equity', ngn(lastStatement.balance.totalEquity))
    page.pair('Balance check', `${ngn(lastStatement.balance.imbalance)} (must be zero)`)
  }

  footer(page, `Scorecard for ${game.founder} · ${game.company} · seed ${game.seed ?? 0}`)
  return buildPdf([page.page], { title: `${game.company} scorecard`, subject: 'Run scorecard' })
}

export const PDF_PAGE = A4
export const PDF_GOLD = GOLD
