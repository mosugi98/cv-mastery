# Calculators Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lazy-loaded, offline "Calculators" tab (scores, drug calculations, echo calculations) to the built Mastering Cardiology site.

**Architecture:** Source files live in `tools/calc/` (pure logic `calc-core.js`, declarative `calc-data.js`, vanilla screen `screen.js`, Node tests). `tools/calc/build.mjs` copies them to `assets/` with content-hashed names, rewrites their import specifiers, and idempotently patches `index-*.js`, `sw.js` and `upload-manifest.json`. The screen is mounted by a React wrapper that uses the app's own `j` and `r` exports.

**Tech Stack:** Plain ES modules, `node --test`, Python 3 (independent cross-check), Playwright (python) for browser tests.

## Global Constraints

- App is a static build served by GitHub Pages; no build tooling in the app itself, nothing to install.
- Service worker is cache-first for everything except `data/*.json` and navigation, so every new or changed asset needs a **new hashed file name**, and `HASH` in `sw.js` must change on every release.
- No Content-Security-Policy; colours only from CSS variables (`--surface`, `--surface-raised`, `--surface-sunk`, `--line`, `--line-strong`, `--ink`, `--ink-muted`, `--pulse*`, `--monitor*`, `--oxygen*`, `--spark*`, `--miss*`, `--on-*`) so dark and contrast themes work.
- Interface language English; educational, not for patient care (disclaimer on every calculator page).
- Nothing the user types is stored or sent. Only the last opened group may be kept in `localStorage`, inside try/catch.
- Every formula and cut-off must be confirmed against a named source (document + section) before it is shipped; unconfirmed items are dropped and reported.
- Repository rules: commit messages end with the two attribution trailers (`Co-Authored-By`, `Claude-Session`); push to `main`; surgical changes only to existing built files.

## File Structure

| Path | Responsibility |
| --- | --- |
| `tools/calc/calc-core.js` | Pure functions only. No imports, no DOM. Exported names listed per task. |
| `tools/calc/calc-data.js` | Declarative definitions (`GROUPS`, `CALCULATORS`). Imports `./calc-core.js`. |
| `tools/calc/screen.js` | `export default function CalculatorsScreen()` React wrapper + `mount(el)` vanilla renderer. Imports `./calc-data.js` and `./index.js` (rewritten by build). |
| `tools/calc/tests/*.test.mjs` | `node --test` suites, one per area. |
| `tools/calc/crosscheck.py` | Independent Python implementation of the same formulas, compared with Node output on a shared vector file. |
| `tools/calc/vectors.json` | Inputs and expected outputs shared by Node tests and the Python cross-check. |
| `tools/calc/build.mjs` | Hash, copy, rewrite imports, patch `index-*.js`, `sw.js`, `upload-manifest.json`. |
| `tools/calc/browser-test.py` | Playwright checks through the real UI. |

## Interfaces (shared by all tasks)

```js
// calc-data.js
export const GROUPS = [{ id: 'scores', label: 'Scores' }, { id: 'drugs', label: 'Drugs' }, { id: 'echo', label: 'Echo' }];
// One definition:
// {
//   id: 'cha2ds2-vasc', group: 'scores', title: 'CHA2DS2-VASc', summary: 'string',
//   inputs: [ // in display order
//     { key: 'age', label: 'Age', type: 'number', unit: 'years', min: 18, max: 120, required: true },
//     { key: 'chf', label: 'Heart failure', type: 'check' },
//     { key: 'sex', label: 'Sex', type: 'choice', options: [{value:'f',label:'Female'},{value:'m',label:'Male'}], required: true },
//     { key: 'creat', label: 'Creatinine', type: 'number', units: [{id:'mgdl',label:'mg/dL',toBase:1,min:0.2,max:20},{id:'umol',label:'µmol/L',toBase:0.011312,min:18,max:1800}], required: true }
//   ],
//   compute: (values) => ({ primary: {label, value, unit}, secondary: [{label,value,unit}], category: 'string', note: 'string' }),
//   howTo: { formula: ['line', ...], references: ['ESC 2024 AF guideline, Table 7', ...] }
// }
```

`compute` receives plain numbers in the base unit (unit selectors are converted by the screen) and booleans for checks. It never throws on validated input.

---

### Task 1: calc-core stage 1 (TDD): CHA2DS2-VASc, Cockcroft-Gault, LVOT/AVA

**Files:**
- Create: `tools/calc/calc-core.js`, `tools/calc/tests/stage1.test.mjs`, `tools/calc/vectors.json`

**Interfaces:**
- Produces (exact signatures):
  - `cha2ds2vasc({chf,htn,age,dm,stroke,vascular,female}) -> {score:number, score_va:number}`; age as number of years; age ≥75 = 2, 65-74 = 1; stroke includes TIA/thromboembolism = 2.
  - `cockcroftGault({age, weightKg, creatMgDl, female}) -> number` mL/min; `(140-age)*weightKg/(72*creat)`, ×0.85 if female.
  - `idealBodyWeight({heightCm, female}) -> number` kg (Devine: 50 + 2.3 per inch over 60 in, women 45.5).
  - `adjustedBodyWeight({ibw, actual}) -> number` = ibw + 0.4×(actual − ibw).
  - `lvotArea(dCm) -> number` cm² = π×(d/2)².
  - `strokeVolume({lvotDcm, vtiCm}) -> number` mL.
  - `cardiacOutput({svMl, hr}) -> number` L/min; `bsaMosteller({heightCm, weightKg}) -> number` m².
  - `avaContinuity({lvotDcm, vtiLvot, vtiAv}) -> number` cm²; `dvi({vtiLvot, vtiAv}) -> number`; `bernoulli(vMs) -> number` mmHg = 4v².

- [ ] **Step 1: Write failing tests** in `stage1.test.mjs` using `node:test` and `node:assert/strict`: hand-worked cases, for example CHA2DS2-VASc of a 76-year-old woman with hypertension and diabetes = 2 (age) + 1 (female) + 1 (HTN) + 1 (DM) = 5 and VA score 4; Cockcroft-Gault for a 60-year-old man, 80 kg, creatinine 1.0 = (80×80)/(72×1.0) = 88.89; LVOT d 2.0 cm, VTI 20 → SV = 62.83 mL; AVA with d 2.0, VTI LVOT 20, VTI AV 80 = 0.785 cm²; Bernoulli 4 m/s = 64 mmHg; boundary ages 64/65/74/75.
- [ ] **Step 2: Run** `node --test tools/calc/tests/` → expect FAIL (module not found).
- [ ] **Step 3: Implement** `calc-core.js` with the signatures above, plus input guards (`assertFinitePositive`) throwing `RangeError` with a readable message.
- [ ] **Step 4: Run** the tests → expect PASS.
- [ ] **Step 5: Verify against sources** (WebFetch): ESC 2024 AF guideline for CHA2DS2-VA wording; Cockcroft-Gault original formula; ASE 2017 native valve stenosis recommendations for continuity and cut-offs. Record document and section in the calculator `howTo.references` (Task 2).
- [ ] **Step 6: Commit** `git add tools/calc && git commit` (with trailers).

### Task 2: Screen framework, build script, tab wiring (stage 1 release)

**Files:**
- Create: `tools/calc/calc-data.js`, `tools/calc/screen.js`, `tools/calc/build.mjs`, `tools/calc/browser-test.py`
- Modify (by `build.mjs`, idempotent): `assets/index-Qvu1KfFE.js`, `sw.js`, `upload-manifest.json`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `node tools/calc/build.mjs` → writes `assets/calc-core-<h>.js`, `assets/calc-data-<h>.js`, `assets/CalculatorsScreen-<h>.js`; patches the existing files; prints the new `HASH`.

Patch points in `index-*.js` (each replaced exactly once, asserted by the build script; a second run replaces the previous patch instead of stacking):
1. `Xh={highlights:"highlights",` → add `calculators:"calculators",` so `#/calculators` resolves.
2. Navigation list: after `{path:"/drills",label:"Drills",names:["drills"]},` insert `{path:"/calculators",label:"Calculators",names:["calculators"]},`.
3. Titles: after `drills:"Drills",` insert `calculators:"Calculators",`.
4. Screen map in `Sb`: `drills:mb}` → `drills:mb,calculators:CALC}`.
5. Lazy loader: before `hb=[{path:"/"` insert `CALC=k.lazy(()=>import("./CalculatorsScreen-<h>.js")),`.
6. `sw.js`: add the three files to `PRECACHE` (sorted), set `HASH` to a new 12-hex token derived from sha256 of all asset and data bytes.
7. `upload-manifest.json`: add entries, recompute sizes of changed files and the `counts` object.

- [ ] **Step 1:** Write `calc-data.js` with the three stage-1 calculators using the interface above (CHA2DS2-VASc with CHA2DS2-VA shown as secondary; Cockcroft-Gault with weight basis choice and creatinine unit selector; LVOT stroke volume and AVA with category cut-offs from the ASE source).
- [ ] **Step 2:** Write `screen.js`: group segments, cards, calculator view, live validation (inline messages), result card with `aria-live="polite"`, collapsible "How it's calculated", Reset, disclaimer; own `<style>` injected once, using only CSS variables; React wrapper `export default function(){ const ref=r.useRef(null); r.useEffect(()=>mount(ref.current),[]); return j.jsx('div',{ref}) }` where `j` and `r` are imported from the built `index` as `import{j,r}from"./index.js"` (build rewrites to the real file name).
- [ ] **Step 3:** Write `build.mjs` implementing the patch points above, failing loudly if any anchor text is missing or occurs more than once.
- [ ] **Step 4:** Run `node tools/calc/build.mjs` twice; expect the second run to produce no diff.
- [ ] **Step 5:** Serve the repo (`python3 -m http.server`) and run `python3 tools/calc/browser-test.py`: tab present in nav, each calculator filled through the UI equals `calc-core` output, invalid input blocked, phone width has no horizontal scroll, dark and contrast themes readable, no console errors, offline reload works (service worker enabled, network blocked).
- [ ] **Step 6:** Measure `index-*.js` size change (only the patch lines); run `node --test`.
- [ ] **Step 7:** Commit and push. Report to the user.

### Task 3: Stage 2, remaining scores

**Files:** Modify `calc-core.js`, `calc-data.js`, `tests/scores.test.mjs`, `vectors.json`; run `build.mjs`.

**Interfaces:** Produces `hasBled`, `timiNste`, `timiStemi`, `heart`, `wellsPe` (two- and three-tier), `spesi`, `arcHbr`, `killip` with the point tables in the spec; each returns `{score, category}`.

- [ ] **Step 1:** Fetch and read the primary source for each score (HAS-BLED: Pisters 2010; TIMI NSTE: Antman 2000; TIMI STEMI: Morrow 2000; HEART: Six 2008 / Backus 2013; Wells PE: Wells 2000; sPESI: Jiménez 2010; ARC-HBR: Urban 2019; Killip: Killip and Kimball 1967). Write the point tables and cut-offs into a comment block of `calc-core.js` with the citation.
- [ ] **Step 2:** Write failing tests with boundary cases for every threshold; run to see them fail.
- [ ] **Step 3:** Implement; run to pass.
- [ ] **Step 4:** Add definitions to `calc-data.js`, extend vectors and the Python cross-check; run `node tools/calc/build.mjs`, `browser-test.py`.
- [ ] **Step 5:** Commit, push, report.

### Task 4: Stage 3, drug calculators

**Files:** same pattern; tests in `tests/drugs.test.mjs`.

**Interfaces:** Produces `ckdEpi2021({age, creatMgDl, female})`, `infusionRate({doseMcgKgMin, weightKg, concMcgMl}) -> mL/h` and inverse `doseFromRate`, `ufhAcs({weightKg}) -> {bolusU, infusionUh}` (60 U/kg capped at 4000 U; 12 U/kg/h capped at 1000 U/h, subject to source confirmation), `tenecteplase({weightKg, age}) -> {doseMg}` (weight bands; half dose at 75 or older, subject to source confirmation), `enoxaparinAcs({age, weightKg, crcl})`, `doacCriteria({drug, age, weightKg, creatMgDl, crcl, ...})`.

- [ ] **Step 1:** Confirm each dosing rule against ESC 2023 ACS (antithrombotic tables), ACC/AHA 2025 ACS, ESC 2024 AF guideline and the drug labels; unconfirmed rules are dropped and reported.
- [ ] **Step 2-5:** Tests first, implement, data definitions, build, browser test, commit, push, report (as in Task 3).

### Task 5: Stage 4, echo calculators

**Files:** same pattern; tests in `tests/echo.test.mjs`.

**Interfaces:** Produces `lvMass({ivsd, lvidd, pwd}) -> g` (ASE cube formula), `rwt`, `lvmi`, `efFromVolumes`, `fractionalShortening`, `mvaPht`, `pisa({radiusCm, aliasVelCmS, regVelCmS, vtiRegCm})` returning `{eroa, rvol}`, `rvsp({trVelMs, rap})`, `rapFromIvc({ivcCm, collapse})`, `pvrEcho({trVelMs, vtiRvotCm})`, `qpQs`, `eOverEPrime`, `laVolumeIndex`.

- [ ] **Step 1:** Confirm against ASE/EACVI chamber quantification (2015), diastolic function (2016), native regurgitation (2017) and stenosis (2017) documents; record cut-offs and sections.
- [ ] **Step 2-5:** as above.

### Task 6: Final verification and documentation

- [ ] Full test run (`node --test`, cross-check, browser test across all calculators in light, dark and contrast themes).
- [ ] Update `README.md` content section with a short Calculators paragraph and the note that `tools/calc` regenerates the assets; keep the not-medical-advice statement.
- [ ] Commit, push, report: what was built, what was dropped, open questions.

## Self-review

- Spec coverage: placement (Task 2), catalogue (Tasks 1, 3, 4, 5), screen behaviour (Task 2), verification (every task), staged release (Tasks 2-5), out-of-scope items untouched.
- Placeholders: none left; signatures are defined once in the Interfaces blocks and reused with the same names.
- Risk: patch anchors depend on the current minified `index-*.js`; the build script asserts each anchor occurs exactly once and fails loudly otherwise.
