export interface MissionDefinition {
  id: string
  name: string
  description: string
  mandatory: boolean
  reward: { xp: number; reputation: number }
}

export interface LevelDefinition {
  levelId: string
  stageId?: string
  chapter?: string
  levelNumber: number
  name: string
  description: string
  learningObjective: string
  missions: MissionDefinition[]
}

const levelData: Array<[string, string, string, string[]]> = [
  ['The Idea', 'Turn a problem into a business worth testing.', 'A business starts with a customer, a problem and a way to create value.', ['Choose your industry', 'Identify an opportunity', 'Define your solution', 'Choose your business model', 'Name your business', 'Set your ambition']],
  ['Market Discovery', 'Learn who might buy before you spend heavily.', 'Demand is discovered through customers, competitors and evidence.', ['Define your customers', 'Explore the market', 'Identify competitors', 'Study customer needs', 'Compare prices', 'Identify your advantage', 'Assess demand']],
  ['Business Planning', 'Turn research into a model you can operate.', 'Pricing, costs, revenue and cash flow make an idea testable.', ['Define your offering', 'Estimate startup costs', 'Set your pricing', 'Identify suppliers', 'Estimate monthly expenses', 'Build revenue projections', 'Create a cash-flow plan', 'Prepare your business plan']],
  ['Company Formation', 'Create the legal and ownership shell of the company.', 'A company needs a clear identity, directors and ownership.', ['Submit registration', 'Appoint directors', 'Allocate founder shares', 'Document founder agreements']],
  ['Meet the Requirements', 'Understand the rules that apply to your sector.', 'Compliance is an operating system, not a one-time checkbox.', ['Review requirements', 'Prepare tax registration', 'Apply for applicable permits', 'Pass the first inspection']],
  ['Open for Business', 'Put money movement and records in place.', 'A clean corporate account makes the business legible and safer.', ['Complete KYC', 'Open a corporate account', 'Start a traceable ledger']],
  ['Build Your Founding Team', 'Add the people who make the plan executable.', 'Early hiring is a trade-off between capability, cash and ownership.', ['Meet a potential co-founder', 'Recruit an initial employee', 'Confirm the team and ownership structure']],
  ['Find Your First Capital', 'Fund the first version responsibly.', 'Gifts, loans and equity create different obligations.', ['Ask family and friends for support', 'Choose a responsible funding route', 'Record the contribution']],
  ['Prepare to Pitch', 'Turn the business plan into an investor story.', 'A pitch is evidence, clarity and a credible use of funds.', ['Build a pitch deck', 'Select proof points', 'Set a clear funding ask']],
  ['Enter the Investment Market', 'Choose investors and enter the market.', 'Good fundraising is selective, prepared and relationship-driven.', ['Review the investor directory', 'Submit a suitable application', 'Follow up with evidence']],
  ['Handle Your First Rejection', 'Use a no as information, not a dead end.', 'Feedback turns rejection into a better plan or a better route.', ['Analyse investor feedback', 'Address the biggest weakness', 'Choose whether to reapply']],
  ['Secure Pre-seed Investment', 'Negotiate terms that fit the company.', 'Investment changes cash, ownership and governance together.', ['Evaluate an investment offer', 'Negotiate responsible terms', 'Sign the simulated agreement']],
  ['Prepare for Launch', 'Make the product, brand and operations ready.', 'Launching is a coordinated operating decision, not a single button.', ['Finalise the first product', 'Create the brand profile', 'Set a measured marketing plan', 'Secure operational suppliers']],
  ['First Board & Business Review', 'Build a habit of governance and learning.', 'Good governance makes decisions visible and correctable.', ['Hold the first board meeting', 'Review finance and operations', 'Record the next resolution']],
  ['Launch & Break-even', 'Make real sales and work toward break-even.', 'A business is operating when customers, costs and cash agree.', ['Launch the business', 'Process the first sale', 'Record operating expenses', 'Work toward break-even']],
]

export const BEGINNER_LEVELS: LevelDefinition[] = levelData.map(([name, description, learningObjective, missions], levelIndex) => ({
  levelId: `beginner-${String(levelIndex + 1).padStart(2, '0')}`,
  levelNumber: levelIndex + 1,
  name,
  description,
  learningObjective,
  missions: missions.map((mission, missionIndex) => ({
    id: `beginner-${levelIndex + 1}-${missionIndex + 1}`,
    name: mission,
    description: `Complete the ${mission.toLowerCase()} activity and record its evidence.`,
    mandatory: true,
    reward: { xp: levelIndex === 14 && missionIndex === missions.length - 1 ? 200 : 25, reputation: 1 },
  })),
}))

export function stageSummary() {
  return { stageId: 'beginner', name: 'Beginner', levelCount: BEGINNER_LEVELS.length, levels: BEGINNER_LEVELS }
}
