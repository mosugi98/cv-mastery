#!/usr/bin/env python3
"""Loads the site with the service worker on, waits for the precache, goes offline, and opens the Calculators tab."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page()
    pg.goto(BASE); pg.wait_for_function("navigator.serviceWorker && navigator.serviceWorker.controller !== null", timeout=60000)
    # wait until the precache holds the calculator chunk
    pg.wait_for_function("""async () => { const ks = await caches.keys(); for (const k of ks) { const c = await caches.open(k); const r = await c.keys(); if (r.some(x => /CalculatorsScreen-/.test(x.url))) return true; } return false; }""", timeout=120000)
    ctx.set_offline(True)
    pg.goto(BASE + '#/calculators?c=cha2ds2-vasc'); pg.reload()
    pg.wait_for_selector('#cx-result', timeout=20000)
    pg.locator('#cx-f-age').fill('70')
    print('offline ok:', 'Enter the required fields' in pg.locator('#cx-result').inner_text())
    b.close()
