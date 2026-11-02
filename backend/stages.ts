import type { LevelDefinition } from './stage.js'
import { STAGE_02_LEVELS } from './stage02.js'

const stageNames = [
  ['Early Growth', ['First Customers', 'Build Repeatability', 'Hire with Intent', 'Measure What Matters', 'Improve the Offer', 'Strengthen Operations', 'Build the Brand', 'Grow Carefully', 'Manage Cash', 'Quarterly Review', 'Customer Retention', 'Team Systems', 'Supplier Strength', 'Sales Engine', 'Early Growth Review']],
  ['Expansion', ['Choose a Market', 'Validate Expansion', 'Open a Location', 'Localise the Offer', 'Fund Expansion', 'Lead Managers', 'Standardise Delivery', 'Manage Inventory', 'Build Partnerships', 'Regional Marketing', 'Multi-site Finance', 'Risk Controls', 'Market Competition', 'Expansion Review', 'Regional Break-even']],
  ['Established Business', ['Formalise Governance', 'Build Middle Management', 'Improve Margins', 'Introduce Products', 'Enterprise Sales', 'Customer Success', 'Procurement Discipline', 'Operational Resilience', 'Data and Reporting', 'Regulatory Readiness', 'Capital Strategy', 'Defend the Market', 'People Development', 'Board Strategy', 'Established Review']],
  ['Enterprise & Legacy', ['Design the Portfolio', 'Institutional Capital', 'International Readiness', 'Executive Leadership', 'Advanced Finance', 'Mergers and Acquisitions', 'Legacy Systems', 'Public Trust', 'Economic Resilience', 'Social Impact', 'Succession Planning', 'Investor Relations', 'New Ventures', 'Legacy Governance', 'Enterprise Review']],
] as const

const GENERIC_LATER_LEVELS: LevelDefinition[] = stageNames.slice(1).flatMap(([stageName, levels], stageIndex) => levels.map((name, levelIndex) => {
  const levelNumber = 31 + stageIndex * 15 + levelIndex
  const stageId = `stage-${stageIndex + 3}`
  return {
    levelId: `${stageId}-${String(levelIndex + 1).padStart(2, '0')}`,
    stageId,
    levelNumber,
    name,
    description: `Build the company through ${name.toLowerCase()} decisions and measurable outcomes.`,
    learningObjective: `Apply the ${stageName.toLowerCase()} operating principles to the persistent business.`,
    missions: [
      { id: `${stageId}-${levelNumber}-decision`, name: 'Make the operating decision', description: 'Choose a direction and record the trade-off.', mandatory: true, reward: { xp: 50, reputation: 2 } },
      { id: `${stageId}-${levelNumber}-evidence`, name: 'Produce evidence', description: 'Use the shared simulation to test the decision.', mandatory: true, reward: { xp: 50, reputation: 2 } },
      { id: `${stageId}-${levelNumber}-review`, name: 'Review the outcome', description: 'Compare the result to the plan and record the next action.', mandatory: true, reward: { xp: 75, reputation: 3 } },
    ],
  }
}))

export const LATER_LEVELS: LevelDefinition[] = [...STAGE_02_LEVELS, ...GENERIC_LATER_LEVELS]
export const ALL_LEVELS = LATER_LEVELS

export function allStageSummaries(beginner: { levelCount: number; levels: LevelDefinition[] }) {
  return [
    { stageId: 'beginner', name: 'Beginner', levelStart: 1, levelEnd: 15, levelCount: 15, levels: beginner.levels },
    ...[['Early Growth'], ...stageNames.slice(1)].map(([name], index) => {
      const start = 16 + index * 15
      return { stageId: `stage-${index + 2}`, name, levelStart: start, levelEnd: start + 14, levelCount: 15, levels: LATER_LEVELS.filter((level) => level.stageId === `stage-${index + 2}`) }
    }),
  ]
}
