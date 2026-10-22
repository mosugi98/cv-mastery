// Runs vectors.json against calc-core.js and prints JSON {index: value}.
import fs from 'node:fs';
import * as c from './calc-core.js';
const v = JSON.parse(fs.readFileSync(new URL('./vectors.json', import.meta.url)));
console.log(JSON.stringify(v.map((x) => c[x.fn](x.args))));
