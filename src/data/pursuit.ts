// HP MPS Pursuit360 — Core Reference Data
// This is the foundational data layer for all pursuit modules

// ─── HP REGIONS & MARKETS ────────────────────────────────────────────────────

export const HP_REGIONS = [
  {
    id: 'americas',
    name: 'Americas',
    markets: ['United States', 'Canada', 'Brazil', 'Mexico', 'Argentina', 'Colombia', 'Chile', 'Peru'],
  },
  {
    id: 'emea',
    name: 'EMEA',
    markets: [
      'United Kingdom', 'Germany', 'France', 'Spain', 'Italy', 'Netherlands', 'Belgium',
      'Sweden', 'Norway', 'Denmark', 'Finland', 'Switzerland', 'Austria', 'Poland',
      'Portugal', 'Czechia', 'Hungary', 'Romania', 'South Africa', 'Saudi Arabia',
      'United Arab Emirates', 'Turkey', 'Israel',
    ],
  },
  {
    id: 'apac',
    name: 'APAC',
    markets: [
      'Australia', 'Japan', 'China', 'India', 'Singapore', 'South Korea', 'New Zealand',
      'Malaysia', 'Thailand', 'Indonesia', 'Philippines', 'Hong Kong', 'Taiwan',
    ],
  },
] as const

export type RegionId = typeof HP_REGIONS[number]['id']

// ─── MPS SERVICE PORTFOLIO ───────────────────────────────────────────────────

export const MPS_SERVICES = [
  {
    id: 'dmps',
    code: 'dMPS',
    name: 'Device-as-a-Service MPS',
    description: 'Full device lifecycle + print services. Hardware, software, support bundled.',
    soar_type: 'BA',
    cde_eligible: true,
    contract_terms: [36, 48, 60],
  },
  {
    id: 'pmps',
    code: 'pMPS',
    name: 'Pure MPS',
    description: 'Customer-owned devices. HP provides software, monitoring, service.',
    soar_type: 'BA',
    cde_eligible: false,
    contract_terms: [12, 24, 36],
  },
  {
    id: 'emps',
    code: 'eMPS',
    name: 'Enhanced MPS',
    description: 'Extended MPS with advanced analytics and optimisation services.',
    soar_type: 'BA',
    cde_eligible: false,
    contract_terms: [36, 48, 60],
  },
  {
    id: 'mds',
    code: 'MDS',
    name: 'Managed Device Services',
    description: 'PC lifecycle management — procurement, deployment, support, refresh.',
    soar_type: 'BA',
    cde_eligible: true,
    contract_terms: [36, 48, 60],
  },
  {
    id: 'mcs',
    code: 'MCS',
    name: 'Managed Collaboration Services',
    description: 'Meeting room and collaboration device lifecycle management.',
    soar_type: 'BA',
    cde_eligible: false,
    contract_terms: [36, 48],
  },
  {
    id: 'lcs',
    code: 'LCS',
    name: 'Lifecycle Services',
    description: 'Deployment, asset recovery, and refresh services.',
    soar_type: 'BA',
    cde_eligible: false,
    contract_terms: [12, 24, 36],
  },
] as const

// ─── SOAR TYPES ──────────────────────────────────────────────────────────────

export const SOAR_TYPES = [
  {
    id: 'oa',
    code: 'OA SOAR',
    name: 'Opportunity Assessment',
    description: 'Initial opportunity qualification. Does not expire.',
    expires: false,
    validity_days: null,
    triggers: ['New opportunity identified', 'Renewal assessment required'],
  },
  {
    id: 'ba',
    code: 'BA SOAR',
    name: 'Bid Approval',
    description: 'Full bid approval before proposal submission.',
    expires: true,
    validity_days: 90,
    validity_days_mds: 30,
    triggers: ['TCV ≥$100K', 'Non-standard terms', 'GM below threshold'],
  },
  {
    id: 'tc',
    code: 'T&C SOAR',
    name: 'Terms & Conditions',
    description: 'Contract terms approval. No expiry while terms unchanged.',
    expires: false,
    validity_days: null,
    triggers: ['Non-standard contractual terms', 'Customer MSA deviations'],
  },
] as const

// ─── APPROVAL THRESHOLDS ─────────────────────────────────────────────────────

export const APPROVAL_THRESHOLDS = [
  {
    tcv_min: 0,
    tcv_max: 4_999_999,
    gm_threshold: null,
    approvers: ['Market Category Manager', 'Market Finance'],
    notes: 'Standard market approval',
  },
  {
    tcv_min: 5_000_000,
    tcv_max: 74_999_999,
    gm_threshold: null,
    approvers: ['Market Category Manager', 'Market Finance', 'WW Category (Helen Sheirbon / Jaimee Martinez)'],
    notes: 'WW Category approval required',
  },
  {
    tcv_min: 75_000_000,
    tcv_max: null,
    gm_threshold: null,
    approvers: ['Market Category Manager', 'Market Finance', 'WW Category', 'Mark Anderson (WW)'],
    notes: 'Executive WW approval required',
  },
  {
    tcv_min: 5_000_000,
    tcv_max: null,
    gm_threshold: 15,
    gm_below: true,
    approvers: ['Market Category Manager', 'Market Finance', 'WW Category + Finance'],
    notes: 'GM < 15% triggers WW Category + Finance regardless of TCV',
  },
] as const

// ─── PURSUIT STAGES ──────────────────────────────────────────────────────────

export const PURSUIT_STAGES = [
  { id: 'discover',  name: 'Discovery',        description: 'OA SOAR, needs analysis, stakeholder mapping',      order: 1, color: '#6366F1' },
  { id: 'qualify',   name: 'Qualification',    description: 'Opportunity scoring, feasibility, win strategy',    order: 2, color: '#0096D6' },
  { id: 'shape',     name: 'Solution Shaping', description: 'Fleet design, service design, delivery validation', order: 3, color: '#7C3AED' },
  { id: 'bid',       name: 'Bid & Proposal',   description: 'BA SOAR, RFP response, pricing, DART',              order: 4, color: '#D97706' },
  { id: 'negotiate', name: 'Negotiation',      description: 'T&C SOAR, contract redlines, final pricing',        order: 5, color: '#DC2626' },
  { id: 'won',       name: 'Won',              description: 'Contract signed, handover to delivery',             order: 6, color: '#22c55e' },
  { id: 'lost',      name: 'Lost',             description: 'Opportunity closed lost — lessons learned',         order: 7, color: '#6B7280' },
] as const

export type StageId = typeof PURSUIT_STAGES[number]['id']

// ─── RISK CATEGORIES ─────────────────────────────────────────────────────────

export const RISK_CATEGORIES = [
  'Solution feasibility',
  'Country capability gap',
  'Delivery capacity',
  'Pricing / margin',
  'SLA compliance',
  'Data quality',
  'Customer readiness',
  'Third-party dependency',
  'Legal / contractual',
  'Transition complexity',
  'Timeline',
  'Competitive',
] as const

export const RISK_LEVELS = [
  { id: 'critical', label: 'Critical',  color: '#DC2626', score: 4 },
  { id: 'high',     label: 'High',      color: '#D97706', score: 3 },
  { id: 'medium',   label: 'Medium',    color: '#0096D6', score: 2 },
  { id: 'low',      label: 'Low',       color: '#22c55e', score: 1 },
] as const

// ─── SA LEVELS ───────────────────────────────────────────────────────────────

export const SA_LEVELS = ['SA', 'Senior SA', 'Lead SA', 'Principal SA'] as const
export type SALevel = typeof SA_LEVELS[number]

// ─── CURRENCY CODES (ISO 4217 — key currencies for MPS pursuits) ─────────────

export const CURRENCIES = [
  { code: 'USD', name: 'US Dollar',         symbol: '$' },
  { code: 'EUR', name: 'Euro',              symbol: '€' },
  { code: 'GBP', name: 'British Pound',     symbol: '£' },
  { code: 'JPY', name: 'Japanese Yen',      symbol: '¥' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', name: 'Canadian Dollar',   symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc',       symbol: 'CHF' },
  { code: 'CNY', name: 'Chinese Yuan',      symbol: '¥' },
  { code: 'INR', name: 'Indian Rupee',      symbol: '₹' },
  { code: 'BRL', name: 'Brazilian Real',    symbol: 'R$' },
  { code: 'SEK', name: 'Swedish Krona',     symbol: 'kr' },
  { code: 'NOK', name: 'Norwegian Krone',   symbol: 'kr' },
  { code: 'DKK', name: 'Danish Krone',      symbol: 'kr' },
  { code: 'SGD', name: 'Singapore Dollar',  symbol: 'S$' },
  { code: 'AED', name: 'UAE Dirham',        symbol: 'AED' },
  { code: 'SAR', name: 'Saudi Riyal',       symbol: 'SAR' },
  { code: 'ZAR', name: 'South African Rand',symbol: 'R' },
  { code: 'MXN', name: 'Mexican Peso',      symbol: 'MX$' },
  { code: 'KRW', name: 'South Korean Won',  symbol: '₩' },
] as const

// ─── INDUSTRY VERTICALS ──────────────────────────────────────────────────────

export const INDUSTRY_VERTICALS = [
  'Financial Services',
  'Healthcare & Life Sciences',
  'Government & Public Sector',
  'Manufacturing',
  'Retail & Consumer',
  'Education',
  'Legal',
  'Professional Services',
  'Technology',
  'Energy & Utilities',
  'Transportation & Logistics',
  'Telecommunications',
  'Media & Entertainment',
  'Real Estate',
  'Non-Profit',
  'Other',
] as const

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

export function getApprovalRequirements(tcv: number, gm: number) {
  const results = APPROVAL_THRESHOLDS.filter(t => {
    const tooSmall = tcv < t.tcv_min
    const tooBig = t.tcv_max !== null && tcv > t.tcv_max
    const gmTrigger = t.gm_below && gm >= (t.gm_threshold ?? 0)
    if (tooSmall || tooBig || gmTrigger) return false
    return true
  })
  return results[results.length - 1] ?? APPROVAL_THRESHOLDS[0]
}

export function formatTCV(value: number, currency = 'USD'): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

export function getStageById(id: string) {
  return PURSUIT_STAGES.find(s => s.id === id)
}
