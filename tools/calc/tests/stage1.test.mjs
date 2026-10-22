import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../calc-core.js';

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test('CHA2DS2-VASc: 76-year-old woman with HTN and DM = 5, VA = 4', () => {
  const r = c.cha2ds2vasc({ chf: false, htn: true, age: 76, dm: true, stroke: false, vascular: false, female: true });
  assert.equal(r.score, 5);
  assert.equal(r.score_va, 4);
});
test('CHA2DS2-VASc: age boundaries 64/65/74/75', () => {
  const base = { chf: false, htn: false, dm: false, stroke: false, vascular: false, female: false };
  assert.equal(c.cha2ds2vasc({ ...base, age: 64 }).score, 0);
  assert.equal(c.cha2ds2vasc({ ...base, age: 65 }).score, 1);
  assert.equal(c.cha2ds2vasc({ ...base, age: 74 }).score, 1);
  assert.equal(c.cha2ds2vasc({ ...base, age: 75 }).score, 2);
});
test('CHA2DS2-VASc: stroke counts 2, everything on = 9 (VA = 8)', () => {
  const r = c.cha2ds2vasc({ chf: true, htn: true, age: 80, dm: true, stroke: true, vascular: true, female: true });
  assert.equal(r.score, 9);
  assert.equal(r.score_va, 8);
});
test('CHA2DS2-VASc: female sex alone = 1 but VA = 0', () => {
  const r = c.cha2ds2vasc({ chf: false, htn: false, age: 50, dm: false, stroke: false, vascular: false, female: true });
  assert.equal(r.score, 1);
  assert.equal(r.score_va, 0);
});
test('Cockcroft-Gault: 60 y man 80 kg creat 1.0 = 88.89', () => {
  near(c.cockcroftGault({ age: 60, weightKg: 80, creatMgDl: 1.0, female: false }), 88.89);
});
test('Cockcroft-Gault: female is x0.85', () => {
  near(c.cockcroftGault({ age: 60, weightKg: 80, creatMgDl: 1.0, female: true }), 88.89 * 0.85);
});
test('Cockcroft-Gault rejects creatinine 0', () => {
  assert.throws(() => c.cockcroftGault({ age: 60, weightKg: 80, creatMgDl: 0, female: false }), RangeError);
});
test('Ideal body weight (Devine)', () => {
  // 170 cm = 66.93 in -> male 50 + 2.3*6.929 = 65.94 ; female 45.5 + 15.94 = 61.44
  near(c.idealBodyWeight({ heightCm: 170, female: false }), 65.94);
  near(c.idealBodyWeight({ heightCm: 170, female: true }), 61.44);
});
test('Adjusted body weight', () => {
  near(c.adjustedBodyWeight({ ibw: 65, actual: 105 }), 65 + 0.4 * 40);
});
test('Creatinine umol/L to mg/dL factor', () => {
  near(c.umolToMgDl(88.4), 1.0, 0.001);
});
test('LVOT area, stroke volume, CO', () => {
  near(c.lvotArea(2.0), 3.1416, 0.0005);
  near(c.strokeVolume({ lvotDcm: 2.0, vtiCm: 20 }), 62.83);
  near(c.cardiacOutput({ svMl: 62.83, hr: 70 }), 4.398, 0.001);
});
test('BSA Mosteller', () => {
  near(c.bsaMosteller({ heightCm: 170, weightKg: 70 }), Math.sqrt(170 * 70 / 3600), 1e-9);
});
test('AVA by continuity and DVI', () => {
  near(c.avaContinuity({ lvotDcm: 2.0, vtiLvot: 20, vtiAv: 80 }), 0.785, 0.001);
  near(c.dvi({ vtiLvot: 20, vtiAv: 80 }), 0.25, 1e-9);
});
test('Bernoulli 4 m/s = 64 mmHg', () => {
  near(c.bernoulli(4), 64, 1e-9);
});
test('AS severe-criteria flags use >= / <= at the cut-offs', () => {
  const f = c.asSevereFlags({ vmax: 4.0, meanGradient: 40, ava: 1.0, avai: 0.6, dvi: 0.25 });
  assert.deepEqual(f, { vmax: true, meanGradient: true, ava: true, avai: true, dvi: false });
  const g = c.asSevereFlags({ vmax: 3.9, meanGradient: 39, ava: 1.01, avai: 0.61, dvi: 0.24 });
  assert.deepEqual(g, { vmax: false, meanGradient: false, ava: false, avai: false, dvi: true });
});
