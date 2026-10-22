#!/usr/bin/env python3
"""Independent re-implementation of the formulas; compares with calc-core.js (via run-vectors.mjs) and with the
hand-worked expectations in vectors.json."""
import json, math, subprocess, sys, os
here = os.path.dirname(os.path.abspath(__file__))
vec = json.load(open(os.path.join(here, 'vectors.json')))
node = json.loads(subprocess.check_output(['node', os.path.join(here, 'run-vectors.mjs')]))

def cg(a):  return (140 - a['age']) * a['weightKg'] / (72 * a['creatMgDl']) * (0.85 if a['female'] else 1)
def sv(a):  return math.pi * (a['lvotDcm'] / 2) ** 2 * a['vtiCm']
def ava(a): return math.pi * (a['lvotDcm'] / 2) ** 2 * a['vtiLvot'] / a['vtiAv']
def bsa(a): return math.sqrt(a['heightCm'] * a['weightKg'] / 3600)
def ibw(a): return (45.5 if a['female'] else 50) + 2.3 * (a['heightCm'] / 2.54 - 60)
def ckd(a):
    k = 0.7 if a['female'] else 0.9; al = -0.241 if a['female'] else -0.302
    return 142 * min(a['creatMgDl'] / k, 1) ** al * max(a['creatMgDl'] / k, 1) ** -1.2 * 0.9938 ** a['age'] * (1.012 if a['female'] else 1)
FN = {'lvMass': lambda a: 0.8 * 1.04 * ((a['ivsCm'] + a['lvidCm'] + a['pwCm']) ** 3 - a['lvidCm'] ** 3) + 0.6,
      'mvaPht': lambda a: 220 / a, 'rvsp': lambda a: 4 * a['trvMs'] ** 2 + a['rap'],
      'qpQs': lambda a: (math.pi / 4 * a['rvotDcm'] ** 2 * a['rvotVti']) / (math.pi / 4 * a['lvotDcm'] ** 2 * a['lvotVti']),
      'eOverEprime': lambda a: a['e'] / ((a['septal'] + a['lateral']) / 2),
      'fractionalShortening': lambda a: (a['lvidd'] - a['lvids']) / a['lvidd'] * 100,
      'ckdEpi2021': ckd, 'infusionRate': lambda a: a['doseMcgPerMin'] * 60 / a['concMcgPerMl'], 'infusionDose': lambda a: a['rateMlPerH'] * a['concMcgPerMl'] / 60,
      'cockcroftGault': cg, 'strokeVolume': sv, 'avaContinuity': ava, 'bsaMosteller': bsa,
      'idealBodyWeight': ibw, 'bernoulli': lambda a: 4 * a * a}
bad = 0
for v, n in zip(vec, node):
    py = FN[v['fn']](v['args'])
    tol = max(0.01, abs(v['expect']) * 0.001)
    ok = abs(py - n) < 1e-9 and abs(py - v['expect']) <= tol
    if not ok:
        bad += 1
        print('MISMATCH', v['fn'], v['args'], 'node', n, 'python', py, 'expected', v['expect'])
print('vectors:', len(vec), 'mismatches:', bad)
sys.exit(1 if bad else 0)
