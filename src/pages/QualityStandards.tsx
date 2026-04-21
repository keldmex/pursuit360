import { useState } from 'react'
import type { SAUser } from '../lib/users'

const STANDARDS = [
  {
    id: '8.1',
    title: 'Engage Delivery Early and Proactively',
    icon: '🤝',
    color: '#0096D6',
    summary: 'Involve Delivery, Operations, and Technical teams during solution shaping — not after pricing is finalized.',
    checks: [
      'Validate solution feasibility before commitments are made to the customer',
      'Confirm service availability, country capabilities, transition effort, and operational constraints',
      'Use delivery feedback to shape a realistic and supportable solution, not just a commercially attractive one',
    ],
    warning: 'Late delivery challenges often result in rework, margin erosion, or approval delays. Early engagement prevents surprises and builds trust across teams.',
    warning_label: 'Why this matters',
  },
  {
    id: '8.2',
    title: 'Document Assumptions Clearly and Explicitly',
    icon: '📝',
    color: '#7C3AED',
    summary: 'All assumptions must be clearly documented in solution artifacts (SRD, OMS, presentations, and contractual inputs).',
    checks: [
      'Clearly state what is in scope vs out of scope',
      'Highlight dependencies on customer inputs, timelines, or behaviors',
      'Document any areas where customer data is incomplete or estimated',
      'Upload supporting files to OMS > Files tab',
    ],
    warning: 'If an assumption is critical to pricing, delivery effort, or SLA compliance, it must be visible and defensible.',
    warning_label: 'Best practice',
  },
  {
    id: '8.3',
    title: 'Use Standard Templates and Approved Artifacts',
    icon: '📐',
    color: '#059669',
    summary: 'Consistency is critical for quality, governance, and scalability.',
    checks: [
      'Always use approved HP templates (SRD, presentations, pricing inputs, handover documents)',
      'Avoid creating one-off formats unless explicitly required and approved',
      'Ensure alignment between OMS entries, solution documentation, and customer-facing materials',
    ],
    warning: 'Standardization enables smoother internal reviews, faster approvals, and cleaner handovers to delivery.',
    warning_label: 'Why this matters',
  },
  {
    id: '8.4',
    title: 'Escalate Risks Early, Clearly, and with Options',
    icon: '⚡',
    color: '#D97706',
    summary: 'Escalation is a sign of professionalism — not failure.',
    checks: [
      'Escalate risks as soon as they are identified',
      'Clearly articulate the risk, its potential impact, and possible mitigation options',
      'Use Engagement Leads, Delivery leaders, or governance forums as appropriate',
    ],
    warning: '"No surprises." Risks raised early can be managed; risks raised late become issues.',
    warning_label: 'Expected mindset',
  },
  {
    id: '8.5',
    title: 'Never Overcommit Beyond the Documented Solution',
    icon: '🛑',
    color: '#DC2626',
    summary: 'Solution Architects must never commit — verbally or in writing — to anything not explicitly captured and approved.',
    checks: [
      'Do not promise service levels, timelines, or capabilities that are not validated',
      'Avoid informal commitments during customer discussions without alignment',
      'If pressured, pause and align internally before responding',
    ],
    warning: 'If it\'s not documented and approved, it does not exist.',
    warning_label: 'Golden rule',
  },
]

export default function QualityStandards({ user, onBack }: { user: SAUser; onBack: () => void }) {
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<string | null>('8.1')

  const toggle = (key: string) => setCheckedItems(prev => ({ ...prev, [key]: !prev[key] }))

  const totalChecks = STANDARDS.reduce((sum, s) => sum + s.checks.length, 0)
  const doneChecks = Object.values(checkedItems).filter(Boolean).length
  const pct = Math.round((doneChecks / totalChecks) * 100)

  return (
    <div style={{ minHeight: '100vh', background: '#0F1923', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff' }}>

      {/* Nav */}
      <nav style={{ background: '#0096D6', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>
            ← Dashboard
          </button>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>|</span>
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 1 }}>PURSUIT360</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: user.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
            {user.initials}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</span>
        </div>
      </nav>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px' }}>

        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <p style={{ color: '#0096D6', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 8px' }}>Section 8</p>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: '0 0 8px' }}>Quality Standards & Best Practices</h1>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 15, margin: 0 }}>
            These standards protect HP from delivery, financial, and reputational risk. They are not optional.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 20px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Self-assessment progress</span>
              <span style={{ fontSize: 12, color: '#0096D6', fontWeight: 700 }}>{doneChecks}/{totalChecks} checks</span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#22c55e' : '#0096D6', borderRadius: 999, transition: 'width 0.3s ease' }} />
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: pct === 100 ? '#22c55e' : '#0096D6', minWidth: 48, textAlign: 'right' }}>{pct}%</div>
        </div>

        {/* Standards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {STANDARDS.map(std => {
            const isOpen = expanded === std.id
            const doneCount = std.checks.filter((_, i) => checkedItems[`${std.id}-${i}`]).length
            const allDone = doneCount === std.checks.length

            return (
              <div key={std.id} style={{
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${isOpen ? std.color + '50' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 14,
                overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}>
                {/* Header row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : std.id)}
                  style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                  }}
                >
                  <span style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: std.color + '20',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>{std.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: std.color, fontFamily: 'monospace' }}>{std.id}</span>
                      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: 0 }}>{std.title}</h3>
                      {allDone && <span style={{ fontSize: 10, background: '#22c55e20', color: '#22c55e', border: '1px solid #22c55e40', borderRadius: 999, padding: '2px 8px', fontWeight: 700 }}>✓ Complete</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{doneCount}/{std.checks.length}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18, transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>⌄</span>
                  </div>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div style={{ padding: '0 22px 22px' }}>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>{std.summary}</p>

                    {/* Checklist */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                      {std.checks.map((check, i) => {
                        const key = `${std.id}-${i}`
                        const checked = !!checkedItems[key]
                        return (
                          <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
                            <div
                              onClick={() => toggle(key)}
                              style={{
                                width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
                                border: `2px solid ${checked ? std.color : 'rgba(255,255,255,0.2)'}`,
                                background: checked ? std.color : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', transition: 'all 0.15s',
                              }}
                            >
                              {checked && <span style={{ color: '#fff', fontSize: 12, fontWeight: 800 }}>✓</span>}
                            </div>
                            <span onClick={() => toggle(key)} style={{ fontSize: 14, color: checked ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.8)', textDecoration: checked ? 'line-through' : 'none', lineHeight: 1.5 }}>
                              {check}
                            </span>
                          </label>
                        )
                      })}
                    </div>

                    {/* Warning/tip box */}
                    <div style={{
                      background: std.color + '12',
                      border: `1px solid ${std.color}30`,
                      borderRadius: 10,
                      padding: '12px 16px',
                      display: 'flex', gap: 10, alignItems: 'flex-start',
                    }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: std.color, textTransform: 'uppercase', letterSpacing: 1 }}>{std.warning_label}: </span>
                        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{std.warning}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Completion banner */}
        {pct === 100 && (
          <div style={{
            marginTop: 28, background: '#22c55e15', border: '1px solid #22c55e40',
            borderRadius: 14, padding: '20px 24px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 20, margin: '0 0 6px' }}>🎉</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#22c55e', margin: '0 0 4px' }}>All quality standards confirmed</p>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
              {user.name} · {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
