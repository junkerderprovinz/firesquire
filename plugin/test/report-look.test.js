// The report opens with a warning beacon in the level's colour: a lit dome with a bright core and a
// halo, and a beam that sweeps all the way round it, passing in front of and behind the dome, for
// Es glimmt and Feuer am Dach on the motion engine's dial, with a glow that breathes on top, lit but
// still without motion. The window has no head bar and closes from its foot, and FireSquire's logo
// lies behind it as a watermark larger than the window. The verdict names the level alone. Buttons
// have rounded corners and are never pills, in either look. Texts run as one paragraph each,
// without breaks set by hand.
const fs = require('fs');
const path = require('path');
const { DIR, read, ok, done, rules, keyframes, grabFn } = require('./lib');

const js = read('firesquire.js');
const sheets = read('firesquire.css') + '\n' + read('firesquire-info.css');
const css = rules(sheets);
const NO_PREF = (r) => r.at.some((a) => /prefers-reduced-motion:\s*no-preference/.test(a));
const rule = (sel) => css.find((r) => r.selector === sel);

console.log('\nThe warning beacon');
ok('the verdict starts with the beacon', /lampHTML\(\) \+ logoHTML\(\)/.test(grabFn(js, 'verdictHTML')));
const beacon = grabFn(js, 'lampHTML');
ok('it is decoration for a screen reader', /class="fs-v-lamp" aria-hidden="true"/.test(beacon));
ok('it has a halo, a dome on a base and a beam behind and in front of the dome',
  ['fs-lamp-halo', 'fs-lamp-dome', 'fs-lamp-base', 'fs-lamp-beam fs-lamp-back', 'fs-lamp-beam fs-lamp-front'].every((c) => beacon.includes(c))
  && beacon.indexOf('fs-lamp-back') < beacon.indexOf('fs-lamp-dome') && beacon.indexOf('fs-lamp-dome') < beacon.indexOf('fs-lamp-front'));
ok('it is drawn in the page, no picture from outside', !/<img|url\(/.test(beacon) && !css.some((r) => /fs-lamp/.test(r.selector) && /url\(/.test(r.body)));
const dome = rule('.fs-lamp-dome');
ok('the dome has a bright core in the level\'s colour', !!dome && /#fff/.test(dome.body) && /var\(--fs-v\)/.test(dome.body));
const halo = rule('.fs-lamp-halo');
const haloBox = css.find((r) => r.selector.split(',').map((x) => x.trim()).includes('.fs-lamp-halo') && /width:/.test(r.body));
ok('the halo lights the surroundings', !!halo && /radial-gradient\([^;]*var\(--fs-v\)/.test(halo.body) && !!haloBox && +(/width:\s*(\d+)px/.exec(haloBox.body) || [])[1] >= 2 * +(/width:\s*(\d+)px/.exec(dome.body) || [])[1]);
const beam = rule('.fs-lamp-beam');
ok('the beam lies flat around the dome', !!beam && /rotateX\(\d+deg\)/.test(beam.body));
const sweep = rule('.fs-lamp-beam::before');
ok('its light is a beam in the level\'s colour', !!sweep && /conic-gradient\([^;]*var\(--fs-v\)/.test(sweep.body));
ok('the front part only shows before the dome', /clip-path:\s*inset\(50% 0 0 0\)/.test((rule('.fs-lamp-front') || {}).body || ''));
ok('it shows in both looks', !css.some((r) => /fs-(v-)?lamp/.test(r.selector) && /display:\s*none/.test(r.body)));
const turns = css.filter((r) => /fs-lamp-beam::before/.test(r.selector) && /animation:\s*fs-beacon /.test(r.body));
ok('the beam sweeps round for Es glimmt and Feuer am Dach', turns.length > 0 && turns.every(NO_PREF) && turns.some((r) => r.selector.includes('.fs-v-caution'))
  && turns.some((r) => r.selector.includes('.fs-v-nogo')) && turns.every((r) => /infinite/.test(r.body)), turns.map((r) => r.selector).join(' | '));
ok('and stands still for Alles klar', !turns.some((r) => /fs-v-go\b/.test(r.selector)));
ok('it turns on the engine\'s dial, faster when the roof burns', turns.every((r) => /var\(--fs-motion-lamp-dur\)/.test(r.body))
  && css.some((r) => /\.fs-v-nogo .fs-lamp-beam::before/.test(r.selector) && /animation-duration:\s*calc\(var\(--fs-motion-lamp-dur\) \* \.6\)/.test(r.body) && NO_PREF(r)));
ok('a full turn, all the way round', /rotate\(-360deg\)/.test(keyframes(sheets)['fs-beacon'] || ''));
ok('it stops at off and stays lit', css.some((r) => r.selector.includes('[data-tt-motion="off"]') && r.selector.includes('.fs-lamp-beam::before') && /animation:\s*none/.test(r.body)));
ok('every level sets the dial', (sheets.match(/--fs-motion-lamp-dur:/g) || []).length === 4);
ok('the turn comes to rest at none', /transform:\s*none/.test((keyframes(sheets)['fs-beacon'] || '').split('to')[1] || ''));
ok('the turning cone is gone', !/fs-lamp-sweep/.test(sheets + js));

const glows = css.filter((r) => /\.fs-lamp-halo/.test(r.selector) && /animation:\s*fs-glow /.test(r.body));
ok('its glow breathes in and out on the engine\'s dial', glows.length > 0 && glows.every(NO_PREF) && glows.every((r) => /var\(--fs-motion-glow-dur\)/.test(r.body) && /infinite/.test(r.body)));
ok('every level sets the glow\'s dial, about two seconds at rest', (sheets.match(/--fs-motion-glow-dur:/g) || []).length === 4 && /--fs-motion-glow-dur:\s*2s/.test(sheets));
const pace = (sel) => css.find((r) => r.selector.includes(sel) && /fs-lamp-halo/.test(r.selector) && /animation-duration/.test(r.body) && NO_PREF(r));
ok('it breathes faster when the roof burns and calmer when all is clear', /\* \.6\)/.test((pace('.fs-v-nogo') || {}).body || '') && /\* 1\.5\)/.test((pace('.fs-v-go') || {}).body || ''));
ok('never more than three times a second', /\* \.6\)/.test((pace('.fs-v-nogo') || {}).body || '') && !/--fs-motion-glow-dur:\s*0?\.[0-4]\d*s/.test(sheets));
ok('the glow stops at off and stays lit', css.some((r) => r.selector.includes('[data-tt-motion="off"]') && r.selector.includes('.fs-lamp-halo') && /animation:\s*none/.test(r.body)));
ok('and rests where it started', /0%\s*,\s*100%/.test(keyframes(sheets)['fs-glow'] || ''));

console.log('\nThe verdict');
const verdict = css.filter((r) => /\.fs-verdict\b/.test(r.selector) && !/\.fs-v-/.test(r.selector));
ok('has no coloured edge', !verdict.some((r) => /box-shadow:\s*inset/.test(r.body)), verdict.map((r) => r.selector).join(' | '));
const vsrc = grabFn(js, 'verdictHTML');
ok('carries the level alone, no name, advice or time', !/fsT\('hc'\)|fsT\('subtitle'\)|fs-v-name|fs-v-adv|generated|fs-v-sub/.test(vsrc));
ok('the advisory texts are gone', !['hc', 'subtitle', 'foot'].some((k) => k in JSON.parse(read('lang/en.json'))));

console.log('\nThe logo in the background');
const runSrc = grabFn(js, 'run');
ok('the report window carries FireSquire\'s logo as a watermark', /class="fs-win-mark" aria-hidden="true"|'fs-win-mark'/.test(runSrc) && /LOGO_SVG/.test(runSrc));
ok('the verdict no longer has a mark of its own', !/fs-v-mark/.test(js + sheets));
const mark = rule('.fs-win-mark');
const op = mark && +((/opacity:\s*([\d.]+)/.exec(mark.body) || [])[1]);
ok('it lies behind everything and is never in the way', !!mark && /position:\s*absolute/.test(mark.body) && /inset:\s*0/.test(mark.body) && /pointer-events:\s*none/.test(mark.body) && /z-index:\s*0/.test(mark.body));
ok('as a faint watermark, four to eight percent on dark', op >= 0.04 && op <= 0.08, String(op));
const light = css.find((r) => /Theme--white/.test(r.selector) && /\.fs-win-mark/.test(r.selector) && /opacity/.test(r.body));
ok('a little less on light', !!light && +((/opacity:\s*([\d.]+)/.exec(light.body) || [])[1]) < op);
ok('larger than the window, cropped by its edges', +((/width:\s*(\d+)%/.exec((rule('.fs-win-mark svg') || {}).body || '') || [])[1]) >= 120
  && /overflow:\s*hidden/.test((rule('.fs-win-mark') || {}).body || ''));
ok('the content stands above it', css.some((r) => /\.fs-win-body/.test(r.selector) && /\.fs-win-act/.test(r.selector) && /z-index:\s*1/.test(r.body) && /position:\s*relative/.test(r.body)));
const cards = css.filter((r) => /^\.fs-f$|^\.fs-verdict$/.test(r.selector) && !r.at.length);
ok('the cards keep solid surfaces', cards.length === 2 && cards.every((r) => /background:\s*var\(--fs-card\)/.test(r.body)) && !css.some((r) => /\.fs-(f|verdict)\b/.test(r.selector) && /background:[^;]*transparent/.test(r.body)));

console.log('\nThe window');
const win = grabFn(js, 'openWindow');
ok('has no head bar', !/fs-win-head(?!ed)|fs-win-name|fs-win-logo/.test(win + sheets));
ok('closes with GlimStone\'s close button, glyph and words, in its foot', /button\('fs-win-btn', 'Close', fsT\('give_close'\)\)/.test(win) && /act\.appendChild\(close\)/.test(win));
ok('and nothing floats in a corner', !/fs-win-x/.test(js + sheets) && !/'×'/.test(win));
ok('the foot shows in both looks', !css.some((r) => /\.fs-win-headed .fs-win-act\b/.test(r.selector) && /display:\s*none/.test(r.body)));
const foot = rule('.fs-win-act');
ok('its buttons stand at the end, as GlimStone\'s dialog actions do', !!foot && /justify-content:\s*flex-end/.test(foot.body));
const btn = css.find((r) => r.selector === '.fs-win button.fs-win-btn' && !r.at.length);
ok('with rounded corners in both looks', !!btn && /border-radius:\s*var\(--fs-r-ctl\)/.test(btn.body));
ok('their glyphs show in Unraid\'s look too', css.some((r) => /\.fs-win-act \.fs-btn-g/.test(r.selector) && !/tt-popups-on/.test(r.selector) && /display:\s*inline-flex/.test(r.body)));
ok('with a visible focus ring', css.some((r) => /\.fs-win button\.fs-win-btn:focus-visible/.test(r.selector) && !/tt-popups-on/.test(r.selector) && /outline:\s*2px solid var\(--fs-focus\)/.test(r.body)));
ok('and Escape closes the window', /e\.key === 'Escape'[^\n]*done\(\)/.test(win));

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
