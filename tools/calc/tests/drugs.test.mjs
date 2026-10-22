import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../calc-core.js';

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

// CKD-EPI 2021 (Inker NEJM 2021), reference values computed independently in Python
test('CKD-EPI 2021 reference values', () => {
  near(c.ckdEpi2021({ age: 60, creatMgDl: 1.0, female: false }), 86.1626, 0.001);
  near(c.ckdEpi2021({ age: 50, creatMgDl: 0.6, female: true }), 109.2830, 0.001);
  near(c.ckdEpi2021({ age: 80, creatMgDl: 2.0, female: false }), 33.1179, 0.001);
  near(c.ckdEpi2021({ age: 30, creatMgDl: 0.9, female: false }), 117.8306, 0.001);
});
test('CKD-EPI rejects non-positive creatinine', () => {
  assert.throws(() => c.ckdEpi2021({ age: 50, creatMgDl: 0, female: false }), RangeError);
});

// Infusion arithmetic
test('infusion: mcg/kg/min -> mL/h and back', () => {
  // 5 mcg/kg/min, 80 kg, 1600 mcg/mL (400 mg in 250 mL): 5*80*60/1600 = 15 mL/h
  near(c.infusionRate({ doseMcgPerMin: 5 * 80, concMcgPerMl: 1600 }), 15);
  near(c.infusionDose({ rateMlPerH: 15, concMcgPerMl: 1600 }), 400);       // mcg/min
  near(c.concentrationMcgPerMl({ amountMg: 400, volumeMl: 250 }), 1600);
});
test('infusion rejects zero concentration or volume', () => {
  assert.throws(() => c.infusionRate({ doseMcgPerMin: 10, concMcgPerMl: 0 }), RangeError);
  assert.throws(() => c.concentrationMcgPerMl({ amountMg: 10, volumeMl: 0 }), RangeError);
});

// UFH (ESC 2023: 70-100 IU/kg at PCI; fibrinolysis: 60 IU/kg max 4000, then 12 IU/kg/h max 1000)
test('UFH PCI bolus range', () => {
  assert.deepEqual(c.ufhPci({ weightKg: 80 }), { lowIu: 5600, highIu: 8000 });
});
test('UFH with fibrinolysis caps', () => {
  assert.deepEqual(c.ufhLysis({ weightKg: 50 }), { bolusIu: 3000, infusionIuPerH: 600, bolusCapped: false, infusionCapped: false });
  assert.deepEqual(c.ufhLysis({ weightKg: 66 }), { bolusIu: 3960, infusionIuPerH: 792, bolusCapped: false, infusionCapped: false });
  const heavy = c.ufhLysis({ weightKg: 100 });
  assert.equal(heavy.bolusIu, 4000); assert.equal(heavy.infusionIuPerH, 1000);
  assert.equal(heavy.bolusCapped, true); assert.equal(heavy.infusionCapped, true);
  assert.equal(c.ufhLysis({ weightKg: 83 }).infusionIuPerH, 996);
  assert.equal(c.ufhLysis({ weightKg: 84 }).infusionIuPerH, 1000);
});

// Tenecteplase weight bands: <60 30, 60-<70 35, 70-<80 40, 80-<90 45, >=90 50 mg; half dose at age >=75
test('tenecteplase bands and boundaries', () => {
  const full = (w) => c.tenecteplase({ weightKg: w, age: 60 }).fullMg;
  assert.deepEqual([59.9, 60, 69.9, 70, 79.9, 80, 89.9, 90, 120].map(full), [30, 35, 35, 40, 40, 45, 45, 50, 50]);
});
test('tenecteplase half dose at 75 and above', () => {
  assert.equal(c.tenecteplase({ weightKg: 75, age: 74 }).halfDose, false);
  const r = c.tenecteplase({ weightKg: 75, age: 75 });
  assert.equal(r.halfDose, true); assert.equal(r.fullMg, 40); assert.equal(r.doseMg, 20);
  assert.equal(c.tenecteplase({ weightKg: 95, age: 80 }).doseMg, 25);
  assert.equal(c.tenecteplase({ weightKg: 55, age: 80 }).doseMg, 15);
});

// Enoxaparin in ACS
test('enoxaparin NSTE-ACS: 1 mg/kg q12h; q24h below CrCl 30; unsupported below 15', () => {
  let r = c.enoxaparinAcs({ setting: 'nste', age: 70, weightKg: 70, crcl: 60 });
  assert.deepEqual([r.status, r.scMg, r.intervalH, r.bolusMg], ['ok', 70, 12, 0]);
  r = c.enoxaparinAcs({ setting: 'nste', age: 70, weightKg: 70, crcl: 30 });
  assert.equal(r.intervalH, 12);
  r = c.enoxaparinAcs({ setting: 'nste', age: 70, weightKg: 70, crcl: 29.9 });
  assert.equal(r.intervalH, 24);
  r = c.enoxaparinAcs({ setting: 'nste', age: 70, weightKg: 70, crcl: 14.9 });
  assert.equal(r.status, 'not-calculated');
});
test('enoxaparin STEMI with fibrinolysis: age 74 vs 75', () => {
  let r = c.enoxaparinAcs({ setting: 'stemi-lysis', age: 74, weightKg: 80, crcl: 90 });
  assert.deepEqual([r.status, r.bolusMg, r.scMg, r.firstTwoMaxMg, r.intervalH], ['ok', 30, 80, 100, 12]);
  r = c.enoxaparinAcs({ setting: 'stemi-lysis', age: 74, weightKg: 120, crcl: 90 });
  assert.equal(r.scMg, 120); assert.equal(r.firstTwoMaxMg, 100);
  r = c.enoxaparinAcs({ setting: 'stemi-lysis', age: 75, weightKg: 80, crcl: 90 });
  assert.deepEqual([r.status, r.bolusMg, r.scMg, r.firstTwoMaxMg, r.intervalH], ['ok', 0, 60, 75, 12]);
});
test('enoxaparin STEMI, age >=75 with CrCl <30: not calculated (sources disagree on dose)', () => {
  const r = c.enoxaparinAcs({ setting: 'stemi-lysis', age: 78, weightKg: 70, crcl: 25 });
  assert.equal(r.status, 'not-calculated');
  const young = c.enoxaparinAcs({ setting: 'stemi-lysis', age: 60, weightKg: 70, crcl: 25 });
  assert.deepEqual([young.status, young.bolusMg, young.scMg, young.intervalH], ['ok', 30, 70, 24]);
});

// DOAC dose criteria in AF
const base = { age: 70, weightKg: 80, creatMgDl: 1.0, crcl: 80, pgpInhibitor: false, verapamil: false };
test('apixaban: 2 of 3 criteria', () => {
  const d = (o) => c.doacAf({ drug: 'apixaban', ...base, ...o });
  assert.equal(d({}).reduced, false);
  assert.equal(d({ age: 80 }).reduced, false);                              // 1 criterion
  assert.equal(d({ age: 79, weightKg: 60, creatMgDl: 1.5 }).reduced, true);  // weight <=60 and creat >=1.5
  assert.equal(d({ age: 80, weightKg: 61 }).reduced, false);
  assert.equal(d({ age: 80, weightKg: 60 }).reduced, true);
  assert.equal(d({ age: 80, creatMgDl: 1.49 }).reduced, false);
  assert.equal(d({ age: 80, creatMgDl: 1.5 }).reduced, true);
  assert.equal(d({ crcl: 29 }).reduced, true);                              // CrCl 15-29 alone
  assert.equal(d({ crcl: 30 }).reduced, false);
  assert.equal(d({ crcl: 14 }).status, 'not-calculated');
  assert.match(d({ age: 80, weightKg: 60 }).dose, /2\.5 mg twice daily/);
  assert.match(d({}).dose, /Apixaban 5 mg twice daily/);
});
test('rivaroxaban: 15 mg if CrCl 15-49', () => {
  const d = (o) => c.doacAf({ drug: 'rivaroxaban', ...base, ...o });
  assert.match(d({ crcl: 50 }).dose, /20 mg once daily/);
  assert.match(d({ crcl: 49 }).dose, /15 mg once daily/);
  assert.match(d({ crcl: 15 }).dose, /15 mg once daily/);
  assert.equal(d({ crcl: 14 }).status, 'not-calculated');
});
test('edoxaban: 30 mg if any one of weight<=60, CrCl 15-49, strong P-gp inhibitor', () => {
  const d = (o) => c.doacAf({ drug: 'edoxaban', ...base, ...o });
  assert.match(d({}).dose, /60 mg once daily/);
  assert.match(d({ weightKg: 60 }).dose, /30 mg once daily/);
  assert.match(d({ weightKg: 60.1 }).dose, /60 mg once daily/);
  assert.match(d({ crcl: 49 }).dose, /30 mg once daily/);
  assert.match(d({ crcl: 50 }).dose, /60 mg once daily/);
  assert.match(d({ pgpInhibitor: true }).dose, /30 mg once daily/);
  assert.equal(d({ crcl: 14 }).status, 'not-calculated');
});
test('dabigatran: 110 mg if age>=80 or verapamil; contraindicated below CrCl 30', () => {
  const d = (o) => c.doacAf({ drug: 'dabigatran', ...base, ...o });
  assert.match(d({}).dose, /150 mg twice daily/);
  assert.match(d({ age: 79 }).dose, /150 mg twice daily/);
  assert.match(d({ age: 80 }).dose, /110 mg twice daily/);
  assert.match(d({ verapamil: true }).dose, /110 mg twice daily/);
  assert.equal(d({ crcl: 29 }).status, 'contraindicated');
  assert.equal(d({ crcl: 30 }).status, 'ok');
});
test('DOAC unknown drug rejected', () => {
  assert.throws(() => c.doacAf({ drug: 'warfarin', ...base }), RangeError);
});
