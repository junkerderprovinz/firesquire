// The report opens with a warning beacon in the level's colour, a dome whose light turns for
// Es glimmt and Es brennt on the motion engine's dial and stays lit but still without motion. The
// verdict box has no coloured edge, the window's head no line under it and a larger logo, and the
// report ends with its findings. Buttons have rounded corners and are never pills, in either look.
// Texts run as one paragraph each, without breaks set by hand.
const fs = require('fs');
const path = require('path');
const { DIR, read, ok, done, rules, keyframes, grabFn } = require('./lib');

const js = read('firesquire.js');
const sheets = read('firesquire.css') + '\n' + read('firesquire-info.css');
const css = rules(sheets);
const NO_PREF = (r) => r.at.some((a) => /prefers-reduced-motion:\s*no-preference/.test(a));

console.log('\nThe warning beacon');
ok('the verdict starts with the beacon', /h \+= lampHTML\(\) \+ logoHTML\(\)/.test(grabFn(js, 'verdictHTML')));
const beacon = grabFn(js, 'lampHTML');
ok('it is decoration for a screen reader', /class="fs-v-lamp" aria-hidden="true"/.test(beacon));
ok('it is a dome on a base with a light inside', /fs-lamp-dome/.test(beacon) && /fs-lamp-base/.test(beacon) && /fs-lamp-sweep/.test(beacon));
ok('it is drawn in the page, no picture from outside', !/<img|url\(/.test(beacon) && !css.some((r) => /fs-lamp/.test(r.selector) && /url\(/.test(r.body)));
const dome = css.find((r) => r.selector === '.fs-lamp-dome');
ok('the dome glows in the level\'s colour', !!dome && /var\(--fs-v\)/.test(dome.body) && /box-shadow:[^;]*var\(--fs-v\)/.test(dome.body));
ok('it shows in both looks', !css.some((r) => /fs-(v-)?lamp/.test(r.selector) && /display:\s*none/.test(r.body)));
const turns = css.filter((r) => /fs-lamp-sweep/.test(r.selector) && /animation:\s*fs-beacon /.test(r.body));
ok('the light turns for Es glimmt and Es brennt', turns.length > 0 && turns.every(NO_PREF) && turns.some((r) => r.selector.includes('.fs-v-caution'))
  && turns.some((r) => r.selector.includes('.fs-v-nogo')) && turns.every((r) => /infinite/.test(r.body)), turns.map((r) => r.selector).join(' | '));
ok('and stands still for Alles klar', !turns.some((r) => /fs-v-go\b/.test(r.selector)));
ok('it turns on the engine\'s dial', turns.every((r) => /var\(--fs-motion-lamp-dur\)/.test(r.body)));
ok('it stops at off and stays lit', css.some((r) => r.selector.includes('[data-tt-motion="off"]') && r.selector.includes('.fs-lamp-sweep') && /animation:\s*none/.test(r.body)));
ok('every level sets the dial', (sheets.match(/--fs-motion-lamp-dur:/g) || []).length === 4);
ok('the turn comes to rest at none', /transform:\s*none/.test((keyframes(sheets)['fs-beacon'] || '').split('to')[1] || ''));
ok('the old pulse is gone', !keyframes(sheets)['fs-lamp'] && !css.some((r) => /fs-v-lamp::after/.test(r.selector)));

console.log('\nThe verdict box');
const verdict = css.filter((r) => /\.fs-verdict\b/.test(r.selector) && !/\.fs-v-/.test(r.selector));
ok('has no coloured edge', !verdict.some((r) => /box-shadow:\s*inset/.test(r.body)), verdict.map((r) => r.selector).join(' | '));

console.log('\nThe window\'s head');
const head = css.find((r) => r.selector === '.fs-win-headed .fs-win-head');
ok('has no line under it', !!head && !/border(-bottom)?\s*:/.test(head.body), head && head.body);
const logo = css.find((r) => r.selector === '.fs-win-logo');
const px = logo && +((/width:\s*(\d+)px/.exec(logo.body) || [])[1]);
ok('its logo is two to three times the old 26px', px >= 52 && px <= 78, String(px));

console.log('\nThe report\'s end');
ok('has no paragraph explaining the check', !/fs-foot/.test(grabFn(js, 'reportHTML')) && !/\.fs-foot/.test(sheets));

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
