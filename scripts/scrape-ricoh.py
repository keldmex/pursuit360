#!/usr/bin/env python3
"""
Ricoh MFP/Printer Catalogue Scraper
Runs monthly — fetches current Ricoh product line and upserts into Supabase devices table.
Target: keldmex Supabase project (usilbnfemjrcasgdyojb)
"""
import urllib.request
import urllib.parse
import json
import re
import time
from datetime import datetime, date

# ── CONFIG ────────────────────────────────────────────────────────────────────
SUPABASE_URL = 'https://usilbnfemjrcasgdyojb.supabase.co'
# SERVICE_ROLE_KEY set as env var: PURSUIT360_SUPABASE_SERVICE_KEY

import os
SERVICE_KEY = os.environ.get('PURSUIT360_SUPABASE_SERVICE_KEY', '')

RICOH_BRAND_NAME = 'Ricoh'
SCRAPE_SOURCES = [
    # UK site has good structured product pages
    'https://www.ricoh.co.uk/products/printers-and-copiers',
    # USA
    'https://www.ricoh-usa.com/en/products/printers-multifunction-products',
]


def sb_request(method, path, data=None):
    """Make a Supabase REST API call."""
    req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/{path}',
        data=json.dumps(data).encode() if data else None,
        method=method,
        headers={
            'apikey': SERVICE_KEY,
            'Authorization': f'Bearer {SERVICE_KEY}',
            'Content-Type': 'application/json',
            'Prefer': 'return=representation',
        }
    )
    resp = urllib.request.urlopen(req, timeout=15)
    return json.loads(resp.read())


def get_brand_id():
    """Get Ricoh brand ID from brands table."""
    result = sb_request('GET', f'brands?name=eq.{urllib.parse.quote(RICOH_BRAND_NAME)}&select=id')
    if result:
        return result[0]['id']
    # Insert if missing
    result = sb_request('POST', 'brands', {
        'name': RICOH_BRAND_NAME,
        'group_name': 'Ricoh Group',
        'aliases': ['Nashuatec', 'Lanier', 'Savin', 'Rex Rotary', 'NRG', 'Gestetner'],
        'website': 'https://www.ricoh.com',
        'is_competitor': True,
    })
    return result[0]['id']


def fetch_page(url):
    """Fetch a web page with a polite user agent."""
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; Pursuit360Bot/1.0; +https://pursuit360.hpservices.ai)',
        'Accept': 'text/html,application/xhtml+xml',
    })
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        return resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f'  Fetch failed for {url}: {e}')
        return None


def classify_volume_tier(duty_cycle, speed_mono):
    """Classify device volume tier from duty cycle and speed."""
    if duty_cycle:
        if duty_cycle > 100000: return 'Production'
        if duty_cycle > 30000:  return 'Heavy'
        if duty_cycle > 10000:  return 'Mid'
        return 'Light'
    if speed_mono:
        if speed_mono >= 60: return 'Heavy'
        if speed_mono >= 30: return 'Mid'
        return 'Light'
    return None


def parse_ricoh_uk_products(html):
    """
    Parse Ricoh UK product listing page.
    Returns list of device dicts ready for upsert.
    """
    devices = []

    # Find product cards/links — pattern varies by site version
    # Look for model names matching Ricoh naming conventions:
    # IM C3000, MP 2555, SP C840DN, P 800, etc.
    model_patterns = [
        r'IM\s+[A-Z]?\d{3,4}[A-Z]*',      # IM C3000, IM 2702
        r'MP\s+[A-Z]?\d{3,4}[A-Z]*',      # MP 2555
        r'SP\s+[A-Z]\d{3,4}[A-Z]*',       # SP C840DN
        r'P\s+\d{3,4}[A-Z]*',             # P 800, P C600
        r'Pro\s+\d{4}[A-Z]*',             # Pro 8300S (production)
        r'IM\s+C\d{4}\s*(?:H|F|A)?',     # IM C6000H
    ]

    found_models = set()
    for pattern in model_patterns:
        matches = re.findall(pattern, html, re.IGNORECASE)
        for m in matches:
            clean = re.sub(r'\s+', ' ', m.strip().upper())
            found_models.add(clean)

    print(f'  Found {len(found_models)} model references')

    for model in sorted(found_models):
        # Classify from model name
        is_colour = 'C' in model and not model.startswith('MP')
        is_a3 = any(x in model for x in ['IM C', 'MP ', 'PRO ']) or (
            re.search(r'\d{4}', model) and int(re.search(r'\d+', model).group()) >= 2000
        )

        # Speed hint from model number (last 2 digits often = ppm)
        speed_match = re.search(r'(\d{2,3})(?:[A-Z]*)$', model.replace(' ', ''))
        speed = None
        if speed_match:
            candidate = int(speed_match.group(1))
            if 10 <= candidate <= 120:
                speed = candidate

        device = {
            'model_name': model,
            'model_family': _get_family(model),
            'full_name': f'Ricoh {model}',
            'format': 'A3' if is_a3 else 'A4',
            'device_type': 'MFP' if any(x in model for x in ['IM ', 'MP ']) else 'SFP',
            'colour_capability': 'Colour' if is_colour else 'Mono',
            'technology': 'Laser',
            'speed_mono_ppm': speed,
            'speed_colour_ppm': speed if is_colour else None,
            'lifecycle_status': 'Active',
            'mps_eligible': True,
            'data_confidence': 'Scraped',
            'last_scraped_at': datetime.utcnow().isoformat(),
            'source_url': 'https://www.ricoh.co.uk/products/printers-and-copiers',
        }
        device['volume_tier'] = classify_volume_tier(None, speed)
        devices.append(device)

    return devices


def _get_family(model):
    """Derive model family from model name."""
    if model.startswith('IM C'):    return 'IM C series'
    if model.startswith('IM '):     return 'IM series'
    if model.startswith('MP '):     return 'MP series'
    if model.startswith('SP C'):    return 'SP C series'
    if model.startswith('SP '):     return 'SP series'
    if model.startswith('P C'):     return 'P C series'
    if model.startswith('P '):      return 'P series'
    if model.startswith('PRO '):    return 'Pro series'
    return 'Other'


def upsert_devices(brand_id, devices):
    """Upsert devices into Supabase."""
    added = 0
    updated = 0
    for d in devices:
        d['brand_id'] = brand_id
        try:
            # Check if exists
            safe_model = urllib.parse.quote(d['model_name'])
            existing = sb_request('GET', f'devices?brand_id=eq.{brand_id}&model_name=eq.{safe_model}&select=id')
            if existing:
                # Update
                sb_request('PATCH', f'devices?id=eq.{existing[0]["id"]}', {
                    'lifecycle_status': d.get('lifecycle_status'),
                    'last_scraped_at': d.get('last_scraped_at'),
                    'updated_at': datetime.utcnow().isoformat(),
                })
                updated += 1
            else:
                # Insert
                sb_request('POST', 'devices', d)
                added += 1
            time.sleep(0.1)  # Polite rate limiting
        except Exception as e:
            print(f'  Error upserting {d["model_name"]}: {e}')

    return added, updated


def log_scrape(brand_id, status, found, added, updated, errors, source_url):
    """Write scrape run to log table."""
    try:
        sb_request('POST', 'device_scrape_log', {
            'brand_id': brand_id,
            'brand_name': RICOH_BRAND_NAME,
            'status': status,
            'devices_found': found,
            'devices_added': added,
            'devices_updated': updated,
            'errors': errors,
            'source_url': source_url,
        })
    except Exception as e:
        print(f'  Log write failed: {e}')


def run():
    print(f'[{datetime.utcnow().isoformat()}] Ricoh scraper starting...')

    if not SERVICE_KEY:
        print('ERROR: PURSUIT360_SUPABASE_SERVICE_KEY not set')
        return

    brand_id = get_brand_id()
    print(f'Brand ID: {brand_id}')

    all_devices = []
    errors = []

    for url in SCRAPE_SOURCES:
        print(f'Fetching: {url}')
        html = fetch_page(url)
        if not html:
            errors.append(f'Failed to fetch {url}')
            continue
        devices = parse_ricoh_uk_products(html)
        all_devices.extend(devices)
        print(f'  Parsed {len(devices)} devices from {url}')
        time.sleep(2)  # Polite delay between pages

    # Deduplicate by model name
    seen = set()
    unique_devices = []
    for d in all_devices:
        if d['model_name'] not in seen:
            seen.add(d['model_name'])
            unique_devices.append(d)

    print(f'Total unique devices: {len(unique_devices)}')

    added, updated = upsert_devices(brand_id, unique_devices)
    print(f'Added: {added}, Updated: {updated}')

    status = 'success' if not errors else ('partial' if unique_devices else 'failed')
    log_scrape(brand_id, status, len(unique_devices), added, updated, errors, SCRAPE_SOURCES[0])

    print(f'Done. Status: {status}')


if __name__ == '__main__':
    run()
