export interface SAUser {
  id: string
  email: string
  password: string
  name: string
  initials: string
  region: 'APAC' | 'EMEA' | 'Americas'
  level: 'SA' | 'Senior SA' | 'Lead SA' | 'Principal SA'
  years: number
  specialisms: string[]
  avatar_color: string
}

export const DEMO_USERS: SAUser[] = [
  {
    id: 'sarah-chen',
    email: 'sarah.chen@hp-pursuit360.demo',
    password: 'Demo-SA-2026',
    name: 'Sarah Chen',
    initials: 'SC',
    region: 'APAC',
    level: 'Senior SA',
    years: 9,
    specialisms: ['Fleet Design', 'Software Solutions', 'RFP Response'],
    avatar_color: '#7C3AED',
  },
  {
    id: 'marco-deluca',
    email: 'marco.deluca@hp-pursuit360.demo',
    password: 'Demo-SA-2026',
    name: 'Marco De Luca',
    initials: 'MD',
    region: 'EMEA',
    level: 'Lead SA',
    years: 14,
    specialisms: ['Contract Negotiation', 'Custom Services', 'SOAR Governance'],
    avatar_color: '#0096D6',
  },
  {
    id: 'priya-sharma',
    email: 'priya.sharma@hp-pursuit360.demo',
    password: 'Demo-SA-2026',
    name: 'Priya Sharma',
    initials: 'PS',
    region: 'EMEA',
    level: 'SA',
    years: 4,
    specialisms: ['Customer Engagement', 'TCO Analysis', 'Print Policy'],
    avatar_color: '#059669',
  },
  {
    id: 'james-okonkwo',
    email: 'james.okonkwo@hp-pursuit360.demo',
    password: 'Demo-SA-2026',
    name: 'James Okonkwo',
    initials: 'JO',
    region: 'Americas',
    level: 'Principal SA',
    years: 17,
    specialisms: ['Global Deals', 'Delivery Handover', 'Win Strategy'],
    avatar_color: '#DC2626',
  },
]

export function authenticate(email: string, password: string): SAUser | null {
  return DEMO_USERS.find(
    u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  ) ?? null
}
