import { useState, useEffect, useRef } from 'react'
import type { SAUser } from '../lib/users'
import { COUNTRIES } from '../data/countries'
import { MPS_SERVICES } from '../data/pursuit'
import { getPreferredCINC, getDeliveryRiskLevel } from '../data/cinc'
import { getEntitiesByCountry } from '../data/hp-entities'
import { findHPRecommendation, type HPRecommendation } from '../lib/supabase-devices'

// ── Types ──────────────────────────────────────────────────────────────────────

interface CountryLine {
  id: string
  country_name: string
  iso: string
  device_count: number
}

interface FleetLine {
  id: string
  country_iso: string
  brand: string
  model: string
  quantity: number
  device_type: string
  format: string
  notes: string
}

interface FeasibilityResult {
  iso: string
  country: string
  hp_entity: string
  rtm: string
  printer_otd_days: number | null
  risk_level: string
  warnings: string[]
  can_service: boolean
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9)

const RISK_COLOR: Record<string, string> = {
  low:     '#22c55e',
  medium:  '#0096D6',
  high:    '#D97706',
  critical:'#DC2626',
  unknown: '#6B7280',
}

const RISK_LABEL: Record<string, string> = {
  low:     '✅ Low risk',
  medium:  '⚠️ Medium',
  high:    '🔶 High',
  critical:'🔴 Critical',
  unknown: '❓ Unknown',
}

function assessCountry(iso: string, country_name: string): FeasibilityResult {
  const cinc = getPreferredCINC(iso)
  const entities = getEntitiesByCountry(iso)
  const warnings: string[] = []

  // Entity checks
  let hp_entity = 'No HP entity found'
  let rtm = 'Unknown'
  if (entities.length > 0) {
    hp_entity = entities[0].contracting_entity
    rtm = entities[0].rtm
    entities.forEach(e => {
      if (e.verification_warning) warnings.push(`⚠️ ${e.contracting_entity}: ${e.verification_warning}`)
    })
    // China complexity
    if (iso === 'CN' && entities.length > 1) {
      warnings.push('🇨🇳 China requires multiple HP entities — split deal by service type')
    }
  } else {
    warnings.push('No HP legal entity found for this country')
  }

  // Delivery checks
  let printer_otd = cinc?.printers ?? null
  const risk = getDeliveryRiskLevel(printer_otd)

  if (!cinc) {
    warnings.push('No CINC delivery data — contact Supply Chain for lead times')
  } else if (cinc.hp_dest !== cinc.final_dest) {
    warnings.push(`HP ships via ${cinc.hp_dest} — not direct to ${country_name}`)
  }

  if (printer_otd && printer_otd > 60) {
    warnings.push(`Long lead time: ${printer_otd} working days for printer delivery`)
  }

  return {
    iso,
    country: country_name,
    hp_entity,
    rtm,
    printer_otd_days: printer_otd,
    risk_level: risk,
    warnings,
    can_service: entities.length > 0,
  }
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function SolutionDesigner({ user, onBack }: { user: SAUser; onBack: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1: Deal definition
  const [customerName, setCustomerName] = useState('')
  const [serviceType, setServiceType] = useState('dmps')
  const [contractTerm, setContractTerm] = useState(36)
  const [countries, setCountries] = useState<CountryLine[]>([
    { id: uid(), country_name: '', iso: '', device_count: 0 }
  ])

  // Step 2: Fleet
  const [fleet, setFleet] = useState<FleetLine[]>([])
  const [hpRecs, setHpRecs] = useState<Record<string, HPRecommendation | null | 'loading'>>({})
  const lookupTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Step 3: Feasibility results
  const [results, setResults] = useState<FeasibilityResult[]>([])

  const selectedService = MPS_SERVICES.find(s => s.id === serviceType)

  // ── Step 1 helpers ──────────────────────────────────────────────────────
  const updateCountry = (id: string, field: keyof CountryLine, value: string | number) => {
    setCountries(prev => prev.map(c => {
      if (c.id !== id) return c
      if (field === 'country_name' && typeof value === 'string') {
        const match = COUNTRIES.find(co =>
          co.name.toLowerCase() === value.toLowerCase() ||
          co.alpha2.toLowerCase() === value.toLowerCase()
        )
        return { ...c, country_name: value, iso: match?.alpha2 ?? '' }
      }
      return { ...c, [field]: value }
    }))
  }

  const addCountry = () => setCountries(prev => [...prev, { id: uid(), country_name: '', iso: '', device_count: 0 }])
  const removeCountry = (id: string) => setCountries(prev => prev.filter(c => c.id !== id))

  // ── Step 2 helpers ──────────────────────────────────────────────────────
  const initFleet = () => {
    const lines: FleetLine[] = countries
      .filter(c => c.iso)
      .map(c => ({ id: uid(), country_iso: c.iso, brand: '', model: '', quantity: c.device_count || 1, device_type: 'MFP', format: 'A3', notes: '' }))
    setFleet(lines.length ? lines : [{ id: uid(), country_iso: '', brand: '', model: '', quantity: 1, device_type: 'MFP', format: 'A3', notes: '' }])
  }

  const updateFleet = (id: string, field: keyof FleetLine, value: string | number) => {
    setFleet(prev => {
      const next = prev.map(f => f.id === id ? { ...f, [field]: value } : f)
      // Trigger HP recommendation lookup when brand/model/format change
      if (field === 'brand' || field === 'model' || field === 'format') {
        const line = next.find(f => f.id === id)
        if (line && line.model.trim().length >= 3) {
          // Debounce lookup by 700ms
          if (lookupTimers.current[id]) clearTimeout(lookupTimers.current[id])
          setHpRecs(r => ({ ...r, [id]: 'loading' }))
          lookupTimers.current[id] = setTimeout(() => {
            findHPRecommendation(line.brand, line.model, line.format)
              .then(rec => setHpRecs(r => ({ ...r, [id]: rec })))
              .catch(() => setHpRecs(r => ({ ...r, [id]: null })))
          }, 700)
        }
      }
      return next
    })
  }

  // Clear recommendations for removed fleet lines
  const removeFleetLineWithCleanup = (id: string) => {
    if (lookupTimers.current[id]) clearTimeout(lookupTimers.current[id])
    setHpRecs(r => { const n = { ...r }; delete n[id]; return n })
    removeFleetLine(id)
  }

  // Cleanup timers on unmount
  useEffect(() => {
    return () => { Object.values(lookupTimers.current).forEach(t => clearTimeout(t)) }
  }, [])

  const addFleetLine = (iso = '') => setFleet(prev => [...prev, { id: uid(), country_iso: iso, brand: '', model: '', quantity: 1, device_type: 'MFP', format: 'A3', notes: '' }])
  const removeFleetLine = (id: string) => setFleet(prev => prev.filter(f => f.id !== id))

  // ── Step 3: Run feasibility ─────────────────────────────────────────────
  const runFeasibility = () => {
    const res = countries
      .filter(c => c.iso)
      .map(c => assessCountry(c.iso, c.country_name))
    setResults(res)
  }

  // ── Styles ──────────────────────────────────────────────────────────────
  const S = {
    page: { minHeight: '100vh', background: '#0F1923', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff' } as React.CSSProperties,
    nav: { background: '#0096D6', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' } as React.CSSProperties,
    body: { maxWidth: 900, margin: '0 auto', padding: '32px 24px' } as React.CSSProperties,
    card: { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '24px 28px', marginBottom: 20 } as React.CSSProperties,
    input: { width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' } as React.CSSProperties,
    label: { display: 'block', color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 },
    btn: { background: '#0096D6', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' } as React.CSSProperties,
    btnGhost: { background: 'transparent', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' } as React.CSSProperties,
  }

  return (
    <div style={S.page}>
      {/* Nav */}
      <nav style={S.nav}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={{ ...S.btnGhost, padding: '6px 12px', fontSize: 13 }}>← Dashboard</button>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>|</span>
          <img src="/hp-logo.svg" alt="HP" style={{ width: 32, height: 32 }} />
          <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: 1 }}>PURSUIT360</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: user.avatar_color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>{user.initials}</div>
          <span style={{ fontSize: 13 }}>{user.name}</span>
        </div>
      </nav>

      <div style={S.body}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ color: '#0096D6', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, margin: '0 0 6px' }}>Solution Designer</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 6px' }}>
            {customerName || 'New Pursuit'} {customerName && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 18 }}>— Solution Design</span>}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: 0 }}>
            Design a feasible MPS solution · Check HP capabilities · Assess risks
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {[
            { n: 1, label: 'Deal Definition' },
            { n: 2, label: 'Current Fleet' },
            { n: 3, label: 'Feasibility' },
          ].map(s => (
            <button key={s.n} onClick={() => { if (s.n <= step) setStep(s.n as 1|2|3) }}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none', cursor: s.n <= step ? 'pointer' : 'default',
                background: step === s.n ? '#0096D6' : s.n < step ? 'rgba(0,150,214,0.15)' : 'rgba(255,255,255,0.04)',
                color: step === s.n ? '#fff' : s.n < step ? '#0096D6' : 'rgba(255,255,255,0.3)',
                fontWeight: 700, fontSize: 13,
              }}>
              {s.n < step ? '✓ ' : `${s.n}. `}{s.label}
            </button>
          ))}
        </div>

        {/* ── STEP 1: Deal Definition ── */}
        {step === 1 && (
          <div>
            <div style={S.card}>
              <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 700 }}>Customer & Service</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={S.label}>Customer Name</label>
                  <input style={S.input} value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. Bank of America" />
                </div>
                <div>
                  <label style={S.label}>Service Type</label>
                  <select style={S.input} value={serviceType} onChange={e => setServiceType(e.target.value)}>
                    {MPS_SERVICES.map(s => (
                      <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {selectedService && (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ background: 'rgba(0,150,214,0.1)', border: '1px solid rgba(0,150,214,0.2)', borderRadius: 8, padding: '8px 14px' }}>
                    <span style={{ fontSize: 11, color: '#0096D6', fontWeight: 700 }}>CDE ELIGIBLE: </span>
                    <span style={{ fontSize: 13, color: selectedService.cde_eligible ? '#22c55e' : '#D97706' }}>
                      {selectedService.cde_eligible ? '✅ Yes' : '⚠️ No — custom pricing needed'}
                    </span>
                  </div>
                  <div style={{ background: 'rgba(0,150,214,0.1)', border: '1px solid rgba(0,150,214,0.2)', borderRadius: 8, padding: '8px 14px' }}>
                    <span style={{ fontSize: 11, color: '#0096D6', fontWeight: 700 }}>CONTRACT TERMS: </span>
                    <span style={{ fontSize: 13, color: '#fff' }}>{selectedService.contract_terms.join(' / ')} months</span>
                  </div>
                  <div style={{ background: 'rgba(0,150,214,0.1)', border: '1px solid rgba(0,150,214,0.2)', borderRadius: 8, padding: '8px 14px' }}>
                    <span style={{ fontSize: 11, color: '#0096D6', fontWeight: 700 }}>SOAR: </span>
                    <span style={{ fontSize: 13, color: '#fff' }}>{selectedService.soar_type}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Contract term */}
            <div style={S.card}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Contract Term</h3>
              <div style={{ display: 'flex', gap: 10 }}>
                {(selectedService?.contract_terms ?? [36,48,60]).map(t => (
                  <button key={t} onClick={() => setContractTerm(t)} style={{
                    flex: 1, padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: contractTerm === t ? '#0096D6' : 'rgba(255,255,255,0.05)',
                    color: contractTerm === t ? '#fff' : 'rgba(255,255,255,0.5)',
                    fontWeight: 700, fontSize: 15,
                  }}>{t} months</button>
                ))}
              </div>
            </div>

            {/* Countries */}
            <div style={S.card}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>Countries & Device Count</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {countries.map((c) => (
                  <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 10, alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                      <input
                        style={S.input}
                        value={c.country_name}
                        onChange={e => updateCountry(c.id, 'country_name', e.target.value)}
                        placeholder="Country name or ISO code (e.g. Denmark or DK)"
                        list={`countries-${c.id}`}
                      />
                      <datalist id={`countries-${c.id}`}>
                        {COUNTRIES.filter(co => co.name.toLowerCase().startsWith(c.country_name.toLowerCase())).slice(0,10).map(co => (
                          <option key={co.alpha2} value={co.name} />
                        ))}
                      </datalist>
                      {c.iso && <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#0096D6', fontWeight: 700 }}>{c.iso}</span>}
                    </div>
                    <input
                      style={S.input}
                      type="number"
                      min={1}
                      value={c.device_count || ''}
                      onChange={e => updateCountry(c.id, 'device_count', parseInt(e.target.value) || 0)}
                      placeholder="# devices"
                    />
                    {countries.length > 1 && (
                      <button onClick={() => removeCountry(c.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={addCountry} style={{ ...S.btnGhost, marginTop: 12, fontSize: 13 }}>+ Add country</button>
            </div>

            {/* Summary */}
            {countries.some(c => c.iso) && (
              <div style={{ ...S.card, background: 'rgba(0,150,214,0.06)', border: '1px solid rgba(0,150,214,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px' }}>Deal summary</p>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                      {selectedService?.code} · {contractTerm}mo · {countries.filter(c=>c.iso).length} {countries.filter(c=>c.iso).length === 1 ? 'country' : 'countries'} · {countries.reduce((sum,c)=>sum+(c.device_count||0),0)} devices total
                    </p>
                  </div>
                  <button onClick={() => { initFleet(); setStep(2) }} style={S.btn}>
                    Next: Map Fleet →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Fleet ── */}
        {step === 2 && (
          <div>
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Current Customer Fleet</h3>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Enter each device type the customer currently has</p>
                </div>
              </div>

              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr 0.6fr 0.8fr 0.8fr auto', gap: 8, marginBottom: 8 }}>
                {['Country','Brand','Model','Qty','Type','Format',''].map((h,i) => (
                  <span key={i} style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: 1 }}>{h}</span>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {fleet.map(f => {
                  const rec = hpRecs[f.id]
                  return (
                    <div key={f.id}>
                      {/* Fleet input row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1.5fr 0.6fr 0.8fr 0.8fr auto', gap: 8, alignItems: 'center' }}>
                        <select style={S.input} value={f.country_iso} onChange={e => updateFleet(f.id,'country_iso',e.target.value)}>
                          <option value="">— Country —</option>
                          {countries.filter(c=>c.iso).map(c => <option key={c.iso} value={c.iso}>{c.country_name} ({c.iso})</option>)}
                        </select>
                        <input style={S.input} value={f.brand} onChange={e => updateFleet(f.id,'brand',e.target.value)} placeholder="e.g. Ricoh" list="brand-list" />
                        <datalist id="brand-list">
                          {['Ricoh','Konica Minolta','Xerox','Canon','Kyocera','Sharp','Lexmark','Brother','Samsung','HP'].map(b => <option key={b} value={b}/>)}
                        </datalist>
                        <input style={S.input} value={f.model} onChange={e => updateFleet(f.id,'model',e.target.value)} placeholder="e.g. IM C3000" />
                        <input style={S.input} type="number" min={1} value={f.quantity} onChange={e => updateFleet(f.id,'quantity',parseInt(e.target.value)||1)} />
                        <select style={S.input} value={f.device_type} onChange={e => updateFleet(f.id,'device_type',e.target.value)}>
                          <option value="MFP">MFP</option>
                          <option value="SFP">SFP</option>
                          <option value="Printer">Printer</option>
                        </select>
                        <select style={S.input} value={f.format} onChange={e => updateFleet(f.id,'format',e.target.value)}>
                          <option value="A3">A3</option>
                          <option value="A4">A4</option>
                        </select>
                        <button onClick={() => removeFleetLineWithCleanup(f.id)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>×</button>
                      </div>

                      {/* HP Recommendation Panel */}
                      {rec === 'loading' && f.model.trim().length >= 3 && (
                        <div style={{
                          marginTop: 6, padding: '8px 14px', borderRadius: 8,
                          background: 'rgba(0,150,214,0.06)', border: '1px solid rgba(0,150,214,0.15)',
                          display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.4)',
                        }}>
                          <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                          Looking up HP equivalent…
                        </div>
                      )}

                      {rec && rec !== 'loading' && (
                        <div style={{
                          marginTop: 6, padding: '10px 14px', borderRadius: 8,
                          background: 'rgba(0,150,214,0.08)', border: '1px solid rgba(0,150,214,0.25)',
                          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                        }}>
                          {/* HP logo indicator */}
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#0096D6', letterSpacing: 1, whiteSpace: 'nowrap' }}>HP MATCH →</span>

                          {/* Model name */}
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{rec.hp_full_name}</span>

                          {/* Format badge */}
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)',
                          }}>{rec.format}</span>

                          {/* Colour badge */}
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                            background: rec.colour_capability === 'Colour' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                            color: rec.colour_capability === 'Colour' ? '#818CF8' : 'rgba(255,255,255,0.5)',
                          }}>{rec.colour_capability}</span>

                          {/* Speed comparison */}
                          {rec.speed_ppm !== null && (
                            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                              {rec.speed_ppm} ppm
                              {rec.speed_delta !== null && (
                                <span style={{
                                  marginLeft: 4, fontSize: 11, fontWeight: 700,
                                  color: rec.speed_delta >= 0 ? '#22c55e' : '#D97706',
                                }}>
                                  ({rec.speed_delta >= 0 ? '+' : ''}{rec.speed_delta} vs {rec.competitor_speed} ppm)
                                </span>
                              )}
                            </span>
                          )}

                          {/* Volume tier */}
                          {rec.volume_tier && (
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{rec.volume_tier} volume</span>
                          )}

                          {/* Confidence badge */}
                          <span style={{
                            marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                            background: rec.data_confidence === 'Verified' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                            color: rec.data_confidence === 'Verified' ? '#22c55e' : '#CA8A04',
                            whiteSpace: 'nowrap',
                          }}>
                            {rec.data_confidence === 'Verified' ? '🟢' : '🟡'} {rec.data_confidence}
                          </span>
                        </div>
                      )}

                      {rec === null && f.brand.trim() && f.model.trim().length >= 3 && (
                        <div style={{
                          marginTop: 6, padding: '8px 14px', borderRadius: 8,
                          background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.2)',
                          fontSize: 12, color: 'rgba(255,255,255,0.4)',
                        }}>
                          ⚠️ No HP equivalent found in database for this format/colour combination
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                <button onClick={() => addFleetLine()} style={{ ...S.btnGhost, fontSize: 13 }}>+ Add device</button>
                {countries.filter(c=>c.iso).map(c => (
                  <button key={c.iso} onClick={() => addFleetLine(c.iso)} style={{ ...S.btnGhost, fontSize: 12 }}>+ Add {c.iso} device</button>
                ))}
              </div>
            </div>

            {/* Fleet summary */}
            {fleet.filter(f=>f.brand).length > 0 && (
              <div style={{ ...S.card, background: 'rgba(0,150,214,0.06)', border: '1px solid rgba(0,150,214,0.2)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 4px' }}>Fleet mapped</p>
                    <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                      {fleet.filter(f=>f.brand).length} device lines · {fleet.reduce((sum,f)=>sum+f.quantity,0)} total units
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setStep(1)} style={S.btnGhost}>← Back</button>
                    <button onClick={() => { runFeasibility(); setStep(3) }} style={S.btn}>Run Feasibility →</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 3: Feasibility ── */}
        {step === 3 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>Feasibility Assessment</h2>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: 0 }}>{customerName} · {selectedService?.code} · {contractTerm} months</p>
              </div>
              <button onClick={() => setStep(2)} style={S.btnGhost}>← Edit Fleet</button>
            </div>

            {/* Overall risk banner */}
            {(() => {
              const critical = results.filter(r => r.risk_level === 'critical').length
              const high     = results.filter(r => r.risk_level === 'high').length
              const warnings = results.reduce((sum,r) => sum + r.warnings.length, 0)
              const cannotService = results.filter(r => !r.can_service).length
              return (
                <div style={{
                  ...S.card,
                  background: critical || cannotService ? 'rgba(220,38,38,0.08)' : high ? 'rgba(217,119,6,0.08)' : 'rgba(34,197,94,0.08)',
                  border: `1px solid ${critical || cannotService ? 'rgba(220,38,38,0.3)' : high ? 'rgba(217,119,6,0.3)' : 'rgba(34,197,94,0.3)'}`,
                  marginBottom: 20,
                }}>
                  <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    <div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Countries</p>
                      <p style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{results.length}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Can Service</p>
                      <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: cannotService ? '#DC2626' : '#22c55e' }}>
                        {results.filter(r=>r.can_service).length}/{results.length}
                      </p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Critical Risks</p>
                      <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: critical ? '#DC2626' : '#22c55e' }}>{critical}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Total Warnings</p>
                      <p style={{ fontSize: 22, fontWeight: 800, margin: 0, color: warnings ? '#D97706' : '#22c55e' }}>{warnings}</p>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: 1 }}>Total Devices</p>
                      <p style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{fleet.reduce((sum,f)=>sum+f.quantity,0)}</p>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Country cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {results.map(r => {
                const countryFleet = fleet.filter(f => f.country_iso === r.iso)
                const deviceTotal = countryFleet.reduce((sum,f)=>sum+f.quantity,0)
                const riskColor = RISK_COLOR[r.risk_level] || RISK_COLOR.unknown

                return (
                  <div key={r.iso} style={{
                    ...S.card,
                    borderColor: r.warnings.length ? `${riskColor}40` : 'rgba(34,197,94,0.2)',
                    padding: '20px 24px',
                    marginBottom: 0,
                  }}>
                    {/* Country header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>{r.country}</span>
                        <span style={{ fontSize: 12, fontFamily: 'monospace', background: 'rgba(0,150,214,0.15)', color: '#0096D6', padding: '2px 8px', borderRadius: 4 }}>{r.iso}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: riskColor }}>{RISK_LABEL[r.risk_level]}</span>
                      </div>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{deviceTotal} devices</span>
                    </div>

                    {/* Info grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: r.warnings.length ? 14 : 0 }}>
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>HP Contracting Entity</p>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{r.hp_entity}</p>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Route to Market</p>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{r.rtm || '—'}</p>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Printer OTD</p>
                        <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: riskColor }}>
                          {r.printer_otd_days ? `${r.printer_otd_days} working days` : 'Unknown — contact Supply Chain'}
                        </p>
                      </div>
                    </div>

                    {/* Fleet lines for this country */}
                    {countryFleet.length > 0 && (
                      <div style={{ marginBottom: r.warnings.length ? 14 : 0 }}>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Current Fleet</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {countryFleet.map(f => (
                            <div key={f.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 12px', fontSize: 13 }}>
                              <strong>{f.quantity}×</strong> {f.brand} {f.model} <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>{f.format} {f.device_type}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {r.warnings.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {r.warnings.map((w, wi) => (
                          <div key={wi} style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>
                            {w}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* SA checklist */}
            <div style={{ ...S.card, marginTop: 20, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#6366F1', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>
                📋 SA Next Steps — Quality Standards Check
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  '8.1 — Engage Delivery to validate feasibility before committing to customer',
                  '8.2 — Document all assumptions in SRD and OMS (esp. for flagged countries)',
                  '8.4 — Escalate any Critical or High risk countries to Engagement Lead now',
                  '8.5 — Do not commit verbally to SLAs or timelines not yet validated',
                  results.some(r => r.iso === 'CN') ? '🇨🇳 China: Confirm entity split with legal — 3 HP entities required' : '',
                  results.some(r => r.warnings.some(w => w.includes('VERIFY'))) ? '⚠️ Verify flagged HP entities in national registry before contracting' : '',
                ].filter(Boolean).map((item, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', paddingLeft: 8, borderLeft: '2px solid rgba(99,102,241,0.4)' }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
