# Calculators tab: design

Date: 2026-10-22. Status: approved by the user in conversation, pending review of this file.

## Goal

Add a **Calculators** tab to the Mastering Cardiology study app with three groups: cardiovascular scores,
cardiovascular drug calculations, and echocardiography calculations. The app stays offline-first, light, and
educational (not for patient care).

## Decisions made

- Placement: new tab inside the app, loaded lazily (same pattern as Drills). No separate site.
- Release 1 scope: the core set below. Coefficient-based scores (GRACE, ASCVD PCE/PREVENT, SCORE2,
  PRECISE-DAPT, MAGGIC) are release 2.
- Interface language: English, like the rest of the app.
- Approach: pure logic module + declarative calculator definitions + a thin vanilla-JS screen wrapped for React.

## Architecture

New files in `assets/`:

| File | Purpose |
| --- | --- |
| `calc-core-<hash>.js` | Pure functions for every formula. No DOM, no imports. Testable in Node. |
| `calc-data-<hash>.js` | Declarative definitions: id, group, title, inputs (type, unit, min/max, required), compute function name, result formatting, interpretation bands, formula text, references. |
| `CalculatorsScreen-<hash>.js` | Renders the list, the calculator view, validation and live results. Uses the app's CSS variables. Mounted through a minimal React wrapper (ref + effect). |

Changes to existing built files (minimal):

- `index-*.js`: one navigation entry (`/calculators`, label "Calculators"), one route, one page title, one lazy loader.
- `sw.js`: add the three new files to `PRECACHE`; bump `HASH`.
- `upload-manifest.json`: add the new files and update sizes and counts.
- `data/meta.json` `content_hash` is recomputed only if data files change (they should not).

Routing: only `#/calculators`. Selecting a calculator is in-page state. The last opened group is remembered in
`localStorage` inside try/catch; the page works without it.

## Calculator catalogue (release 1)

Scores (8): CHA2DS2-VASc (with CHA2DS2-VA shown alongside), HAS-BLED, TIMI NSTE-ACS, TIMI STEMI, HEART,
Wells PE (two-tier and three-tier) with sPESI, ARC-HBR, Killip class table.

Drugs (7): Cockcroft-Gault CrCl (actual, ideal, adjusted weight), CKD-EPI 2021 eGFR (race-free), BSA (Mosteller),
infusion rate converter (dose to mL/h and back, concentration supplied by the user, no suggested dose ranges unless
sourced), weight-based UFH for ACS, weight-based tenecteplase (half dose at age 75 or older), enoxaparin dosing in
ACS (age and CrCl adjustment), DOAC dose criteria in AF (apixaban, rivaroxaban, edoxaban, dabigatran).

Echo (10): LVOT stroke volume, CO, CI, SVI; aortic valve area by continuity, dimensionless index, Bernoulli gradient,
with severity categories; MVA by pressure half-time; LV mass (ASE cube formula), RWT, LV mass index with sex-specific
limits; EF from volumes and fractional shortening; MR by PISA (EROA, regurgitant volume, regurgitant fraction);
RVSP with RAP from IVC, and PVR estimate; Qp/Qs; E/e' ratio and LA volume index.

Every definition lists the exact source (document and section) for its formula and cut-offs.

## Screen behaviour

- Three segments: Scores, Drugs, Echo. Cards open a calculator in place; Back returns to the list.
- Inputs: decimal keyboard on phones; unit selectors where relevant (for example creatinine mg/dL or umol/L);
  checkboxes or choice lists for scores. Results update live.
- A result shows only when all required inputs are valid. Implausible values are rejected with an inline message
  next to the field, not calculated.
- Result card: main value, category, short interpretation; a collapsible "How it's calculated" with formula, units
  and references; a Reset button.
- Accessibility: every field labelled, result in an `aria-live` region, visible focus, colours from app tokens so
  dark and high-contrast themes work.
- Privacy: nothing entered is stored or sent. A disclaimer ("educational, not for patient care") is on every
  calculator page.

## Verification and safety

1. Each formula and cut-off is checked against its primary source (ESC, ACC/AHA, PERKI guidelines; ASE/EACVI
   recommendations; original publications for scores).
2. Logic lives in pure functions with automated tests built from hand-worked examples and published examples,
   including boundary values (exactly at cut-offs) and invalid input. A second, independent Python implementation is
   used as a cross-check.
3. Anything that cannot be confirmed from a source is not shipped silently: it is dropped or flagged to the user.
4. Dose calculators show the formula and the source guideline and make no recommendation beyond it.

## Testing

- Node tests for `calc-core` (`node --test`).
- Browser tests: fill each calculator through the UI, compare with `calc-core`; check phone width, dark mode and
  high-contrast; check offline load; check that `index-*.js` size grows only by the navigation lines.

## Delivery in stages (each ends with a review checkpoint)

1. Tab skeleton and three sample calculators: CHA2DS2-VASc, Cockcroft-Gault, LVOT SV/AVA.
2. Remaining scores.
3. Remaining drug calculators.
4. Remaining echo calculators.

Each stage bumps the service-worker cache token, updates the manifest, is committed and pushed, then reported.

## Out of scope (release 1)

GRACE, ASCVD PCE, PREVENT, SCORE2, PRECISE-DAPT, MAGGIC, EuroSCORE II; QTc, LDL estimation and Duke criteria
(not requested; can be added later); saving calculation history; patient identifiers of any kind.
