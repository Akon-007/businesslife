#!/usr/bin/env node
/**
 * Server-side render smoke test for the finance UI.
 *
 * There is no browser in this environment, so this does the next best thing:
 * it plays six months on a real seeded engine, puts the state into the store
 * and renders the Finance centre (and the month report) to static markup. It
 * cannot judge layout or interaction, but it does prove the panel renders from
 * a real game state without throwing, and that the numbers on screen are the
 * numbers in the ledger.
 *
 *   npx tsx scripts/verify-render.ts
 */
import React from 'react'
import type { GameState } from '../src/game/types'

// tsx compiles the imported components with the classic JSX runtime, so React
// has to exist globally before those modules evaluate.
;(globalThis as unknown as { React: typeof React }).React = React

let failures = 0
const check = (label: string, ok: boolean, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${ok || !detail ? '' : ` — ${detail}`}`)
  if (!ok) failures += 1
}

function play(startGame: typeof import('../src/game/engine')['startGame'], advanceMonth: typeof import('../src/game/engine')['advanceMonth'], resolveCrisis: typeof import('../src/game/engine')['resolveCrisis'], industry: GameState['industry'], seed: number, months: number) {
  let game = startGame({
    founder: 'Render Tester',
    company: `Render ${industry}`,
    strategy: 'product',
    founderBackground: 'operator',
    difficulty: 'standard',
    industry,
    seed,
  })
  for (let index = 0; index < months; index += 1) {
    game = advanceMonth(game)
    while (game.pendingCrisis) game = resolveCrisis(game, game.pendingCrisis.options[0].id)
  }
  return game
}

async function main() {
  const { renderToStaticMarkup } = await import('react-dom/server')
  const { FinancePanel } = await import('../src/components/game/FinancePanel')
  const { ReportModal } = await import('../src/components/game/modals')
  const { MarketingPanel } = await import('../src/components/game/MarketingPanel')
  const { advanceMonth, resolveCrisis, startGame } = await import('../src/game/engine')
  const { money } = await import('../src/lib/format')

console.log('\nRender smoke test: finance UI\n')

for (const industry of ['saas', 'retail'] as const) {
  const game = play(startGame, advanceMonth, resolveCrisis, industry, 4242, 6)

  let markup = ''
  let error: unknown = null
  try {
    markup = renderToStaticMarkup(<FinancePanel game={game} />)
  } catch (caught) {
    error = caught
  }

  check(`${industry}: Finance centre renders`, !error, error instanceof Error ? error.message : String(error))
  if (error) continue

  const latest = game.statements[game.statements.length - 1]
  const text = markup.replace(/&amp;/g, '&').replace(/&#x27;/g, "'")
  check(`${industry}: shows the profit & loss`, text.includes('Profit & loss'))
  check(`${industry}: shows the report month`, markup.includes('Net profit'))
  check(`${industry}: cash matches the engine`, markup.includes(money(game.cash).replace(/\u00a0/g, '&nbsp;')) || markup.includes(money(game.cash)))
  check(`${industry}: net profit matches the statement`, Boolean(latest) && markup.includes(money(latest.income.netProfit, { sign: latest.income.netProfit < 0 })))
  check(`${industry}: every tab is present`, ['Profit & loss', 'Balance sheet', 'Cash flow', 'Budget', 'Forecast', 'Invoices', 'Bills', 'What if'].every((label) => text.includes(label)))

  const balanceMarkup = renderToStaticMarkup(<FinancePanel game={game} initialTab="balance" />).replace(/&amp;/g, '&')
  check(`${industry}: the balance sheet states whether it balances`, balanceMarkup.includes('The sheet balances'))
  check(`${industry}: balance sheet figures match the ledger`, Boolean(latest) && balanceMarkup.includes(money(latest.balance.totalAssets)))

  const tabs = ['pl', 'balance', 'cash', 'budget', 'forecast', 'invoices', 'bills', 'whatif'] as const
  const broken = tabs.filter((id) => {
    try {
      const panel = renderToStaticMarkup(<FinancePanel game={game} initialTab={id} />)
      return /NaN|undefined|\[object Object\]/.test(panel)
    } catch {
      return true
    }
  })
  check(`${industry}: every tab renders clean`, broken.length === 0, broken.join(', '))
  check(`${industry}: no NaN or undefined leaked into the markup`, !/NaN|undefined|\[object Object\]/.test(markup))

  let marketingMarkup = ''
  let marketingError: unknown = null
  try {
    marketingMarkup = renderToStaticMarkup(<MarketingPanel game={game} />)
  } catch (caught) {
    marketingError = caught
  }
  const marketingText = marketingMarkup.replace(/&amp;/g, '&')
  check(`${industry}: marketing studio renders`, !marketingError, marketingError instanceof Error ? marketingError.message : String(marketingError))
  if (!marketingError) {
    check(`${industry}: marketing shows the mix controls`, ['Social & creators', 'Search & intent', 'Content & SEO', 'Events & B2B'].every((label) => marketingText.includes(label)))
    check(`${industry}: marketing shows attribution and unit economics`, marketingText.includes('Attribution') && marketingText.includes('LTV : CAC'))
    check(`${industry}: marketing has no leaked values`, !/NaN|undefined|\[object Object\]/.test(marketingMarkup))
  }

  const report = game.lastReport
  let reportMarkup = ''
  let reportError: unknown = null
  try {
    reportMarkup = renderToStaticMarkup(<ReportModal report={report} game={game} onClose={() => undefined} />)
  } catch (caught) {
    reportError = caught
  }
  // The modal portal is skipped without a DOM, so this only asserts the report
  // model renders without throwing; the figures are checked on the model itself.
  check(`${industry}: month report builds without throwing`, !reportError, reportError instanceof Error ? reportError.message : String(reportError))
  check(`${industry}: report carries net profit and bills`, Boolean(report) && report.netProfit === latest.income.netProfit && typeof report.billed === 'number' && report.payables === game.payables, `${report?.netProfit} vs ${latest?.income.netProfit}`)
  check(`${industry}: report has no leaked values`, !/NaN|undefined|\[object Object\]/.test(reportMarkup))
}

console.log(failures ? `\n${failures} render failure(s)` : '\nAll render checks passed')
process.exit(failures ? 1 : 0)
}

void main()
