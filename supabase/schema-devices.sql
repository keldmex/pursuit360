-- ============================================================
-- Pursuit360 — Device Intelligence Database
-- Supabase project: keldmex's Project (usilbnfemjrcasgdyojb)
-- Purpose: Competitor + HP device catalogue for fleet mapping
--          Exposed via MCP for use across all applications
-- ============================================================

-- ─── BRANDS ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS brands (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL UNIQUE,           -- e.g. 'Ricoh'
  group_name    text,                           -- e.g. 'Ricoh Group' (covers Nashuatec, Lanier etc.)
  aliases       text[],                         -- e.g. ['Nashuatec','Lanier','Savin','Rex Rotary']
  website       text,
  is_competitor boolean NOT NULL DEFAULT true,  -- false = HP own devices
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- ─── DEVICES ─────────────────────────────────────────────────────────────────
-- DATA PROVENANCE: Every row must have data_source, source_url, last_scraped_at, data_confidence
-- This allows SAs to know exactly where data came from and how fresh it is
-- data_confidence levels:
--   Scraped   = model confirmed exists, specs inferred from model name (not verified)
--   Verified  = SA or admin manually confirmed specs against official source
--   Manual    = manually entered, no automated source
--   Estimated = specs estimated from similar models in same family
CREATE TABLE IF NOT EXISTS devices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,

  -- Identity
  model_name          text NOT NULL,            -- e.g. 'IM C3000'
  model_family        text,                     -- e.g. 'IM C series'
  full_name           text,                     -- e.g. 'Ricoh IM C3000 Colour Laser MFP'
  sku                 text,                     -- Manufacturer SKU/part number

  -- Classification
  format              text CHECK (format IN ('A3','A4','A3/A4','Wide Format','Production')),
  device_type         text CHECK (device_type IN ('MFP','SFP','Printer','Scanner','Fax','Wide Format','Production')),
  colour_capability   text CHECK (colour_capability IN ('Mono','Colour','Both')),
  technology          text CHECK (technology IN ('Laser','Inkjet','LED','Thermal','Solid Ink','Other')),

  -- Performance
  speed_mono_ppm      integer,                  -- Pages per minute mono
  speed_colour_ppm    integer,                  -- Pages per minute colour
  max_paper_size      text,                     -- e.g. 'SRA3', 'A3', 'A4'
  max_resolution_dpi  integer,                  -- e.g. 1200
  monthly_duty_cycle  integer,                  -- Max recommended monthly pages
  paper_capacity_std  integer,                  -- Standard paper capacity (sheets)
  paper_capacity_max  integer,                  -- Max paper capacity with all options

  -- Volume tier (derived from duty cycle + speed)
  volume_tier         text CHECK (volume_tier IN ('Light','Mid','Heavy','Production')),
  -- Light:      <10k pages/month
  -- Mid:        10k–30k pages/month
  -- Heavy:      30k–100k pages/month
  -- Production: >100k pages/month

  -- Connectivity & features
  connectivity        text[],                   -- e.g. ['Network','WiFi','USB','NFC']
  functions           text[],                   -- e.g. ['Print','Copy','Scan','Fax','Email']
  has_hdd             boolean,
  has_finisher        boolean,
  duplex_standard     boolean,

  -- Lifecycle
  launch_year         integer,
  end_of_sale_date    date,                     -- When manufacturer stopped selling
  end_of_service_date date,                     -- EOSL — when support ends (critical for MPS)
  eosl_confirmed      boolean DEFAULT false,    -- Has EOSL been officially confirmed?
  lifecycle_status    text CHECK (lifecycle_status IN ('Active','End of Sale','End of Service','Discontinued','Unknown'))
                      DEFAULT 'Unknown',

  -- MPS relevance
  mps_eligible        boolean DEFAULT true,     -- Can this be included in an MPS deal?
  mps_notes           text,                     -- e.g. 'Firmware no longer updated — security risk'

  -- ── AUTHORITY DATABASE REGISTRATIONS ──
  -- These fields are populated by authority DB scrapers
  -- Presence = device officially registered with that government body
  fcc_id              text,                     -- USA: FCC Equipment Authorization ID
  fcc_grant_date      text,                     -- USA: FCC grant date
  fcc_source_url      text,                     -- USA: URL of FCC filing
  eprel_registration_no text,                   -- EU: EPREL registration number
  eu_on_market_start  text,                     -- EU: Date placed on EU market
  eu_on_market_end    text,                     -- EU: Date withdrawn from EU market (EOSL signal)
  energy_class_eu     text,                     -- EU: Energy label class (A-G)
  cmiit_id            text,                     -- China: CMIIT certification ID
  kcc_id              text,                     -- Korea: KCC MSIP ID
  anatel_id           text,                     -- Brazil: ANATEL certification ID

  -- ── DATA PROVENANCE (mandatory fields — SA trust layer) ──
  data_source         text NOT NULL DEFAULT 'Unknown',  -- e.g. 'OpenPrinting.org', 'ICECAT', 'Manual', 'Ricoh Support Site'
  source_url          text,                             -- Exact URL fetched
  last_scraped_at     timestamptz,                      -- When scraper last touched this record
  data_confidence     text CHECK (data_confidence IN ('Verified','Scraped','Manual','Estimated'))
                      DEFAULT 'Scraped',
  -- Confidence levels:
  --   Scraped   = model confirmed, specs inferred from name (not spec-sheet verified)
  --   Verified  = confirmed against official spec sheet or SA review
  --   Manual    = hand-entered by SA or admin
  --   Estimated = specs estimated from family/similar model
  sa_verified_by      text,                             -- SA name if manually verified
  sa_verified_at      timestamptz,                      -- When SA verified
  notes               text,                             -- SA or admin notes

  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),

  UNIQUE (brand_id, model_name)
);

-- ─── HP DEVICE MAPPINGS ───────────────────────────────────────────────────────
-- Maps a competitor device to the recommended HP replacement
-- SA can override the AI suggestion
CREATE TABLE IF NOT EXISTS device_mappings (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_device_id      uuid NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  hp_device_id          uuid REFERENCES devices(id) ON DELETE SET NULL,  -- null if no direct HP equivalent yet

  -- Mapping metadata
  match_quality         text CHECK (match_quality IN ('Exact','Close','Approximate','No Match')),
  match_rationale       text,                   -- Why this HP device is recommended
  match_notes           text,                   -- SA override notes

  -- Who set this mapping
  created_by            text,                   -- 'AI' or SA name
  verified_by           text,                   -- SA who confirmed/overrode
  verified_at           timestamptz,
  sa_override           boolean DEFAULT false,  -- true = SA manually changed AI suggestion

  -- Transition notes
  transition_notes      text,                   -- e.g. 'Customer may need A3 for booklet finishing'
  risk_flags            text[],                 -- e.g. ['Speed downgrade','Feature gap: stapling']

  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),

  UNIQUE (source_device_id)                     -- One HP mapping per competitor device
);

-- ─── SCRAPE LOG ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_scrape_log (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            uuid REFERENCES brands(id),
  brand_name          text NOT NULL,
  openprinting_name   text,                    -- Brand name as used in OpenPrinting query
  data_source         text NOT NULL DEFAULT 'OpenPrinting.org',
  run_at              timestamptz DEFAULT now(),
  status              text CHECK (status IN ('success','partial','failed')),
  devices_found       integer DEFAULT 0,
  devices_added       integer DEFAULT 0,
  devices_updated     integer DEFAULT 0,
  errors              text[],
  source_url          text,
  duration_seconds    numeric,
  notes               text
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_devices_brand        ON devices(brand_id);
CREATE INDEX IF NOT EXISTS idx_devices_format       ON devices(format);
CREATE INDEX IF NOT EXISTS idx_devices_volume_tier  ON devices(volume_tier);
CREATE INDEX IF NOT EXISTS idx_devices_lifecycle    ON devices(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_devices_eosl         ON devices(end_of_service_date);
CREATE INDEX IF NOT EXISTS idx_devices_model        ON devices(model_name);
CREATE INDEX IF NOT EXISTS idx_mappings_source      ON device_mappings(source_device_id);
CREATE INDEX IF NOT EXISTS idx_mappings_hp          ON device_mappings(hp_device_id);

-- ─── RLS POLICIES ────────────────────────────────────────────────────────────
ALTER TABLE brands          ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_scrape_log ENABLE ROW LEVEL SECURITY;

-- Public read (anon + authenticated) — this is reference data, not sensitive
CREATE POLICY "Public read brands"           ON brands           FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read devices"          ON devices          FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read device_mappings"  ON device_mappings  FOR SELECT TO anon, authenticated USING (true);

-- Authenticated write (SA can update mappings, service role handles scraping)
CREATE POLICY "Auth write device_mappings"   ON device_mappings  FOR ALL    TO authenticated USING (true);
CREATE POLICY "Service write devices"        ON devices          FOR ALL    TO service_role  USING (true);
CREATE POLICY "Service write brands"         ON brands           FOR ALL    TO service_role  USING (true);
CREATE POLICY "Service write scrape_log"     ON device_scrape_log FOR ALL   TO service_role  USING (true);

-- ─── SEED: BRANDS ────────────────────────────────────────────────────────────
INSERT INTO brands (name, group_name, aliases, website, is_competitor) VALUES
  ('Ricoh',          'Ricoh Group',    ARRAY['Nashuatec','Lanier','Savin','Rex Rotary','NRG','Gestetner'], 'https://www.ricoh.com',          true),
  ('Konica Minolta', 'Konica Minolta', ARRAY['Develop','Olivetti'],                                       'https://www.konicaminolta.com',  true),
  ('Xerox',          'Xerox Group',    ARRAY['Fujifilm Xerox','ApeosPort'],                               'https://www.xerox.com',          true),
  ('Canon',          'Canon Group',    ARRAY['Océ','imageRUNNER','imagePRESS'],                           'https://www.canon.com',          true),
  ('Kyocera',        'Kyocera Group',  ARRAY['TASKalfa','ECOSYS'],                                        'https://www.kyocera.com',        true),
  ('Sharp',          'Sharp Group',    ARRAY['Sharp NEC'],                                                'https://www.sharp.com',          true),
  ('Lexmark',        'Lexmark',        ARRAY[]::text[],                                                   'https://www.lexmark.com',        true),
  ('Brother',        'Brother',        ARRAY[]::text[],                                                   'https://www.brother.com',        true),
  ('Samsung',        'HP Group',       ARRAY['Samsung Printing'],                                         'https://www.hp.com',             false),
  ('HP',             'HP Group',       ARRAY['HP Inc','Hewlett-Packard'],                                 'https://www.hp.com',             false)
ON CONFLICT (name) DO NOTHING;
