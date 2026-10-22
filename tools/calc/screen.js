// Calculators screen: a vanilla DOM renderer driven by calc-data.js, mounted by a small React wrapper.
// It uses only the app's CSS variables so every theme (light, dark, contrast) works.
// Nothing typed here is stored or sent. Only the last opened group is remembered, inside try/catch.

import { GROUPS, CALCULATORS } from './calc-data.js';
import { j, r } from './index.js';

const STORE_KEY = 'cx-group';

const CSS = `
.cx{max-width:44rem;margin:0 auto;color:var(--ink);font-family:var(--font-body)}
.cx *{box-sizing:border-box}
.cx h1,.cx h2{font-family:var(--font-display);margin:0 0 .5rem;line-height:1.15}
.cx h1{font-size:1.75rem}.cx h2{font-size:1.4rem}.cx h2:focus{outline:none}
.cx p{margin:.25rem 0 .75rem;line-height:1.45}
.cx .cx-muted{color:var(--ink-muted)}
.cx .cx-warn{border:2px solid var(--spark-deep);background:var(--spark-soft);color:var(--ink);border-radius:var(--radius-md);padding:.6rem .8rem;font-size:.92rem;margin:.75rem 0 1rem}
.cx .cx-tabs{display:flex;flex-wrap:wrap;gap:.4rem;margin:.5rem 0 1rem}
.cx button{font:inherit;color:inherit;cursor:pointer}
.cx .cx-tab{min-height:44px;padding:.35rem 1rem;border-radius:var(--radius-pill);border:2px solid var(--line-strong);background:transparent;font-weight:800}
.cx .cx-tab[aria-selected=true]{border-color:var(--pulse);background:var(--pulse-soft);color:var(--pulse)}
.cx .cx-grid{display:grid;gap:.6rem;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))}
.cx .cx-card{text-align:left;min-height:44px;padding:.8rem .9rem;border-radius:var(--radius-md);border:2px solid var(--line-strong);background:var(--surface-raised);box-shadow:var(--shadow-chunky)}
.cx .cx-card:hover{border-color:var(--pulse)}
.cx .cx-card strong{display:block;font-size:1.02rem;margin-bottom:.2rem}
.cx .cx-card span{color:var(--ink-muted);font-size:.9rem}
.cx .cx-back{min-height:44px;padding:.25rem .8rem;border-radius:var(--radius-pill);border:2px solid var(--line-strong);background:transparent;font-weight:800;margin-bottom:.75rem}
.cx .cx-field{margin:0 0 .9rem;padding:0;border:0;min-width:0}
.cx legend,.cx .cx-label{display:block;font-weight:800;margin-bottom:.25rem;padding:0}
.cx .cx-req{color:var(--pulse)}
.cx .cx-row{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap}
.cx input[type=text],.cx select{font:inherit;font-size:16px;min-height:44px;padding:.35rem .6rem;border-radius:var(--radius-md);border:2px solid var(--line-strong);background:var(--surface-raised);color:var(--ink);width:9rem;max-width:100%}
.cx select{width:auto}
.cx input[aria-invalid=true]{border-color:var(--miss)}
.cx .cx-unit{color:var(--ink-muted);font-weight:700}
.cx .cx-hint{color:var(--ink-muted);font-size:.85rem;margin:.2rem 0 0}
.cx .cx-err{color:var(--miss);font-size:.88rem;font-weight:700;margin:.2rem 0 0}
.cx .cx-check{display:flex;gap:.6rem;align-items:flex-start;min-height:44px;padding:.35rem 0}
.cx .cx-check input{width:1.4rem;height:1.4rem;margin-top:.1rem;accent-color:var(--pulse);flex:none}
.cx .cx-radios{display:flex;flex-wrap:wrap;gap:.4rem}
.cx .cx-radio{display:flex;gap:.4rem;align-items:center;min-height:44px;padding:.2rem .75rem;border:2px solid var(--line-strong);border-radius:var(--radius-pill);background:var(--surface-raised)}
.cx .cx-radio input{accent-color:var(--pulse);width:1.1rem;height:1.1rem}
.cx .cx-radio:has(input:checked){border-color:var(--pulse);background:var(--pulse-soft)}
.cx :focus-visible{outline:3px solid var(--oxygen);outline-offset:2px}
.cx .cx-result{border:2px solid var(--monitor);background:var(--monitor-soft);border-radius:var(--radius-lg);padding:1rem;margin:1rem 0}
.cx .cx-result.cx-wait{border-color:var(--line-strong);background:var(--surface-sunk);color:var(--ink-muted)}
.cx .cx-big{font-family:var(--font-display);font-size:2.2rem;line-height:1.1;margin:.1rem 0}
.cx .cx-big small{font-size:1rem;font-family:var(--font-body);color:var(--ink-muted);margin-left:.3rem}
.cx dl{margin:.6rem 0 0;display:grid;grid-template-columns:1fr auto;gap:.25rem .75rem}
.cx dt{color:var(--ink-muted)}.cx dd{margin:0;font-weight:800;text-align:right}
.cx ul.cx-flags{list-style:none;margin:.6rem 0 0;padding:0}
.cx ul.cx-flags li{display:flex;gap:.5rem;padding:.2rem 0}
.cx .cx-met{font-weight:800;white-space:nowrap}
.cx .cx-actions{display:flex;gap:.5rem;margin:.5rem 0 1rem}
.cx .cx-reset{min-height:44px;padding:.25rem 1rem;border-radius:var(--radius-pill);border:2px solid var(--line-strong);background:transparent;font-weight:800}
.cx details{border:2px solid var(--line);border-radius:var(--radius-md);background:var(--surface-raised);padding:.5rem .8rem;margin:.75rem 0}
.cx summary{cursor:pointer;font-weight:800;min-height:32px;display:flex;align-items:center}
.cx details ul{margin:.4rem 0 .6rem;padding-left:1.2rem}.cx details li{margin:.25rem 0}
@media (max-width:30rem){.cx h1{font-size:1.5rem}.cx input[type=text]{width:8rem}}
`;

function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const kid of kids.flat()) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

function loadGroup() {
  try {
    const g = localStorage.getItem(STORE_KEY);
    if (GROUPS.some((x) => x.id === g)) return g;
  } catch (e) { /* storage unavailable */ }
  return GROUPS[0].id;
}
function saveGroup(g) {
  try { localStorage.setItem(STORE_KEY, g); } catch (e) { /* storage unavailable */ }
}

const fmt = (x) => {
  if (x.text !== undefined) return x.text;
  const v = x.value;
  return (Number.isFinite(v) ? v.toFixed(x.digits ?? 1) : '–');
};
const hashId = () => {
  const q = (location.hash.split('?')[1] || '');
  try { return new URLSearchParams(q).get('c'); } catch (e) { return null; }
};
const isRequired = (inp, values) => !!(inp.required || (inp.requiredIf && inp.requiredIf(values)));

// Turn raw field state into base-unit values, or report what is missing or wrong.
export function evaluate(calc, raw, unitSel) {
  const values = {};
  const errors = {};
  const missing = [];
  for (const inp of calc.inputs) {
    const rv = raw[inp.key];
    if (inp.type === 'check') { values[inp.key] = !!rv; continue; }
    if (inp.type === 'choice') { values[inp.key] = rv || ''; continue; }
    const text = (rv ?? '').toString().trim().replace(',', '.');
    if (text === '') { values[inp.key] = undefined; continue; }
    const n = Number(text);
    if (!Number.isFinite(n) || !/^-?\d*\.?\d+$/.test(text)) { errors[inp.key] = 'Enter a number'; continue; }
    const unit = inp.units ? inp.units.find((u) => u.id === (unitSel[inp.key] || inp.units[0].id)) : null;
    const min = unit ? unit.min : inp.min;
    const max = unit ? unit.max : inp.max;
    const ulabel = unit ? unit.label : (inp.unit || '');
    if ((min !== undefined && n < min) || (max !== undefined && n > max)) {
      errors[inp.key] = `Enter a value between ${min} and ${max} ${ulabel}`.trim();
      continue;
    }
    values[inp.key] = unit ? n * unit.toBase : n;
  }
  for (const inp of calc.inputs) {
    if (inp.type === 'choice' && inp.required && !values[inp.key]) missing.push(inp.label);
    if (inp.type === 'number' && isRequired(inp, values) && values[inp.key] === undefined && !errors[inp.key]) missing.push(inp.label);
  }
  return { values, errors, missing };
}

export function mount(root) {
  if (!document.getElementById('cx-style')) {
    const st = document.createElement('style');
    st.id = 'cx-style';
    st.textContent = CSS;
    document.head.append(st);
  }
  const state = { group: loadGroup(), calc: null, raw: {}, unitSel: {} };
  let lastCard = null;

  const disclaimer = () => h('p', { class: 'cx-warn', role: 'note' },
    'Educational tool for exam preparation. It is not for patient care. Check every result against the full, current guideline.');

  function renderList() {
    state.calc = null;
    root.textContent = '';
    const tablist = h('div', { class: 'cx-tabs', role: 'tablist', 'aria-label': 'Calculator groups' },
      GROUPS.map((g) => h('button', {
        class: 'cx-tab', role: 'tab', type: 'button', id: `cx-tab-${g.id}`, 'aria-selected': g.id === state.group ? 'true' : 'false',
        'aria-controls': 'cx-panel', tabindex: g.id === state.group ? '0' : '-1',
        onclick: () => { state.group = g.id; saveGroup(g.id); renderList(); root.querySelector(`#cx-tab-${g.id}`).focus(); },
        onkeydown: (e) => {
          const i = GROUPS.findIndex((x) => x.id === state.group);
          const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
          if (!d) return;
          e.preventDefault();
          const next = GROUPS[(i + d + GROUPS.length) % GROUPS.length];
          state.group = next.id; saveGroup(next.id); renderList(); root.querySelector(`#cx-tab-${next.id}`).focus();
        },
      }, g.label)));
    const group = GROUPS.find((g) => g.id === state.group);
    const cards = CALCULATORS.filter((x) => x.group === state.group).map((calc) => h('button', {
      class: 'cx-card', type: 'button', 'data-calc': calc.id, onclick: () => { lastCard = calc.id; location.hash = `#/calculators?c=${calc.id}`; },
    }, h('strong', null, calc.title), h('span', null, calc.summary)));
    root.append(
      h('div', { class: 'cx' },
        h('h1', null, 'Calculators'),
        h('p', { class: 'cx-muted' }, 'Scores, drug calculations and echocardiography measurements. Everything is calculated on this device.'),
        disclaimer(),
        tablist,
        h('p', { class: 'cx-muted' }, group.blurb),
        h('div', { class: 'cx-grid', role: 'tabpanel', id: 'cx-panel', 'aria-labelledby': `cx-tab-${group.id}` }, cards),
      ),
    );
  }

  function openCalc(calc) {
    state.calc = calc;
    state.raw = {};
    state.unitSel = {};
    for (const inp of calc.inputs) {
      if (inp.type === 'choice' && inp.default) state.raw[inp.key] = inp.default;
      if (inp.units) state.unitSel[inp.key] = inp.units[0].id;
    }
    renderCalc();
  }

  function renderCalc() {
    const calc = state.calc;
    root.textContent = '';
    const result = h('div', { id: 'cx-result', 'aria-live': 'polite', 'aria-atomic': 'true' });
    const form = h('form', { novalidate: true, onsubmit: (e) => e.preventDefault() });
    const errEls = {};
    for (const inp of calc.inputs) form.append(renderField(inp, errEls));

    const howTo = h('details', null,
      h('summary', null, "How it's calculated"),
      h('p', { class: 'cx-muted' }, 'Formula'),
      h('ul', null, calc.howTo.formula.map((t) => h('li', null, t))),
      h('p', { class: 'cx-muted' }, 'References'),
      h('ul', null, calc.howTo.references.map((t) => h('li', null, t))),
    );
    const title = h('h2', { tabindex: '-1' }, calc.title);
    root.append(h('div', { class: 'cx' },
      h('button', { class: 'cx-back', type: 'button', onclick: () => { location.hash = '#/calculators'; } }, '← All calculators'),
      title,
      h('p', { class: 'cx-muted' }, calc.summary),
      form,
      h('div', { class: 'cx-actions' }, h('button', { class: 'cx-reset', type: 'button', onclick: () => { openCalc(calc); root.querySelector('input,select')?.focus(); } }, 'Reset')),
      result,
      howTo,
      disclaimer(),
    ));
    title.focus();
    update(calc, result, errEls);
  }

  function renderField(inp, errEls) {
    const calc = state.calc;
    const id = `cx-f-${inp.key}`;
    const hintId = `${id}-hint`;
    const errId = `${id}-err`;
    const err = h('p', { class: 'cx-err', id: errId, hidden: true });
    errEls[inp.key] = err;
    const hint = inp.hint ? h('p', { class: 'cx-hint', id: hintId }, inp.hint) : null;
    const refresh = () => update(calc, root.querySelector('#cx-result'), errEls);

    if (inp.type === 'check') {
      return h('div', { class: 'cx-field' },
        h('label', { class: 'cx-check', for: id },
          h('input', { type: 'checkbox', id, 'aria-describedby': inp.hint ? hintId : null, checked: !!state.raw[inp.key], onchange: (e) => { state.raw[inp.key] = e.target.checked; refresh(); } }),
          h('span', null, inp.label)),
        hint);
    }
    if (inp.type === 'choice') {
      return h('fieldset', { class: 'cx-field', role: 'radiogroup', 'aria-required': inp.required ? 'true' : null },
        h('legend', null, inp.label, inp.required ? h('span', { class: 'cx-req', 'aria-hidden': 'true' }, ' *') : null),
        h('div', { class: 'cx-radios' }, inp.options.map((o) => h('label', { class: 'cx-radio' },
          h('input', { type: 'radio', name: id, value: o.value, checked: state.raw[inp.key] === o.value, onchange: () => { state.raw[inp.key] = o.value; refreshCalc(); } }),
          o.label))),
        hint);
    }
    // number
    const req = isRequired(inp, evaluate(calc, state.raw, state.unitSel).values);
    const input = h('input', {
      type: 'text', inputmode: 'decimal', autocomplete: 'off', id, value: state.raw[inp.key] ?? '',
      'aria-describedby': [inp.hint ? hintId : null, errId].filter(Boolean).join(' '),
      oninput: (e) => { state.raw[inp.key] = e.target.value; refresh(); },
    });
    const unitEl = inp.units
      ? h('select', { 'aria-label': `${inp.label} unit`, onchange: (e) => { state.unitSel[inp.key] = e.target.value; refresh(); } },
        inp.units.map((u) => h('option', { value: u.id, selected: u.id === state.unitSel[inp.key] }, u.label)))
      : (inp.unit ? h('span', { class: 'cx-unit' }, inp.unit) : null);
    const label = h('label', { class: 'cx-label', for: id, 'data-label-for': inp.key }, inp.label,
      req ? h('span', { class: 'cx-req', 'aria-hidden': 'true' }, ' *') : null);
    return h('div', { class: 'cx-field', 'data-field': inp.key }, label, h('div', { class: 'cx-row' }, input, unitEl), hint, err);
  }

  // Re-render the whole form when a choice changes (it can change which fields are required), keeping focus on the choice.
  function refreshCalc() {
    const active = document.activeElement;
    const name = active && active.name;
    const val = active && active.value;
    renderCalc();
    const again = name ? root.querySelector(`input[name="${name}"][value="${val}"]`) : null;
    if (again) again.focus();
  }

  function update(calc, resultEl, errEls) {
    if (!resultEl) return;
    const { values, errors, missing } = evaluate(calc, state.raw, state.unitSel);
    for (const inp of calc.inputs) {
      const e = errEls[inp.key];
      const input = root.querySelector(`#cx-f-${inp.key}`);
      if (!e) continue;
      const msg = errors[inp.key];
      e.hidden = !msg;
      e.textContent = msg || '';
      if (input && input.type === 'text') input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    }
    resultEl.textContent = '';
    if (Object.keys(errors).length) {
      resultEl.append(h('div', { class: 'cx-result cx-wait' }, 'Fix the highlighted fields to see the result.'));
      return;
    }
    if (missing.length) {
      resultEl.append(h('div', { class: 'cx-result cx-wait' }, `Enter the required fields (marked *) to see the result. Still needed: ${missing.join(', ')}.`));
      return;
    }
    let out;
    try { out = calc.compute(values); } catch (e) { out = { error: e && e.message ? e.message : 'These values cannot be calculated' }; }
    if (out.error) {
      resultEl.append(h('div', { class: 'cx-result cx-wait' }, out.error));
      return;
    }
    const p = out.primary;
    resultEl.append(h('div', { class: 'cx-result' },
      h('div', { class: 'cx-muted' }, p.label),
      h('div', { class: 'cx-big' }, fmt(p), p.unit ? h('small', null, ` ${p.unit}`) : null),
      out.category ? h('p', null, out.category) : null,
      out.secondary && out.secondary.length
        ? h('dl', null, out.secondary.flatMap((s) => [h('dt', null, s.label), h('dd', null, `${fmt(s)}${s.unit ? ' ' + s.unit : ''}`)]))
        : null,
      out.flags && out.flags.length
        ? h('ul', { class: 'cx-flags' }, out.flags.map((f) => h('li', null, h('span', { class: 'cx-met' }, f.met ? '✓ Met' : '✗ Not met'), h('span', null, f.label))))
        : null,
      out.note ? h('p', { class: 'cx-muted' }, out.note) : null,
    ));
  }

  // The open calculator lives in the address (#/calculators?c=<id>) so the browser Back button, the Calculators tab and
  // shared links all behave: no id = the list.
  function sync() {
    const id = hashId();
    const calc = CALCULATORS.find((x) => x.id === id);
    if (calc) {
      if (state.calc && state.calc.id === calc.id) return;
      state.group = calc.group;
      openCalc(calc);
    } else {
      const was = state.calc;
      renderList();
      if (was) { const b = root.querySelector(`[data-calc="${was.id}"]`); if (b) b.focus(); }
    }
  }
  const onHash = () => { if (location.hash.startsWith('#/calculators')) sync(); };
  window.addEventListener('hashchange', onHash);
  sync();
  return () => { window.removeEventListener('hashchange', onHash); root.textContent = ''; };
}

export default function CalculatorsScreen() {
  const ref = r.useRef(null);
  r.useEffect(() => mount(ref.current), []);
  return j.jsx('div', { ref });
}
