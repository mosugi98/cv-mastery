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
