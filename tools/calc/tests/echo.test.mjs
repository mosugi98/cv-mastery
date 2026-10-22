import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../calc-core.js';

const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

// LV mass (ASE cube formula): 0.8 x 1.04 x [(IVSd+LVIDd+PWd)^3 - LVIDd^3] + 0.6, cm -> g
test('LV mass: IVS 1.0, LVID 5.0, PW 1.0 = 181.976 g', () => {
  near(c.lvMass({ ivsCm: 1.0, lvidCm: 5.0, pwCm: 1.0 }), 181.976, 0.001);
});
test('RWT = 2 x PW / LVIDd', () => {
  near(c.rwt({ pwCm: 1.0, lvidCm: 5.0 }), 0.4, 1e-9);
});
test('LVMI grade by sex (upper limits 95 F / 115 M; mild <109/<132; moderate <122/<149)', () => {
  const g = (v, female) => c.lvmiGrade({ lvmi: v, female });
  assert.deepEqual([95, 95.5, 108.9, 109, 121.9, 122].map((v) => g(v, true)), ['normal', 'mild', 'mild', 'moderate', 'moderate', 'severe']);
  assert.deepEqual([115, 115.5, 131.9, 132, 148.9, 149].map((v) => g(v, false)), ['normal', 'mild', 'mild', 'moderate', 'moderate', 'severe']);
});
test('LV geometry from mass grade and RWT 0.42', () => {
  assert.equal(c.lvGeometry({ lvmiGrade: 'normal', rwt: 0.42 }), 'normal geometry');
  assert.equal(c.lvGeometry({ lvmiGrade: 'normal', rwt: 0.43 }), 'concentric remodelling');
  assert.equal(c.lvGeometry({ lvmiGrade: 'mild', rwt: 0.43 }), 'concentric hypertrophy');
  assert.equal(c.lvGeometry({ lvmiGrade: 'severe', rwt: 0.42 }), 'eccentric hypertrophy');
});

// LVEF from volumes and grade (Lang 2015: F 54-74, M 52-72; mild F 41-53, M 41-51; moderate 30-40; severe <30)
test('LVEF from volumes', () => {
  const r = c.lvefFromVolumes({ edv: 120, esv: 50 });
  near(r.ef, 58.333, 0.001); assert.equal(r.sv, 70);
  assert.throws(() => c.lvefFromVolumes({ edv: 50, esv: 60 }), RangeError);
});
test('LVEF category by sex', () => {
  const g = (ef, female) => c.efCategory({ ef, female });
  assert.equal(g(54, true), 'normal'); assert.equal(g(53.9, true), 'mildly abnormal');
  assert.equal(g(52, false), 'normal'); assert.equal(g(51.9, false), 'mildly abnormal');
  assert.equal(g(41, false), 'mildly abnormal'); assert.equal(g(40.9, false), 'moderately abnormal');
  assert.equal(g(30, true), 'moderately abnormal'); assert.equal(g(29.9, true), 'severely abnormal');
  assert.equal(g(75, true), 'above the reference range'); assert.equal(g(73, false), 'above the reference range');
});
test('fractional shortening and its range', () => {
  near(c.fractionalShortening({ lvidd: 5.0, lvids: 3.2 }), 36, 1e-9);
  assert.equal(c.fsCategory({ fs: 25, female: false }), 'within reference (25-43%)');
  assert.equal(c.fsCategory({ fs: 24.9, female: false }), 'below reference (25-43%)');
  assert.equal(c.fsCategory({ fs: 26.9, female: true }), 'below reference (27-45%)');
  assert.equal(c.fsCategory({ fs: 45.1, female: true }), 'above reference (27-45%)');
  assert.throws(() => c.fractionalShortening({ lvidd: 3.0, lvids: 3.5 }), RangeError);
});

// Mitral stenosis PHT: 220 / PHT
test('MVA by pressure half-time', () => {
  near(c.mvaPht(220), 1.0, 1e-9); near(c.mvaPht(147), 1.4966, 0.001);
  assert.throws(() => c.mvaPht(0), RangeError);
});

// PISA: EROA = 2 pi r^2 Va / Vpeak (cm, cm/s); RVol = EROA x VTI
test('PISA EROA and regurgitant volume', () => {
  const r = c.pisa({ rCm: 0.9, aliasCmS: 40, vPeakCmS: 500, vtiCm: 150 });
  near(r.eroa, 0.4072, 0.0001); near(r.rvol, 61.08, 0.01);
  assert.throws(() => c.pisa({ rCm: 0.9, aliasCmS: 40, vPeakCmS: 0, vtiCm: 150 }), RangeError);
});
test('MR severity flags: two sourced sets', () => {
  const f = c.mrSevereFlags({ eroa: 0.40, rvol: 60 });
  assert.deepEqual([f.primaryEroa, f.primaryRvol], [true, true]);
  const g = c.mrSevereFlags({ eroa: 0.39, rvol: 59 });
  assert.deepEqual([g.primaryEroa, g.primaryRvol], [false, false]);
  const s = c.mrSevereFlags({ eroa: 0.25, rvol: 35 });
  assert.deepEqual([s.esc2017SecondaryEroa, s.esc2017SecondaryRvol], [true, true]);
  const t = c.mrSevereFlags({ eroa: 0.20, rvol: 30 });
  assert.deepEqual([t.esc2017SecondaryEroa, t.esc2017SecondaryRvol], [false, false]); // strictly greater than
});

// RVSP
test('RAP from IVC', () => {
  assert.equal(c.rapFromIvc({ diameterCm: 2.1, collapse: 'gt50' }), 3);
  assert.equal(c.rapFromIvc({ diameterCm: 2.2, collapse: 'lt50' }), 15);
  assert.equal(c.rapFromIvc({ diameterCm: 2.0, collapse: 'lt50' }), 8);
  assert.equal(c.rapFromIvc({ diameterCm: 2.5, collapse: 'gt50' }), 8);
});
test('RVSP = 4 v^2 + RAP', () => {
  near(c.rvsp({ trvMs: 3.0, rap: 8 }), 44, 1e-9);
});

// PVR by Doppler (TRV/VTI RVOT)
test('PVR estimate: bands at 0.175 and 0.275', () => {
  let r = c.pvrDoppler({ trvMs: 2.4, vtiRvotCm: 12 });
  near(r.ratio, 0.2, 1e-9); near(r.pvrWu, 2.0, 1e-9); assert.equal(r.band, 'above 2 WU');
  r = c.pvrDoppler({ trvMs: 3.6, vtiRvotCm: 10 });
  near(r.pvrWu, 6.48, 1e-9); assert.equal(r.band, 'above 6 WU');
  r = c.pvrDoppler({ trvMs: 1.5, vtiRvotCm: 20 });
  assert.equal(r.pvrWu, null); assert.equal(r.band, 'likely 2 WU or below');
  r = c.pvrDoppler({ trvMs: 3.5, vtiRvotCm: 20 });                 // ratio 0.175 exactly
  assert.equal(r.band, 'likely 2 WU or below');
});

// Qp/Qs
test('Qp/Qs from diameters and VTIs', () => {
  near(c.qpQs({ rvotDcm: 2.4, rvotVti: 15, lvotDcm: 2.0, lvotVti: 20 }), 1.08, 1e-9);
});

// Filling pressure markers
test('average E/e prime', () => {
  near(c.eOverEprime({ e: 90, septal: 6, lateral: 9 }), 12.0, 1e-9);
});
test('LA volume index and grade', () => {
  near(c.lavi({ volumeMl: 70, bsa: 1.8 }), 38.889, 0.001);
  const g = (v) => c.laviGrade(v);
  assert.deepEqual([34, 34.4, 35, 41.9, 42, 48, 48.1].map(g), ['normal', 'normal', 'mildly enlarged', 'mildly enlarged', 'moderately enlarged', 'moderately enlarged', 'severely enlarged']);
});
