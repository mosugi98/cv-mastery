// Declarative calculator definitions. The screen reads only this file; the maths lives in calc-core.js.
//
// Input types
//   number : { key, label, type:'number', unit?, min?, max?, step?, required?, requiredIf?(values), hint?,
//              units?: [{ id, label, toBase, min, max }] }   toBase converts the typed value to the base unit.
//   check  : { key, label, type:'check', hint? }
//   choice : { key, label, type:'choice', options:[{value,label}], required?, default? }
// compute(values) receives numbers in the base unit, booleans and strings. It returns
//   { primary:{label,value,digits,unit}, secondary:[{label,value,digits,unit}], category, flags:[{label,met}], note }
// or { error:'message' } when the combination of inputs cannot be calculated.

import * as c from './calc-core.js';

export const GROUPS = [
  { id: 'scores', label: 'Scores', blurb: 'Risk and probability scores' },
  { id: 'drugs', label: 'Drugs', blurb: 'Renal function and dosing' },
  { id: 'echo', label: 'Echo', blurb: 'Echocardiography measurements' },
];

const SEX = {
  key: 'sex', label: 'Sex', type: 'choice', required: true,
  options: [{ value: 'f', label: 'Female' }, { value: 'm', label: 'Male' }],
};

const cha2ds2vasc = {
  id: 'cha2ds2-vasc', group: 'scores', title: 'CHA₂DS₂-VASc and CHA₂DS₂-VA',
  summary: 'Stroke risk in atrial fibrillation (ESC 2024 uses the VA version without sex).',
  inputs: [
    { key: 'age', label: 'Age', type: 'number', unit: 'years', min: 18, max: 120, step: 1, required: true },
    SEX,
    { key: 'chf', label: 'Heart failure', type: 'check', hint: 'Symptoms and signs of HF at any LVEF, or asymptomatic LVEF 40% or lower' },
    { key: 'htn', label: 'Hypertension', type: 'check', hint: 'Resting BP above 140/90 mmHg on at least two occasions, or on treatment' },
    { key: 'dm', label: 'Diabetes mellitus', type: 'check' },
    { key: 'stroke', label: 'Prior stroke, TIA or arterial thromboembolism', type: 'check' },
    { key: 'vascular', label: 'Vascular disease', type: 'check', hint: 'Coronary or peripheral artery disease, or complex aortic plaque' },
  ],
  compute: (v) => {
    const r = c.cha2ds2vasc({ chf: v.chf, htn: v.htn, age: v.age, dm: v.dm, stroke: v.stroke, vascular: v.vascular, female: v.sex === 'f' });
    const category = r.score_va >= 2
      ? 'CHA₂DS₂-VA 2 or more: oral anticoagulation is recommended (ESC 2024)'
      : r.score_va === 1
        ? 'CHA₂DS₂-VA 1: oral anticoagulation should be considered, by shared decision (ESC 2024)'
        : 'CHA₂DS₂-VA 0: no stroke-risk factor counted by the VA score';
    return {
      primary: { label: 'CHA₂DS₂-VASc', value: r.score, digits: 0, unit: 'points' },
      secondary: [{ label: 'CHA₂DS₂-VA (no sex category)', value: r.score_va, digits: 0, unit: 'points' }],
      category,
      note: 'Bleeding risk is assessed separately. A score supports, and does not replace, clinical judgement.',
    };
  },
  howTo: {
    formula: [
      'Heart failure +1, hypertension +1, diabetes +1, vascular disease +1',
      'Age 65-74 +1, age 75 or older +2',
      'Prior stroke, TIA or arterial thromboembolism +2',
      'Female sex +1 (CHA₂DS₂-VASc only; removed in CHA₂DS₂-VA)',
    ],
    references: [
      'Lip GYH, et al. Chest 2010;137:263-272 (CHA₂DS₂-VASc)',
      '2024 ESC Guidelines for the management of atrial fibrillation, Table 10 (CHA₂DS₂-VA; thresholds for oral anticoagulation)',
    ],
  },
};

const cockcroft = {
  id: 'cockcroft-gault', group: 'drugs', title: 'Creatinine clearance (Cockcroft-Gault)',
  summary: 'Estimated CrCl in mL/min, the measure most drug labels use for dose adjustment.',
  inputs: [
    { key: 'age', label: 'Age', type: 'number', unit: 'years', min: 18, max: 120, step: 1, required: true },
    SEX,
    { key: 'weight', label: 'Actual body weight', type: 'number', unit: 'kg', min: 20, max: 300, step: 0.1, required: true },
    {
      key: 'creat', label: 'Serum creatinine', type: 'number', required: true,
      units: [
        { id: 'mgdl', label: 'mg/dL', toBase: 1, min: 0.2, max: 20, step: 0.01 },
        { id: 'umol', label: 'µmol/L', toBase: 1 / 88.4, min: 18, max: 1768, step: 1 },
      ],
    },
    {
      key: 'basis', label: 'Weight used in the formula', type: 'choice', default: 'actual', required: true,
      options: [
        { value: 'actual', label: 'Actual weight' },
        { value: 'ideal', label: 'Ideal weight' },
        { value: 'adjusted', label: 'Adjusted weight' },
      ],
    },
    {
      key: 'height', label: 'Height', type: 'number', unit: 'cm', min: 100, max: 250, step: 1,
      requiredIf: (v) => v.basis !== 'actual', hint: 'Needed only for ideal or adjusted weight',
    },
  ],
  compute: (v) => {
    const female = v.sex === 'f';
    let w = v.weight;
    let wlabel = 'actual weight';
    let ibw = null;
    if (v.basis !== 'actual') {
      ibw = c.idealBodyWeight({ heightCm: v.height, female });
      if (ibw <= 0) return { error: 'Ideal body weight is not defined for this height' };
      if (v.basis === 'ideal') { w = ibw; wlabel = 'ideal weight'; }
      else { w = c.adjustedBodyWeight({ ibw, actual: v.weight }); wlabel = 'adjusted weight'; }
    }
    const crcl = c.cockcroftGault({ age: v.age, weightKg: w, creatMgDl: v.creat, female });
    const secondary = [{ label: `Weight used (${wlabel})`, value: w, digits: 1, unit: 'kg' }];
    if (ibw !== null) secondary.push({ label: 'Ideal body weight (Devine)', value: ibw, digits: 1, unit: 'kg' });
    return {
      primary: { label: 'Creatinine clearance', value: crcl, digits: 0, unit: 'mL/min' },
      secondary,
      note: 'Use the weight basis that the drug label or guideline you are following specifies. The formula was derived in adults with stable creatinine.',
    };
  },
  howTo: {
    formula: [
      'CrCl = (140 - age) × weight ÷ (72 × creatinine in mg/dL)',
      'Multiply by 0.85 for women',
      'Creatinine in µmol/L is divided by 88.4 to give mg/dL',
      'Ideal weight (Devine) = 50 kg (men) or 45.5 kg (women) + 2.3 kg per inch of height above 60 inches',
      'Adjusted weight = ideal weight + 0.4 × (actual weight - ideal weight)',
    ],
    references: [
      'Cockcroft DW, Gault MH. Nephron 1976;16:31-41',
      'Devine BJ. Drug Intell Clin Pharm 1974;8:650-655',
    ],
  },
};

const lvotSv = {
  id: 'lvot-sv', group: 'echo', title: 'Stroke volume and cardiac output (LVOT)',
  summary: 'SV, CO and indexed values from the LVOT diameter and pulsed-wave VTI.',
  inputs: [
    { key: 'd', label: 'LVOT diameter', type: 'number', unit: 'cm', min: 1, max: 3.5, step: 0.01, required: true, hint: 'Parasternal long axis, mid-systole' },
    { key: 'vti', label: 'LVOT VTI', type: 'number', unit: 'cm', min: 5, max: 40, step: 0.1, required: true, hint: 'Pulsed-wave Doppler, apical 5- or 3-chamber' },
    { key: 'hr', label: 'Heart rate', type: 'number', unit: 'bpm', min: 20, max: 250, step: 1 },
    { key: 'height', label: 'Height', type: 'number', unit: 'cm', min: 100, max: 250, step: 1, hint: 'With weight, gives the indexed values' },
    { key: 'weight', label: 'Weight', type: 'number', unit: 'kg', min: 20, max: 300, step: 0.1 },
  ],
  compute: (v) => {
    const sv = c.strokeVolume({ lvotDcm: v.d, vtiCm: v.vti });
    const secondary = [{ label: 'LVOT area', value: c.lvotArea(v.d), digits: 2, unit: 'cm²' }];
    let category;
    let bsa = null;
    if (v.height && v.weight) {
      bsa = c.bsaMosteller({ heightCm: v.height, weightKg: v.weight });
      secondary.push({ label: 'BSA (Mosteller)', value: bsa, digits: 2, unit: 'm²' });
      const svi = sv / bsa;
      secondary.push({ label: 'Stroke volume index', value: svi, digits: 1, unit: 'mL/m²' });
      category = svi <= 35 ? 'SVi 35 mL/m² or lower: low flow (criterion used for low-flow aortic stenosis, ESC/EACTS 2021)' : 'SVi above 35 mL/m²: not low flow by this criterion';
    }
    if (v.hr) {
      const co = c.cardiacOutput({ svMl: sv, hr: v.hr });
      secondary.push({ label: 'Cardiac output', value: co, digits: 1, unit: 'L/min' });
      if (bsa) secondary.push({ label: 'Cardiac index', value: co / bsa, digits: 1, unit: 'L/min/m²' });
    }
    return {
      primary: { label: 'Stroke volume', value: sv, digits: 0, unit: 'mL' },
      secondary,
      category,
      note: 'Assumes a circular LVOT; an elliptical LVOT makes the area, and so SV, underestimated.',
    };
  },
  howTo: {
    formula: [
      'LVOT area = π × (diameter ÷ 2)²',
      'Stroke volume = LVOT area × LVOT VTI',
      'Cardiac output = stroke volume × heart rate ÷ 1000',
      'Indexed values = value ÷ BSA; BSA (Mosteller) = √(height in cm × weight in kg ÷ 3600)',
    ],
    references: [
      'Baumgartner H, et al. EACVI/ASE focused update on aortic stenosis. Eur Heart J Cardiovasc Imaging 2017 (doi:10.1093/ehjci/jew335)',
      '2021 ESC/EACTS Guidelines for valvular heart disease, section 5.1.1 (SVi 35 mL/m² or lower = low flow)',
    ],
  },
};

const avaCont = {
  id: 'ava-continuity', group: 'echo', title: 'Aortic valve area (continuity equation)',
  summary: 'AVA, indexed AVA, dimensionless index and the severe-stenosis criteria.',
  inputs: [
    { key: 'd', label: 'LVOT diameter', type: 'number', unit: 'cm', min: 1, max: 3.5, step: 0.01, required: true },
    { key: 'vtiLvot', label: 'LVOT VTI', type: 'number', unit: 'cm', min: 5, max: 40, step: 0.1, required: true },
    { key: 'vtiAv', label: 'Aortic valve VTI', type: 'number', unit: 'cm', min: 10, max: 200, step: 0.1, required: true, hint: 'Continuous-wave Doppler' },
    { key: 'vmax', label: 'Peak aortic jet velocity', type: 'number', unit: 'm/s', min: 0.5, max: 8, step: 0.01, hint: 'Optional; adds the peak gradient and the velocity criterion' },
    { key: 'mg', label: 'Mean gradient', type: 'number', unit: 'mmHg', min: 1, max: 200, step: 1, hint: 'Optional; adds the gradient criterion' },
    { key: 'height', label: 'Height', type: 'number', unit: 'cm', min: 100, max: 250, step: 1, hint: 'With weight, gives the indexed AVA' },
    { key: 'weight', label: 'Weight', type: 'number', unit: 'kg', min: 20, max: 300, step: 0.1 },
  ],
  compute: (v) => {
    const ava = c.avaContinuity({ lvotDcm: v.d, vtiLvot: v.vtiLvot, vtiAv: v.vtiAv });
    const dvi = c.dvi({ vtiLvot: v.vtiLvot, vtiAv: v.vtiAv });
    const secondary = [{ label: 'Dimensionless index (VTI ratio)', value: dvi, digits: 2, unit: '' }];
    let avai = null;
    if (v.height && v.weight) {
      const bsa = c.bsaMosteller({ heightCm: v.height, weightKg: v.weight });
      avai = ava / bsa;
      secondary.push({ label: 'Indexed AVA', value: avai, digits: 2, unit: 'cm²/m²' });
    }
    if (v.vmax) secondary.push({ label: 'Peak gradient (4v²)', value: c.bernoulli(v.vmax), digits: 0, unit: 'mmHg' });
    const flags = c.asSevereFlags({ vmax: v.vmax ?? null, meanGradient: v.mg ?? null, ava, avai, dvi });
    const rows = [
      { label: 'Peak velocity 4.0 m/s or more', met: flags.vmax },
      { label: 'Mean gradient 40 mmHg or more', met: flags.meanGradient },
      { label: 'AVA 1.0 cm² or less', met: flags.ava },
      { label: 'Indexed AVA 0.6 cm²/m² or less', met: flags.avai },
      { label: 'Dimensionless index below 0.25 (supportive)', met: flags.dvi },
    ].filter((r) => r.met !== null);
    return {
      primary: { label: 'Aortic valve area', value: ava, digits: 2, unit: 'cm²' },
      secondary,
      flags: rows,
      category: 'Severe-stenosis criteria shown below, met or not met',
      note: 'AVA 1.0 cm² or less with a mean gradient below 40 mmHg and Vmax below 4.0 m/s is discordant: check flow (stroke volume index) and measurement error before calling it severe (ESC/EACTS 2021, 5.1.1).',
    };
  },
  howTo: {
    formula: [
      'AVA = LVOT area × LVOT VTI ÷ aortic valve VTI, with LVOT area = π × (LVOT diameter ÷ 2)²',
      'Dimensionless index = LVOT VTI ÷ aortic valve VTI',
      'Indexed AVA = AVA ÷ BSA (Mosteller)',
      'Peak gradient = 4 × velocity² (simplified Bernoulli)',
    ],
    references: [
      '2021 ESC/EACTS Guidelines for valvular heart disease, sections 5.1.1 (mean gradient ≥40 mmHg, Vmax ≥4.0 m/s, AVA ≤1 cm² or ≤0.6 cm²/m²) and 5.1.2 (dimensionless index <0.25)',
      'Baumgartner H, et al. EACVI/ASE focused update on aortic stenosis. Eur Heart J Cardiovasc Imaging 2017 (doi:10.1093/ehjci/jew335)',
    ],
  },
};

export const CALCULATORS = [cha2ds2vasc, cockcroft, lvotSv, avaCont];
