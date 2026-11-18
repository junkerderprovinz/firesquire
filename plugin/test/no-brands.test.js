// FireSquire names no other product in what people read: the texts in every language, the English
// fallback, the engine's messages and the README. A SMART history app it finds running is called
// what it is.
const fs = require('fs');
const path = require('path');
const { DIR, read, ok, done } = require('./lib');

const BRANDS = /\bScrutiny\b/i;
const langDir = path.join(DIR, 'lang');
const strings = (v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v : Object.values(v));

console.log('\nThe texts');
for (const f of fs.readdirSync(langDir)) {
  const l = JSON.parse(fs.readFileSync(path.join(langDir, f), 'utf8'));
  const named = Object.entries(l).filter(([, v]) => strings(v).some((s) => BRANDS.test(s))).map(([k]) => k);
  ok(`${f} names no other product`, named.length === 0, named.join(', '));
}
const js = read('firesquire.js');
ok('neither does the English fallback', !/^\s+\w+: .*\bScrutiny\b/m.test(js));
const msgs = [...read('firesquire-health.sh').matchAll(/^\s*add \w+ \w+ \w+ \w+ "[^"]*" "([^"]*)"/gm)].map((m) => m[1]);
ok('nor a message of the engine', msgs.length > 0 && !msgs.some((m) => BRANDS.test(m)), msgs.filter((m) => BRANDS.test(m)).join(' | '));
ok('nor the README', !BRANDS.test(fs.readFileSync(path.join(__dirname, '..', '..', 'README.md'), 'utf8')));

done();
