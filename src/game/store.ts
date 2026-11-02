import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  acceptOffer,
  advanceMonth,
  acknowledgeMissionEvidence,
  declineOffers,
  fireEmployee,
  hireCandidate,
  normalizeGame,
  offerRound,
  openBranch,
  pushDeal,
  refreshCandidates,
  repayDebt,
  resolveCrisis,
  selectSupplier,
  setMarketing,
  setPrice,
  setProduct,
  setRestock,
  setTraining,
  startGame,
  takeLoan,
  toggleDealDiscount,
} from './engine'
import type { DifficultyId, FounderBackgroundId, GameState, IndustryId, StrategyId } from './types'
import { money, uid } from '../lib/format'
import { createRemoteCompany, syncCompanyAction, syncFundingAction, syncMission } from '../lib/api'

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
  openBranch: (branchId: string) => void
  loadRun: (runId: string) => void
  deleteRun: (runId: string) => void
  archiveCurrent: () => void
  dismissReport: () => void
  clearToast: () => void
  notify: (message: string, tone?: Toast['tone']) => void
  completeMission: (missionId: string) => void
  recordEvidence: (evidence: string[]) => void
}

const archive = (game: GameState): ArchivedRun => ({ id: uid(), savedAt: Date.now(), game })

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
        void createRemoteCompany({ founder: nextGame.founder, company: nextGame.company, industry: nextGame.industry, strategy: nextGame.strategy, ambition: 'Launch and reach break-even', startingCash: nextGame.cash })
          .then((remote) => set((state) => state.game ? { game: { ...state.game, backendCompanyId: remote.id } } : state))
          .catch(() => get().notify('Local simulation is running. Backend sync will retry on the next action.', 'neutral'))
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
        const next = advanceMonth(game)
        set({ game: next })
        void syncCompanyAction(game.backendCompanyId, 'time/advance', { days: 30 }).catch(() => undefined)
      },
      completeMission: () => {
        get().notify('Complete the business action first. The system will mark the mission automatically.', 'neutral')
      },
      recordEvidence: (evidence) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        const next = acknowledgeMissionEvidence(game, evidence)
        if (next === game) return
        const before = new Set(game.beginner.levels.flatMap((level) => level.missions.filter((mission) => mission.status === 'completed').map((mission) => mission.missionId)))
        const newlyCompleted = next.beginner.levels.flatMap((level) => level.missions.filter((mission) => mission.status === 'completed' && !before.has(mission.missionId)).map((mission) => mission.missionId))
        set({ game: next })
        for (const missionId of newlyCompleted) void syncMission(game.backendCompanyId, missionId).catch(() => undefined)
        if (newlyCompleted.length) get().notify(`${newlyCompleted.length === 1 ? 'Mission' : 'Missions'} completed from your business actions.`, 'good')
      },
      resolve: (optionId) => {
        const { game } = get()
        if (!game) return
        set({ game: resolveCrisis(game, optionId) })
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
        set({ game: hireCandidate(game, candidateId) })
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
        set({ game: fireEmployee(game, employeeId) })
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
        set({ game: refreshCandidates(game) })
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
        set({ game: offerRound(game) })
        get().recordEvidence(['beginner-9-1', 'beginner-9-2', 'beginner-9-3', 'beginner-10-1'])
      },
      accept: (offerId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        const offer = game.offers.find((item) => item.id === offerId)
        set({ game: acceptOffer(game, offerId) })
        get().recordEvidence(['beginner-12-1', 'beginner-12-2', 'beginner-12-3'])
        if (offer) void syncFundingAction(game.backendCompanyId, offerId, offer.amount, offer.equity).catch(() => undefined)
        if (offer) get().notify(`Term sheet signed with ${offer.fund}.`, 'good')
      },
      decline: () => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: declineOffers(game) })
      },
      loan: (amount) => {
        const { game } = get()
        if (!game || game.status !== 'active' || amount <= 0) return
        set({ game: takeLoan(game, amount) })
        get().recordEvidence(['beginner-8-2', 'beginner-8-3'])
        void syncCompanyAction(game.backendCompanyId, 'finance/loan', { amount: Math.round(amount) }, `loan-${game.month}-${amount}`).catch(() => undefined)
        get().notify('Loan approved. Interest starts next month.', 'neutral')
      },
      repay: (amount) => {
        const { game } = get()
        if (!game || game.status !== 'active' || amount <= 0) return
        set({ game: repayDebt(game, amount) })
        get().recordEvidence(['beginner-12-2'])
        void syncCompanyAction(game.backendCompanyId, 'finance/repay', { amount: Math.round(amount) }, `repay-${game.month}-${amount}`).catch(() => undefined)
      },
      updatePrice: (price) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: setPrice(game, price) })
        get().recordEvidence(['beginner-2-5', 'beginner-3-3'])
      },
      updateMarketing: (amount) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: setMarketing(game, amount) })
        get().recordEvidence(['beginner-13-3'])
        void syncCompanyAction(game.backendCompanyId, 'budget', { budget: 'marketing', amount: Math.round(amount) }, `marketing-budget-${game.month}`).catch(() => undefined)
      },
      updateProduct: (amount) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: setProduct(game, amount) })
        get().recordEvidence(['beginner-3-1', 'beginner-13-1'])
        void syncCompanyAction(game.backendCompanyId, 'budget', { budget: 'product', amount: Math.round(amount) }, `product-budget-${game.month}`).catch(() => undefined)
      },
      updateTraining: (amount) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: setTraining(game, amount) })
        void syncCompanyAction(game.backendCompanyId, 'budget', { budget: 'training', amount: Math.round(amount) }, `training-budget-${game.month}`).catch(() => undefined)
      },
      chooseSupplier: (supplierId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: selectSupplier(game, supplierId) })
        get().recordEvidence(['beginner-3-4', 'beginner-13-4'])
        void syncCompanyAction(game.backendCompanyId, 'supplier-selection', { supplierId }, `supplier-${game.month}`).catch(() => undefined)
        const supplier = game.suppliers.find((item) => item.id === supplierId)
        if (supplier) get().notify(`Supply now runs through ${supplier.name}.`, 'neutral')
      },
      updateRestock: (months) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: setRestock(game, months) })
        void syncCompanyAction(game.backendCompanyId, 'budget', { budget: 'restock', months }, `restock-${game.month}`).catch(() => undefined)
      },
      toggleDealDiscount: (dealId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        set({ game: toggleDealDiscount(game, dealId) })
        void syncCompanyAction(game.backendCompanyId, 'sales/pipeline', { dealId, discount: !game.pipeline.find((deal) => deal.id === dealId)?.discount }, `deal-discount-${dealId}-${game.month}`).catch(() => undefined)
      },
      pushDeal: (dealId) => {
        const { game } = get()
        if (!game || game.status !== 'active') return
        if (game.cash < 1_200) {
          get().notify(`Pushing a deal costs ${money(1_200)} in cash.`, 'bad')
          return
        }
        set({ game: pushDeal(game, dealId) })
        void syncCompanyAction(game.backendCompanyId, 'sales/pipeline', { dealId, action: 'push', cost: 1200 }, `deal-push-${dealId}`).catch(() => undefined)
        get().notify(`You spent ${money(1_200)} pushing the deal forward.`, 'neutral')
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
        set({ game: openBranch(game, branchId) })
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
