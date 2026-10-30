// The report's title is a plain window title. FireSquire's logo heads the verdict instead, and its
// own diamond frame takes the verdict's colour: neutral while the check runs, the state colour once
// it has answered, and the colour of a failure when the engine could not run. When the answer
// arrives the frame turns from grey into its colour and the logo pops once, on the motion engine's
// levels. Nothing on the logo glows.
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
const logoRules = css.filter((r) => /\.fs-v-logo\b/.test(r.selector));
ok('nothing on the logo glows', !logoRules.some((r) => /(^|;)\s*(filter|box-shadow)\s*:|drop-shadow/.test(r.body)) && !/drop-shadow/.test(read('firesquire.css')));
const gated = (re) => css.find((r) => /\.fs-v-logo/.test(r.selector) && re.test(r.body) && r.at.some((x) => /no-preference/.test(x)));
const tint = gated(/animation:\s*fs-tint var\(--fs-motion-tint-dur\)/), pop = gated(/animation:\s*fs-pop var\(--fs-motion-pop-dur\)/);
ok('the answer turns the frame from grey into its colour', !!tint && tint.selector.includes(':is(.fs-verdict, .fs-err)'));
ok('and pops the logo once', !!pop && pop.selector.includes(':is(.fs-verdict, .fs-err)') && !/infinite/.test(pop.body));
ok('the running frame stands still', !css.some((r) => /\.fs-prog[^,]*\.fs-v-logo/.test(r.selector) && /animation/.test(r.body)));
ok('the colour starts from the running grey', read('firesquire.css').includes('@keyframes fs-tint { from { color: var(--fs-neutral); } }'));
ok('the motion stops at off', css.some((r) => r.selector.includes('[data-cc-motion="off"]') && r.selector.includes('.fs-v-logo svg') && /animation:\s*none/.test(r.body)));
ok('it shows only in the GlimStone look', css.some((r) => r.selector === '.fs-v-logo' && /display:\s*none/.test(r.body)));
for (const st of ['go', 'caution', 'nogo', 'unknown']) ok(`the ${st} state names a colour`, css.some((r) => r.selector.split(',').map((x) => x.trim()).includes('.fs-v-' + st) && /--fs-v:/.test(r.body)));

done();
