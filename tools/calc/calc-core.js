// Pure calculation functions for the Calculators tab. No imports, no DOM.
// Every function validates its input and throws RangeError with a readable message; the screen validates first,
// so these errors only fire on programming mistakes.
//
// Sources
//  CHA2DS2-VASc: Lip GYH et al. Chest 2010;137:263-272. CHA2DS2-VA: 2024 ESC Guidelines for AF, Table 10 (female sex removed).
//  Cockcroft-Gault: Cockcroft DW, Gault MH. Nephron 1976;16:31-41.
//  Devine ideal body weight: Devine BJ. Drug Intell Clin Pharm 1974;8:650-655.
//  Mosteller BSA: Mosteller RD. N Engl J Med 1987;317:1098.
//  LVOT stroke volume and continuity equation: Baumgartner H et al. EACVI/ASE 2017 (Eur Heart J Cardiovasc Imaging 2017, doi:10.1093/ehjci/jew335).
//  HAS-BLED: Pisters R et al. Chest 2010;138:1093-1100 (>=3 = high bleeding risk).
//  TIMI risk score UA/NSTEMI: Antman EM et al. JAMA 2000;284:835-842 (14-day death/MI/urgent revascularisation).
//  TIMI risk index STEMI: Morrow DA et al. Circulation 2000;102:2031-2037 (30-day mortality).
//  HEART score: Six AJ et al. Neth Heart J 2008;16:191-196.
//  Wells PE: Wells PS et al. Thromb Haemost 2000;83:416-420 (three-tier <2 / 2-6 / >6; two-tier <=4 / >4).
//  sPESI: Jimenez D et al. Arch Intern Med 2010;170:1383-1389.
//  ARC-HBR: Urban P et al. Eur Heart J 2019;40:2632-2653 (doi:10.1093/eurheartj/ehz372): high risk = 1 major or 2 minor criteria.
//  Killip class: Killip T, Kimball JT. Am J Cardiol 1967;20:457-464.
//  CKD-EPI 2021 creatinine equation: Inker LA et al. N Engl J Med 2021;385:1737-1749 (kidney.org transcription of the constants).
//  UFH: 2023 ESC ACS guidelines (weight-adjusted bolus 70-100 IU/kg during PCI, class I); with fibrinolysis 60 IU/kg (max 4000 IU) then
//   12 IU/kg/h (max 1000 IU/h) as tabulated in the McMaster Textbook of Internal Medicine, Table 3.11-2 (ESC STEMI guidance).
//  Tenecteplase weight bands: the same table and NHS Grampian STEMI thrombolysis protocol (based on SmPC and ESC 2023); half dose at age >=75
//   (STREAM; ESC 2017 STEMI as cited in Arq Bras Cardiol; NHS Grampian protocol). The Metalyse label itself has no age adjustment.
//  Enoxaparin in ACS: Lovenox/Clexane SmPC section 4.2 (UA/NSTEMI 1 mg/kg q12h; STEMI <75 y 30 mg IV bolus then 1 mg/kg SC q12h, max 100 mg for the
//   first two doses; >=75 y no bolus, 0.75 mg/kg q12h, max 75 mg for the first two doses; severe renal impairment CrCl 15-30 once-daily).
//  DOAC dose criteria in AF: EHRA Practical Guide 2021 / Europace 2023 table (apixaban, rivaroxaban, edoxaban); Pradaxa SmPC (dabigatran);
//   Xarelto SmPC (CrCl <15 not recommended).
//  Severe AS criteria: 2021 ESC/EACTS VHD guidelines, section 5.1.1 (mean gradient >=40 mmHg, Vmax >=4.0 m/s,
//  AVA <=1 cm2 or <=0.6 cm2/m2) and 5.1.2 (dimensionless index <0.25).

function need(name, v, { min = -Infinity, max = Infinity, gt = null } = {}) {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new RangeError(`${name} must be a number`);
  if (gt !== null && !(v > gt)) throw new RangeError(`${name} must be greater than ${gt}`);
  if (v < min || v > max) throw new RangeError(`${name} must be between ${min} and ${max}`);
  return v;
}

export function cha2ds2vasc({ chf, htn, age, dm, stroke, vascular, female }) {
  need('age', age, { min: 0, max: 130 });
  const ageCat = age >= 75 ? 2 : age >= 65 ? 1 : 0;
  const va = (chf ? 1 : 0) + (htn ? 1 : 0) + ageCat + (dm ? 1 : 0) + (stroke ? 2 : 0) + (vascular ? 1 : 0);
  return { score: va + (female ? 1 : 0), score_va: va };
}

export function cockcroftGault({ age, weightKg, creatMgDl, female }) {
  need('age', age, { min: 1, max: 130 });
  need('weight', weightKg, { gt: 0, max: 500 });
  need('creatinine', creatMgDl, { gt: 0, max: 50 });
  const v = ((140 - age) * weightKg) / (72 * creatMgDl);
  return female ? v * 0.85 : v;
}

export function idealBodyWeight({ heightCm, female }) {
  need('height', heightCm, { gt: 0, max: 280 });
  const inchesOver60 = heightCm / 2.54 - 60;
  return (female ? 45.5 : 50) + 2.3 * inchesOver60;
}

export function adjustedBodyWeight({ ibw, actual }) {
  need('ideal weight', ibw, { gt: 0 });
  need('actual weight', actual, { gt: 0 });
  return ibw + 0.4 * (actual - ibw);
}

// Creatinine: 1 mg/dL = 88.4 umol/L
export function umolToMgDl(umol) {
  need('creatinine', umol, { gt: 0 });
  return umol / 88.4;
}

export function bsaMosteller({ heightCm, weightKg }) {
  need('height', heightCm, { gt: 0, max: 280 });
  need('weight', weightKg, { gt: 0, max: 500 });
  return Math.sqrt((heightCm * weightKg) / 3600);
}

export function lvotArea(dCm) {
  need('LVOT diameter', dCm, { gt: 0, max: 5 });
  return Math.PI * (dCm / 2) ** 2;
}

export function strokeVolume({ lvotDcm, vtiCm }) {
  need('LVOT VTI', vtiCm, { gt: 0, max: 60 });
  return lvotArea(lvotDcm) * vtiCm;
}

export function cardiacOutput({ svMl, hr }) {
  need('stroke volume', svMl, { gt: 0 });
  need('heart rate', hr, { gt: 0, max: 300 });
  return (svMl * hr) / 1000;
}

export function avaContinuity({ lvotDcm, vtiLvot, vtiAv }) {
  need('LVOT VTI', vtiLvot, { gt: 0, max: 60 });
  need('aortic valve VTI', vtiAv, { gt: 0, max: 200 });
  return (lvotArea(lvotDcm) * vtiLvot) / vtiAv;
}

export function dvi({ vtiLvot, vtiAv }) {
  need('LVOT VTI', vtiLvot, { gt: 0, max: 60 });
  need('aortic valve VTI', vtiAv, { gt: 0, max: 200 });
  return vtiLvot / vtiAv;
}

// Simplified Bernoulli: peak gradient (mmHg) = 4 x velocity (m/s) squared
export function bernoulli(vMs) {
  need('velocity', vMs, { min: 0, max: 12 });
  return 4 * vMs * vMs;
}

// Which severe-AS criteria are met. Any argument may be null/undefined (then that flag is null).
export function asSevereFlags({ vmax = null, meanGradient = null, ava = null, avai = null, dvi: d = null }) {
  const f = (v, test) => (v === null || v === undefined ? null : test(v));
  return {
    vmax: f(vmax, (v) => v >= 4.0),
    meanGradient: f(meanGradient, (v) => v >= 40),
    ava: f(ava, (v) => v <= 1.0),
    avai: f(avai, (v) => v <= 0.6),
    dvi: f(d, (v) => v < 0.25),
  };
}

// ---------------------------------------------------------------- scores

// HAS-BLED. "Elderly" means age above 65. Renal and liver are separate items (1 point each), as are drugs and alcohol.
export function hasBled({ htnUncontrolled, renal, liver, stroke, bleeding, labileInr, drugs, alcohol, age }) {
  need('age', age, { min: 0, max: 130 });
  const b = (v) => (v ? 1 : 0);
  const score = b(htnUncontrolled) + b(renal) + b(liver) + b(stroke) + b(bleeding) + b(labileInr) + (age > 65 ? 1 : 0) + b(drugs) + b(alcohol);
  return { score, high: score >= 3 };
}

// TIMI UA/NSTEMI: 7 items, 1 point each. 14-day rate of death, MI or urgent revascularisation (%).
const TIMI_NSTE_RISK = [4.7, 4.7, 8.3, 13.2, 19.9, 26.2, 40.9, 40.9];
export function timiNste({ age65, rf3, knownCad, aspirin7d, angina2, stDev, marker }) {
  const score = [age65, rf3, knownCad, aspirin7d, angina2, stDev, marker].filter(Boolean).length;
  return { score, risk14d: TIMI_NSTE_RISK[score] };
}

// TIMI risk index for STEMI: max 14. 30-day mortality (%), score >8 pooled as one group.
const TIMI_STEMI_MORT = [0.8, 1.6, 2.2, 4.4, 7.3, 12.4, 16.1, 23.4, 26.8];
export function timiStemi({ age, dmHtnAngina, sbpLt100, hrGt100, killip2to4, wtLt67, anteriorOrLbbb, timeGt4h }) {
  need('age', age, { min: 0, max: 130 });
  const b = (v) => (v ? 1 : 0);
  const score = (age >= 75 ? 3 : age >= 65 ? 2 : 0) + b(dmHtnAngina) + 3 * b(sbpLt100) + 2 * b(hrGt100) + 2 * b(killip2to4) + b(wtLt67) + b(anteriorOrLbbb) + b(timeGt4h);
  return { score, mortality30d: score > 8 ? 35.9 : TIMI_STEMI_MORT[score] };
}

// HEART: history/ECG/troponin are entered as 0-2 (the clinician's grading); age and risk factors are derived.
// Risk factors: 0 -> 0, 1-2 -> 1, >=3 or known atherosclerotic disease -> 2.
export function heart({ history, ecg, age, riskCount, atherosclerotic, troponin }) {
  for (const [n, v] of [['history', history], ['ECG', ecg], ['troponin', troponin]]) need(n, v, { min: 0, max: 2 });
  need('age', age, { min: 0, max: 130 });
  need('risk factors', riskCount, { min: 0, max: 10 });
  const ageP = age >= 65 ? 2 : age >= 45 ? 1 : 0;
  const riskP = atherosclerotic || riskCount >= 3 ? 2 : riskCount >= 1 ? 1 : 0;
  const score = history + ecg + ageP + riskP + troponin;
  return { score, category: score >= 7 ? 'high' : score >= 4 ? 'moderate' : 'low' };
}

// Wells PE. Items: clinical signs of DVT 3, PE most likely diagnosis 3, HR>100 1.5, immobilisation or surgery in prior 4 weeks 1.5,
// previous PE/DVT 1.5, haemoptysis 1, malignancy 1. Three-tier: <2 low, 2-6 moderate, >6 high. Two-tier: <=4 unlikely, >4 likely.
export function wellsPe({ dvtSigns, peLikely, hr100, immobilised, prevVte, hemoptysis, malignancy }) {
  const score = (dvtSigns ? 3 : 0) + (peLikely ? 3 : 0) + (hr100 ? 1.5 : 0) + (immobilised ? 1.5 : 0) + (prevVte ? 1.5 : 0) + (hemoptysis ? 1 : 0) + (malignancy ? 1 : 0);
  return { score, tier3: score > 6 ? 'high' : score >= 2 ? 'moderate' : 'low', tier2: score > 4 ? 'likely' : 'unlikely' };
}

// sPESI: age >80, cancer, chronic cardiopulmonary disease, HR >=110, SBP <100, SaO2 <90%. 0 = low risk, >=1 = high risk.
export function spesi({ age, cancer, cardiopulm, hr, sbp, spo2 }) {
  need('age', age, { min: 0, max: 130 });
  need('heart rate', hr, { gt: 0, max: 300 });
  need('systolic BP', sbp, { gt: 0, max: 300 });
  need('SpO2', spo2, { gt: 0, max: 100 });
  const score = (age > 80 ? 1 : 0) + (cancer ? 1 : 0) + (cardiopulm ? 1 : 0) + (hr >= 110 ? 1 : 0) + (sbp < 100 ? 1 : 0) + (spo2 < 90 ? 1 : 0);
  return { score, risk: score === 0 ? 'low' : 'high' };
}

// ARC-HBR: high bleeding risk when at least 1 major or at least 2 minor criteria are present.
export function arcHbr({ major, minor }) {
  need('major criteria', major, { min: 0, max: 50 });
  need('minor criteria', minor, { min: 0, max: 50 });
  return { hbr: major >= 1 || minor >= 2, major, minor };
}

const KILLIP = {
  1: 'No clinical signs of heart failure.',
  2: 'Rales or crackles in the lungs, S3 gallop and/or raised jugular venous pressure.',
  3: 'Frank acute pulmonary oedema.',
  4: 'Cardiogenic shock: hypotension (systolic BP below 90 mmHg) with signs of peripheral vasoconstriction such as oliguria, cyanosis or sweating.',
};
export function killip(cls) {
  if (!Number.isInteger(cls) || cls < 1 || cls > 4) throw new RangeError('Killip class must be 1, 2, 3 or 4');
  return { cls, description: KILLIP[cls] };
}

// ---------------------------------------------------------------- drugs (stage 3)

// CKD-EPI 2021 (race-free) creatinine equation, mL/min/1.73 m2.
export function ckdEpi2021({ age, creatMgDl, female }) {
  need('age', age, { min: 18, max: 130 });
  need('creatinine', creatMgDl, { gt: 0, max: 50 });
  const kappa = female ? 0.7 : 0.9;
  const alpha = female ? -0.241 : -0.302;
  const r = creatMgDl / kappa;
  return 142 * Math.min(r, 1) ** alpha * Math.max(r, 1) ** -1.2 * 0.9938 ** age * (female ? 1.012 : 1);
}

// Infusion arithmetic. All in mcg so the caller converts mg/kg/min etc. first.
export function concentrationMcgPerMl({ amountMg, volumeMl }) {
  need('drug amount', amountMg, { gt: 0 });
  need('volume', volumeMl, { gt: 0 });
  return (amountMg * 1000) / volumeMl;
}
export function infusionRate({ doseMcgPerMin, concMcgPerMl }) {
  need('dose', doseMcgPerMin, { min: 0 });
  need('concentration', concMcgPerMl, { gt: 0 });
  return (doseMcgPerMin * 60) / concMcgPerMl;            // mL/h
}
export function infusionDose({ rateMlPerH, concMcgPerMl }) {
  need('pump rate', rateMlPerH, { min: 0 });
  need('concentration', concMcgPerMl, { gt: 0 });
  return (rateMlPerH * concMcgPerMl) / 60;               // mcg/min
}

// Unfractionated heparin in ACS.
export function ufhPci({ weightKg }) {
  need('weight', weightKg, { gt: 0, max: 500 });
  return { lowIu: 70 * weightKg, highIu: 100 * weightKg };
}
export function ufhLysis({ weightKg }) {
  need('weight', weightKg, { gt: 0, max: 500 });
  const bolus = 60 * weightKg;
  const infusion = 12 * weightKg;
  return {
    bolusIu: Math.min(bolus, 4000),
    infusionIuPerH: Math.min(infusion, 1000),
    bolusCapped: bolus > 4000,
    infusionCapped: infusion > 1000,
  };
}

// Tenecteplase single IV bolus by weight band; half dose at age >=75.
export function tenecteplase({ weightKg, age }) {
  need('weight', weightKg, { gt: 0, max: 500 });
  need('age', age, { min: 18, max: 130 });
  const fullMg = weightKg < 60 ? 30 : weightKg < 70 ? 35 : weightKg < 80 ? 40 : weightKg < 90 ? 45 : 50;
  const halfDose = age >= 75;
  return { fullMg, halfDose, doseMg: halfDose ? fullMg / 2 : fullMg };
}

// Enoxaparin in ACS. setting: 'nste' | 'stemi-lysis'. crcl in mL/min.
export function enoxaparinAcs({ setting, age, weightKg, crcl }) {
  if (setting !== 'nste' && setting !== 'stemi-lysis') throw new RangeError('setting must be nste or stemi-lysis');
  need('age', age, { min: 18, max: 130 });
  need('weight', weightKg, { gt: 0, max: 500 });
  need('creatinine clearance', crcl, { gt: 0 });
  if (crcl < 15) return { status: 'not-calculated', reason: 'CrCl below 15 mL/min is outside the dosing in the product label.' };
  const intervalH = crcl < 30 ? 24 : 12;
  if (setting === 'nste') return { status: 'ok', bolusMg: 0, scMg: weightKg, firstTwoMaxMg: null, intervalH };
  if (age < 75) return { status: 'ok', bolusMg: 30, scMg: weightKg, firstTwoMaxMg: 100, intervalH };
  if (crcl < 30) return { status: 'not-calculated', reason: 'Age 75 or older with CrCl below 30 mL/min: the label text and its own dosage table give different doses, so no dose is calculated here.' };
  return { status: 'ok', bolusMg: 0, scMg: 0.75 * weightKg, firstTwoMaxMg: 75, intervalH };
}

// DOAC dose for stroke prevention in AF. crcl from Cockcroft-Gault with actual weight (as in the trials and labels).
export function doacAf({ drug, age, weightKg, creatMgDl, crcl, pgpInhibitor = false, verapamil = false }) {
  const DRUGS = ['apixaban', 'rivaroxaban', 'edoxaban', 'dabigatran'];
  if (!DRUGS.includes(drug)) throw new RangeError('drug must be apixaban, rivaroxaban, edoxaban or dabigatran');
  need('age', age, { min: 18, max: 130 });
  need('weight', weightKg, { gt: 0, max: 500 });
  need('creatinine', creatMgDl, { gt: 0, max: 50 });
  need('creatinine clearance', crcl, { gt: 0 });
  const name = drug[0].toUpperCase() + drug.slice(1);
  if (drug === 'dabigatran' && crcl < 30) return { drug: drug[0].toUpperCase() + drug.slice(1), status: 'contraindicated', reduced: null, dose: null, reasons: ['CrCl below 30 mL/min: dabigatran is contraindicated (SmPC)'] };
  if (crcl < 15) return { drug: drug[0].toUpperCase() + drug.slice(1), status: 'not-calculated', reduced: null, dose: null, reasons: ['CrCl below 15 mL/min is outside the dose criteria used here'] };
  const reasons = [];
  let reduced = false;
  let dose;
  if (drug === 'apixaban') {
    const hits = [];
    if (age >= 80) hits.push('age 80 or older');
    if (weightKg <= 60) hits.push('weight 60 kg or less');
    if (creatMgDl >= 1.5) hits.push('creatinine 1.5 mg/dL (133 µmol/L) or more');
    if (hits.length >= 2) { reduced = true; reasons.push(`2 of 3 criteria met: ${hits.join(', ')}`); }
    if (crcl < 30) { reduced = true; reasons.push('CrCl 15-29 mL/min'); }
    dose = reduced ? 'Apixaban 2.5 mg twice daily' : 'Apixaban 5 mg twice daily';
  } else if (drug === 'rivaroxaban') {
    if (crcl < 50) { reduced = true; reasons.push('CrCl 15-49 mL/min'); }
    dose = reduced ? 'Rivaroxaban 15 mg once daily' : 'Rivaroxaban 20 mg once daily';
  } else if (drug === 'edoxaban') {
    if (weightKg <= 60) { reduced = true; reasons.push('weight 60 kg or less'); }
    if (crcl < 50) { reduced = true; reasons.push('CrCl 15-49 mL/min'); }
    if (pgpInhibitor) { reduced = true; reasons.push('concomitant strong P-gp inhibitor'); }
    dose = reduced ? 'Edoxaban 30 mg once daily' : 'Edoxaban 60 mg once daily';
  } else {
    if (age >= 80) { reduced = true; reasons.push('age 80 or older'); }
    if (verapamil) { reduced = true; reasons.push('concomitant verapamil'); }
    dose = reduced ? 'Dabigatran 110 mg twice daily' : 'Dabigatran 150 mg twice daily';
  }
  return { drug: name, status: 'ok', reduced, dose, reasons };
}
