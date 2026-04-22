// ── Supabase Devices Client ─────────────────────────────────────────────────
// Queries the devices table for competitor device specs and HP recommendations.
// Uses plain fetch — no Supabase SDK required.

const SUPABASE_URL = 'https://usilbnfemjrcasgdyojb.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzaWxibmZlbWpyY2FzZ2R5b2piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU0OTg0NjgsImV4cCI6MjA1MTA3NDQ2OH0.uB7f9wPKHuG-0_SOmY0M8s3zN3S7ULvsYX1Q9e0DgjM'

const HP_BRAND_ID = '31232763-68ef-45c5-95ee-b1ff817cfcf5'

export interface DeviceRecord {
  model_name: string
  full_name: string
  format: string
  colour_capability: string
  speed_mono_ppm: number | null
  speed_colour_ppm: number | null
  volume_tier: string | null
  data_confidence: string
}

export interface HPRecommendation {
  hp_model: string
  hp_full_name: string
  format: string
  colour_capability: string
  speed_ppm: number | null
  volume_tier: string | null
  data_confidence: 'Scraped' | 'Verified' | string
  speed_delta: number | null   // positive = HP is faster, negative = HP is slower
  competitor_speed: number | null
}

async function supabaseFetch<T>(
  table: string,
  params: Record<string, string>
): Promise<T[]> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) return []
  return res.json()
}

// ── Look up a competitor device by brand name + model ───────────────────────
// Returns the first matching device record from the DB (any brand match).
export async function lookupCompetitorDevice(
  brand: string,
  model: string
): Promise<DeviceRecord | null> {
  if (!brand.trim() || !model.trim()) return null

  // First try: exact brand name prefix in full_name + model match
  const byFullName = await supabaseFetch<DeviceRecord>('devices', {
    full_name: `ilike.${brand.trim()}*`,
    model_name: `ilike.*${model.trim()}*`,
    select: 'model_name,full_name,format,colour_capability,speed_mono_ppm,speed_colour_ppm,volume_tier,data_confidence',
    limit: '1',
  })
  if (byFullName.length > 0) return byFullName[0]

  // Fallback: just match by model_name
  const byModel = await supabaseFetch<DeviceRecord>('devices', {
    model_name: `ilike.*${model.trim()}*`,
    select: 'model_name,full_name,format,colour_capability,speed_mono_ppm,speed_colour_ppm,volume_tier,data_confidence',
    limit: '1',
  })
  return byModel.length > 0 ? byModel[0] : null
}

// ── Find the closest HP equivalent ─────────────────────────────────────────
// Matches on format + colour_capability, then picks the HP device with
// the closest speed_mono_ppm to the competitor's speed.
export async function findHPRecommendation(
  brand: string,
  model: string,
  format: string,
): Promise<HPRecommendation | null> {
  if (!model.trim()) return null

  // Step 1 — get competitor device specs
  const competitor = await lookupCompetitorDevice(brand, model)
  const colour = competitor?.colour_capability ?? 'Colour'
  const competitorSpeed = competitor?.speed_mono_ppm ?? null

  // Step 2 — find HP candidates with matching format + colour
  const candidates = await supabaseFetch<DeviceRecord>('devices', {
    brand_id: `eq.${HP_BRAND_ID}`,
    full_name: `ilike.HP*`,           // only real HP devices
    format: `eq.${format}`,
    colour_capability: `eq.${colour}`,
    select: 'model_name,full_name,format,colour_capability,speed_mono_ppm,speed_colour_ppm,volume_tier,data_confidence',
    order: 'speed_mono_ppm',
    limit: '50',
  })

  if (candidates.length === 0) return null

  // De-duplicate by model_name (data has duplicates from multiple brand_ids)
  const seen = new Set<string>()
  const unique = candidates.filter(d => {
    if (seen.has(d.model_name)) return false
    seen.add(d.model_name)
    return true
  })

  // Step 3 — pick closest speed match
  let best = unique[0]
  if (competitorSpeed !== null) {
    best = unique.reduce((prev, curr) => {
      const prevDelta = Math.abs((prev.speed_mono_ppm ?? 0) - competitorSpeed)
      const currDelta = Math.abs((curr.speed_mono_ppm ?? 0) - competitorSpeed)
      return currDelta < prevDelta ? curr : prev
    })
  }

  const hpSpeed = best.speed_mono_ppm ?? null

  return {
    hp_model: best.model_name,
    hp_full_name: best.full_name,
    format: best.format,
    colour_capability: best.colour_capability,
    speed_ppm: hpSpeed,
    volume_tier: best.volume_tier,
    data_confidence: best.data_confidence,
    speed_delta: hpSpeed !== null && competitorSpeed !== null ? hpSpeed - competitorSpeed : null,
    competitor_speed: competitorSpeed,
  }
}
