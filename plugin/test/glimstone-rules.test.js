// GlimStone 4.3.7's rules for the buttons, a window's foot and a running bar, in the look
// TowerTorch switches on. A button reached by the pointer or the keyboard takes its tint: 22% of it
// in its ground and all of it in its glyph, its words in the text colour, and under the rainbow
// each button its own position. The answers in a foot hug their words and never end in an
// ellipsis, and the question beside them gives way first. A bar whose work runs carries a sheen.
// An open window makes the page behind it inert, and every button, card and window carries its
// GlimStone name.
const { read, ok, done, rules, keyframes } = require('./lib');

const js = read('firesquire.js');
const sheets = read('firesquire.css') + '\n' + read('firesquire-info.css');
const css = rules(sheets);
const NO_PREF = (r) => r.at.some((a) => /prefers-reduced-motion:\s*no-preference/.test(a));
const gated = (r) => /tt-popups-on/.test(r.selector);
const reached = (r) => /:hover/.test(r.selector) && /:focus-visible/.test(r.selector);

console.log('\nA button takes its tint when it is reached for');
for (const [name, sel] of [['a window\'s answers', 'button.fs-win-btn'], ['the way to a finding', 'a.fs-f-go'], ['the settings page\'s buttons', '#fs-info .fs-btn']]) {
  const ground = css.filter((r) => gated(r) && reached(r) && r.selector.includes(sel) && /background(-color)?:\s*color-mix\(in srgb, var\(--fs-[\w-]+\),? var\(--fs-btn-tint\) 22%\)/.test(r.body));
  ok(`${name}: 22% of the tint in the ground`, ground.length > 0, sel);
  const words = ground.every((r) => /(^|;)\s*color:\s*var\(--(fs-text|tt-text)/.test(r.body));
  ok(`${name}: the words keep the text colour`, ground.length > 0 && words);
  ok(`${name}: the glyph takes the tint`, css.some((r) => gated(r) && reached(r) && r.selector.includes(sel) && /\.fs-btn-g/.test(r.selector) && /color:\s*var\(--fs-btn-tint\)/.test(r.body)));
}
const tint = css.find((r) => gated(r) && /--fs-btn-tint:/.test(r.body));
ok('the tint is the accent as a glyph, darker on a light theme', !!tint && /--fs-btn-tint:\s*color-mix\(in srgb, var\(--fs-hue, var\(--tt-accent[^)]*\)\) var\(--tt-ink-mix, 100%\), black\)/.test(tint.body));
ok('and sits on the button, where its rainbow position is set', !!tint && /fs-btn|fs-win-btn|fs-f-go/.test(tint.selector));
const tinted = css.filter((r) => gated(r) && reached(r) && /var\(--fs-btn-tint\)/.test(r.body) && /button\.fs-win-btn|#fs-info \.fs-btn/.test(r.selector));
ok('a disabled button stays as it is', tinted.length > 0 && tinted.every((r) => /:not\(:disabled\)/.test(r.selector)), tinted.filter((r) => !/:not\(:disabled\)/.test(r.selector)).map((r) => r.selector).join(' | '));
ok('Unraid\'s look keeps its own hover', css.some((r) => r.selector === '.fs-win button.fs-win-btn:hover' && /var\(--fs-head\)/.test(r.body)));

console.log('\nUnder the rainbow every button its own colour');
ok('a button takes its position as the pointer or the focus reaches it', /addEventListener\('pointerover', takeHue\)/.test(js) && /addEventListener\('focusin', takeHue\)/.test(js));
ok('counted in the order the buttons stand', /querySelectorAll\('\.fs-btn'\)/.test(js) && /hue\(b, /.test(js));

console.log('\nThe answers in a foot');
const foot = css.find((r) => r.selector === 'html.tt-popups-on .fs-win button.fs-win-btn' && !r.at.length);
ok('hug their words down to 5.5rem', !!foot && /min-width:\s*5\.5rem/.test(foot.body));
ok('never shrink to an ellipsis', css.some((r) => /\.fs-win-act/.test(r.selector) && /\.fs-win-btn/.test(r.selector) && /flex:\s*none/.test(r.body)));
const wrap = css.find((r) => gated(r) && /\.fs-win-act/.test(r.selector) && /\.fs-btn-l/.test(r.selector) && /white-space:\s*normal/.test(r.body));
ok('a word too long for the foot runs onto a second line', !!wrap && /text-wrap:\s*balance/.test(wrap.body));
ok('only while the words show', !!wrap && /:not\(\[data-tt-labels-buttons="glyph"\]\)/.test(wrap.selector) && /:not\(\[data-tt-labels-buttons="reactive"\]\)/.test(wrap.selector));
const ask = css.find((r) => /\.fs-win-act \.fs-win-ask$/.test(r.selector));
ok('the question beside them gives way first', !!ask && /flex:\s*1 1 0/.test(ask.body) && /min-width:\s*min\(4rem, 100%\)/.test(ask.body) && /overflow-wrap:\s*anywhere/.test(ask.body));

console.log('\nA running bar carries a sheen');
const sheen = css.find((r) => gated(r) && /\.fs-prog-fill::after/.test(r.selector) && /linear-gradient/.test(r.body));
ok('a light over the filled part', !!sheen);
const runs = css.filter((r) => /\.fs-prog-fill/.test(r.selector) && /::after/.test(r.selector) && /animation:\s*fs-prog-sheen /.test(r.body));
ok('on the engine\'s dial, inside the reduced-motion gate', runs.length > 0 && runs.every(NO_PREF) && runs.every((r) => /var\(--fs-motion-progress-sheen-dur\)/.test(r.body) && /infinite/.test(r.body)));
ok('not on a bar that waits without a value', runs.every((r) => /:not\(\.fs-indet\)/.test(r.selector)));
ok('and still at off', runs.every((r) => /:not\(\[data-tt-motion="off"\]\)/.test(r.selector)));
ok('every level sets the dial', (sheets.match(/--fs-motion-progress-sheen-dur:/g) || []).length === 4);
ok('the pass crosses the fill', /translate:\s*100% 0/.test(keyframes(sheets)['fs-prog-sheen'] || ''));

console.log('\nAn open window holds the page behind it');
ok('everything behind it turns inert', /behind = Array\.prototype\.filter\.call\(document\.body\.children/.test(js) && /n\.inert = true/.test(js));
ok('and wakes up again when it closes', /behind\.forEach\(function\(n\)\{ n\.inert = false; \}\)/.test(js));

console.log('\nEvery element names itself by its GlimStone name');
ok('a button', /b\.setAttribute\('data-glim', 'Button'\)/.test(js));
ok('a window, with its title', /win\.setAttribute\('data-glim', 'Window'\)/.test(js) && /win\.setAttribute\('data-glim-title', o\.title\)/.test(js));
for (const f of ['firesquire-info.js', 'firesquire-notify.js']) {
  ok(`a card in ${f}, with its title`, /\.setAttribute\("data-glim", "Card"\)/.test(read(f)) && /\.setAttribute\("data-glim-title", /.test(read(f)));
}

done();
