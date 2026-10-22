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


// ------------------------------------------------------------------ scores (stage 2)

const hasBled = {
  id: 'has-bled', group: 'scores', title: 'HAS-BLED',
  summary: 'Bleeding risk on anticoagulation in AF; flags modifiable factors.',
  inputs: [
    { key: 'age', label: 'Age', type: 'number', unit: 'years', min: 18, max: 120, step: 1, required: true },
    { key: 'htnUncontrolled', label: 'Uncontrolled hypertension', type: 'check', hint: 'Systolic BP above 160 mmHg' },
    { key: 'renal', label: 'Abnormal renal function', type: 'check', hint: 'Dialysis, transplant, or creatinine above 200 µmol/L (2.26 mg/dL)' },
    { key: 'liver', label: 'Abnormal liver function', type: 'check', hint: 'Cirrhosis, or bilirubin above 2× normal with AST/ALT/ALP above 3× normal' },
    { key: 'stroke', label: 'Prior stroke', type: 'check' },
    { key: 'bleeding', label: 'Bleeding history or predisposition', type: 'check', hint: 'Prior major bleeding, anaemia or bleeding diathesis' },
    { key: 'labileInr', label: 'Labile INR', type: 'check', hint: 'Time in therapeutic range below 60%; only if on a vitamin K antagonist' },
    { key: 'drugs', label: 'Drugs predisposing to bleeding', type: 'check', hint: 'Antiplatelets or NSAIDs' },
    { key: 'alcohol', label: 'Alcohol excess', type: 'check', hint: '8 or more drinks per week' },
  ],
  compute: (v) => {
    const r = c.hasBled(v);
    return {
      primary: { label: 'HAS-BLED', value: r.score, digits: 0, unit: 'points' },
      category: r.high
        ? 'Score 3 or more: high bleeding risk. Address modifiable factors and review more often; it is not a reason on its own to withhold anticoagulation.'
        : 'Score below 3: not high bleeding risk by this score. Modifiable factors are still worth correcting.',
      note: 'Age counts as "elderly" above 65 years. Use alongside, never instead of, the stroke-risk assessment.',
    };
  },
  howTo: {
    formula: [
      'One point each: uncontrolled hypertension, abnormal renal function, abnormal liver function, prior stroke, bleeding history, labile INR, age above 65, drugs, alcohol',
      'Maximum 9 points; 3 or more = high risk',
    ],
    references: ['Pisters R, et al. Chest 2010;138:1093-1100'],
  },
};

const timiNste = {
  id: 'timi-nste', group: 'scores', title: 'TIMI risk score (UA/NSTEMI)',
  summary: '14-day death, MI or urgent revascularisation in unstable angina / NSTEMI.',
  inputs: [
    { key: 'age65', label: 'Age 65 or older', type: 'check' },
    { key: 'rf3', label: '3 or more coronary risk factors', type: 'check', hint: 'Family history, hypertension, hypercholesterolaemia, diabetes, current smoker' },
    { key: 'knownCad', label: 'Known coronary stenosis of 50% or more', type: 'check' },
    { key: 'aspirin7d', label: 'Aspirin use in the past 7 days', type: 'check' },
    { key: 'angina2', label: 'Severe angina: 2 or more episodes in 24 hours', type: 'check' },
    { key: 'stDev', label: 'ST deviation of 0.5 mm or more', type: 'check' },
    { key: 'marker', label: 'Elevated cardiac marker', type: 'check' },
  ],
  compute: (v) => {
    const r = c.timiNste(v);
    return {
      primary: { label: 'TIMI (UA/NSTEMI)', value: r.score, digits: 0, unit: 'of 7 points' },
      secondary: [{ label: '14-day death, MI or urgent revascularisation (original cohort)', value: r.risk14d, digits: 1, unit: '%' }],
      note: 'Rates come from the 2000 derivation and validation cohorts (scores 0-1 and 6-7 are pooled). Current ESC/ACC/AHA pathways use troponin and GRACE for decisions; TIMI is shown for teaching and exam use.',
    };
  },
  howTo: {
    formula: ['One point per item, 7 items', 'Event rate by score: 0-1 = 4.7%, 2 = 8.3%, 3 = 13.2%, 4 = 19.9%, 5 = 26.2%, 6-7 = 40.9%'],
    references: ['Antman EM, et al. JAMA 2000;284:835-842'],
  },
};

const timiStemi = {
  id: 'timi-stemi', group: 'scores', title: 'TIMI risk index (STEMI)',
  summary: '30-day mortality after STEMI from bedside variables.',
  inputs: [
    { key: 'age', label: 'Age', type: 'number', unit: 'years', min: 18, max: 120, step: 1, required: true, hint: '65-74 = 2 points, 75 or older = 3 points' },
    { key: 'dmHtnAngina', label: 'Diabetes, hypertension or angina', type: 'check' },
    { key: 'sbpLt100', label: 'Systolic BP below 100 mmHg', type: 'check' },
    { key: 'hrGt100', label: 'Heart rate above 100 bpm', type: 'check' },
    { key: 'killip2to4', label: 'Killip class II-IV', type: 'check' },
    { key: 'wtLt67', label: 'Weight below 67 kg', type: 'check' },
    { key: 'anteriorOrLbbb', label: 'Anterior ST elevation or LBBB', type: 'check' },
    { key: 'timeGt4h', label: 'Time to treatment above 4 hours', type: 'check' },
  ],
  compute: (v) => {
    const r = c.timiStemi(v);
    return {
      primary: { label: 'TIMI risk index (STEMI)', value: r.score, digits: 0, unit: 'of 14 points' },
      secondary: [{ label: '30-day mortality (original cohort)', value: r.mortality30d, digits: 1, unit: '%' }],
      note: 'Derived in fibrinolysis-era trials (InTIME II). Scores above 8 share one mortality estimate.',
    };
  },
  howTo: {
    formula: [
      'Age 65-74 +2, age 75 or older +3',
      'Diabetes / hypertension / angina +1; systolic BP below 100 +3; heart rate above 100 +2; Killip II-IV +2',
      'Weight below 67 kg +1; anterior ST elevation or LBBB +1; time to treatment above 4 h +1',
      '30-day mortality by score: 0 = 0.8%, 1 = 1.6%, 2 = 2.2%, 3 = 4.4%, 4 = 7.3%, 5 = 12.4%, 6 = 16.1%, 7 = 23.4%, 8 = 26.8%, above 8 = 35.9%',
    ],
    references: ['Morrow DA, et al. Circulation 2000;102:2031-2037'],
  },
};

const GRADE = (key, label, hint, opts) => ({
  key, label, type: 'choice', required: true, hint,
  options: opts.map((o, i) => ({ value: String(i), label: o })),
});

const heart = {
  id: 'heart', group: 'scores', title: 'HEART score',
  summary: 'Chest pain in the emergency department: short-term MACE risk group.',
  inputs: [
    GRADE('history', 'History', 'Clinician judgement of how typical the story is for ACS', ['Slightly suspicious (0)', 'Moderately suspicious (1)', 'Highly suspicious (2)']),
    GRADE('ecg', 'ECG', null, ['Normal (0)', 'Non-specific repolarisation disturbance (1)', 'Significant ST deviation (2)']),
    { key: 'age', label: 'Age', type: 'number', unit: 'years', min: 18, max: 120, step: 1, required: true, hint: 'Under 45 = 0, 45-64 = 1, 65 or older = 2' },
    { key: 'riskCount', label: 'Number of risk factors', type: 'number', min: 0, max: 6, step: 1, required: true, hint: 'Hypertension, hypercholesterolaemia, diabetes, obesity (BMI above 30), smoking (current or quit within 3 months), positive family history' },
    { key: 'atherosclerotic', label: 'Known atherosclerotic disease', type: 'check', hint: 'Prior MI, PCI/CABG, stroke/TIA or peripheral artery disease; scores the maximum for risk factors' },
    GRADE('troponin', 'Troponin', null, ['At or below normal limit (0)', '1-3× normal limit (1)', 'Above 3× normal limit (2)']),
  ],
  compute: (v) => {
    const r = c.heart({ history: Number(v.history), ecg: Number(v.ecg), age: v.age, riskCount: v.riskCount, atherosclerotic: v.atherosclerotic, troponin: Number(v.troponin) });
    const cat = {
      low: 'Score 0-3: low-risk group. In the derivation work, such patients were candidates for early discharge when serial troponin is also reassuring.',
      moderate: 'Score 4-6: intermediate-risk group. Observation and further testing are usually needed.',
      high: 'Score 7-10: high-risk group. Early invasive strategy is usually considered.',
    };
    return {
      primary: { label: 'HEART score', value: r.score, digits: 0, unit: 'of 10 points' },
      category: cat[r.category],
      note: 'History and ECG grades are clinical judgements; the score does not replace the ESC 0/1-h or 0/2-h troponin pathway.',
    };
  },
  howTo: {
    formula: [
      'History, ECG and troponin: 0-2 points each',
      'Age: under 45 = 0, 45-64 = 1, 65 or older = 2',
      'Risk factors: none = 0, 1-2 = 1, 3 or more or known atherosclerotic disease = 2',
      'Groups: 0-3 low, 4-6 intermediate, 7-10 high',
    ],
    references: ['Six AJ, Backus BE, Kelder JC. Neth Heart J 2008;16:191-196'],
  },
};

const wellsPe = {
  id: 'wells-pe', group: 'scores', title: 'Wells score for pulmonary embolism',
  summary: 'Pre-test probability of PE, three-level and two-level interpretation.',
  inputs: [
    { key: 'dvtSigns', label: 'Clinical signs and symptoms of DVT', type: 'check', hint: '3 points' },
    { key: 'peLikely', label: 'PE is the most likely diagnosis, or equally likely', type: 'check', hint: '3 points' },
    { key: 'hr100', label: 'Heart rate above 100 bpm', type: 'check', hint: '1.5 points' },
    { key: 'immobilised', label: 'Immobilisation (3 days or more) or surgery in the previous 4 weeks', type: 'check', hint: '1.5 points' },
    { key: 'prevVte', label: 'Previous PE or DVT', type: 'check', hint: '1.5 points' },
    { key: 'hemoptysis', label: 'Haemoptysis', type: 'check', hint: '1 point' },
    { key: 'malignancy', label: 'Malignancy on treatment, treated in the last 6 months, or palliative', type: 'check', hint: '1 point' },
  ],
  compute: (v) => {
    const r = c.wellsPe(v);
    const t3 = { low: 'low', moderate: 'moderate', high: 'high' }[r.tier3];
    return {
      primary: { label: 'Wells score (PE)', value: r.score, digits: 1, unit: 'points' },
      secondary: [
        { label: 'Three-level probability', text: t3 },
        { label: 'Two-level probability', text: r.tier2 === 'likely' ? 'PE likely (above 4)' : 'PE unlikely (4 or below)' },
      ],
      category: r.tier2 === 'unlikely'
        ? 'PE unlikely: a D-dimer can be used to exclude PE (ESC 2019).'
        : 'PE likely: proceed to imaging (CT pulmonary angiography); D-dimer is not used to exclude PE.',
      note: 'Three-level bands: below 2 low, 2-6 moderate, above 6 high. Haemodynamically unstable patients follow a separate pathway.',
    };
  },
  howTo: {
    formula: [
      'DVT signs +3, PE most likely +3, heart rate above 100 +1.5, immobilisation or recent surgery +1.5, previous VTE +1.5, haemoptysis +1, malignancy +1',
      'Three-level: below 2 low, 2-6 moderate, above 6 high. Two-level: 4 or below unlikely, above 4 likely',
    ],
    references: [
      'Wells PS, et al. Thromb Haemost 2000;83:416-420',
      '2019 ESC Guidelines for acute pulmonary embolism (diagnostic algorithm)',
    ],
  },
};

const spesi = {
  id: 'spesi', group: 'scores', title: 'sPESI (simplified PESI)',
  summary: 'Short-term mortality risk in confirmed pulmonary embolism.',
  inputs: [
    { key: 'age', label: 'Age', type: 'number', unit: 'years', min: 18, max: 120, step: 1, required: true, hint: 'Counts when above 80' },
    { key: 'cancer', label: 'Cancer', type: 'check' },
    { key: 'cardiopulm', label: 'Chronic heart failure or chronic lung disease', type: 'check' },
    { key: 'hr', label: 'Heart rate', type: 'number', unit: 'bpm', min: 20, max: 250, step: 1, required: true, hint: 'Counts at 110 or more' },
    { key: 'sbp', label: 'Systolic blood pressure', type: 'number', unit: 'mmHg', min: 40, max: 300, step: 1, required: true, hint: 'Counts below 100' },
    { key: 'spo2', label: 'Arterial oxygen saturation', type: 'number', unit: '%', min: 50, max: 100, step: 1, required: true, hint: 'Counts below 90' },
  ],
  compute: (v) => {
    const r = c.spesi(v);
    return {
      primary: { label: 'sPESI', value: r.score, digits: 0, unit: 'of 6 points' },
      category: r.risk === 'low'
        ? 'Score 0: low risk of 30-day mortality.'
        : 'Score 1 or more: not low risk. Combine with RV imaging and troponin for the ESC risk class.',
      note: 'The ESC 2019 classification also needs haemodynamic status, RV dysfunction and troponin; sPESI is one part.',
    };
  },
  howTo: {
    formula: ['One point each: age above 80, cancer, chronic heart failure or lung disease, heart rate 110 or more, systolic BP below 100, SaO₂ below 90%', '0 = low risk; 1 or more = high risk'],
    references: ['Jiménez D, et al. Arch Intern Med 2010;170:1383-1389', '2019 ESC Guidelines for acute pulmonary embolism'],
  },
};

const ARC_MAJOR = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10", "m11", "m12", "m13"];
const ARC_MINOR = ["n1", "n2", "n3", "n4", "n5", "n6"];

const arcHbr = {
  id: 'arc-hbr', group: 'scores', title: 'ARC-HBR (high bleeding risk after PCI)',
  summary: 'High bleeding risk when at least 1 major or 2 minor criteria are present.',
  inputs: [
    { key: 'm1', label: "Major: Anticipated long-term oral anticoagulation", type: 'check' },
    { key: 'm2', label: "Major: Severe or end-stage CKD (eGFR below 30 mL/min/1.73 m²)", type: 'check' },
    { key: 'm3', label: "Major: Haemoglobin below 11 g/dL", type: 'check' },
    { key: 'm4', label: "Major: Spontaneous bleeding needing hospitalisation or transfusion in the past 6 months, or at any time if recurrent", type: 'check' },
    { key: 'm5', label: "Major: Moderate or severe baseline thrombocytopenia (platelets below 100 × 10⁹/L)", type: 'check' },
    { key: 'm6', label: "Major: Chronic bleeding diathesis", type: 'check' },
    { key: 'm7', label: "Major: Liver cirrhosis with portal hypertension", type: 'check' },
    { key: 'm8', label: "Major: Active malignancy in the past 12 months (excluding non-melanoma skin cancer)", type: 'check' },
    { key: 'm9', label: "Major: Previous spontaneous intracranial haemorrhage (any time) or traumatic ICH in the past 12 months", type: 'check' },
    { key: 'm10', label: "Major: Brain arteriovenous malformation", type: 'check' },
    { key: 'm11', label: "Major: Moderate or severe ischaemic stroke in the past 6 months", type: 'check' },
    { key: 'm12', label: "Major: Non-deferrable major surgery on dual antiplatelet therapy", type: 'check' },
    { key: 'm13', label: "Major: Recent major surgery or major trauma within 30 days before PCI", type: 'check' },
    { key: 'n1', label: "Minor: Age 75 or older", type: 'check' },
    { key: 'n2', label: "Minor: Moderate CKD (eGFR 30-59 mL/min/1.73 m²)", type: 'check' },
    { key: 'n3', label: "Minor: Haemoglobin 11-12.9 g/dL in men or 11-11.9 g/dL in women", type: 'check' },
    { key: 'n4', label: "Minor: Spontaneous bleeding needing hospitalisation or transfusion within 12 months, not meeting the major criterion", type: 'check' },
    { key: 'n5', label: "Minor: Long-term use of oral NSAIDs or steroids", type: 'check' },
    { key: 'n6', label: "Minor: Any ischaemic stroke at any time not meeting the major criterion", type: 'check' },
  ],
  compute: (v) => {
    const major = ARC_MAJOR.filter((k) => v[k]).length;
    const minor = ARC_MINOR.filter((k) => v[k]).length;
    const r = c.arcHbr({ major, minor });
    return {
      primary: { label: 'ARC-HBR', text: r.hbr ? 'High bleeding risk' : 'Not high bleeding risk' },
      secondary: [
        { label: 'Major criteria present', value: major, digits: 0, unit: '' },
        { label: 'Minor criteria present', value: minor, digits: 0, unit: '' },
      ],
      category: r.hbr ? 'At least 1 major or 2 minor criteria are present.' : 'Fewer than 1 major and fewer than 2 minor criteria.',
      note: 'A classification, not a continuous score. Several criteria are time-windowed; read the wording of each.',
    };
  },
  howTo: {
    formula: ['High bleeding risk = at least 1 major OR at least 2 minor criteria', 'Each criterion is counted once'],
    references: ['Urban P, et al. Eur Heart J 2019;40:2632-2653 (doi:10.1093/eurheartj/ehz372)'],
  },
};

const killip = {
  id: 'killip', group: 'scores', title: 'Killip class',
  summary: 'Bedside heart-failure class in acute MI.',
  inputs: [
    {
      key: 'cls', label: 'Clinical findings', type: 'choice', required: true,
      options: [
        { value: '1', label: 'No signs of heart failure' },
        { value: '2', label: 'Rales, S3 gallop or raised JVP' },
        { value: '3', label: 'Frank pulmonary oedema' },
        { value: '4', label: 'Cardiogenic shock' },
      ],
    },
  ],
  compute: (v) => {
    const r = c.killip(Number(v.cls));
    return {
      primary: { label: 'Killip class', text: ['', 'I', 'II', 'III', 'IV'][r.cls] },
      category: r.description,
      note: 'Original in-hospital mortality figures (1967) predate reperfusion and are not reproduced here; class II-IV adds points in TIMI-STEMI and GRACE.',
    };
  },
  howTo: {
    formula: ['I: no clinical signs of heart failure', 'II: rales over the lungs, S3 gallop and/or raised jugular venous pressure', 'III: frank acute pulmonary oedema', 'IV: cardiogenic shock (systolic BP below 90 mmHg with peripheral vasoconstriction)'],
    references: ['Killip T, Kimball JT. Am J Cardiol 1967;20:457-464'],
  },
};

// ------------------------------------------------------------------ drugs (stage 3)

const creatInput = (extra = {}) => ({
  key: 'creat', label: 'Serum creatinine', type: 'number', required: true,
  units: [
    { id: 'mgdl', label: 'mg/dL', toBase: 1, min: 0.2, max: 20, step: 0.01 },
    { id: 'umol', label: 'µmol/L', toBase: 1 / 88.4, min: 18, max: 1768, step: 1 },
  ],
  ...extra,
});
const AGE = { key: 'age', label: 'Age', type: 'number', unit: 'years', min: 18, max: 120, step: 1, required: true };
const WEIGHT = { key: 'weight', label: 'Actual body weight', type: 'number', unit: 'kg', min: 20, max: 300, step: 0.1, required: true };
const DOSE_DISCLAIMER = 'Teaching calculation of published regimens. Check the current label, your hospital protocol and the patient before prescribing.';
const fmtInt = (n) => Math.round(n).toLocaleString('en-US');

const ckdEpi = {
  id: 'ckd-epi-2021', group: 'drugs', title: 'eGFR (CKD-EPI 2021)',
  summary: 'Race-free creatinine-based eGFR with KDIGO GFR category.',
  inputs: [AGE, SEX, creatInput()],
  compute: (v) => {
    const egfr = c.ckdEpi2021({ age: v.age, creatMgDl: v.creat, female: v.sex === 'f' });
    const stage = egfr >= 90 ? 'G1 (90 or more)' : egfr >= 60 ? 'G2 (60-89)' : egfr >= 45 ? 'G3a (45-59)' : egfr >= 30 ? 'G3b (30-44)' : egfr >= 15 ? 'G4 (15-29)' : 'G5 (below 15)';
    return {
      primary: { label: 'eGFR', value: egfr, digits: 0, unit: 'mL/min/1.73 m²' },
      secondary: [{ label: 'KDIGO GFR category', text: stage }],
      note: 'Indexed to 1.73 m² of body surface. Drug labels and the DOAC trials use Cockcroft-Gault creatinine clearance, not eGFR; use the CrCl calculator for dosing. A GFR category needs persistence for 3 months to define CKD.',
    };
  },
  howTo: {
    formula: [
      'eGFR = 142 × min(Scr/κ, 1)^α × max(Scr/κ, 1)^−1.200 × 0.9938^age × 1.012 (if female)',
      'Scr in mg/dL; κ = 0.7 (female) or 0.9 (male); α = −0.241 (female) or −0.302 (male)',
      'KDIGO categories: G1 90 or more, G2 60-89, G3a 45-59, G3b 30-44, G4 15-29, G5 below 15',
    ],
    references: ['Inker LA, et al. N Engl J Med 2021;385:1737-1749 (CKD-EPI 2021 creatinine equation)', 'KDIGO CKD guideline (GFR categories)'],
  },
};

const bsaCalc = {
  id: 'bsa', group: 'drugs', title: 'Body surface area and ideal weight',
  summary: 'BSA (Mosteller), ideal weight (Devine) and adjusted weight.',
  inputs: [
    SEX,
    { key: 'height', label: 'Height', type: 'number', unit: 'cm', min: 100, max: 250, step: 1, required: true },
    WEIGHT,
  ],
  compute: (v) => {
    const female = v.sex === 'f';
    const bsa = c.bsaMosteller({ heightCm: v.height, weightKg: v.weight });
    const ibw = c.idealBodyWeight({ heightCm: v.height, female });
    if (ibw <= 0) return { error: 'Ideal body weight is not defined for this height' };
    const bmi = v.weight / ((v.height / 100) ** 2);
    return {
      primary: { label: 'Body surface area (Mosteller)', value: bsa, digits: 2, unit: 'm²' },
      secondary: [
        { label: 'Ideal body weight (Devine)', value: ibw, digits: 1, unit: 'kg' },
        { label: 'Adjusted body weight', value: c.adjustedBodyWeight({ ibw, actual: v.weight }), digits: 1, unit: 'kg' },
        { label: 'BMI', value: bmi, digits: 1, unit: 'kg/m²' },
      ],
    };
  },
  howTo: {
    formula: ['BSA = √(height in cm × weight in kg ÷ 3600)', 'Ideal weight = 50 kg (men) or 45.5 kg (women) + 2.3 kg per inch above 60 inches', 'Adjusted weight = ideal + 0.4 × (actual − ideal)'],
    references: ['Mosteller RD. N Engl J Med 1987;317:1098', 'Devine BJ. Drug Intell Clin Pharm 1974;8:650-655'],
  },
};

const infusion = {
  id: 'infusion', group: 'drugs', title: 'Infusion rate converter',
  summary: 'Dose to pump rate (mL/h) and back, for any drug. No dose ranges are suggested.',
  inputs: [
    {
      key: 'direction', label: 'Convert', type: 'choice', required: true, default: 'toRate',
      options: [{ value: 'toRate', label: 'Dose to pump rate' }, { value: 'toDose', label: 'Pump rate to dose' }],
    },
    { key: 'amount', label: 'Drug in the bag or syringe', type: 'number', unit: 'mg', min: 0.001, max: 100000, step: 0.1, required: true },
    { key: 'volume', label: 'Total volume', type: 'number', unit: 'mL', min: 1, max: 5000, step: 1, required: true },
    {
      key: 'doseUnit', label: 'Dose unit', type: 'choice', required: true, default: 'mcgkgmin',
      options: [{ value: 'mcgkgmin', label: 'mcg/kg/min' }, { value: 'mcgmin', label: 'mcg/min' }, { value: 'mgh', label: 'mg/h' }],
    },
    { key: 'weight', label: 'Body weight', type: 'number', unit: 'kg', min: 1, max: 300, step: 0.1, requiredIf: (v) => v.doseUnit === 'mcgkgmin', hint: 'Needed only for mcg/kg/min' },
    { key: 'dose', label: 'Dose', type: 'number', min: 0, max: 100000, step: 0.01, requiredIf: (v) => v.direction === 'toRate', hint: 'In the dose unit chosen above' },
    { key: 'rate', label: 'Pump rate', type: 'number', unit: 'mL/h', min: 0, max: 1000, step: 0.1, requiredIf: (v) => v.direction === 'toDose' },
  ],
  compute: (v) => {
    const conc = c.concentrationMcgPerMl({ amountMg: v.amount, volumeMl: v.volume });
    const toMcgMin = (x) => (v.doseUnit === 'mcgkgmin' ? x * v.weight : v.doseUnit === 'mgh' ? (x * 1000) / 60 : x);
    const fromMcgMin = (x) => (v.doseUnit === 'mcgkgmin' ? x / v.weight : v.doseUnit === 'mgh' ? (x * 60) / 1000 : x);
    const unitLabel = { mcgkgmin: 'mcg/kg/min', mcgmin: 'mcg/min', mgh: 'mg/h' }[v.doseUnit];
    const secondary = [{ label: 'Concentration', value: conc, digits: 1, unit: 'mcg/mL' }];
    if (v.direction === 'toRate') {
      const mcgMin = toMcgMin(v.dose);
      secondary.push({ label: 'Dose as mcg/min', value: mcgMin, digits: 1, unit: 'mcg/min' });
      return {
        primary: { label: 'Pump rate', value: c.infusionRate({ doseMcgPerMin: mcgMin, concMcgPerMl: conc }), digits: 1, unit: 'mL/h' },
        secondary,
        note: 'Check the result against the usual range for the drug in your protocol; this tool does not know it.',
      };
    }
    const mcgMin = c.infusionDose({ rateMlPerH: v.rate, concMcgPerMl: conc });
    return {
      primary: { label: 'Delivered dose', value: fromMcgMin(mcgMin), digits: 2, unit: unitLabel },
      secondary,
      note: 'Check the result against the usual range for the drug in your protocol; this tool does not know it.',
    };
  },
  howTo: {
    formula: [
      'Concentration (mcg/mL) = drug amount in mg × 1000 ÷ total volume in mL',
      'Dose as mcg/min = mcg/kg/min × weight, or mg/h × 1000 ÷ 60',
      'Pump rate (mL/h) = mcg/min × 60 ÷ concentration',
      'Reverse: mcg/min = pump rate × concentration ÷ 60',
    ],
    references: ['Unit arithmetic only; no drug-specific data or dose ranges are used.'],
  },
};

const ufh = {
  id: 'ufh-acs', group: 'drugs', title: 'Unfractionated heparin (ACS)',
  summary: 'Weight-based bolus at PCI, or bolus and infusion with fibrinolysis.',
  inputs: [
    {
      key: 'setting', label: 'Setting', type: 'choice', required: true, default: 'pci',
      options: [{ value: 'pci', label: 'During PCI' }, { value: 'lysis', label: 'With fibrinolysis (STEMI)' }],
    },
    { key: 'weight', label: 'Body weight', type: 'number', unit: 'kg', min: 20, max: 300, step: 0.1, required: true },
  ],
  compute: (v) => {
    if (v.setting === 'pci') {
      const r = c.ufhPci({ weightKg: v.weight });
      return {
        primary: { label: 'IV bolus during PCI (70-100 IU/kg)', text: `${fmtInt(r.lowIu)} to ${fmtInt(r.highIu)} IU` },
        category: 'The ESC 2023 recommendation is a weight-adjusted bolus of 70-100 IU/kg during PCI (class I). Adjust to the ACT or institutional target.',
        note: DOSE_DISCLAIMER,
      };
    }
    const r = c.ufhLysis({ weightKg: v.weight });
    return {
      primary: { label: 'IV bolus (60 IU/kg, maximum 4,000 IU)', value: r.bolusIu, digits: 0, unit: 'IU' },
      secondary: [{ label: 'Infusion (12 IU/kg/h, maximum 1,000 IU/h)', value: r.infusionIuPerH, digits: 0, unit: 'IU/h' }],
      category: `${r.bolusCapped ? 'Bolus capped at 4,000 IU. ' : ''}${r.infusionCapped ? 'Infusion capped at 1,000 IU/h. ' : ''}Target aPTT 50-70 s, checked at 3, 6, 12 and 24 h; continue 24-48 h.`.trim(),
      note: DOSE_DISCLAIMER,
    };
  },
  howTo: {
    formula: ['At PCI: 70-100 IU/kg IV bolus', 'With fibrinolysis: 60 IU/kg bolus (maximum 4,000 IU), then 12 IU/kg/h (maximum 1,000 IU/h), aPTT 50-70 s, 24-48 h'],
    references: [
      '2023 ESC Guidelines for the management of acute coronary syndromes (weight-adjusted UFH bolus 70-100 IU/kg during PCI)',
      'ESC STEMI guidance as tabulated in the McMaster Textbook of Internal Medicine, Table 3.11-2 (fibrinolysis regimen)',
    ],
  },
};

const tnk = {
  id: 'tenecteplase', group: 'drugs', title: 'Tenecteplase (STEMI)',
  summary: 'Weight-based single bolus; half dose at age 75 or older.',
  inputs: [AGE, { key: 'weight', label: 'Body weight', type: 'number', unit: 'kg', min: 20, max: 300, step: 0.1, required: true }],
  compute: (v) => {
    const r = c.tenecteplase({ weightKg: v.weight, age: v.age });
    return {
      primary: { label: r.halfDose ? 'Half dose, single IV bolus (age 75 or older)' : 'Single IV bolus', value: r.doseMg, digits: r.doseMg % 1 ? 1 : 0, unit: 'mg' },
      secondary: [{ label: 'Full weight-based dose', value: r.fullMg, digits: 0, unit: 'mg' }],
      category: r.halfDose
        ? 'Half dose follows STREAM and the ESC STEMI guidance. The tenecteplase label itself gives no age adjustment, so follow your protocol.'
        : 'Full weight-based dose. Tenecteplase is given once, with antiplatelets and an anticoagulant, when primary PCI cannot be done in time.',
      note: DOSE_DISCLAIMER,
    };
  },
  howTo: {
    formula: ['Below 60 kg 30 mg; 60 to below 70 kg 35 mg; 70 to below 80 kg 40 mg; 80 to below 90 kg 45 mg; 90 kg or more 50 mg', 'Age 75 or older: half of that dose'],
    references: [
      'ESC STEMI guidance as tabulated in the McMaster Textbook of Internal Medicine, Table 3.11-2 (weight bands)',
      'NHS Grampian STEMI thrombolysis protocol (based on the SmPC and 2023 ESC ACS guidelines): 50% reduction at 75 or older',
      'Armstrong PW, et al. STREAM. N Engl J Med 2013;368:1379-1387',
    ],
  },
};

const enox = {
  id: 'enoxaparin-acs', group: 'drugs', title: 'Enoxaparin (ACS)',
  summary: 'NSTE-ACS dose, or STEMI dose with fibrinolysis, adjusted for age and renal function.',
  inputs: [
    {
      key: 'setting', label: 'Setting', type: 'choice', required: true, default: 'nste',
      options: [{ value: 'nste', label: 'UA / NSTEMI' }, { value: 'stemi-lysis', label: 'STEMI with fibrinolysis' }],
    },
    AGE, SEX, WEIGHT, creatInput(),
  ],
  compute: (v) => {
    const crcl = c.cockcroftGault({ age: v.age, weightKg: v.weight, creatMgDl: v.creat, female: v.sex === 'f' });
    const r = c.enoxaparinAcs({ setting: v.setting, age: v.age, weightKg: v.weight, crcl });
    if (r.status !== 'ok') return { error: r.reason };
    const secondary = [{ label: 'Creatinine clearance used (Cockcroft-Gault, actual weight)', value: crcl, digits: 0, unit: 'mL/min' }];
    if (r.bolusMg) secondary.unshift({ label: 'IV bolus first', value: r.bolusMg, digits: 0, unit: 'mg' });
    if (r.firstTwoMaxMg) secondary.push({ label: 'Maximum for each of the first two SC doses', value: r.firstTwoMaxMg, digits: 0, unit: 'mg' });
    const perKg = v.setting === 'stemi-lysis' && v.age >= 75 ? '0.75' : '1';
    return {
      primary: { label: `SC dose (${perKg} mg/kg), every ${r.intervalH} hours`, value: r.scMg, digits: 0, unit: 'mg' },
      secondary,
      category: r.intervalH === 24 ? 'CrCl below 30 mL/min: the interval is lengthened to once daily.' : undefined,
      note: `Round to the syringe graduation your hospital uses. ${DOSE_DISCLAIMER}`,
    };
  },
  howTo: {
    formula: [
      'UA/NSTEMI: 1 mg/kg SC every 12 h',
      'STEMI with fibrinolysis, age below 75: 30 mg IV bolus, then 1 mg/kg SC every 12 h; the first two SC doses at most 100 mg',
      'STEMI with fibrinolysis, age 75 or older: no IV bolus; 0.75 mg/kg SC every 12 h; the first two SC doses at most 75 mg',
      'CrCl below 30 mL/min: the interval becomes 24 h. Not calculated below 15 mL/min, or for age 75 or older with CrCl below 30 (label text and its table disagree)',
    ],
    references: ['Enoxaparin SmPC (Clexane / Lovenox), section 4.2', 'ESC STEMI guidance as tabulated in the McMaster Textbook of Internal Medicine, Table 3.11-2'],
  },
};

const doac = {
  id: 'doac-af', group: 'drugs', title: 'DOAC dose check (atrial fibrillation)',
  summary: 'Which labelled dose applies for stroke prevention in AF.',
  inputs: [
    {
      key: 'drug', label: 'Drug', type: 'choice', required: true,
      options: [{ value: 'apixaban', label: 'Apixaban' }, { value: 'rivaroxaban', label: 'Rivaroxaban' }, { value: 'edoxaban', label: 'Edoxaban' }, { value: 'dabigatran', label: 'Dabigatran' }],
    },
    AGE, SEX, WEIGHT, creatInput(),
    { key: 'pgp', label: 'Taking a strong P-gp inhibitor', type: 'check', hint: 'Edoxaban only' },
    { key: 'verapamil', label: 'Taking verapamil', type: 'check', hint: 'Dabigatran only' },
  ],
  compute: (v) => {
    const crcl = c.cockcroftGault({ age: v.age, weightKg: v.weight, creatMgDl: v.creat, female: v.sex === 'f' });
    const r = c.doacAf({ drug: v.drug, age: v.age, weightKg: v.weight, creatMgDl: v.creat, crcl, pgpInhibitor: !!v.pgp, verapamil: !!v.verapamil });
    const secondary = [{ label: 'Creatinine clearance used (Cockcroft-Gault, actual weight)', value: crcl, digits: 0, unit: 'mL/min' }];
    if (r.status !== 'ok') return { primary: { label: r.drug, text: r.status === 'contraindicated' ? 'Contraindicated' : 'Not calculated' }, secondary, category: r.reasons.join('. '), note: DOSE_DISCLAIMER };
    const extra = v.drug === 'dabigatran' ? ' SmPC: age 75-80, CrCl 30-50, gastritis/reflux or other bleeding risk may also justify 110 mg; decide individually.' : '';
    return {
      primary: { label: r.reduced ? 'Reduced dose applies' : 'Standard dose applies', text: r.dose },
      secondary,
      category: r.reduced ? `Reason: ${r.reasons.join('; ')}.` : 'No dose-reduction criterion is met.',
      note: `For stroke prevention in AF only. Check interactions and the full label.${extra}`,
    };
  },
  howTo: {
    formula: [
      'Apixaban 5 mg twice daily; 2.5 mg twice daily if 2 of 3: age 80+, weight 60 kg or less, creatinine 1.5 mg/dL (133 µmol/L) or more; also if CrCl 15-29',
      'Rivaroxaban 20 mg once daily; 15 mg once daily if CrCl 15-49; not recommended below 15',
      'Edoxaban 60 mg once daily; 30 mg once daily if any one of: weight 60 kg or less, CrCl 15-49, strong P-gp inhibitor',
      'Dabigatran 150 mg twice daily; 110 mg twice daily if age 80+ or on verapamil; contraindicated if CrCl below 30',
      'CrCl is Cockcroft-Gault with actual weight, as in the trials and labels',
    ],
    references: [
      'EHRA Practical Guide on the use of NOACs in AF (Europace 2023;25:euad226, Table 1)',
      'Pradaxa SmPC, section 4.2 (age 80+, verapamil, CrCl below 30)',
      'Xarelto SmPC (15 mg for CrCl 15-49; CrCl below 15 not recommended)',
    ],
  },
};

export const CALCULATORS = [cha2ds2vasc, hasBled, timiNste, timiStemi, heart, wellsPe, spesi, arcHbr, killip, cockcroft, ckdEpi, bsaCalc, infusion, ufh, tnk, enox, doac, lvotSv, avaCont];
