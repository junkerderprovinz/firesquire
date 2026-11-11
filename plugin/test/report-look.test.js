// The report opens with a warning lamp in the verdict's colour that pulses on the motion engine's
// levels and stands still without motion. The window's head has no line under it. Buttons have
// rounded corners and are never pills, in either look. Texts run as one paragraph each, without
// breaks set by hand.
const fs = require('fs');
const path = require('path');
const { DIR, read, ok, done, rules, keyframes, grabFn } = require('./lib');

const js = read('firesquire.js');
const sheets = read('firesquire.css') + '\n' + read('firesquire-info.css');
const css = rules(sheets);
const NO_PREF = (r) => r.at.some((a) => /prefers-reduced-motion:\s*no-preference/.test(a));

console.log('\nThe warning lamp');
ok('the verdict starts with the lamp', /h \+= lampHTML\(\) \+ logoHTML\(\)/.test(grabFn(js, 'verdictHTML')));
ok('it is decoration for a screen reader', /class="fs-v-lamp" aria-hidden="true"/.test(js));
const lamp = css.find((r) => r.selector === '.fs-v-lamp');
ok('it shines in the verdict\'s colour', !!lamp && /background:\s*var\(--fs-v\)/.test(lamp.body));
ok('it shows in both looks', !css.some((r) => /\.fs-v-lamp/.test(r.selector) && /display:\s*none/.test(r.body)));
const pulse = css.find((r) => /\.fs-v-lamp::after/.test(r.selector) && /animation:\s*fs-lamp var\(--fs-motion-lamp-dur\)/.test(r.body));
ok('it pulses on the engine\'s dial', !!pulse && NO_PREF(pulse) && /infinite/.test(pulse.body));
ok('the pulse stops at off', css.some((r) => r.selector.includes('[data-tt-motion="off"]') && r.selector.includes('.fs-v-lamp::after') && /animation:\s*none/.test(r.body)));
ok('every level sets the dial', (sheets.match(/--fs-motion-lamp-dur:/g) || []).length === 4);
ok('the pulse rests where it started', /transform:\s*none/.test((keyframes(sheets)['fs-lamp'] || '').split('100%')[1] || ''));

console.log('\nThe window\'s head');
const head = css.find((r) => r.selector === '.fs-win-headed .fs-win-head');
ok('has no line under it', !!head && !/border(-bottom)?\s*:/.test(head.body), head && head.body);

console.log('\nButtons');
const BUTTON = /\.fs-btn\b|\.fs-win-btn\b|\.fs-f-go\b|\.fs-rbtn(-unit)?\b|\.fs-net\b|\.fs-seg-opt\b|\.fs-coin\b/;
const pills = css.filter((r) => BUTTON.test(r.selector) && /border-radius:\s*(var\(--fs-r-pill\)|var\(--tt-radius-pill|9999px|50%)/.test(r.body));
ok('no button is a pill', pills.length === 0, pills.map((r) => r.selector).join(' | '));
ok('they round with the control radius', css.filter((r) => BUTTON.test(r.selector) && /border-radius:\s*var\(--fs-r-ctl\)/.test(r.body)).length >= 5);

console.log('\nTexts');
const langDir = path.join(DIR, 'lang');
const broken = [];
for (const f of fs.readdirSync(langDir)) {
  for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(langDir, f), 'utf8')))) {
    if (/\n|<br/i.test([].concat(v).join(''))) broken.push(f + ':' + k);
  }
}
ok('no string breaks a line by hand', broken.length === 0, broken.join(', '));
const changes = (/<CHANGES>([\s\S]*?)<\/CHANGES>/.exec(fs.readFileSync(path.join(__dirname, '..', 'firesquire.plg'), 'utf8')) || [])[1] || '';
const wrapped = changes.split('\n').filter((l) => /^\s{2,}\S/.test(l) && !/^\s*(- |#|---)/.test(l) && !/^\s*[✨🎨⚡🐛🌐]/u.test(l));
ok('every release note is one line', wrapped.length === 0, wrapped.slice(0, 3).join(' / '));

done();
