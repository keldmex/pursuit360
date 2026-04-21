#!/usr/bin/env python3
"""
Authority Database Scraper — Regulatory & Government Sources
=============================================================
Enriches device records with data from official regulatory databases.
These are the HIGHEST confidence sources — government-mandated registries.

Sources:
  1. FCC (USA)      — Equipment Authorization database via fccid.io
  2. EPREL (EU)     — Energy Product Registry (imaging equipment)
  3. CMIIT (China)  — China equipment certification via fccid.io
  4. KCC MSIP (Korea) — Korea certification via fccid.io
  5. ANATEL (Brazil) — Brazil certification via fccid.io

data_confidence = 'Verified' for all authority DB records
data_source = 'FCC' | 'EPREL' | 'CMIIT' | 'KCC' | 'ANATEL'
"""

import urllib.request
import urllib.parse
import json
import time
import os
import re
from datetime import datetime, timezone
from html.parser import HTMLParser

SUPABASE_URL = os.environ.get('PURSUIT360_SUPABASE_URL', 'https://usilbnfemjrcasgdyojb.supabase.co')
SERVICE_KEY  = os.environ.get('PURSUIT360_SUPABASE_SERVICE_KEY', '')
NOW          = datetime.now(timezone.utc).isoformat()

# ── SUPABASE HELPERS ──────────────────────────────────────────────────────────

def sb(method, path, data=None, params=''):
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

def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Pursuit360DeviceBot/1.0 (+https://pursuit360.hpservices.ai)',
        'Accept': 'text/html,application/json,text/xml',
    })
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.read().decode('utf-8', errors='replace')
    except Exception as e:
        print(f'  Fetch error {url}: {e}')
        return None

# ── FCC / fccid.io ────────────────────────────────────────────────────────────
# fccid.io mirrors the FCC Equipment Authorization database
# Also includes CMIIT (China), KCC MSIP (Korea), ANATEL (Brazil)
# Use case: given a model name, find its official government registration + grant date

FCCID_SEARCH = 'https://fccid.io/search.php?query={query}'
FCCID_COMPANY = 'https://fccid.io/company/{company}/'

# Ricoh's FCC grantee code is 'MD8', Konica Minolta is 'PK2', etc.
GRANTEE_CODES = {
    'Ricoh':         'MD8',
    'Konica Minolta':'PK2',
    'Canon':         'MXF',
    'Kyocera':       'ALVKYOCERA',
    'Xerox':         'EX4',
    'Sharp':         'BEJSHARP',
    'Lexmark':       'IYL',
    'Brother':       'BEJBROTHER',
    'HP':            'B4S',
    'Samsung':       'A3LSAMSUNG',
}

class FccIdParser(HTMLParser):
    """Simple parser to extract FCC ID search results."""
    def __init__(self):
        super().__init__()
        self.results = []
        self._in_table = False
        self._current_row = []
        self._current_cell = ''

    def handle_starttag(self, tag, attrs):
        if tag == 'table': self._in_table = True
        if tag in ('tr',): self._current_row = []
        if tag in ('td', 'th'): self._current_cell = ''

    def handle_endtag(self, tag):
        if tag in ('td', 'th'):
            self._current_row.append(self._current_cell.strip())
        if tag == 'tr' and len(self._current_row) >= 3:
            self.results.append(self._current_row[:])
            self._current_row = []
        if tag == 'table': self._in_table = False

    def handle_data(self, data):
        if self._in_table:
            self._current_cell += data.strip()


def search_fcc(query: str, source: str = 'FCC') -> list[dict]:
    """Search fccid.io for a device model. Returns list of matching registrations."""
    url = FCCID_SEARCH.format(query=urllib.parse.quote(query))
    html = fetch(url)
    if not html:
        return []

    parser = FccIdParser()
    parser.feed(html)

    results = []
    for row in parser.results[1:]:  # Skip header
        if len(row) >= 2 and row[0] and row[0] != 'FCC ID':
            fcc_id    = row[0].strip()
            company   = row[1].strip() if len(row) > 1 else ''
            date      = row[2].strip() if len(row) > 2 else ''
            dev_type  = row[3].strip() if len(row) > 3 else ''

            results.append({
                'fcc_id':       fcc_id,
                'company':      company,
                'grant_date':   date,
                'device_type':  dev_type,
                'source':       source,
                'source_url':   url,
            })
    return results


def enrich_device_from_fcc(device_id: str, model_name: str, brand_name: str):
    """Find FCC registration for a device and update Supabase record."""
    query = f'{brand_name} {model_name}'
    results = search_fcc(query)
    time.sleep(0.5)

    if not results:
        return False

    # Find best match — FCC ID containing model name hint
    best = None
    model_clean = re.sub(r'\s+', '', model_name.upper())
    for r in results:
        fcc_clean = re.sub(r'\s+', '', r['fcc_id'].upper())
        if model_clean[:4] in fcc_clean:
            best = r
            break
    if not best:
        best = results[0]  # Take first result

    # Update device with FCC data
    try:
        sb('PATCH', 'devices', {
            'fcc_id':          best['fcc_id'],
            'fcc_grant_date':  best['grant_date'] or None,
            'fcc_source_url':  best['source_url'],
            'last_scraped_at': NOW,
            'updated_at':      NOW,
            # Note: don't change data_confidence here — FCC confirms existence,
            # not full specs. Specs still need verification.
        }, params=f'?id=eq.{device_id}')
        return True
    except Exception as e:
        print(f'  DB update error: {e}')
        return False


# ── EPREL (EU Energy Registry) ────────────────────────────────────────────────
# EPREL requires OAuth registration but the token endpoint is accessible
# Registration: https://eprel.ec.europa.eu/api/registration
# Product group for printers: 'imagingequipment'

EPREL_TOKEN_URL = 'https://eprel.ec.europa.eu/api/authenticate'
EPREL_SEARCH_URL = 'https://eprel.ec.europa.eu/api/product/imagingequipment'

def get_eprel_token(username: str, password: str) -> str | None:
    """Get EPREL OAuth token. Requires free EPREL account."""
    try:
        payload = json.dumps({'username': username, 'password': password}).encode()
        req = urllib.request.Request(EPREL_TOKEN_URL, data=payload, method='POST',
            headers={'Content-Type': 'application/json'})
        resp = urllib.request.urlopen(req, timeout=15)
        data = json.loads(resp.read())
        return data.get('token') or data.get('access_token')
    except Exception as e:
        print(f'EPREL auth failed: {e}')
        return None


def search_eprel(token: str, supplier_name: str, model_id: str = '', page: int = 1) -> list[dict]:
    """Search EPREL for imaging equipment by supplier/model."""
    params = f'?supplierOrTradeName={urllib.parse.quote(supplier_name)}&page={page}&size=50'
    if model_id:
        params += f'&modelIdentifier={urllib.parse.quote(model_id)}'

    url = f'{EPREL_SEARCH_URL}{params}'
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json',
    })
    try:
        resp = urllib.request.urlopen(req, timeout=20)
        data = json.loads(resp.read())
        results = []
        for item in data.get('data', []) or []:
            results.append({
                'eprel_id':          item.get('registrationNumber'),
                'supplier':          item.get('supplierOrTradeName'),
                'model_id':          item.get('modelIdentifier'),
                'on_market_start':   item.get('onMarketStartDateEEA'),
                'on_market_end':     item.get('onMarketEndDateEEA'),
                'energy_class':      item.get('energyClass'),
                'source':            'EPREL',
                'source_url':        url,
                'eu_registration_no': item.get('registrationNumber'),
            })
        return results
    except Exception as e:
        print(f'EPREL search error: {e}')
        return []


def enrich_all_from_eprel(eprel_user: str, eprel_pass: str):
    """
    Full EPREL enrichment pass:
    - Get token
    - For each brand, fetch all imaging equipment registrations
    - Match to devices table by model name
    - Update: eprel_id, eu_registration_no, on_market_start/end dates, energy_class
    """
    token = get_eprel_token(eprel_user, eprel_pass)
    if not token:
        print('EPREL: Cannot authenticate. Skipping.')
        return

    eprel_brands = [
        ('Ricoh', 'Ricoh'),
        ('KONICA MINOLTA', 'Konica Minolta'),
        ('Xerox', 'Xerox'),
        ('Canon', 'Canon'),
        ('Kyocera', 'Kyocera'),
        ('Sharp', 'Sharp'),
        ('Lexmark', 'Lexmark'),
        ('Brother', 'Brother'),
        ('HP', 'HP'),
        ('Samsung', 'Samsung'),
    ]

    enriched = 0
    for eprel_name, db_brand in eprel_brands:
        print(f'EPREL: Fetching {eprel_name}...')
        page = 1
        while True:
            results = search_eprel(token, eprel_name, page=page)
            if not results:
                break
            for r in results:
                model_id = r.get('model_id', '').strip()
                if not model_id:
                    continue
                # Find matching device in DB
                matches = sb('GET', 'devices',
                    params=f'?model_name=ilike.*{urllib.parse.quote(model_id[:8])}*&select=id,model_name')
                if matches:
                    dev = matches[0]
                    sb('PATCH', 'devices', {
                        'eprel_registration_no': r.get('eprel_id'),
                        'eu_on_market_start':    r.get('on_market_start'),
                        'eu_on_market_end':      r.get('on_market_end'),
                        'energy_class_eu':       r.get('energy_class'),
                        'data_source':           f'EPREL + {dev.get("data_source","OpenPrinting")}',
                        'data_confidence':       'Verified',
                        'last_scraped_at':       NOW,
                        'updated_at':            NOW,
                    }, params=f'?id=eq.{dev["id"]}')
                    enriched += 1
                time.sleep(0.1)
            page += 1
            if page > 20:
                break  # Safety limit
            time.sleep(0.5)

    print(f'EPREL: Enriched {enriched} devices')
    log_authority_scrape('EPREL', 'imagingequipment', enriched, 0, EPREL_SEARCH_URL)


# ── AUTHORITY SCRAPE LOG ──────────────────────────────────────────────────────

def log_authority_scrape(source: str, category: str, enriched: int, errors: int, url: str):
    """Log an authority database scrape run."""
    try:
        sb('POST', 'device_scrape_log', {
            'brand_name':    f'ALL ({category})',
            'data_source':   source,
            'run_at':        NOW,
            'status':        'success' if not errors else 'partial',
            'devices_found': enriched,
            'devices_updated': enriched,
            'devices_added': 0,
            'source_url':    url,
            'notes':         f'Authority DB enrichment: {source}',
        })
    except Exception as e:
        print(f'Log write failed: {e}')


# ── MAIN ──────────────────────────────────────────────────────────────────────

def run():
    """
    Authority DB enrichment — run AFTER OpenPrinting scraper has populated devices.

    Pass 1: FCC lookup for all devices without fcc_id (USA market validation)
    Pass 2: EPREL lookup for EU devices (requires EPREL credentials in env)

    Future passes (when credentials available):
    Pass 3: CMIIT — China market validation
    Pass 4: KCC MSIP — Korea market validation
    Pass 5: ANATEL — Brazil market validation
    """
    print(f'[{NOW}] Authority DB enrichment starting')

    if not SERVICE_KEY:
        print('ERROR: PURSUIT360_SUPABASE_SERVICE_KEY not set')
        return

    # ── Pass 1: FCC ───────────────────────────────────────────────────────────
    print('\n=== PASS 1: FCC Equipment Authorization Database ===')
    print('Source: fccid.io (mirrors official FCC EAS database)')
    print('Coverage: USA market — every device sold in USA must be FCC authorised')
    print('Confidence: Verified (government-mandated registration)')

    # Get devices without FCC ID (sample first 100 for rate limit safety)
    devices = sb('GET', 'devices',
        params='?fcc_id=is.null&select=id,model_name,brand_id&limit=100')
    # Get brand names for those devices
    brand_ids = list(set(d['brand_id'] for d in devices))

    fcc_enriched = 0
    for dev in devices:
        # Get brand name
        brand = sb('GET', 'brands', params=f'?id=eq.{dev["brand_id"]}&select=name')
        brand_name = brand[0]['name'] if brand else ''

        success = enrich_device_from_fcc(dev['id'], dev['model_name'], brand_name)
        if success:
            fcc_enriched += 1
        time.sleep(1)  # Polite — fccid.io is a free community resource

    print(f'FCC: Enriched {fcc_enriched}/{len(devices)} devices')
    log_authority_scrape('FCC (via fccid.io)', 'all', fcc_enriched, 0,
        'https://fccid.io')

    # ── Pass 2: EPREL ─────────────────────────────────────────────────────────
    eprel_user = os.environ.get('EPREL_USERNAME')
    eprel_pass = os.environ.get('EPREL_PASSWORD')

    if eprel_user and eprel_pass:
        print('\n=== PASS 2: EPREL EU Energy Product Registry ===')
        print('Source: eprel.ec.europa.eu (EU Commission mandatory registry)')
        print('Coverage: EU market — all imaging equipment sold in EU since 2021')
        print('Confidence: Verified (EU Regulation 2019/2021 mandatory registration)')
        enrich_all_from_eprel(eprel_user, eprel_pass)
    else:
        print('\nEPREL: Skipped — set EPREL_USERNAME + EPREL_PASSWORD env vars')
        print('Register free at: https://eprel.ec.europa.eu/api/registration')

    # ── Future passes ─────────────────────────────────────────────────────────
    print('\n=== Future Authority Sources (not yet implemented) ===')
    print('CMIIT (China):  https://fccid.io/CMIIT-ID.php  — no auth required via fccid.io')
    print('KCC MSIP (Korea): https://fccid.io/KCC.php     — no auth required via fccid.io')
    print('ANATEL (Brazil): https://fccid.io/ANATEL/      — no auth required via fccid.io')
    print('Ofcom (UK):     https://sitefinder.ofcom.org.uk — separate implementation needed')
    print('All three can be added with same pattern as FCC pass above.')

    print('\nAuthority DB enrichment complete.')


if __name__ == '__main__':
    run()
