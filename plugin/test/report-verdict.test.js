// The report's title is a plain window title. FireSquire's logo heads the verdict instead, in a
// frame drawn in the verdict's colour: neutral while the check runs, the state colour once it has
// answered, and the colour of a failure when the engine could not run.
const { read, ok, done, rules, grabFn } = require('./lib');

const js = read('firesquire.js');
const css = rules(read('firesquire.css'));

console.log('\nThe title');
ok('the report window asks for no logo in its title', !/cls: 'fs-win-report'[^}]*logo:/.test(js));
ok('the window title holds its words alone', /title\.textContent = o\.title;/.test(grabFn(js, 'openWindow')));

console.log('\nThe verdict line');
ok('the verdict starts with the logo', /logoHTML\(\) \+ '<div class="fs-v-word">'/.test(grabFn(js, 'verdictHTML')));
ok('a running check shows it in the neutral frame', /<div class="fs-prog fs-v-unknown"><div class="fs-prog-lab">' \+ logoHTML\(\)/.test(grabFn(js, 'progressHTML')));
ok('an engine that could not run shows it in the failure frame', /<div class="fs-err fs-v-nogo">' \+ logoHTML\(\)/.test(grabFn(js, 'errHTML')));

console.log('\nThe frame');
const frame = css.find((r) => r.selector === 'html.cc-popups-on .fs-v-logo');
ok('it is drawn in the verdict colour', frame && /border:\s*2px solid var\(--fs-v\)/.test(frame.body));
ok('its corners follow the shape engine', frame && /border-radius:\s*var\(--fs-r-ctl\)/.test(frame.body));
ok('it shows only in the GlimStone look', css.some((r) => r.selector === '.fs-v-logo' && /display:\s*none/.test(r.body)));
for (const st of ['go', 'caution', 'nogo', 'unknown']) ok(`the ${st} state names a colour`, css.some((r) => r.selector.split(',').map((x) => x.trim()).includes('.fs-v-' + st) && /--fs-v:/.test(r.body)));

done();
