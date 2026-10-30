// Every language carries every string, with the same placeholders, and every string the
// scripts ask for exists in English.
const fs = require('fs');
const path = require('path');
const { DIR, read, ok, done } = require('./lib');

const langDir = path.join(DIR, 'lang');
const en = JSON.parse(fs.readFileSync(path.join(langDir, 'en.json'), 'utf8'));
const holes = (s) => (Array.isArray(s) ? s.join('\n') : String(s)).match(/\{\d+\}/g)?.sort().join('') || '';

console.log('\nEvery language is complete');
const files = fs.readdirSync(langDir).filter((f) => f.endsWith('.json'));
ok('26 languages', files.length === 26, files.length);
for (const f of files) {
  const tr = JSON.parse(fs.readFileSync(path.join(langDir, f), 'utf8'));
  const missing = Object.keys(en).filter((k) => !(k in tr));
  const extra = Object.keys(tr).filter((k) => !(k in en));
  const wrong = Object.keys(en).filter((k) => k in tr && holes(en[k]) !== holes(tr[k]));
  ok(`${f} has every key and no other`, !missing.length && !extra.length, missing.concat(extra).join(', '));
  ok(`${f} keeps the placeholders`, !wrong.length, wrong.join(', '));
  ok(`${f} lists four check groups`, Array.isArray(tr.tools_li) && tr.tools_li.length === 4);
}

console.log('\nThe scripts ask for strings that exist');
const asked = new Set();
for (const [file, re] of [['firesquire.js', /fsT\('([\w-]+)'[,)]/g], ['firesquire-info.js', /\bt\("([\w-]+)"\)/g]]) {
  for (const m of read(file).matchAll(re)) asked.add(m[1]);
}
const unknown = [...asked].filter((k) => !(k in en));
ok('every asked key is in en.json', unknown.length === 0, unknown.join(', '));
const js = read('firesquire.js');
const fallback = ['err_hint', 'tools_title', 'tools_note', 'retry', 'rel_notes'].filter((k) => !js.includes('    ' + k + ': '));
ok('the English fallback carries the new strings', fallback.length === 0, fallback.join(', '));

done();
