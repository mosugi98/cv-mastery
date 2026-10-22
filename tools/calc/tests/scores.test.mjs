import test from 'node:test';
import assert from 'node:assert/strict';
import * as c from '../calc-core.js';

const none = (keys) => Object.fromEntries(keys.map((k) => [k, false]));

// ---------- HAS-BLED (Pisters 2010): 9 items, 1 point each, >=3 high
const HB = ['htnUncontrolled', 'renal', 'liver', 'stroke', 'bleeding', 'labileInr', 'drugs', 'alcohol'];
test('HAS-BLED: none = 0, not high', () => {
  const r = c.hasBled({ ...none(HB), age: 60 });
  assert.equal(r.score, 0); assert.equal(r.high, false);
});
test('HAS-BLED: elderly means age above 65 (65 no, 66 yes)', () => {
  assert.equal(c.hasBled({ ...none(HB), age: 65 }).score, 0);
  assert.equal(c.hasBled({ ...none(HB), age: 66 }).score, 1);
});
test('HAS-BLED: all items = 9; threshold 3', () => {
  const all = Object.fromEntries(HB.map((k) => [k, true]));
  assert.equal(c.hasBled({ ...all, age: 80 }).score, 9);
  const three = { ...none(HB), htnUncontrolled: true, stroke: true, age: 70 };
  assert.equal(c.hasBled(three).score, 3); assert.equal(c.hasBled(three).high, true);
  assert.equal(c.hasBled({ ...three, stroke: false }).high, false);
});

// ---------- TIMI UA/NSTEMI (Antman 2000): 7 items, 14-day event rates
const TN = ['age65', 'rf3', 'knownCad', 'aspirin7d', 'angina2', 'stDev', 'marker'];
test('TIMI NSTE: rates by score', () => {
  const rates = { 0: 4.7, 1: 4.7, 2: 8.3, 3: 13.2, 4: 19.9, 5: 26.2, 6: 40.9, 7: 40.9 };
  for (let n = 0; n <= 7; n++) {
    const v = Object.fromEntries(TN.map((k, i) => [k, i < n]));
    const r = c.timiNste(v);
    assert.equal(r.score, n); assert.equal(r.risk14d, rates[n]);
  }
});

// ---------- TIMI STEMI (Morrow 2000): max 14
test('TIMI STEMI: age bands 64/65/74/75', () => {
  const base = { dmHtnAngina: false, sbpLt100: false, hrGt100: false, killip2to4: false, wtLt67: false, anteriorOrLbbb: false, timeGt4h: false };
  assert.equal(c.timiStemi({ ...base, age: 64 }).score, 0);
  assert.equal(c.timiStemi({ ...base, age: 65 }).score, 2);
  assert.equal(c.timiStemi({ ...base, age: 74 }).score, 2);
  assert.equal(c.timiStemi({ ...base, age: 75 }).score, 3);
});
test('TIMI STEMI: all items = 14, mortality >8 = 35.9', () => {
  const all = { age: 80, dmHtnAngina: true, sbpLt100: true, hrGt100: true, killip2to4: true, wtLt67: true, anteriorOrLbbb: true, timeGt4h: true };
  const r = c.timiStemi(all);
  assert.equal(r.score, 14); assert.equal(r.mortality30d, 35.9);
});
test('TIMI STEMI: mortality table 0..8', () => {
  const m = { 0: 0.8, 1: 1.6, 2: 2.2, 3: 4.4, 4: 7.3, 5: 12.4, 6: 16.1, 7: 23.4, 8: 26.8 };
  // build scores from items: sbp(3) + hr(2) + killip(2) + dm(1) + wt(1) + ant(1) + time(1) = 11 available beside age
  const mk = (items) => ({ age: 50, dmHtnAngina: false, sbpLt100: false, hrGt100: false, killip2to4: false, wtLt67: false, anteriorOrLbbb: false, timeGt4h: false, ...items });
  assert.equal(c.timiStemi(mk({})).mortality30d, m[0]);
  assert.equal(c.timiStemi(mk({ dmHtnAngina: true })).mortality30d, m[1]);
  assert.equal(c.timiStemi(mk({ hrGt100: true })).mortality30d, m[2]);
  assert.equal(c.timiStemi(mk({ sbpLt100: true })).mortality30d, m[3]);
  assert.equal(c.timiStemi(mk({ sbpLt100: true, dmHtnAngina: true })).mortality30d, m[4]);
  assert.equal(c.timiStemi(mk({ sbpLt100: true, hrGt100: true })).mortality30d, m[5]);
  assert.equal(c.timiStemi(mk({ sbpLt100: true, hrGt100: true, dmHtnAngina: true })).mortality30d, m[6]);
  assert.equal(c.timiStemi(mk({ sbpLt100: true, hrGt100: true, killip2to4: true })).mortality30d, m[7]);
  assert.equal(c.timiStemi(mk({ sbpLt100: true, hrGt100: true, killip2to4: true, dmHtnAngina: true })).mortality30d, m[8]);
});

// ---------- HEART (Six 2008)
test('HEART: components and age/troponin boundaries', () => {
  const base = { history: 0, ecg: 0, age: 44, riskCount: 0, atherosclerotic: false, troponin: 0 };
  assert.equal(c.heart(base).score, 0);
  assert.equal(c.heart({ ...base, age: 45 }).score, 1);
  assert.equal(c.heart({ ...base, age: 64 }).score, 1);
  assert.equal(c.heart({ ...base, age: 65 }).score, 2);
  assert.equal(c.heart({ ...base, riskCount: 1 }).score, 1);
  assert.equal(c.heart({ ...base, riskCount: 2 }).score, 1);
  assert.equal(c.heart({ ...base, riskCount: 3 }).score, 2);
  assert.equal(c.heart({ ...base, atherosclerotic: true }).score, 2);
  assert.equal(c.heart({ ...base, troponin: 2 }).score, 2);
});
test('HEART: risk groups 0-3 / 4-6 / 7-10', () => {
  const mk = (history, ecg, troponin, age = 44) => ({ history, ecg, age, riskCount: 0, atherosclerotic: false, troponin });
  assert.equal(c.heart(mk(1, 1, 1)).category, 'low');       // 3
  assert.equal(c.heart(mk(2, 1, 1)).category, 'moderate');  // 4
  assert.equal(c.heart(mk(2, 2, 2)).category, 'moderate');  // 6
  assert.equal(c.heart(mk(2, 2, 2, 45)).category, 'high');  // 7
  assert.equal(c.heart({ history: 2, ecg: 2, age: 70, riskCount: 3, atherosclerotic: true, troponin: 2 }).score, 10);
});

// ---------- Wells PE
test('Wells PE: points and tiers', () => {
  const all = { dvtSigns: true, peLikely: true, hr100: true, immobilised: true, prevVte: true, hemoptysis: true, malignancy: true };
  assert.equal(c.wellsPe(all).score, 12.5);
  const none = Object.fromEntries(Object.keys(all).map((k) => [k, false]));
  assert.equal(c.wellsPe(none).score, 0);
  assert.equal(c.wellsPe({ ...none, hr100: true }).tier3, 'low');          // 1.5
  assert.equal(c.wellsPe({ ...none, hr100: true, hemoptysis: true }).tier3, 'moderate'); // 2.5
  assert.equal(c.wellsPe({ ...none, peLikely: true, hr100: true, immobilised: true }).score, 6);
  assert.equal(c.wellsPe({ ...none, peLikely: true, hr100: true, immobilised: true }).tier3, 'moderate'); // 6 is moderate
  assert.equal(c.wellsPe({ ...none, peLikely: true, hr100: true, immobilised: true, hemoptysis: true }).tier3, 'high'); // 7
});
test('Wells PE: two-tier cut-off 4 / 4.5', () => {
  const none = { dvtSigns: false, peLikely: false, hr100: false, immobilised: false, prevVte: false, hemoptysis: false, malignancy: false };
  assert.equal(c.wellsPe({ ...none, dvtSigns: true, hemoptysis: true }).tier2, 'unlikely');              // 4.0
  assert.equal(c.wellsPe({ ...none, dvtSigns: true, hemoptysis: true, hr100: true }).tier2, 'likely');    // 5.5
  assert.equal(c.wellsPe({ ...none, peLikely: true, hr100: true }).tier2, 'likely');                       // 4.5
});

// ---------- sPESI
test('sPESI: 0 low, >=1 high', () => {
  const none = { age: 60, cancer: false, cardiopulm: false, hr: 80, sbp: 120, spo2: 98 };
  assert.deepEqual([c.spesi(none).score, c.spesi(none).risk], [0, 'low']);
  assert.equal(c.spesi({ ...none, age: 80 }).score, 0);   // above 80, so 80 does not count
  assert.equal(c.spesi({ ...none, age: 81 }).score, 1);
  assert.equal(c.spesi({ ...none, hr: 109 }).score, 0);
  assert.equal(c.spesi({ ...none, hr: 110 }).score, 1);
  assert.equal(c.spesi({ ...none, sbp: 100 }).score, 0);
  assert.equal(c.spesi({ ...none, sbp: 99 }).score, 1);
  assert.equal(c.spesi({ ...none, spo2: 90 }).score, 0);
  assert.equal(c.spesi({ ...none, spo2: 89 }).score, 1);
  const all = { age: 85, cancer: true, cardiopulm: true, hr: 120, sbp: 90, spo2: 85 };
  assert.deepEqual([c.spesi(all).score, c.spesi(all).risk], [6, 'high']);
});

// ---------- ARC-HBR
test('ARC-HBR: 1 major or 2 minor', () => {
  assert.equal(c.arcHbr({ major: 0, minor: 1 }).hbr, false);
  assert.equal(c.arcHbr({ major: 0, minor: 2 }).hbr, true);
  assert.equal(c.arcHbr({ major: 1, minor: 0 }).hbr, true);
  assert.equal(c.arcHbr({ major: 0, minor: 0 }).hbr, false);
});

// ---------- Killip
test('Killip classes', () => {
  assert.match(c.killip(1).description, /no clinical signs of heart failure/i);
  assert.match(c.killip(3).description, /pulmonary oedema/i);
  assert.match(c.killip(4).description, /cardiogenic shock/i);
  assert.throws(() => c.killip(5), RangeError);
});
