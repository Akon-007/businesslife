import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  authorityPayload,
  normalizeGame,
  startGame,
} from './engine'
import type { DifficultyId, FounderBackgroundId, GameOp, GameState, IndustryId, StrategyId } from './types'
import { QUALIFICATION_FEE, quoteValue } from './sales'
import { money, uid } from '../lib/format'
import { applyOp } from './ops'
import { commitRun, createRemoteCompany, fetchRun, syncCompanyAction, syncFundingAction, syncMission } from '../lib/api'

type Toast = { id: string; message: string; tone: 'good' | 'bad' | 'neutral' }

export interface ArchivedRun {
  id: string
  savedAt: number
  game: GameState
}

export interface StartInput {
  founder: string
  company: string
  industry: IndustryId
  strategy: StrategyId
  founderBackground?: FounderBackgroundId
  difficulty?: DifficultyId
  firstName?: string
  lastName?: string
  nickname?: string
  avatar?: string
  accountEmail?: string
  password?: string
  problem?: string
  solution?: string
  seed?: number
  startingCash?: number
  /** Start from a scenario pack (fixes industry, strategy, difficulty and seed). */
  scenarioId?: string
}

interface GameStore {
  game: GameState | null
  runs: ArchivedRun[]
  toast: Toast | null
  start: (input: StartInput) => void
  reset: () => void
  advance: () => void
  resolve: (optionId: string) => void
  hire: (candidateId: string) => void
  fire: (employeeId: string) => void
  refreshPool: () => void
  openRound: () => void
  accept: (offerId: string) => void
  decline: () => void
  loan: (amount: number) => void
  repay: (amount: number) => void
  updatePrice: (price: number) => void
  updateMarketing: (amount: number) => void
  updateProduct: (amount: number) => void
  updateTraining: (amount: number) => void
  chooseSupplier: (supplierId: string) => void
  updateRestock: (months: number) => void
  toggleDealDiscount: (dealId: string) => void
  pushDeal: (dealId: string) => void
  qualifyLead: (leadId: string) => void
  sendQuote: (leadId: string, discount: number) => void
  dropLead: (leadId: string) => void
  placeOrder: (cover: number) => void
  expediteOrder: (orderId: string) => void
  cancelOrder: (orderId: string) => void
  investCapacity: (amount: number) => void
  openBranch: (branchId: string) => void
  setChannelShare: (channelId: string, share: number) => void
  setMixPreset: (mix: Record<string, number>) => void
  payBill: (billId: string) => void
  payAllBills: () => void
  loadRun: (runId: string) => void
  deleteRun: (runId: string) => void
  archiveCurrent: () => void
  dismissReport: () => void
  clearToast: () => void
  notify: (message: string, tone?: Toast['tone']) => void
  completeMission: (missionId: string) => void
  recordEvidence: (evidence: string[]) => void
  restartScenario: () => void
  syncRun: () => void
  hydrateAuthority: () => Promise<void>
}

const archive = (game: GameState): ArchivedRun => ({ id: uid(), savedAt: Date.now(), game })

/**
 * Apply a decision and record it. Every mutating store action goes through
 * here, which is what makes the run replayable on the server.
 */
const withOp = (game: GameState, op: GameOp): GameState => {
  const next = applyOp(game, op)
  if (next === game) return game
  return { ...next, journal: [...(game.journal ?? []), op] }
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      game: null,
      runs: [],
      toast: null,
      start: (input) => {
        const { game, runs } = get()
        const nextRuns = game ? [archive(game), ...runs].slice(0, 8) : runs
        const nextGame = startGame(input)
        set({ game: nextGame, runs: nextRuns })
        void createRemoteCompany({ founder: nextGame.founder, company: nextGame.company, industry: nextGame.industry, strategy: nextGame.strategy, ambition: 'Launch and reach break-even', startingCash: nextGame.cash, firstName: nextGame.firstName, lastName: nextGame.lastName, nickname: nextGame.nickname, avatar: nextGame.avatar, accountEmail: nextGame.accountEmail, password: input.password, problem: input.problem, solution: input.solution })
          .then((remote) => {
            set((state) => state.game ? { game: { ...state.game, backendCompanyId: remote.id } } : state)
            get().syncRun()
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : ''
            if (/email|password|account|sign in/i.test(message)) {
              get().notify(`Account: ${message} Your local run still works; fix the account to sync grades.`, 'neutral')
              return
            }
            get().notify('Local simulation is running. Backend sync will retry on the next action.', 'neutral')
          })
      },
      reset: () => {
        const { game, runs } = get()
        set({ game: null, runs: game ? [archive(game), ...runs].slice(0, 8) : runs })
      },
      archiveCurrent: () => {
        const { game, runs } = get()
        if (!game) return
        set({ game: null, runs: [archive(game), ...runs].slice(0, 8) })
      },
      loadRun: (runId) => {
        const { game, runs } = get()
        const run = runs.find((item) => item.id === runId)
        if (!run) return
        const remaining = runs.filter((item) => item.id !== runId)
        set({
          game: normalizeGame(run.game),
          runs: game ? [archive(game), ...remaining].slice(0, 8) : remaining,
        })
        get().notify(`${run.game.company} is back on the desk.`, 'good')
      },
      deleteRun: (runId) => {
        set({ runs: get().runs.filter((run) => run.id !== runId) })
      },
      advance: () => {
        const { game } = get()
        if (!game) return
        if (game.pendingCrisis) {
          get().notify('Resolve the crisis before closing the month.', 'bad')
          return
        }
        if (game.status !== 'active') return
        const next = withOp(game, { op: 'advanceDay' })
        set({ game: next })
        void syncCompanyAction(game.backendCompanyId, 'time/advance', { days: 1 }).catch(() => undefined)
        if (next.month !== game.month) get().syncRun()
      },
      completeMission: () => {
        get().notify('Complete the business action first. The system will mark the mission automatically.', 'neutral')
      },
      recordEvidence: (evidence) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        const next = withOp(game, { op: 'missionEvidence', args: { evidence } })
        if (next === game) return
        const before = new Set(game.beginner.levels.flatMap((level) => level.missions.filter((mission) => mission.status === 'completed').map((mission) => mission.missionId)))
        const newlyCompleted = next.beginner.levels.flatMap((level) => level.missions.filter((mission) => mission.status === 'completed' && !before.has(mission.missionId)).map((mission) => mission.missionId))
        set({ game: next })
        for (const missionId of newlyCompleted) void syncMission(game.backendCompanyId, missionId).catch(() => undefined)
        if (newlyCompleted.length) get().notify(`${newlyCompleted.length === 1 ? 'Mission' : 'Missions'} completed from your business actions.`, 'good')
      },
      syncRun: () => {
        const { game } = get()
        if (!game?.backendCompanyId) return
        const companyId = game.backendCompanyId
        const replayable = game.journalComplete !== false
        void commitRun(companyId, {
          ...authorityPayload(game),
          seed: game.seed,
          replay: replayable ? {
            profile: {
              founder: game.founder,
              firstName: game.firstName,
              lastName: game.lastName,
              nickname: game.nickname,
              avatar: game.avatar,
              accountEmail: game.accountEmail,
              company: game.company,
              industry: game.industry,
              strategy: game.strategy,
              founderBackground: game.founderBackground,
              difficulty: game.difficulty,
              startingCash: game.startingCash,
              seed: game.seed,
            },
            journal: game.journal ?? [],
          } : undefined,
        })
          .then((result) => {
            set((state) => {
              if (!state.game) return state
              const next = {
                ...state.game,
                authority: {
                  score: result.score,
                  month: result.canonical.month,
                  cash: result.canonical.cashKobo / 100,
                  commits: (state.game.authority?.commits ?? 0) + 1,
                  updatedAt: new Date().toISOString(),
                  integrity: result.tampered ? ('flagged' as const) : ('verified' as const),
                  readOnly: false,
                },
              }
              if (!result.tampered) return { game: next }
              return {
                game: {
                  ...next,
                  cash: result.canonical.cashKobo / 100,
                  customers: result.canonical.customers,
                  valuation: result.canonical.valuationKobo / 100,
                },
              }
            })
            if (result.tampered) {
              const fields = result.violations.map((item) => item.field).slice(0, 3).join(', ')
              get().notify(`The server corrected figures that did not reconcile (${fields}).`, 'bad')
            }
          })
          .catch(() => {
            set((state) => state.game?.authority ? { game: { ...state.game, authority: { ...state.game.authority, integrity: 'unknown' } } } : state)
          })
      },
      restartScenario: () => {
        const { game, runs } = get()
        if (!game) return
        const next = startGame({
          founder: game.founder,
          firstName: game.firstName,
          lastName: game.lastName,
          nickname: game.nickname,
          avatar: game.avatar,
          accountEmail: game.accountEmail,
          company: game.company,
          industry: game.industry,
          strategy: game.strategy,
          founderBackground: game.founderBackground,
          difficulty: game.difficulty,
          seed: game.seed,
          startingCash: game.startingCash,
          // A pack run restarts as the same pack, so the objectives stay attached.
          scenarioId: game.scenario?.id,
        })
        set({
          game: { ...next, backendCompanyId: game.backendCompanyId },
          runs: [archive(game), ...runs].slice(0, 8),
        })
        get().syncRun()
        get().notify('Scenario restarted from the same seed — same starting conditions, same city.', 'good')
      },
      hydrateAuthority: async () => {
        const { game } = get()
        if (!game?.backendCompanyId) return
        try {
          const run = await fetchRun(game.backendCompanyId)
          if (!run.authority.commits) {
            get().syncRun()
            return
          }
          const serverCash = run.canonical.cashKobo / 100
          if (run.canonical.month < game.month) {
            // The instructor reset this run on the server. Restart locally on the
            // same seed so the decision journal matches the authority again.
            get().restartScenario()
            get().notify('Your instructor reset this run. Restarting from the scenario seed.', 'neutral')
            return
          }
          const drifted = Math.abs(serverCash - game.cash) > Math.max(1, serverCash * 0.02)
          set((state) => {
            if (!state.game) return state
            const base = {
              ...state.game,
              authority: {
                score: run.score,
                month: run.canonical.month,
                cash: serverCash,
                commits: run.authority.commits,
                updatedAt: run.authority.updatedAt,
                integrity: run.violations.length ? ('flagged' as const) : ('verified' as const),
                readOnly: run.readOnly,
              },
            }
            if (!drifted) return { game: base }
            return {
              game: {
                ...base,
                cash: serverCash,
                customers: run.canonical.customers,
                valuation: run.canonical.valuationKobo / 100,
              },
            }
          })
          if (drifted) get().notify('Protected figures were restored from the server — your saved run had drifted.', 'neutral')
        } catch {
          /* offline: keep playing on the local simulation */
        }
      },
      resolve: (optionId) => {
        const { game } = get()
        if (!game) return
        set({ game: withOp(game, { op: 'resolveCrisis', args: { optionId } }) })
      },
      hire: (candidateId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        const candidate = game.candidates.find((item) => item.id === candidateId)
        if (!candidate) return
        if (game.cash < candidate.signingBonus + candidate.salary) {
          get().notify('You need the signing bonus plus one month of salary in cash.', 'bad')
          return
        }
        set({ game: withOp(game, { op: 'hireCandidate', args: { candidateId } }) })
        get().recordEvidence(['beginner-7-2', 'beginner-7-3'])
        void syncCompanyAction(game.backendCompanyId, 'job-openings', { name: candidate.name, role: candidate.role, salaryKobo: Math.round(candidate.salary * 100) }, `hire-${candidateId}-${game.month}`).catch(() => undefined)
        get().notify(`${candidate.name} joined the team.`, 'good')
      },
      fire: (employeeId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        const member = game.team.find((item) => item.id === employeeId)
        if (!member) return
        if (game.cash < member.salary) {
          get().notify('You need one month of severance available in cash.', 'bad')
          return
        }
        set({ game: withOp(game, { op: 'fireEmployee', args: { employeeId } }) })
        void syncCompanyAction(game.backendCompanyId, 'budget', { type: 'employee_terminated', employeeId, severanceKobo: Math.round(member.salary * 100) }, `fire-${employeeId}-${game.month}`).catch(() => undefined)
        get().notify(`${member.name} left the team.`, 'neutral')
      },
      refreshPool: () => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        if (game.cash < 500) {
          get().notify(`Refreshing the candidate pool costs ${money(500)}.`, 'bad')
          return
        }
        set({ game: withOp(game, { op: 'refreshCandidates' }) })
      },
      openRound: () => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        if (game.month < 3) {
          get().notify('Investors want to see at least three months of progress.', 'bad')
          return
        }
        if (game.month - game.lastRoundMonth < 3) {
          get().notify('Give it another quarter before opening a new round.', 'bad')
          return
        }
        set({ game: withOp(game, { op: 'offerRound' }) })
        get().recordEvidence(['beginner-9-1', 'beginner-9-2', 'beginner-9-3', 'beginner-10-1'])
      },
      accept: (offerId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        const offer = game.offers.find((item) => item.id === offerId)
        set({ game: withOp(game, { op: 'acceptOffer', args: { offerId } }) })
        get().recordEvidence(['beginner-12-1', 'beginner-12-2', 'beginner-12-3'])
        if (offer) void syncFundingAction(game.backendCompanyId, offerId, offer.amount, offer.equity).catch(() => undefined)
        if (offer) get().notify(`Term sheet signed with ${offer.fund}.`, 'good')
      },
      decline: () => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: withOp(game, { op: 'declineOffers' }) })
      },
      loan: (amount) => {
        const { game } = get()
        if (!game || game.status !== 'active' || amount <= 0) return
        set({ game: withOp(game, { op: 'takeLoan', args: { amount } }) })
        get().recordEvidence(['beginner-8-2', 'beginner-8-3'])
        void syncCompanyAction(game.backendCompanyId, 'finance/loan', { amount: Math.round(amount) }, `loan-${game.month}-${amount}`).catch(() => undefined)
        get().notify('Loan approved. Interest starts next month.', 'neutral')
      },
      repay: (amount) => {
        const { game } = get()
        if (!game || game.status !== 'active' || amount <= 0) return
        set({ game: withOp(game, { op: 'repayDebt', args: { amount } }) })
        get().recordEvidence(['beginner-12-2'])
        void syncCompanyAction(game.backendCompanyId, 'finance/repay', { amount: Math.round(amount) }, `repay-${game.month}-${amount}`).catch(() => undefined)
      },
      updatePrice: (price) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: withOp(game, { op: 'setPrice', args: { price } }) })
        get().recordEvidence(['beginner-2-5', 'beginner-3-3'])
      },
      updateMarketing: (amount) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: withOp(game, { op: 'setMarketing', args: { amount } }) })
        get().recordEvidence(['beginner-13-3'])
        void syncCompanyAction(game.backendCompanyId, 'budget', { budget: 'marketing', amount: Math.round(amount) }, `marketing-budget-${game.month}`).catch(() => undefined)
      },
      updateProduct: (amount) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: withOp(game, { op: 'setProduct', args: { amount } }) })
        get().recordEvidence(['beginner-3-1', 'beginner-13-1'])
        void syncCompanyAction(game.backendCompanyId, 'budget', { budget: 'product', amount: Math.round(amount) }, `product-budget-${game.month}`).catch(() => undefined)
      },
      updateTraining: (amount) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: withOp(game, { op: 'setTraining', args: { amount } }) })
        void syncCompanyAction(game.backendCompanyId, 'budget', { budget: 'training', amount: Math.round(amount) }, `training-budget-${game.month}`).catch(() => undefined)
      },
      chooseSupplier: (supplierId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: withOp(game, { op: 'selectSupplier', args: { supplierId } }) })
        get().recordEvidence(['beginner-3-4', 'beginner-13-4'])
        void syncCompanyAction(game.backendCompanyId, 'supplier-selection', { supplierId }, `supplier-${game.month}`).catch(() => undefined)
        const supplier = game.suppliers.find((item) => item.id === supplierId)
        if (supplier) get().notify(`Supply now runs through ${supplier.name}.`, 'neutral')
      },
      updateRestock: (months) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: withOp(game, { op: 'setRestock', args: { months } }) })
        void syncCompanyAction(game.backendCompanyId, 'budget', { budget: 'restock', months }, `restock-${game.month}`).catch(() => undefined)
      },
      toggleDealDiscount: (dealId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: withOp(game, { op: 'toggleDealDiscount', args: { dealId } }) })
        void syncCompanyAction(game.backendCompanyId, 'sales/pipeline', { dealId, discount: !game.pipeline.find((deal) => deal.id === dealId)?.discount }, `deal-discount-${dealId}-${game.month}`).catch(() => undefined)
      },
      pushDeal: (dealId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        if (game.cash < 1_200) {
          get().notify(`Pushing a deal costs ${money(1_200)} in cash.`, 'bad')
          return
        }
        set({ game: withOp(game, { op: 'pushDeal', args: { dealId } }) })
        void syncCompanyAction(game.backendCompanyId, 'sales/pipeline', { dealId, action: 'push', cost: 1200 }, `deal-push-${dealId}`).catch(() => undefined)
        get().notify(`You spent ${money(1_200)} pushing the deal forward.`, 'neutral')
      },
      qualifyLead: (leadId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        const lead = (game.leads ?? []).find((item) => item.id === leadId)
        if (!lead || lead.status !== 'open') return
        if (game.cash < QUALIFICATION_FEE) {
          get().notify(`Qualifying an account costs ${money(QUALIFICATION_FEE)}.`, 'bad')
          return
        }
        set({ game: withOp(game, { op: 'qualifyLead', args: { leadId } }) })
        void syncCompanyAction(game.backendCompanyId, 'sales/funnel', { leadId, action: 'qualify' }, `lead-qualify-${leadId}`).catch(() => undefined)
        get().notify(`${lead.company} qualified — the quote will land harder.`, 'good')
      },
      sendQuote: (leadId, discount) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        const lead = (game.leads ?? []).find((item) => item.id === leadId)
        if (!lead || (lead.status !== 'open' && lead.status !== 'qualified')) return
        const value = quoteValue(lead, game.price, discount)
        set({ game: withOp(game, { op: 'sendQuote', args: { leadId, discount } }) })
        void syncCompanyAction(game.backendCompanyId, 'sales/funnel', { leadId, action: 'quote', value, discount }, `lead-quote-${leadId}-${game.month}`).catch(() => undefined)
        get().notify(`Quote sent to ${lead.company}: ${money(value)}/month.`, 'good')
      },
      placeOrder: (cover) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        const before = (game.orders ?? []).length
        set({ game: withOp(game, { op: 'placeOrder', args: { cover } }) })
        void syncCompanyAction(game.backendCompanyId, 'operations/orders', { action: 'place', cover }, `po-${game.month}-${before}`).catch(() => undefined)
        get().notify(`Order placed for ${cover.toFixed(1)} months of stock cover.`, 'good')
      },
      expediteOrder: (orderId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        const before = game.cash
        set({ game: withOp(game, { op: 'expediteOrder', args: { orderId } }) })
        const after = get().game?.cash ?? before
        if (after === before) {
          get().notify('That delivery cannot be expedited any further.', 'bad')
          return
        }
        void syncCompanyAction(game.backendCompanyId, 'operations/orders', { action: 'expedite', orderId }, `po-expedite-${orderId}`).catch(() => undefined)
        get().notify(`Delivery expedited for ${money(before - after)}.`, 'neutral')
      },
      cancelOrder: (orderId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: withOp(game, { op: 'cancelOrder', args: { orderId } }) })
      },
      investCapacity: (amount) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        if (game.cash < amount) {
          get().notify(`Capacity investment needs ${money(amount)}; cash on hand is ${money(game.cash)}.`, 'bad')
          return
        }
        set({ game: withOp(game, { op: 'investCapacity', args: { amount } }) })
        void syncCompanyAction(game.backendCompanyId, 'operations/orders', { action: 'invest', amount }, `capacity-${game.month}-${Math.round(amount)}`).catch(() => undefined)
        get().notify(`${money(amount)} invested in fulfilment capacity.`, 'good')
      },
      dropLead: (leadId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: withOp(game, { op: 'dropLead', args: { leadId } }) })
      },
      setChannelShare: (channelId, share) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        const current = game.marketingMix?.[channelId as keyof typeof game.marketingMix] ?? 0
        if (Math.abs(current - share) < 0.005) return
        set({ game: withOp(game, { op: 'setMarketingChannel', args: { channelId, share } }) })
      },
      setMixPreset: (mix) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: withOp(game, { op: 'setMarketingMix', args: mix }) })
      },
      payBill: (billId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        const bill = (game.bills ?? []).find((item) => item.id === billId)
        if (!bill || bill.status === 'paid') return
        if (game.cash < bill.amount) {
          get().notify(`That bill needs ${money(bill.amount)}; cash on hand is ${money(game.cash)}.`, 'bad')
          return
        }
        set({ game: withOp(game, { op: 'payBill', args: { billId } }) })
        get().notify(`${money(bill.amount)} paid to ${bill.vendor}.`, 'good')
      },
      payAllBills: () => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        const open = (game.bills ?? []).filter((bill) => bill.status !== 'paid')
        const total = open.reduce((sum, bill) => sum + bill.amount, 0)
        if (!open.length) {
          get().notify('No supplier bills outstanding.', 'neutral')
          return
        }
        if (game.cash < Math.min(...open.map((bill) => bill.amount))) {
          get().notify(`Cash on hand is ${money(game.cash)} — not enough for the oldest bill (${money(Math.min(...open.map((bill) => bill.amount)))}).`, 'bad')
          return
        }
        set({ game: withOp(game, { op: 'payAllBills', args: {} }) })
        get().notify(`Payment run sent: ${money(Math.min(total, game.cash))} against ${open.length} open bill${open.length === 1 ? '' : 's'}.`, 'good')
      },
      openBranch: (branchId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        const branch = game.branches.find((item) => item.id === branchId)
        if (!branch || branch.openedMonth !== null) return
        if (game.month < branch.minMonth) {
          get().notify(`${branch.name} unlocks in month ${branch.minMonth}.`, 'bad')
          return
        }
        if (game.cash < branch.launchCost) {
          get().notify(`You need ${money(branch.launchCost)} in cash to launch.`, 'bad')
          return
        }
        set({ game: withOp(game, { op: 'openBranch', args: { branchId } }) })
        void syncCompanyAction(game.backendCompanyId, 'branches', { branchId, name: branch.name, launchCost: branch.launchCost }, `branch-${branchId}`).catch(() => undefined)
        get().notify(`${branch.name} is open.`, 'good')
      },
      dismissReport: () => {
        const { game } = get()
        if (!game) return
        set({ game: { ...game, lastReport: null } })
      },
      clearToast: () => set({ toast: null }),
      notify: (message, tone = 'neutral') => set({ toast: { id: uid(), message, tone } }),
    }),
    {
      name: 'businesslife.save',
      version: 2,
      partialize: (state) => ({ game: state.game, runs: state.runs }),
      migrate: (persisted) => {
        const stored = (persisted ?? {}) as Partial<GameStore>
        return {
          game: stored.game ? normalizeGame(stored.game) : null,
          runs: (stored.runs ?? []).map((run) => ({ ...run, game: normalizeGame(run.game) })),
        }
      },
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<GameStore>
        return {
          ...current,
          ...stored,
          game: stored.game ? normalizeGame(stored.game) : null,
          runs: (stored.runs ?? []).map((run) => ({ ...run, game: normalizeGame(run.game) })),
          toast: null,
        }
      },
    },
  ),
)
