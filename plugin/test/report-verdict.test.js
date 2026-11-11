// The report's window carries no logo at all: no title bar with one, no mark behind the verdict or
// the window, and none beside the word. The verdict is the warning beacon and the level in the
// level's colour, the running check stands in the neutral colour and an engine that could not run
// in the colour of a failure.
const { read, ok, done, rules, grabFn } = require('./lib');

const js = read('firesquire.js');
const sheets = read('firesquire.css') + '\n' + read('firesquire-info.css');
const css = rules(sheets);

console.log('\nThe title');
ok('the report window asks for no logo in its title', !/cls: 'fs-win-report'[^}]*logo:/.test(js));
ok('the window title holds its words alone', /title\.textContent = o\.title;/.test(grabFn(js, 'openWindow')));

console.log('\nNo logo in the window');
ok('the script draws no logo into it', !/LOGO_SVG|logoHTML|var LOGO\b/.test(js));
ok('no rule styles one', !/fs-v-logo|fs-win-mark|fs-lf\b|fs-lf-lit/.test(sheets));
ok('and the motion that coloured it is gone', !/fs-tint|fs-pop|--fs-motion-tint-dur|--fs-motion-pop-/.test(sheets));

console.log('\nThe verdict line');
ok('the verdict is the beacon and the word', /lampHTML\(\) \+ '<div class="fs-v-word">'/.test(grabFn(js, 'verdictHTML')));
ok('a running check shows in the neutral colour', /<div class="fs-prog fs-v-unknown"><div class="fs-prog-lab"><span class="fs-prog-txt">/.test(grabFn(js, 'progressHTML')));
ok('an engine that could not run shows in the failure colour', /<div class="fs-err fs-v-nogo"><div><p class="fs-err-text">/.test(grabFn(js, 'errHTML')));
for (const st of ['go', 'caution', 'nogo', 'unknown']) ok(`the ${st} state names a colour`, css.some((r) => r.selector.split(',').map((x) => x.trim()).includes('.fs-v-' + st) && /--fs-v:/.test(r.body)));

done();
