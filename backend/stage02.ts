import type { LevelDefinition } from './stage.js'

const levels: Array<[string, string, string, string[]]> = [
  ['Understand Your Numbers', 'Understand what is happening financially inside the company.', 'Financial understanding', ['Open the business financial report', 'Review previous sales', 'Identify the largest expense', 'Review outstanding payments', 'Compare cash with obligations', 'Prepare a financial summary']],
  ['Build a Sales Engine', 'Create a repeatable process for attracting and converting customers.', 'Repeatable sales', ['Set a monthly sales target', 'Identify the main customer group', 'Create a product offer', 'Respond to a customer enquiry', 'Complete business sales', 'Review sales performance']],
  ['Retain Your Customers', 'Learn that getting a customer is only the beginning.', 'Customer relationships', ['Review customer history', 'Identify previous customers', 'Follow up with inactive customers', 'Resolve a customer complaint', 'Create a retention offer', 'Review repeat purchases']],
  ['Manage Your Team', 'Manage employees and workplace responsibilities.', 'Workforce management', ['Review employee roles', 'Review salary obligations', 'Check attendance and performance', 'Address an employee concern', 'Assign responsibilities', 'Review team performance']],
  ['Financial Discipline', 'Build financial habits that allow the business to survive and grow.', 'Budget and cash-flow control', ['Prepare a monthly budget', 'Separate business and personal spending', 'Review upcoming payments', 'Set an expense limit', 'Identify a cash-flow problem', 'Review financial position']],
  ['Monthly Marketing', 'Learn to attract customers consistently.', 'Consistent customer acquisition', ['Choose a product to promote', 'Choose a target audience', 'Select a marketing channel', 'Set a campaign budget', 'Launch a campaign', 'Review campaign results']],
  ['Build Your Network', 'Establish relationships that create business opportunities.', 'Business relationships', ['Identify relevant businesses', 'Contact a potential partner', 'Arrange a business meeting', 'Attend a networking opportunity', 'Establish a useful relationship']],
  ['Host Your First Business Event', 'Organise an event that attracts customers and creates opportunities.', 'Event planning and execution', ['Choose an event type', 'Select a location', 'Set a date and budget', 'Prepare products and staff', 'Promote the event', 'Review event profit or loss']],
  ['Improve Operations', 'Make the company more efficient and reliable.', 'Operational efficiency', ['Review the order process', 'Identify an operational problem', 'Review supplier performance', 'Improve a business process', 'Reduce unnecessary expenses', 'Review the improvement']],
  ['Achieve Consistent Profitability', 'Move from occasional sales to a sustainable business.', 'Sustainable business performance', ['Review monthly performance', 'Identify the biggest profit constraint', 'Review pricing', 'Reduce unnecessary expenses', 'Improve sales or efficiency', 'Review multiple periods']],
  ['Investment & Shareholder Obligations', 'Understand obligations created by funding and ownership.', 'Ownership and investor management', ['Review ownership structure', 'Review investment agreements', 'Prepare a performance update', 'Send a shareholder update', 'Review investor obligations']],
  ['Investment Payback & Returns', 'Distinguish equity, loans and other financing agreements.', 'Financing obligations', ['Review funding agreements', 'Identify repayment obligations', 'Review financial capacity', 'Prepare a funding report', 'Make a suitable financing decision']],
  ['Staff Welfare & Retention', 'Treat employees as people whose performance responds to conditions.', 'Employee satisfaction and retention', ['Review employee satisfaction', 'Identify a welfare issue', 'Review salary arrangements', 'Address workload or performance', 'Introduce a staff improvement', 'Review retention']],
  ['Strengthen Governance', 'Make the company organised, accountable and prepared.', 'Organised company management', ['Review company records', 'Identify a business risk', 'Review outstanding contracts', 'Check compliance', 'Document a business decision', 'Prepare a management report']],
  ['Become Growth-Ready', 'Prepare the company for expansion based on its actual health.', 'Expansion readiness', ['Review the complete business health report', 'Choose a realistic growth path', 'Set growth priorities', 'Document risks and safeguards', 'Submit the growth plan']],
]

export const STAGE_02_LEVELS: LevelDefinition[] = levels.map(([name, description, objective, missions], index) => ({
  levelId: `stage-2-${String(index + 1).padStart(2, '0')}`,
  stageId: 'stage-2',
  levelNumber: 16 + index,
  name,
  description,
  learningObjective: objective,
  chapter: index < 3 ? 'Know Your Business' : index < 6 ? 'Build Your Operations' : index < 9 ? 'Build Your Reputation' : index < 13 ? 'Strengthen the Company' : 'Prepare for Growth',
  missions: missions.map((mission, missionIndex) => ({ id: `stage-2-${index + 16}-${missionIndex + 1}`, name: mission, description: `Use the live business records to ${mission.toLowerCase()}.`, mandatory: true, reward: { xp: index === 14 ? 100 : 50, reputation: 2 } })),
}))
