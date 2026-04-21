#!/usr/bin/env python3
"""
OpenPrinting.org Device Scraper
================================
Fetches all printer/MFP models for all target brands from OpenPrinting.org
and upserts into Supabase devices table with full data provenance.

Run: monthly via Netlify scheduled function or manual trigger
Source: https://www.openprinting.org/query.cgi

Every row written to Supabase includes:
  - data_source: where it came from
  - source_url: exact URL fetched
  - last_scraped_at: when it was retrieved
  - data_confidence: 'Scraped' (OpenPrinting) or 'Verified' (manually confirmed)
"""

import urllib.request
import urllib.parse
import xml.etree.ElementTree as ET
import json
import time
import os
import re
from datetime import datetime, timezone

# ── CONFIG ────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get('PURSUIT360_SUPABASE_URL', 'https://usilbnfemjrcasgdyojb.supabase.co')
SERVICE_KEY  = os.environ.get('PURSUIT360_SUPABASE_SERVICE_KEY', '')
BASE_URL     = 'https://www.openprinting.org/query.cgi'
NOW          = datetime.now(timezone.utc).isoformat()
SOURCE_NAME  = 'OpenPrinting.org'

# All brands to scrape — including Ricoh Group sub-brands
BRANDS_TO_SCRAPE = [
    # (openprinting_name, our_brand_name_in_db)
    ('Ricoh',         'Ricoh'),
    ('Gestetner',     'Ricoh'),   # Ricoh Group sub-brand
    ('Lanier',        'Ricoh'),   # Ricoh Group sub-brand
    ('NRG',           'Ricoh'),   # Ricoh Group sub-brand
    ('Savin',         'Ricoh'),   # Ricoh Group sub-brand
    ('Infotec',       'Ricoh'),   # Ricoh Group sub-brand
    ('KONICA MINOLTA','Konica Minolta'),
    ('Minolta',       'Konica Minolta'),
    ('Olivetti',      'Konica Minolta'),
    ('Xerox',         'Xerox'),
    ('Fuji Xerox',    'Xerox'),
    ('Fujifilm',      'Xerox'),
    ('Oce',           'Xerox'),
    ('Canon',         'Canon'),
    ('Kyocera',       'Kyocera'),
    ('Sharp',         'Sharp'),
    ('Lexmark',       'Lexmark'),
    ('Brother',       'Brother'),
    ('Samsung',       'Samsung'),
    ('HP',            'HP'),
]

# ── CLASSIFICATION HELPERS ────────────────────────────────────────────────────

def classify_device(make: str, model: str) -> dict:
    """
    Classify a device from brand + model name alone.
    Returns format, device_type, colour_capability, volume_tier, technology guesses.
    data_confidence will be 'Scraped' — not verified specs.
    """
    m = model.upper()
    b = make.upper()

    # ── Format (A3 vs A4) ─────────────────────────────────────────────────────
    # A3 indicators: high model numbers, specific series names
    a3_keywords = ['IM C', 'IM ', 'MP ', 'TASKALFA', 'BIZHUB', 'AFICIO', 'WORKCENTRE',
                   'IMAGERUNNER', 'VERSALINK C', 'ALTALINK', 'C558', 'C452', 'C652']
    a3_number = bool(re.search(r'\b[2-9]\d{3}\b', m))  # 4-digit model >= 2000
    is_a3 = a3_number or any(kw in m for kw in a3_keywords)

    # A4 indicators
    a4_keywords = ['SP ', 'SP C', 'P ', 'P C', 'PHASER', 'VERSALINK B', 'IMAGECLASS',
                   'ECOSYS P', 'ECOSYS M', 'HL-', 'MFC-', 'DCP-']
    is_a4 = any(kw in m for kw in a4_keywords)

    # Wide format
    wide_keywords = ['DESIGNJET', 'PAGEWIDE', 'WIDE', 'PLOTTER', '36"', '44"', '60"']
    is_wide = any(kw in m for kw in wide_keywords)

    if is_wide:
        fmt = 'Wide Format'
    elif is_a3 and not is_a4:
        fmt = 'A3'
    elif is_a4 and not is_a3:
        fmt = 'A4'
    else:
        fmt = 'A4'  # default

    # ── Device type ───────────────────────────────────────────────────────────
    mfp_keywords = ['MFP', 'MFC', 'DCP', 'MP ', 'IM ', 'TASKALFA', 'BIZHUB', 'AFICIO',
                    'WORKCENTRE', 'IMAGERUNNER', 'ALTALINK', 'VERSALINK C', 'ALL-IN-ONE',
                    'MULTIFUNCTION']
    sfp_keywords = ['SP ', 'SP C', 'P ', 'PHASER', 'HL-', 'ECOSYS P', 'LASER JET',
                    'LASERJET', 'PAGEWIDE', 'DESIGNJET']
    is_mfp = any(kw in m for kw in mfp_keywords)
    is_sfp = any(kw in m for kw in sfp_keywords)
    device_type = 'MFP' if is_mfp else ('SFP' if is_sfp else 'Printer')

    # ── Colour capability ─────────────────────────────────────────────────────
    colour_keywords = [' C', 'COLOR', 'COLOUR', 'COLOUR', 'CLR', 'VERSALINK C',
                       'BIZHUB C', 'TASKALFA C', 'IM C', 'SP C', 'P C', 'MFC-9',
                       'DCP-9', 'IMAGECLASS MF', 'ECOSYS M', 'PAGEWIDE']
    mono_keywords = ['MONO', 'BLACK', 'BW', 'B&W', ' B ', 'ECOSYS P2', 'ECOSYS P3',
                     'HL-L5', 'HL-L6', 'HL-5', 'HL-6']
    has_colour = any(kw in m for kw in colour_keywords)
    has_mono_kw = any(kw in m for kw in mono_keywords)
    colour = 'Colour' if has_colour else ('Mono' if has_mono_kw else 'Mono')

    # ── Technology ────────────────────────────────────────────────────────────
    inkjet_keywords = ['INKJET', 'PAGEWIDE', 'OFFICEJET', 'DESKJET', 'PIXMA',
                       'MAXIFY', 'WORKFORCE', 'ECOTANK']
    tech = 'Inkjet' if any(kw in m for kw in inkjet_keywords) else 'Laser'

    # ── Speed hint from model number ──────────────────────────────────────────
    # Many models encode speed in last 2 digits: IM C3000 → 30 ppm
    speed = None
    speed_match = re.search(r'(\d{2})(?:\d{2})?(?:[A-Z]*)$', m.replace(' ', ''))
    if speed_match:
        candidate = int(speed_match.group(1))
        if 8 <= candidate <= 90:
            speed = candidate

    # ── Volume tier from speed ────────────────────────────────────────────────
    if speed:
        if speed >= 60:   tier = 'Heavy'
        elif speed >= 30: tier = 'Mid'
        else:             tier = 'Light'
    else:
        tier = None

    return {
        'format':            fmt,
        'device_type':       device_type,
        'colour_capability': colour,
        'technology':        tech,
        'speed_mono_ppm':    speed,
        'speed_colour_ppm':  speed if colour == 'Colour' else None,
        'volume_tier':       tier,
    }


# ── SUPABASE HELPERS ──────────────────────────────────────────────────────────

def sb(method: str, path: str, data=None, params: str = '') -> list | dict:
    url = f'{SUPABASE_URL}/rest/v1/{path}{params}'
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method, headers={
        'apikey':        SERVICE_KEY,
        'Authorization': f'Bearer {SERVICE_KEY}',
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
    })
    resp = urllib.request.urlopen(req, timeout=20)
    raw = resp.read()
    return json.loads(raw) if raw else []


def get_brand_id(brand_name: str) -> str:
    result = sb('GET', 'brands', params=f'?name=eq.{urllib.parse.quote(brand_name)}&select=id')
    if result:
        return result[0]['id']
    raise ValueError(f'Brand not found in DB: {brand_name}. Run schema seed first.')


def device_exists(brand_id: str, model_name: str) -> str | None:
    """Returns device id if exists, else None."""
    result = sb('GET', 'devices',
        params=f'?brand_id=eq.{brand_id}&model_name=eq.{urllib.parse.quote(model_name)}&select=id')
    return result[0]['id'] if result else None


# ── OPENPRINTING FETCH ────────────────────────────────────────────────────────

def fetch_models(openprinting_brand: str) -> list[dict]:
    """Fetch all printer models for a brand from OpenPrinting."""
    url = f'{BASE_URL}?type=printers&mfg={urllib.parse.quote(openprinting_brand)}&format=xml'
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Pursuit360DeviceBot/1.0 (+https://pursuit360.hpservices.ai; device-intelligence)',
        'Accept': 'text/xml,application/xml',
    })
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        xml_data = resp.read().decode('utf-8', errors='replace')
        root = ET.fromstring(xml_data)
        models = []
        for printer in root.findall('printer'):
            printer_id = printer.findtext('id', '').strip()
            make       = printer.findtext('make', openprinting_brand).strip()
            model      = printer.findtext('model', '').strip()
            if model:
                models.append({
                    'openprinting_id': printer_id,
                    'make':            make,
                    'model':           model,
                    'source_url':      url,
                })
        return models
    except Exception as e:
        print(f'  ⚠ Fetch failed for {openprinting_brand}: {e}')
        return []


# ── MAIN ──────────────────────────────────────────────────────────────────────

def run():
    if not SERVICE_KEY:
        print('ERROR: PURSUIT360_SUPABASE_SERVICE_KEY not set')
        return

    print(f'[{NOW}] OpenPrinting scraper starting')
    print(f'Target: {len(BRANDS_TO_SCRAPE)} brand entries across {len(set(b[1] for b in BRANDS_TO_SCRAPE))} DB brands')
    print()

    # Cache brand IDs
    brand_id_cache: dict[str, str] = {}
    for _, db_brand in set((x[1], x[1]) for x in BRANDS_TO_SCRAPE):
        try:
            brand_id_cache[db_brand] = get_brand_id(db_brand)
        except ValueError as e:
            print(f'  ⚠ {e}')

    total_found = total_added = total_updated = total_skipped = 0
    all_errors = []

    for op_brand, db_brand in BRANDS_TO_SCRAPE:
        brand_id = brand_id_cache.get(db_brand)
        if not brand_id:
            print(f'  Skipping {op_brand} — brand {db_brand} not in DB')
            continue

        print(f'Fetching {op_brand} → brand: {db_brand}')
        models = fetch_models(op_brand)
        print(f'  Found {len(models)} models')
        total_found += len(models)

        added = updated = skipped = 0

        for m in models:
            model_name = m['model']
            classification = classify_device(m['make'], model_name)

            # Build the full device record with provenance
            record = {
                'brand_id':         brand_id,
                'model_name':       model_name,
                'model_family':     _family(m['make'], model_name),
                'full_name':        f'{m["make"]} {model_name}',
                'sku':              m['openprinting_id'],

                # Classification (derived from model name — not verified specs)
                'format':               classification['format'],
                'device_type':          classification['device_type'],
                'colour_capability':    classification['colour_capability'],
                'technology':           classification['technology'],
                'speed_mono_ppm':       classification['speed_mono_ppm'],
                'speed_colour_ppm':     classification['speed_colour_ppm'],
                'volume_tier':          classification['volume_tier'],

                # Lifecycle — unknown until enriched
                'lifecycle_status':     'Unknown',
                'eosl_confirmed':       False,
                'mps_eligible':         True,

                # ── DATA PROVENANCE (every row) ──
                'data_source':      SOURCE_NAME,
                'source_url':       m['source_url'],
                'last_scraped_at':  NOW,
                'data_confidence':  'Scraped',
                # Confidence levels:
                #   Scraped   = model list confirmed, specs inferred from model name
                #   Verified  = SA or admin manually confirmed specs
                #   Manual    = manually entered, no automated source
                #   Estimated = specs estimated from similar models

                'notes':            f'Imported from {SOURCE_NAME} | Make reported as: {m["make"]}',
                'updated_at':       NOW,
            }

            try:
                existing_id = device_exists(brand_id, model_name)
                if existing_id:
                    # Update provenance fields only — don't overwrite SA-verified data
                    sb('PATCH', 'devices', {
                        'last_scraped_at': NOW,
                        'source_url':      m['source_url'],
                        'updated_at':      NOW,
                    }, params=f'?id=eq.{existing_id}')
                    updated += 1
                else:
                    sb('POST', 'devices', record)
                    added += 1
                time.sleep(0.05)  # ~20 req/sec — polite
            except Exception as e:
                err = f'{op_brand}/{model_name}: {e}'
                all_errors.append(err)
                print(f'    ⚠ Error: {err}')
                skipped += 1

        total_added   += added
        total_updated += updated
        total_skipped += skipped
        print(f'  Added: {added} | Updated: {updated} | Skipped: {skipped}')

        # Log this brand's scrape run
        try:
            sb('POST', 'device_scrape_log', {
                'brand_id':        brand_id,
                'brand_name':      db_brand,
                'openprinting_name': op_brand,
                'run_at':          NOW,
                'status':          'success' if not skipped else 'partial',
                'devices_found':   len(models),
                'devices_added':   added,
                'devices_updated': updated,
                'errors':          all_errors[-skipped:] if skipped else [],
                'source_url':      f'{BASE_URL}?type=printers&mfg={urllib.parse.quote(op_brand)}&format=xml',
                'notes':           f'OpenPrinting scraper v1.0',
            })
        except Exception as e:
            print(f'  ⚠ Log write failed: {e}')

        time.sleep(1)  # Polite delay between brands

    print()
    print('═' * 60)
    print(f'DONE — {NOW}')
    print(f'  Total found:   {total_found}')
    print(f'  Added:         {total_added}')
    print(f'  Updated:       {total_updated}')
    print(f'  Skipped/Error: {total_skipped}')
    if all_errors:
        print(f'  Errors ({len(all_errors)}):')
        for e in all_errors[:10]:
            print(f'    - {e}')
    print('═' * 60)


def _family(make: str, model: str) -> str:
    m = model.upper()
    # Ricoh families
    if 'IM C' in m:       return 'Ricoh IM C series'
    if 'IM '  in m:       return 'Ricoh IM series'
    if 'MP '  in m:       return 'Ricoh MP series'
    if 'SP C' in m:       return 'Ricoh SP C series'
    if 'SP '  in m:       return 'Ricoh SP series'
    if 'P C'  in m:       return 'Ricoh P C series'
    if m.startswith('P '): return 'Ricoh P series'
    if 'PRO'  in m:       return 'Ricoh Pro series'
    # Konica Minolta
    if 'BIZHUB C'  in m:  return 'Konica Minolta bizhub C series'
    if 'BIZHUB'    in m:  return 'Konica Minolta bizhub series'
    # Kyocera
    if 'TASKALFA'  in m:  return 'Kyocera TASKalfa series'
    if 'ECOSYS'    in m:  return 'Kyocera ECOSYS series'
    # Xerox
    if 'VERSALINK' in m:  return 'Xerox VersaLink series'
    if 'ALTALINK'  in m:  return 'Xerox AltaLink series'
    if 'WORKCENTRE'in m:  return 'Xerox WorkCentre series'
    if 'PHASER'    in m:  return 'Xerox Phaser series'
    # Canon
    if 'IMAGERUNNER'  in m: return 'Canon imageRUNNER series'
    if 'IMAGECLASS'   in m: return 'Canon imageCLASS series'
    # HP
    if 'LASERJET' in m:   return 'HP LaserJet series'
    if 'PAGEWIDE' in m:   return 'HP PageWide series'
    if 'OFFICEJET'in m:   return 'HP OfficeJet series'
    if 'DESIGNJET'in m:   return 'HP DesignJet series'
    # Lexmark
    if 'MX' in m:         return 'Lexmark MX series'
    if 'CX' in m:         return 'Lexmark CX series'
    if 'MS' in m:         return 'Lexmark MS series'
    if 'CS' in m:         return 'Lexmark CS series'
    # Brother
    if 'MFC' in m:        return 'Brother MFC series'
    if 'DCP' in m:        return 'Brother DCP series'
    if 'HL'  in m:        return 'Brother HL series'
    return f'{make} Other'


if __name__ == '__main__':
    run()
