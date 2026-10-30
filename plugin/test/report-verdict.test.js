// The report's title is a plain window title. FireSquire's logo heads the verdict instead, and its
// own diamond frame takes the verdict's colour: neutral while the check runs, the state colour once
// it has answered, and the colour of a failure when the engine could not run. The frame glows on
// the motion engine's levels.
const { read, ok, done, rules, grabFn } = require('./lib');

const js = read('firesquire.js');
const css = rules(read('firesquire.css'));

console.log('\nThe title');
ok('the report window asks for no logo in its title', !/cls: 'fs-win-report'[^}]*logo:/.test(js));
ok('the window title holds its words alone', /title\.textContent = o\.title;/.test(grabFn(js, 'openWindow')));

console.log('\nThe verdict line');
ok('the verdict starts with the logo', /logoHTML\(\) \+ '<div class="fs-v-word">'/.test(grabFn(js, 'verdictHTML')));
ok('a running check shows it in the neutral colour', /<div class="fs-prog fs-v-unknown"><div class="fs-prog-lab">' \+ logoHTML\(\)/.test(grabFn(js, 'progressHTML')));
ok('an engine that could not run shows it in the failure colour', /<div class="fs-err fs-v-nogo">' \+ logoHTML\(\)/.test(grabFn(js, 'errHTML')));

console.log('\nThe frame');
const logo = (/var LOGO_SVG = ([\s\S]*?);\n/.exec(js) || [])[1] || '';
ok('the logo is drawn inline, not as a picture', /<svg viewBox=/.test(logo) && !/<img/.test(grabFn(js, 'logoHTML')));
ok('its four frame paths take the frame classes', (logo.match(/class="fs-lf(-lit)?"/g) || []).length === 4);
ok('its six flames keep their own colours', (logo.match(/fill="#[0-9a-f]{6}"/gi) || []).length === 6);
ok('the frame has no box behind it', !css.some((r) => /\.fs-v-logo\b/.test(r.selector) && /(^|;)\s*(background|border)(-[a-z]+)?\s*:/.test(r.body)));
const holder = css.find((r) => r.selector === 'html.cc-popups-on .fs-v-logo');
ok('the logo takes the verdict colour', !!holder && /color:\s*var\(--fs-v\)/.test(holder.body));
ok('the frame paths paint in it', css.some((r) => r.selector === '.fs-v-logo .fs-lf' && /fill:\s*currentColor/.test(r.body)));
const glow = css.find((r) => /\.fs-v-logo svg/.test(r.selector) && /animation:\s*fs-glow var\(--fs-motion-glow-dur\)/.test(r.body));
ok('the frame glows on the motion engine', !!glow && glow.at.some((a) => /no-preference/.test(a)));
ok('the glow stops at off', css.some((r) => r.selector === 'html[data-cc-motion="off"] .fs-v-logo svg' && /animation:\s*none/.test(r.body)));
ok('it shows only in the GlimStone look', css.some((r) => r.selector === '.fs-v-logo' && /display:\s*none/.test(r.body)));
for (const st of ['go', 'caution', 'nogo', 'unknown']) ok(`the ${st} state names a colour`, css.some((r) => r.selector.split(',').map((x) => x.trim()).includes('.fs-v-' + st) && /--fs-v:/.test(r.body)));

done();
