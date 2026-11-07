import { useState } from 'react'
import { clsx } from 'clsx'
import { ArrowLeftRight, CheckCircle2, CircleAlert, Clock3, FileText, Receipt } from 'lucide-react'
import { useGame } from '../../game/store'
import type { Bill, GameState, Invoice, Statements } from '../../game/types'
import { money, monthLabel, percent } from '../../lib/format'
import { PanelSection } from './bits'

type TabId = 'pl' | 'balance' | 'cash' | 'budget' | 'forecast' | 'invoices' | 'bills' | 'whatif'

const TABS: { id: TabId; label: string }[] = [
  { id: 'pl', label: 'Profit & loss' },
  { id: 'balance', label: 'Balance sheet' },
  { id: 'cash', label: 'Cash flow' },
  { id: 'budget', label: 'Budget' },
  { id: 'forecast', label: 'Forecast' },
  { id: 'invoices', label: 'Invoices' },
  { id: 'bills', label: 'Bills' },
  { id: 'whatif', label: 'What if' },
]

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-brand-50 text-brand-700 ring-brand-200',
  paid: 'bg-success-soft text-success-strong ring-success/30',
  overdue: 'bg-coral-soft text-coral ring-coral/30',
}

function Figure({ value, strength = 'normal', className }: { value: number; strength?: 'normal' | 'strong' | 'muted'; className?: string }) {
  const safe = Number.isFinite(value) ? value : 0
  return (
    <span
      className={clsx(
        'figure text-[12.5px] tabular-nums',
        strength === 'strong' && 'font-semibold text-ink',
        strength === 'normal' && 'text-ink-700',
        strength === 'muted' && 'text-ink-400',
        safe < 0 && 'text-coral',
        className,
      )}
    >
      {money(safe, { sign: safe < 0 })}
    </span>
  )
}

function LineRow({
  label,
  value,
  hint,
  tone = 'body',
  sign,
}: {
  label: string
  value: number
  hint?: string
  tone?: 'body' | 'subtotal' | 'total' | 'muted'
  sign?: 'plus' | 'minus'
}) {
  return (
    <tr className={clsx(tone === 'total' && 'border-t border-line-strong bg-paper-3/60', tone === 'subtotal' && 'border-t border-line')}>
      <th scope="row" className="py-1.5 pr-3 text-left font-normal">
        <span
          className={clsx(
            'text-[12px]',
            tone === 'total' && 'font-semibold text-ink',
            tone === 'subtotal' && 'font-semibold text-ink-700',
            tone === 'body' && 'text-ink-600',
            tone === 'muted' && 'text-ink-400',
          )}
        >
          {sign === 'minus' && <span aria-hidden className="mr-1 text-ink-300">−</span>}
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-[10.5px] leading-snug text-ink-400">{hint}</span>}
      </th>
      <td className="py-1.5 text-right align-top">
        <Figure value={sign === 'plus' ? Math.abs(value) : value} strength={tone === 'total' ? 'strong' : tone === 'muted' ? 'muted' : 'normal'} />
      </td>
    </tr>
  )
}

function StatementTable({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <table className="w-full border-collapse">
      <caption className="sr-only">{caption}</caption>
      <tbody>{children}</tbody>
    </table>
  )
}

function MonthPicker({ month, onChange, max }: { month: number; onChange: (next: number) => void; max: number }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, month - 1))}
        disabled={month <= 1}
        className="grid size-7 place-items-center rounded-lg border border-line bg-white text-ink-500 transition hover:border-line-strong hover:text-ink disabled:opacity-40"
        aria-label="Previous month"
      >
        <span aria-hidden>‹</span>
      </button>
      <span className="figure min-w-[92px] text-center text-[12px] font-semibold text-ink">{monthLabel(month)}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, month + 1))}
        disabled={month >= max}
        className="grid size-7 place-items-center rounded-lg border border-line bg-white text-ink-500 transition hover:border-line-strong hover:text-ink disabled:opacity-40"
        aria-label="Next month"
      >
        <span aria-hidden>›</span>
      </button>
    </div>
  )
}

export function FinancePanel({ game: injected, initialTab = 'pl' }: { game?: GameState; initialTab?: TabId } = {}) {
  const stored = useGame((state) => state.game) as GameState | null
  const payBill = useGame((state) => state.payBill)
  const payAllBills = useGame((state) => state.payAllBills)
  const [tab, setTab] = useState<TabId>(initialTab)
  const [pickedMonth, setPickedMonth] = useState<number | null>(null)

  const game = injected ?? stored
  const statements = game?.statements ?? []
  const latest = statements[statements.length - 1]
  const shownMonth = pickedMonth ?? latest?.month ?? game?.month ?? 1
  const statement: Statements | undefined = statements.find((item) => item.month === shownMonth) ?? latest

  if (!game) return null

  const bills = game.bills ?? []
  const invoices = game.invoices ?? []
  const openBills = bills.filter((bill) => bill.status !== 'paid')
  const dueSoon = openBills.filter((bill) => bill.dueMonth <= game.month)
  const overdueBills = openBills.filter((bill) => bill.status === 'overdue')
  const receivables = invoices.filter((invoice) => invoice.status !== 'paid')
  const overdueInvoices = receivables.filter((invoice) => invoice.status === 'overdue')

  if (!latest) {
    return (
      <PanelSection title="Finance centre" hint="Close your first month to see the three statements.">
        <p className="text-[12.5px] leading-relaxed text-ink-500">
          The ledger starts empty. Once a month closes, the profit &amp; loss, balance sheet and cash-flow
          statements appear here, with the invoices still owed to you and the supplier bills you owe.
        </p>
      </PanelSection>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl bg-ink-900 px-3 py-2.5 text-white">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-white/50">Cash</p>
          <p className="figure mt-1 text-[16px] font-semibold tabular-nums">{money(game.cash)}</p>
        </div>
        <div className="rounded-xl bg-paper-3/70 px-3 py-2.5">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-ink-400">Net profit · {monthLabel(latest.month)}</p>
          <p className={clsx('figure mt-1 text-[16px] font-semibold tabular-nums', latest.income.netProfit < 0 ? 'text-coral' : 'text-success-strong')}>
            {money(latest.income.netProfit, { sign: latest.income.netProfit < 0 })}
          </p>
        </div>
        <div className="rounded-xl bg-paper-3/70 px-3 py-2.5">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-ink-400">Owed to you</p>
          <p className="figure mt-1 text-[16px] font-semibold tabular-nums text-ink">{money(game.receivables ?? 0)}</p>
        </div>
        <div className="rounded-xl bg-paper-3/70 px-3 py-2.5">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-ink-400">You owe</p>
          <p className={clsx('figure mt-1 text-[16px] font-semibold tabular-nums', (game.payables ?? 0) > 0 ? 'text-gold-ink' : 'text-ink')}>
            {money(game.payables ?? 0)}
          </p>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Finance statements"
        onKeyDown={(event) => {
          const index = TABS.findIndex((item) => item.id === tab)
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
            event.preventDefault()
            const direction = event.key === 'ArrowRight' ? 1 : -1
            const next = TABS[(index + direction + TABS.length) % TABS.length]
            setTab(next.id)
            document.getElementById(`finance-tab-${next.id}`)?.focus()
          }
        }}
        className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto px-1"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`finance-panel-${item.id}`}
            id={`finance-tab-${item.id}`}
            onClick={() => setTab(item.id)}
            tabIndex={tab === item.id ? 0 : -1}
            className={clsx(
              'shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition',
              tab === item.id ? 'bg-ink text-white shadow-sm' : 'bg-paper-3/70 text-ink-500 hover:bg-paper-3 hover:text-ink',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab !== 'invoices' && tab !== 'bills' && tab !== 'whatif' && tab !== 'forecast' && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-white px-3 py-2">
          <p className="text-[11px] text-ink-500">
            {tab === 'pl' && 'What the month earned and what it cost.'}
            {tab === 'balance' && 'What you own, what you owe, and what is left for you.'}
            {tab === 'cash' && 'Cash in and out — profit is not the same as cash.'}
            {tab === 'budget' && 'What you planned to spend against what the month actually charged.'}
          </p>
          <MonthPicker month={statement?.month ?? latest.month} onChange={setPickedMonth} max={latest.month} />
        </div>
      )}

      {tab === 'pl' && statement && (
        <PanelSection
          title={`Profit & loss · ${monthLabel(statement.month)}`}
          hint="Revenue is what you billed. Marketing, product and training sit inside operating costs."
        >
          <div id="finance-panel-pl" role="tabpanel" aria-labelledby="finance-tab-pl">
            <StatementTable caption={`Profit and loss for ${monthLabel(statement.month)}`}>
              <LineRow label="Revenue" value={statement.income.revenue} tone="subtotal" />
              <LineRow label="Cost of goods sold" value={statement.income.cogs} sign="minus" />
              <LineRow label="Gross profit" value={statement.income.grossProfit} tone="subtotal" />
              <LineRow label="Payroll" value={statement.income.payroll} sign="minus" />
              <LineRow label="Overhead" value={statement.income.overhead} sign="minus" hint="Rent, tools, admin — fixed whether you sell or not." />
              <LineRow label="Depreciation" value={statement.income.depreciation} sign="minus" hint="2% of fixed assets a month. No cash leaves the bank." />
              <LineRow label="Spoilage & write-offs" value={statement.income.spoilage} sign="minus" />
              <LineRow label="Bad debt" value={statement.income.badDebt} sign="minus" hint="Invoices a customer never paid." />
              <LineRow label="Late supplier fees" value={statement.income.lateFees} sign="minus" />
              <LineRow label="Other costs" value={statement.income.otherExpenses} sign="minus" hint="Signing bonuses, crisis spending and one-off purchases." />
              <LineRow label="Other income" value={statement.income.otherIncome} sign="plus" hint="Deal cash and one-off wins that are not monthly sales." />
              <LineRow label="Operating profit" value={statement.income.operatingProfit} tone="subtotal" />
              <LineRow label="Interest" value={statement.income.interest} sign="minus" />
              <LineRow label="Net profit" value={statement.income.netProfit} tone="total" />
            </StatementTable>
            <p className="mt-3 rounded-xl bg-paper-3/60 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
              Margin {percent(statement.income.revenue ? statement.income.netProfit / statement.income.revenue : 0, 1)} on{' '}
              {money(statement.income.revenue)} of revenue. Net profit changes retained earnings; it does not move cash on its own.
            </p>
          </div>
        </PanelSection>
      )}

      {tab === 'balance' && statement && (
        <PanelSection
          title={`Balance sheet · ${monthLabel(statement.month)}`}
          hint="A photograph at the close: assets on the left, who funded them on the right."
        >
          <div id="finance-panel-balance" role="tabpanel" aria-labelledby="finance-tab-balance">
            <StatementTable caption={`Balance sheet for ${monthLabel(statement.month)}`}>
              <LineRow label="Cash" value={statement.balance.cash} />
              <LineRow label="Receivables" value={statement.balance.receivables} hint="Invoiced, not yet collected." />
              <LineRow label="Inventory" value={statement.balance.inventory} />
              <LineRow label="Fixed assets" value={statement.balance.fixedAssets} hint="Branches and equipment, after depreciation." />
              <LineRow label="Total assets" value={statement.balance.totalAssets} tone="subtotal" />
              <LineRow label="Payables" value={statement.balance.payables} hint="Supplier bills still outstanding." />
              <LineRow label="Debt" value={statement.balance.debt} />
              <LineRow label="Total liabilities" value={statement.balance.totalLiabilities} tone="subtotal" />
              <LineRow label="Paid-in capital" value={statement.balance.paidInCapital} hint="Founder cash and investor funding put in." />
              <LineRow label="Retained earnings" value={statement.balance.retainedEarnings} hint="Profit kept in the business since day one." />
              <LineRow label="Total equity" value={statement.balance.totalEquity} tone="subtotal" />
              <LineRow label="Liabilities + equity" value={statement.balance.liabilitiesAndEquity} tone="total" />
            </StatementTable>

            <div
              className={clsx(
                'mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-[11px] leading-relaxed',
                Math.abs(statement.balance.imbalance) <= 2 ? 'bg-success-soft/70 text-success-strong' : 'bg-coral-soft text-coral',
              )}
            >
              {Math.abs(statement.balance.imbalance) <= 2 ? <CheckCircle2 className="mt-px size-3.5 shrink-0" /> : <CircleAlert className="mt-px size-3.5 shrink-0" />}
              <span>
                {Math.abs(statement.balance.imbalance) <= 2
                  ? 'The sheet balances: assets equal liabilities plus equity.'
                  : `Out of balance by ${money(statement.balance.imbalance)}. This is a bug — please report it.`}
              </span>
            </div>
          </div>
        </PanelSection>
      )}

      {tab === 'cash' && statement && (
        <PanelSection
          title={`Cash flow · ${monthLabel(statement.month)}`}
          hint="Operating is the business trading. Investing is buying capacity. Financing is other people's money."
        >
          <div id="finance-panel-cash" role="tabpanel" aria-labelledby="finance-tab-cash">
            <StatementTable caption={`Cash flow for ${monthLabel(statement.month)}`}>
              <LineRow label="Opening cash" value={statement.cashFlow.openingCash} tone="muted" />
              <LineRow label="Cash from sales" value={statement.cashFlow.cashSales} />
              <LineRow label="Invoice collections" value={statement.cashFlow.collections} />
              <LineRow label="Stock paid for" value={statement.cashFlow.stockPaid} sign="minus" />
              <LineRow label="Supplier bills paid" value={statement.cashFlow.billsPaid} sign="minus" />
              <LineRow label="Payroll" value={statement.cashFlow.payroll} sign="minus" />
              <LineRow label="Overhead" value={statement.cashFlow.overhead} sign="minus" />
              <LineRow label="Interest paid" value={statement.cashFlow.interest} sign="minus" />
              <LineRow label="Write-offs" value={statement.cashFlow.spoilage} sign="minus" />
              <LineRow label="Other costs" value={statement.cashFlow.otherExpenses} sign="minus" />
              <LineRow label="Other income" value={statement.cashFlow.otherIncome} sign="plus" />
              <LineRow label="Operating cash flow" value={statement.cashFlow.operating} tone="subtotal" />
              <LineRow label="Capex" value={Math.abs(statement.cashFlow.capex)} sign="minus" />
              <LineRow label="Investing cash flow" value={statement.cashFlow.investing} tone="subtotal" />
              <LineRow label="Funding raised" value={statement.cashFlow.funding} sign="plus" />
              <LineRow label="Borrowing" value={statement.cashFlow.borrow} sign="plus" />
              <LineRow label="Repayments" value={statement.cashFlow.repay} sign="minus" />
              <LineRow label="Financing cash flow" value={statement.cashFlow.financing} tone="subtotal" />
              <LineRow label="Net change in cash" value={statement.cashFlow.netChange} />
              <LineRow label="Closing cash" value={statement.cashFlow.closingCash} tone="total" />
            </StatementTable>
            <p className="mt-3 rounded-xl bg-paper-3/60 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
              Non-cash items (depreciation, bad debt, late fees) reduce profit without moving money. That is why closing cash and net profit rarely match.
            </p>
          </div>
        </PanelSection>
      )}

      {tab === 'budget' && statement && <BudgetTab statement={statement} game={game} />}

      {tab === 'forecast' && <ForecastTab statements={statements} cash={game.cash} />}

      {tab === 'invoices' && (
        <PanelSection
          title="Invoices"
          hint={`${receivables.length} unpaid · ${money(game.receivables ?? 0)} outstanding${overdueInvoices.length ? ` · ${overdueInvoices.length} overdue` : ''}`}
        >
          <div id="finance-panel-invoices" role="tabpanel" aria-labelledby="finance-tab-invoices">
            {invoices.length === 0 ? (
              <EmptyState icon={<FileText className="size-4" />} text="No invoices yet. Close a month with sales to raise your first one." />
            ) : (
              <ul className="divide-y divide-line">
                {[...invoices]
                  .sort((a, b) => b.issuedMonth - a.issuedMonth || a.id.localeCompare(b.id))
                  .slice(0, 12)
                  .map((invoice) => (
                    <InvoiceRow key={invoice.id} invoice={invoice} />
                  ))}
              </ul>
            )}
          </div>
        </PanelSection>
      )}

      {tab === 'bills' && (
        <PanelSection
          title="Bills"
          hint={`${openBills.length} open · ${money(game.payables ?? 0)} payable${overdueBills.length ? ` · ${overdueBills.length} overdue` : ''}`}
        >
          <div id="finance-panel-bills" role="tabpanel" aria-labelledby="finance-tab-bills">
            <div className="mb-3 rounded-xl bg-gold-soft/70 px-3 py-2 text-[11px] leading-relaxed text-gold-ink">
              <strong className="font-semibold">Supplier terms.</strong> 45% of stock is billed on 30-day terms. Bills settle at the
              next close if cash allows; if it does not, the bill rolls over with a 2% late fee and shows as overdue. You can
              also pay ahead of time — the cash leaves today and the late-fee risk goes with it.
            </div>

            {openBills.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-paper-3/50 px-3 py-2">
                <div>
                  <p className="text-[11px] font-semibold text-ink">
                    {money(game.payables ?? 0)} across {openBills.length} open bill{openBills.length === 1 ? '' : 's'}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-ink-400">
                    Cash on hand {money(game.cash)} · {overdueBills.length > 0 ? `${overdueBills.length} already overdue` : 'nothing overdue'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => payAllBills()}
                  disabled={game.status !== 'active'}
                  className="rounded-full bg-ink px-3.5 py-1.5 text-[11px] font-semibold text-white transition hover:bg-ink-800 disabled:opacity-40"
                >
                  Run a payment run
                </button>
              </div>
            )}
            {bills.length === 0 ? (
              <EmptyState icon={<Receipt className="size-4" />} text="No supplier bills yet. Stock purchases on credit appear here." />
            ) : (
              <ul className="divide-y divide-line">
                {[...bills]
                  .sort((a, b) => b.issuedMonth - a.issuedMonth || a.id.localeCompare(b.id))
                  .slice(0, 12)
                  .map((bill) => (
                    <BillRow
                      key={bill.id}
                      bill={bill}
                      month={game.month}
                      cash={game.cash}
                      canPay={game.status === 'active' && !injected}
                      onPay={() => payBill(bill.id)}
                    />
                  ))}
              </ul>
            )}
            {dueSoon.length > 0 && (
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-500">
                <Clock3 className="size-3.5" /> {dueSoon.length} bill{dueSoon.length === 1 ? '' : 's'} settling at the next close.
              </p>
            )}
          </div>
        </PanelSection>
      )}

      {tab === 'whatif' && statement && <WhatIf statement={statement} cash={game.cash} />}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-4 text-[11.5px] text-ink-400">
      <span className="grid size-7 place-items-center rounded-lg bg-paper-3 text-ink-400">{icon}</span>
      {text}
    </div>
  )
}

function StatusPill({ status }: { status: Bill['status'] | Invoice['status'] }) {
  return (
    <span className={clsx('rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] ring-1 ring-inset', STATUS_STYLES[status])}>
      {status}
    </span>
  )
}

function BillRow({
  bill,
  month,
  cash,
  canPay,
  onPay,
}: {
  bill: Bill
  month: number
  cash: number
  canPay: boolean
  onPay: () => void
}) {
  const due = bill.status === 'paid' ? null : Math.max(0, bill.dueMonth - month)
  const affordable = cash >= bill.amount
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-ink">{bill.vendor}</p>
        <p className="mt-0.5 text-[10.5px] text-ink-400">
          Issued {monthLabel(bill.issuedMonth)} · {bill.status === 'paid' ? `paid ${monthLabel(bill.paidMonth ?? bill.dueMonth)}` : due === 0 ? 'due now' : `due in ${due} month${due === 1 ? '' : 's'}`}
          {bill.lateFee > 0 && ` · ${money(bill.lateFee)} late fee`}
        </p>
        {bill.status !== 'paid' && canPay && (
          <button
            type="button"
            onClick={onPay}
            disabled={!affordable}
            aria-label={`Pay ${money(bill.amount)} to ${bill.vendor} now`}
            className="mt-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-[10.5px] font-semibold text-ink-600 transition hover:border-line-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            {affordable ? 'Pay now' : `Need ${money(bill.amount - cash)} more`}
          </button>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Figure value={bill.status === 'paid' ? bill.paid : bill.amount} strength="strong" />
        <StatusPill status={bill.status} />
      </div>
    </li>
  )
}

function InvoiceRow({ invoice }: { invoice: Invoice }) {
  return (
    <li className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-ink">{invoice.customer}</p>
        <p className="mt-0.5 text-[10.5px] text-ink-400">
          {monthLabel(invoice.issuedMonth)} · net {invoice.terms || 0} days · expected {monthLabel(invoice.dueMonth)}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Figure value={invoice.status === 'paid' ? invoice.collected : invoice.amount} strength="strong" />
        <StatusPill status={invoice.status} />
      </div>
    </li>
  )
}

function BudgetTab({ statement, game }: { statement: Statements; game: GameState }) {
  const snapshot = game.history.find((item) => item.month >= statement.month)
  const customers = snapshot?.customers ?? game.customers
  const realisedPerCustomer = customers > 0 ? statement.income.revenue / customers : 0
  const rows: { label: string; plan: number; actual: number; hint?: string }[] = [
    { label: 'Marketing', plan: game.marketingSpend, actual: statement.income.marketing, hint: 'Budget set in the plan panel.' },
    { label: 'Product', plan: game.productSpend, actual: statement.income.product, hint: 'Quality budget for the month.' },
    { label: 'Training', plan: game.trainingSpend, actual: statement.income.training, hint: game.team.length ? 'Per teammate, monthly.' : 'No team to train yet.' },
  ]

  return (
    <PanelSection
      title={`Budget vs actual · ${monthLabel(statement.month)}`}
      hint="The plan you set, the amount the month charged, and where they differed."
    >
      <div id="finance-panel-budget" role="tabpanel" aria-labelledby="finance-tab-budget">
        <table className="w-full border-collapse">
          <caption className="sr-only">Budget against actual spend</caption>
          <thead>
            <tr className="border-b border-line text-[9.5px] uppercase tracking-[0.11em] text-ink-400">
              <th scope="col" className="py-1.5 text-left font-bold">Line</th>
              <th scope="col" className="py-1.5 text-right font-bold">Planned</th>
              <th scope="col" className="py-1.5 text-right font-bold">Actual</th>
              <th scope="col" className="py-1.5 text-right font-bold">Variance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const variance = row.actual - row.plan
              return (
                <tr key={row.label} className="border-b border-line/60">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <span className="text-[12px] text-ink-600">{row.label}</span>
                    {row.hint && <span className="mt-0.5 block text-[10.5px] leading-snug text-ink-400">{row.hint}</span>}
                  </th>
                  <td className="py-2 text-right"><Figure value={row.plan} /></td>
                  <td className="py-2 text-right"><Figure value={row.actual} /></td>
                  <td className="py-2 text-right">
                    <span className={clsx('figure text-[12.5px] tabular-nums', Math.abs(variance) < 1 ? 'text-ink-400' : variance > 0 ? 'text-coral' : 'text-success-strong')}>
                      {Math.abs(variance) < 1 ? 'on plan' : `${variance > 0 ? '+' : '−'}${money(Math.abs(variance))}`}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-paper-3/70 px-3 py-2">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-ink-400">Price planned</p>
            <p className="figure mt-1 text-[14px] font-semibold text-ink">{money(game.price)}</p>
          </div>
          <div className="rounded-xl bg-paper-3/70 px-3 py-2">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-ink-400">Revenue per customer</p>
            <p className="figure mt-1 text-[14px] font-semibold text-ink">{money(realisedPerCustomer)}</p>
            <p className="mt-0.5 text-[10px] text-ink-400">
              {realisedPerCustomer >= game.price ? 'at or above list price' : 'discounting or mix below list'}
            </p>
          </div>
        </div>

        <p className="mt-3 rounded-xl bg-paper-3/60 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
          Spend lines move in whole months, so a variance usually means the budget changed after the close it applied to.
          A negative spend variance is money you did not spend — not profit you earned.
        </p>
      </div>
    </PanelSection>
  )
}

function ForecastTab({ statements, cash }: { statements: Statements[]; cash: number }) {
  const recent = statements.slice(-3)
  const average = (pick: (item: Statements) => number) => (recent.length ? Math.round(recent.reduce((sum, item) => sum + pick(item), 0) / recent.length) : 0)

  const revenue = average((item) => item.income.revenue)
  const netProfit = average((item) => item.income.netProfit)
  const depreciation = average((item) => item.income.depreciation)
  const operatingCash = average((item) => item.cashFlow.operating)
  const monthlyDelta = netProfit + depreciation

  const horizon = [1, 2, 3].map((step) => ({
    step,
    month: (statements[statements.length - 1]?.month ?? 0) + step,
    revenue: revenue * step,
    profit: monthlyDelta * step,
    cash: cash + monthlyDelta * step,
  }))

  const burn = operatingCash < 0 ? -operatingCash : 0
  const runway = burn > 0 ? Math.floor(cash / burn) : null

  return (
    <PanelSection
      title="Forecast"
      hint="The last three months repeated forward. It is an extrapolation of your own history, not a model of demand."
    >
      <div id="finance-panel-forecast" role="tabpanel" aria-labelledby="finance-tab-forecast">
        <div className="grid grid-cols-3 gap-2">
          {horizon.map((item) => (
            <div key={item.step} className="rounded-xl bg-paper-3/70 px-3 py-2">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-ink-400">{monthLabel(item.month)}</p>
              <p className={clsx('figure mt-1 text-[15px] font-semibold', item.cash < 0 ? 'text-coral' : 'text-ink')}>{money(item.cash)}</p>
              <p className="mt-0.5 text-[10px] text-ink-400">cash, {item.profit >= 0 ? '+' : '−'}{money(Math.abs(item.profit))}/mo</p>
            </div>
          ))}
        </div>

        <StatementTable caption="Three-month extrapolation">
          <LineRow label="Average revenue" value={revenue} hint="Last three closes." />
          <LineRow label="Average net profit" value={netProfit} />
          <LineRow label="Add back depreciation" value={depreciation} hint="Non-cash, so it returns to the bank." tone="muted" />
          <LineRow label="Monthly cash movement" value={monthlyDelta} tone="subtotal" />
          <LineRow label="Average operating cash flow" value={operatingCash} />
          <LineRow label="Cash today" value={cash} tone="total" />
        </StatementTable>

        <p className="mt-3 rounded-xl bg-paper-3/60 px-3 py-2 text-[11px] leading-relaxed text-ink-500">
          {runway !== null
            ? `Operating cash has averaged ${money(burn)} of burn a month. At that rate the current cash covers about ${runway} month${runway === 1 ? '' : 's'} — before any supplier bills you cannot pay.`
            : 'Operating cash flow has been positive on average, so there is no burn to run down. Watch the bills tab: a month with a large payment can still take cash out.'}
        </p>
      </div>
    </PanelSection>
  )
}

function WhatIf({ statement, cash }: { statement: Statements; cash: number }) {
  const [delta, setDelta] = useState(0)
  const baseMarketing = statement.income.marketing
  const baseProduct = statement.income.product
  const marketing = Math.max(0, Math.round(baseMarketing * (1 + delta)))
  const product = Math.max(0, Math.round(baseProduct * (1 + delta)))

  // Deliberately simple, explainable arithmetic: assume revenue moves with the
  // spend change at half the rate (diminishing returns), everything else holds.
  const spendChange = marketing + product - (baseMarketing + baseProduct)
  const revenueChange = Math.round(spendChange * 0.75)
  const projectedNet = statement.income.netProfit + revenueChange - spendChange + Math.round(revenueChange * 0.3)
  const projectedCash = cash + (projectedNet - statement.income.depreciation)

  return (
    <PanelSection
      title="What if"
      hint="A rough, explainable estimate — not a forecast. It assumes revenue moves with spend at three-quarters of the change and gross margin holds."
    >
      <div id="finance-panel-whatif" role="tabpanel" aria-labelledby="finance-tab-whatif">
        <div className="flex flex-wrap gap-1.5">
          {[
            { value: -0.2, label: 'Trim spend 20%' },
            { value: 0, label: 'Hold the plan' },
            { value: 0.2, label: 'Push spend 20%' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setDelta(option.value)}
              aria-pressed={delta === option.value}
              className={clsx(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition',
                delta === option.value ? 'bg-brand-500 text-white shadow-sm' : 'bg-paper-3/80 text-ink-500 hover:bg-paper-3 hover:text-ink',
              )}
            >
              <ArrowLeftRight className="size-3" aria-hidden />
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-paper-3/70 px-3 py-2">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-ink-400">Marketing + product</p>
            <p className="figure mt-1 text-[14px] font-semibold text-ink">{money(marketing + product)}</p>
            <p className="mt-0.5 text-[10px] text-ink-400">{spendChange >= 0 ? '+' : '−'}{money(Math.abs(spendChange))} vs last month</p>
          </div>
          <div className="rounded-xl bg-paper-3/70 px-3 py-2">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-ink-400">Projected net profit</p>
            <p className={clsx('figure mt-1 text-[14px] font-semibold', projectedNet < 0 ? 'text-coral' : 'text-success-strong')}>{money(projectedNet, { sign: projectedNet < 0 })}</p>
            <p className="mt-0.5 text-[10px] text-ink-400">{statement.income.netProfit >= 0 ? 'vs ' : 'vs '}{money(statement.income.netProfit)} last month</p>
          </div>
          <div className="col-span-2 rounded-xl bg-ink-900 px-3 py-2.5 text-white">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.11em] text-white/50">Projected closing cash</p>
            <p className="figure mt-1 text-[17px] font-semibold tabular-nums">{money(projectedCash)}</p>
            <p className="mt-0.5 text-[10px] text-white/60">
              {projectedCash >= cash ? '+' : '−'}{money(Math.abs(projectedCash - cash))} against today's {money(cash)}
            </p>
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-ink-500">
          Depreciation is added back because it never left the bank. Demand, pricing and competitor reactions are ignored here —
          use it to sanity-check a decision, then close the month to see what actually happens.
        </p>
      </div>
    </PanelSection>
  )
}
