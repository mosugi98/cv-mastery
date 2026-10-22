#!/usr/bin/env node
// Builds the Calculators tab into the published site.
//  1. copies calc-core.js, calc-data.js, screen.js to assets/ with content-hashed names (import specifiers rewritten)
//  2. patches assets/index-*.js (route, nav entry, title, lazy loader), sw.js (PRECACHE, HASH), upload-manifest.json
// Idempotent: running it again replaces the previous patch and never stacks it. Fails loudly if an anchor is missing.
// Usage: node tools/calc/build.mjs   (from anywhere)

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const assets = path.join(root, 'assets');
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const read = (p) => fs.readFileSync(p, 'utf8');
const die = (m) => { console.error('BUILD FAILED: ' + m); process.exit(1); };

// ---- locate the built index bundle
const indexFile = fs.readdirSync(assets).find((f) => /^index-[A-Za-z0-9_-]+\.js$/.test(f));
if (!indexFile) die('assets/index-*.js not found');

// ---- 1. hashed copies
for (const f of fs.readdirSync(assets)) {
  if (/^calc-(core|data)-[0-9a-f]{8}\.js$/.test(f) || /^CalculatorsScreen-[0-9a-f]{8}\.js$/.test(f)) fs.unlinkSync(path.join(assets, f));
}
const core = read(path.join(here, 'calc-core.js'));
const coreName = `calc-core-${sha(core).slice(0, 8)}.js`;
fs.writeFileSync(path.join(assets, coreName), core);

let data = read(path.join(here, 'calc-data.js'));
if (!data.includes("from './calc-core.js'")) die("calc-data.js must import './calc-core.js'");
data = data.replace("from './calc-core.js'", `from './${coreName}'`);
const dataName = `calc-data-${sha(data).slice(0, 8)}.js`;
fs.writeFileSync(path.join(assets, dataName), data);

let screen = read(path.join(here, 'screen.js'));
if (!screen.includes("from './calc-data.js'") || !screen.includes("from './index.js'")) die('screen.js import anchors missing');
screen = screen.replace("from './calc-data.js'", `from './${dataName}'`).replace("from './index.js'", `from './${indexFile}'`);
const screenName = `CalculatorsScreen-${sha(screen).slice(0, 8)}.js`;
fs.writeFileSync(path.join(assets, screenName), screen);

// ---- 2a. patch the index bundle
const ip = path.join(assets, indexFile);
let idx = read(ip);
// remove any previous patch
idx = idx
  .replace(/calculators:"calculators",/g, '')
  .replace(/\{path:"\/calculators",label:"Calculators",names:\["calculators"\]\},/g, '')
  .replace(/calculators:"Calculators",/g, '')
  .replace(/,calculators:mcCalc/g, '')
  .replace(/mcCalc=k\.lazy\(\(\)=>import\("\.\/CalculatorsScreen-[0-9a-f]{8}\.js"\)\),/g, '');
const once = (needle, replacement) => {
  const n = idx.split(needle).length - 1;
  if (n !== 1) die(`anchor must occur exactly once (found ${n}): ${needle}`);
  idx = idx.replace(needle, () => replacement);
};
once('Xh={highlights:"highlights",', 'Xh={calculators:"calculators",highlights:"highlights",');
once('{path:"/drills",label:"Drills",names:["drills"]},', '{path:"/drills",label:"Drills",names:["drills"]},{path:"/calculators",label:"Calculators",names:["calculators"]},');
once('drills:"Drills",', 'drills:"Drills",calculators:"Calculators",');
once('drills:mb}[i.name]', 'drills:mb,calculators:mcCalc}[i.name]');
once(',hb=[{path:"/",label:"Home"', `,mcCalc=k.lazy(()=>import("./${screenName}")),hb=[{path:"/",label:"Home"`);
fs.writeFileSync(ip, idx);

// ---- 2b. service worker: precache list and cache token
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const swp = path.join(root, 'sw.js');
let sw = read(swp);
const m = sw.match(/const PRECACHE = \[\n([\s\S]*?)\n\];/);
if (!m) die('PRECACHE block not found in sw.js');
let entries = m[1].split('\n').map((l) => l.trim().replace(/,$/, '')).filter(Boolean)
  .filter((l) => !/\.\/assets\/(calc-(core|data)-[0-9a-f]{8}\.js|CalculatorsScreen-[0-9a-f]{8}\.js)/.test(l));
for (const n of [coreName, dataName, screenName]) entries.push(`"./assets/${n}"`);
entries.sort();
sw = sw.replace(m[0], `const PRECACHE = [\n${entries.map((e) => `  ${e},`).join('\n')}\n];`);
// cache token: hash of every asset and data byte (sw.js itself excluded)
const h = crypto.createHash('sha256');
for (const f of [...walk(assets), ...walk(path.join(root, 'data'))].sort()) { h.update(path.relative(root, f)); h.update(fs.readFileSync(f)); }
const token = h.digest('hex').slice(0, 12);
if (!/const HASH = "[0-9a-f]{12}";/.test(sw)) die('HASH line not found in sw.js');
sw = sw.replace(/const HASH = "[0-9a-f]{12}";/, `const HASH = "${token}";`);
fs.writeFileSync(swp, sw);

// ---- 2c. upload manifest
const mp = path.join(root, 'upload-manifest.json');
const rawManifest = read(mp);
const man = JSON.parse(rawManifest);
man.files = man.files.filter((f) => !/^assets\/(calc-(core|data)-[0-9a-f]{8}\.js|CalculatorsScreen-[0-9a-f]{8}\.js)$/.test(f.path));
for (const n of [coreName, dataName, screenName]) man.files.push({ path: `assets/${n}`, size: 0 });
man.files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
for (const f of man.files) f.size = fs.statSync(path.join(root, f.path)).size;
man.counts.assets = man.files.filter((f) => f.path.startsWith('assets/')).length;
man.counts.total = man.files.length;
const indent = rawManifest.startsWith('{\n "') ? 1 : 2;
fs.writeFileSync(mp, JSON.stringify(man, null, indent) + (rawManifest.endsWith('\n') ? '\n' : ''));

console.log(JSON.stringify({ coreName, dataName, screenName, token, indexFile, indexBytes: fs.statSync(ip).size }, null, 1));
