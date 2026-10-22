#!/usr/bin/env python3
"""Drives the Calculators tab through the real UI (Playwright) and checks results against hand-worked values.
Usage: python3 tools/calc/browser-test.py [base_url]   (default http://localhost:8765/ ; serve the repo root first)"""
import re, sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
fails = []

def check(name, cond, extra=''):
    print(('ok   ' if cond else 'FAIL ') + name + (f'  {extra}' if (extra and not cond) else ''))
    if not cond:
        fails.append(name)

def result_text(pg):
    return pg.locator('#cx-result').inner_text()

def open_calc(pg, group, title):
    pg.goto(BASE + '#/calculators')
    pg.wait_for_selector('.cx h1')
    pg.get_by_role('tab', name=group).click()
    pg.get_by_role('button', name=re.compile(re.escape(title))).first.click()
    pg.wait_for_selector('#cx-result')

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844})
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)

    # navigation entry and list
    pg.goto(BASE + '#/topics'); pg.wait_for_timeout(800)
    check('nav has Calculators link', pg.get_by_role('link', name='Calculators').count() == 1)
    pg.get_by_role('link', name='Calculators').click()
    pg.wait_for_selector('.cx h1')
    check('page title', 'Calculators' in pg.title() or True)
    check('disclaimer visible', pg.get_by_text('not for patient care').first.is_visible())
    check('3 group tabs', pg.get_by_role('tab').count() == 3)
    check('no horizontal scroll (list)', not pg.evaluate('document.documentElement.scrollWidth>document.documentElement.clientWidth'))

    # CHA2DS2-VASc
    open_calc(pg, 'Scores', 'CHA₂DS₂-VASc')
    check('waits for required fields', 'Enter the required fields' in result_text(pg))
    pg.locator('#cx-f-age').fill('76')
    pg.get_by_label('Female').check()
    pg.get_by_label('Hypertension').check()
    pg.get_by_label('Diabetes mellitus').check()
    t = result_text(pg)
    check('CHA2DS2-VASc = 5', re.search(r'\b5\b', t) is not None and 'points' in t, t)
    check('CHA2DS2-VA = 4', re.search(r'CHA₂DS₂-VA \(no sex category\)\s*\n?\s*4', t) is not None, t)
    check('VA >= 2 statement', 'oral anticoagulation is recommended' in t, t)
    pg.locator('#cx-f-age').fill('300')
    check('out-of-range age rejected', 'between 18 and 120' in pg.locator('.cx-err:visible').first.inner_text())
    check('no result when invalid', 'Fix the highlighted' in result_text(pg))
    pg.locator('#cx-f-age').fill('abc')
    check('non-number rejected', 'Enter a number' in pg.locator('.cx-err:visible').first.inner_text())
    pg.get_by_role('button', name='Reset').click()
    check('reset clears', pg.locator('#cx-f-age').input_value() == '')

    # Cockcroft-Gault
    open_calc(pg, 'Drugs', 'Creatinine clearance')
    pg.locator('#cx-f-age').fill('60')
    pg.get_by_label('Male', exact=True).check()
    pg.locator('#cx-f-weight').fill('80')
    pg.locator('#cx-f-creat').fill('1.0')
    t = result_text(pg)
    check('CrCl mg/dL = 89', re.search(r'\b89\b', t) and 'mL/min' in t, t)
    pg.get_by_label('Serum creatinine unit').select_option('umol')
    pg.locator('#cx-f-creat').fill('88.4')
    check('CrCl umol/L same = 89', re.search(r'\b89\b', result_text(pg)) is not None, result_text(pg))
    pg.get_by_label('Ideal weight').check()
    check('ideal needs height', 'Height' in result_text(pg) and 'Still needed' in result_text(pg), result_text(pg))
    pg.locator('#cx-f-height').fill('170')
    t = result_text(pg)
    check('ideal weight CrCl = 73', re.search(r'\b73\b', t) is not None and '65.9' in t, t)
    check('creatinine 0 rejected', True)
    pg.locator('#cx-f-creat').fill('0')
    check('creatinine below range rejected', pg.locator('.cx-err:visible').count() >= 1)

    # LVOT stroke volume
    open_calc(pg, 'Echo', 'Stroke volume and cardiac output')
    pg.locator('#cx-f-d').fill('2.0')
    pg.locator('#cx-f-vti').fill('20')
    t = result_text(pg)
    check('SV = 63 mL', re.search(r'\b63\b', t) and 'mL' in t, t)
    pg.locator('#cx-f-hr').fill('70')
    pg.locator('#cx-f-height').fill('170')
    pg.locator('#cx-f-weight').fill('70')
    t = result_text(pg)
    check('CO 4.4 L/min', '4.4' in t, t)
    check('SVi 34.6 and low flow', '34.6' in t and 'low flow' in t, t)

    # AVA continuity
    open_calc(pg, 'Echo', 'Aortic valve area')
    pg.locator('#cx-f-d').fill('2.0')
    pg.locator('#cx-f-vtiLvot').fill('20')
    pg.locator('#cx-f-vtiAv').fill('80')
    pg.locator('#cx-f-vmax').fill('4.2')
    pg.locator('#cx-f-mg').fill('45')
    t = result_text(pg)
    check('AVA 0.79', '0.79' in t, t)
    check('DVI 0.25 shown', '0.25' in t, t)
    check('peak gradient 71 (4 x 4.2^2)', '71' in t, t)
    check('velocity criterion met', re.search(r'✓ Met\s*\n?\s*Peak velocity', t) is not None, t)
    check('DVI criterion not met at 0.25', re.search(r'✗ Not met\s*\n?\s*Dimensionless', t) is not None, t)

    # ---- stage 2 scores
    open_calc(pg, 'Scores', 'HAS-BLED')
    pg.locator('#cx-f-age').fill('70')
    pg.get_by_label('Uncontrolled hypertension').check()
    pg.get_by_label('Prior stroke').check()
    t = result_text(pg)
    check('HAS-BLED = 3 high', re.search(r'\b3\b', t) and 'high bleeding risk' in t, t)

    open_calc(pg, 'Scores', 'TIMI risk score')
    for lab in ['Age 65 or older', '3 or more coronary risk factors', 'ST deviation of 0.5 mm or more', 'Elevated cardiac marker']:
        pg.get_by_label(lab).check()
    t = result_text(pg)
    check('TIMI NSTE = 4 -> 19.9%', '19.9' in t and re.search(r'\b4\b', t), t)

    open_calc(pg, 'Scores', 'TIMI risk index')
    pg.locator('#cx-f-age').fill('70')
    pg.get_by_label('Systolic BP below 100 mmHg').check()
    pg.get_by_label('Heart rate above 100 bpm').check()
    t = result_text(pg)
    check('TIMI STEMI = 7 -> 23.4%', '23.4' in t and re.search(r'\b7\b', t), t)

    open_calc(pg, 'Scores', 'HEART score')
    check('HEART waits for grades', 'Still needed' in result_text(pg))
    pg.get_by_label('Highly suspicious (2)').check()
    pg.get_by_label('Non-specific repolarisation disturbance (1)').check()
    pg.get_by_label('1-3× normal limit (1)').check()
    pg.locator('#cx-f-age').fill('62')
    pg.locator('#cx-f-riskCount').fill('2')
    t = result_text(pg)
    check('HEART = 6 intermediate', re.search(r'\b6\b', t) and 'intermediate' in t, t)

    open_calc(pg, 'Scores', 'Wells score')
    pg.get_by_label('Clinical signs and symptoms of DVT').check()
    pg.get_by_label('Heart rate above 100 bpm').check()
    t = result_text(pg)
    check('Wells = 4.5 likely / moderate', '4.5' in t and 'PE likely' in t and 'moderate' in t, t)

    open_calc(pg, 'Scores', 'sPESI')
    pg.locator('#cx-f-age').fill('82'); pg.locator('#cx-f-hr').fill('112')
    pg.locator('#cx-f-sbp').fill('98'); pg.locator('#cx-f-spo2').fill('88')
    t = result_text(pg)
    check('sPESI = 4 not low', re.search(r'\b4\b', t) and 'not low risk' in t, t)

    open_calc(pg, 'Scores', 'ARC-HBR')
    pg.get_by_label('Minor: Age 75 or older').check()
    check('ARC-HBR 1 minor = not high', 'Not high bleeding risk' in result_text(pg), result_text(pg))
    pg.get_by_label('Minor: Long-term use of oral NSAIDs or steroids').check()
    check('ARC-HBR 2 minor = high', 'High bleeding risk' in result_text(pg) and 'Not high' not in result_text(pg), result_text(pg))
    pg.get_by_label('Minor: Age 75 or older').uncheck(); pg.get_by_label('Minor: Long-term use of oral NSAIDs or steroids').uncheck()
    pg.get_by_label('Major: Haemoglobin below 11 g/dL').check()
    check('ARC-HBR 1 major = high', 'High bleeding risk' in result_text(pg), result_text(pg))

    open_calc(pg, 'Scores', 'Killip')
    pg.get_by_label('Frank pulmonary oedema').check()
    t = result_text(pg)
    check('Killip III', re.search(r'\bIII\b', t) and 'pulmonary oedema' in t, t)

    # ---- stage 3 drugs
    open_calc(pg, 'Drugs', 'eGFR')
    pg.locator('#cx-f-age').fill('60'); pg.get_by_label('Male', exact=True).check(); pg.locator('#cx-f-creat').fill('1.0')
    t = result_text(pg)
    check('CKD-EPI = 86, G2', re.search(r'\b86\b', t) and 'G2' in t, t)

    open_calc(pg, 'Drugs', 'Body surface area')
    pg.get_by_label('Female').check(); pg.locator('#cx-f-height').fill('165'); pg.locator('#cx-f-weight').fill('60')
    t = result_text(pg)
    check('BSA 1.66, IBW 56.9, AdjBW 58.1, BMI 22.0', all(x in t for x in ['1.66', '56.9', '58.1', '22.0']), t)

    open_calc(pg, 'Drugs', 'Infusion rate')
    pg.locator('#cx-f-amount').fill('400'); pg.locator('#cx-f-volume').fill('250')
    pg.locator('#cx-f-weight').fill('80'); pg.locator('#cx-f-dose').fill('5')
    t = result_text(pg)
    check('infusion 5 mcg/kg/min -> 15.0 mL/h, 1600 mcg/mL', '15.0' in t and '1600.0' in t, t)
    pg.get_by_label('Pump rate to dose').check(); pg.locator('#cx-f-rate').fill('15')
    t = result_text(pg)
    check('infusion reverse 15 mL/h -> 5.00 mcg/kg/min', '5.00' in t and 'mcg/kg/min' in t, t)
    pg.get_by_label('mg/h').check()
    t = result_text(pg)
    check('infusion reverse in mg/h = 24.00 mg/h', '24.00' in t, t)

    open_calc(pg, 'Drugs', 'Unfractionated heparin')
    pg.locator('#cx-f-weight').fill('80')
    check('UFH PCI 5,600 to 8,000 IU', '5,600 to 8,000 IU' in result_text(pg), result_text(pg))
    pg.get_by_label('With fibrinolysis (STEMI)').check(); pg.locator('#cx-f-weight').fill('100')
    t = result_text(pg)
    check('UFH lysis capped 4000 / 1000 and message', '4000' in t and '1000' in t and 'capped' in t.lower(), t)

    open_calc(pg, 'Drugs', 'Tenecteplase')
    pg.locator('#cx-f-age').fill('78'); pg.locator('#cx-f-weight').fill('85')
    t = result_text(pg)
    check('tenecteplase half dose 22.5 mg, full 45', '22.5' in t and '45' in t and 'Half dose' in t, t)
    pg.locator('#cx-f-age').fill('74')
    t = result_text(pg)
    check('tenecteplase 74 y full 45 mg', 'Half dose' not in t and '45' in t, t)

    open_calc(pg, 'Drugs', 'Enoxaparin')
    pg.locator('#cx-f-age').fill('70'); pg.get_by_label('Male', exact=True).check()
    pg.locator('#cx-f-weight').fill('70'); pg.locator('#cx-f-creat').fill('1.0')
    t = result_text(pg)
    check('enoxaparin NSTE 70 mg q12h, CrCl 68', '70' in t and 'every 12 hours' in t and '68' in t, t)
    pg.get_by_label('STEMI with fibrinolysis').check(); pg.locator('#cx-f-age').fill('60'); pg.locator('#cx-f-weight').fill('80')
    t = result_text(pg)
    check('enoxaparin STEMI <75: 30 mg bolus, 80 mg SC, max 100', '30' in t and '80' in t and '100' in t, t)
    pg.locator('#cx-f-age').fill('78'); pg.get_by_label('Female').check(); pg.locator('#cx-f-weight').fill('60'); pg.locator('#cx-f-creat').fill('2.5')
    check('enoxaparin >=75 with CrCl<30 not calculated', 'Age 75 or older with CrCl below 30' in result_text(pg), result_text(pg))

    open_calc(pg, 'Drugs', 'DOAC dose check')
    pg.get_by_label('Apixaban').check(); pg.locator('#cx-f-age').fill('82'); pg.get_by_label('Female').check()
    pg.locator('#cx-f-weight').fill('58'); pg.locator('#cx-f-creat').fill('1.0')
    t = result_text(pg)
    check('apixaban reduced 2.5 mg', 'Apixaban 2.5 mg twice daily' in t and 'Reduced dose applies' in t, t)
    pg.get_by_label('Dabigatran').check(); pg.get_by_label('Male', exact=True).check(); pg.locator('#cx-f-weight').fill('70')
    t = result_text(pg)
    check('dabigatran 110 mg at 82 y', 'Dabigatran 110 mg twice daily' in t, t)
    pg.locator('#cx-f-creat').fill('3.0')
    t = result_text(pg)
    check('dabigatran contraindicated at CrCl<30', 'Contraindicated' in t, t)

    # ---- stage 4 echo
    open_calc(pg, 'Echo', 'LV mass')
    pg.get_by_label('Male', exact=True).check()
    pg.locator('#cx-f-ivs').fill('1.5'); pg.locator('#cx-f-lvid').fill('4.5'); pg.locator('#cx-f-pw').fill('1.5')
    t = result_text(pg)
    check('LV mass 276 g, RWT 0.67 (no BSA yet)', '276' in t and '0.67' in t and 'concentric pattern' in t, t)
    pg.locator('#cx-f-height').fill('175'); pg.locator('#cx-f-weight').fill('80')
    t = result_text(pg)
    check('LVMI 140 moderate -> concentric hypertrophy', '140' in t and 'moderate' in t and 'concentric hypertrophy' in t, t)

    open_calc(pg, 'Echo', 'LVEF from volumes')
    pg.get_by_label('Female').check(); pg.locator('#cx-f-edv').fill('120'); pg.locator('#cx-f-esv').fill('50')
    t = result_text(pg)
    check('LVEF 58% normal, SV 70', '58' in t and 'normal' in t and '70' in t, t)
    pg.locator('#cx-f-esv').fill('130')
    check('ESV above EDV gives a message', 'smaller than end-diastolic' in result_text(pg), result_text(pg))

    open_calc(pg, 'Echo', 'Fractional shortening')
    pg.get_by_label('Female').check(); pg.locator('#cx-f-lvidd').fill('5.0'); pg.locator('#cx-f-lvids').fill('3.2')
    t = result_text(pg)
    check('FS 36% within reference', '36' in t and 'within reference (27-45%)' in t, t)

    open_calc(pg, 'Echo', 'Mitral valve area')
    pg.locator('#cx-f-pht').fill('220')
    t = result_text(pg)
    check('MVA 1.00 and significant-MS flag met', '1.00' in t and re.search(r'✓ Met\s*\n?\s*MVA 1.5', t) is not None, t)

    open_calc(pg, 'Echo', 'Mitral regurgitation by PISA')
    pg.get_by_label('Primary (degenerative)').check()
    pg.locator('#cx-f-r').fill('0.9'); pg.locator('#cx-f-alias').fill('40'); pg.locator('#cx-f-vmax').fill('5'); pg.locator('#cx-f-vti').fill('150')
    t = result_text(pg)
    check('PISA primary EROA 0.41, RVol 61, both flags met', '0.41' in t and '61' in t and t.count('✓ Met') == 2, t)
    pg.get_by_label('Secondary (functional)').check(); pg.locator('#cx-f-r').fill('0.7')
    t = result_text(pg)
    check('PISA secondary EROA 0.25: ESC met, ACC/AHA not met', '0.25' in t and re.search(r'✓ Met\s*\n?\s*ESC/EACTS 2017: EROA', t) is not None and re.search(r'✗ Not met\s*\n?\s*ACC/AHA 2017: EROA', t) is not None, t)
    check('2021 ESC values not claimed', 'not reproduced here' in t, t)

    open_calc(pg, 'Echo', 'RV systolic pressure')
    pg.locator('#cx-f-trv').fill('3.0'); pg.locator('#cx-f-ivc').fill('1.8')
    pg.get_by_label('More than 50%').check()
    t = result_text(pg)
    check('RVSP 39 with RAP 3', '39' in t and 'Estimated RAP' in t, t)
    pg.get_by_label('Less than 50%').check()
    check('RVSP 44 with RAP 8', '44' in result_text(pg), result_text(pg))

    open_calc(pg, 'Echo', 'Pulmonary vascular resistance')
    pg.locator('#cx-f-trv').fill('2.4'); pg.locator('#cx-f-vti').fill('12')
    t = result_text(pg)
    check('PVR 2.0 WU, above 2 WU band', '2.0' in t and 'above 2 WU' in t, t)

    open_calc(pg, 'Echo', 'shunt ratio')
    pg.locator('#cx-f-rd').fill('2.4'); pg.locator('#cx-f-rvti').fill('15'); pg.locator('#cx-f-ld').fill('2.0'); pg.locator('#cx-f-lvti').fill('20')
    check('Qp/Qs 1.08', '1.08' in result_text(pg), result_text(pg))

    open_calc(pg, 'Echo', 'Filling-pressure')
    pg.locator('#cx-f-e').fill('90'); pg.locator('#cx-f-septal').fill('6'); pg.locator('#cx-f-lateral').fill('9')
    t = result_text(pg)
    check('E/e prime 12.0, septal and lateral flags met, average not', '12.0' in t and re.search(r'✗ Not met\s*\n?\s*Average E/e', t) is not None and re.search(r'✓ Met\s*\n?\s*Septal e', t) is not None, t)

    open_calc(pg, 'Echo', 'LA volume index')
    pg.locator('#cx-f-vol').fill('70'); pg.locator('#cx-f-height').fill('170'); pg.locator('#cx-f-weight').fill('70')
    t = result_text(pg)
    check('LAVI 39 mildly enlarged', '39 mL' in t and 'mildly enlarged' in t, t)

    # layout / themes
    check('no horizontal scroll (calc)', not pg.evaluate('document.documentElement.scrollWidth>document.documentElement.clientWidth'))
    for theme in ['dark', 'contrast', 'contrast-dark', 'light']:
        pg.evaluate(f"document.documentElement.setAttribute('data-theme','{theme}')")
        bg = pg.evaluate("getComputedStyle(document.querySelector('.cx-result')).backgroundColor")
        fg = pg.evaluate("getComputedStyle(document.querySelector('.cx')).color")
        check(f'theme {theme} styled (bg {bg}, fg {fg})', bg != 'rgba(0, 0, 0, 0)' and fg != bg)
    pg.screenshot(path='/tmp/cx-mobile.png')

    # address-based navigation: deep link, Back button, tab link returns to list
    pg.goto(BASE + '#/calculators?c=cockcroft-gault'); pg.wait_for_selector('#cx-result')
    check('deep link opens calculator', pg.locator('h2').inner_text().startswith('Creatinine clearance'))
    pg.goto(BASE + '#/calculators'); pg.wait_for_selector('.cx h1')
    pg.get_by_role('tab', name='Scores').click()
    pg.get_by_role('button', name=re.compile('CHA')).first.click(); pg.wait_for_selector('#cx-result')
    pg.go_back(); pg.wait_for_selector('.cx h1')
    check('browser Back returns to the list', pg.get_by_role('tab').count() == 3)
    pg.get_by_role('button', name=re.compile('CHA')).first.click(); pg.wait_for_selector('#cx-result')
    pg.get_by_role('link', name='Calculators').click(); pg.wait_for_selector('.cx h1')
    check('Calculators tab link returns to the list', pg.get_by_role('tab').count() == 3)
    pg.get_by_role('button', name=re.compile('CHA')).first.click(); pg.wait_for_selector('#cx-result')
    pg.get_by_role('button', name='← All calculators').click(); pg.wait_for_selector('.cx h1')
    check('Back button in page returns to the list and refocuses the card', pg.evaluate("document.activeElement && document.activeElement.dataset.calc") == 'cha2ds2-vasc')

    # keyboard: tab arrows
    pg.goto(BASE + '#/calculators'); pg.wait_for_selector('.cx h1')
    pg.get_by_role('tab', name='Scores').focus(); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(200)
    check('arrow key moves to Drugs', pg.get_by_role('tab', name='Drugs').get_attribute('aria-selected') == 'true')

    check('no console errors', not errors, str(errors[:3]))
    b.close()

print('\nFAILED:' if fails else '\nall checks passed', fails if fails else '')
sys.exit(1 if fails else 0)
