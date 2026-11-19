// GlimStone's rules for the buttons, a window's foot and a running bar, in the look TowerTorch
// switches on. A button reached by the pointer or the keyboard lights in TowerTorch's --tt-hover,
// as a row and a tab do, and its glyph takes the tint, its words in the text colour, and under the
// rainbow each button's glyph its own position. The answers in a foot hug their words and never
// end in an ellipsis, and the question beside them gives way first. A bar whose work runs carries
// a sheen. An open window makes the page behind it inert, and every button, card and window
// carries its GlimStone name.
const { read, ok, done, rules, keyframes } = require('./lib');

const js = read('firesquire.js');
const sheets = read('firesquire.css') + '\n' + read('firesquire-info.css');
const css = rules(sheets);
const NO_PREF = (r) => r.at.some((a) => /prefers-reduced-motion:\s*no-preference/.test(a));
const gated = (r) => /tt-popups-on/.test(r.selector);
const reached = (r) => /:hover/.test(r.selector) && /:focus-visible/.test(r.selector);

console.log('\nA button lights in the hover when it is reached for');
for (const [name, sel] of [['a window\'s answers', 'button.fs-win-btn'], ['the way to a finding', 'a.fs-f-go'], ['the settings page\'s buttons', '#fs-info .fs-btn']]) {
  const ground = css.filter((r) => gated(r) && reached(r) && r.selector.includes(sel) && /background(-color)?:\s*var\(--tt-hover, color-mix\(in srgb, var\(--fs-[\w-]+\),? var\(--fs-btn-tint\) 22%\)\)/.test(r.body));
  ok(`${name}: TowerTorch's hover in the ground, 22% of the tint without it`, ground.length > 0, sel);
  const words = ground.every((r) => /(^|;)\s*color:\s*var\(--(fs-text|tt-text)/.test(r.body));
  ok(`${name}: the words keep the text colour`, ground.length > 0 && words);
  ok(`${name}: the glyph takes the tint`, css.some((r) => gated(r) && reached(r) && r.selector.includes(sel) && /\.fs-btn-g/.test(r.selector) && /color:\s*var\(--fs-btn-tint\)/.test(r.body)));
}
const tint = css.find((r) => gated(r) && /--fs-btn-tint:/.test(r.body));
ok('the tint is the accent as a glyph, on the ramp\'s OKLab step as TowerTorch\'s ink is', !!tint && /--fs-btn-tint:\s*oklab\(from var\(--fs-hue, var\(--tt-accent[^)]*\)\) clamp\(var\(--tt-ink-min, 0\), l, var\(--tt-ink-max, 1\)\)/.test(tint.body), tint && tint.body);
console.log('\nThe focus ring is opaque, in the accent\'s ink');
{
  const all = rules(read('firesquire.css')).concat(rules(read('firesquire-info.css')));
  const themed = all.find((r) => /html\.tt-popups-on :is\(#fs-info, \.fs-win, \.fs-scrim\)/.test(r.selector) && /--fs-focus:/.test(r.body));
  ok('under TowerTorch the ring is the accent\'s ink', !!themed && /--fs-focus:\s*var\(--tt-accent-ink, #FCC419\)/.test(themed.body), themed && themed.body.match(/--fs-focus:[^;]*/)[0]);
  const rings = all.filter((r) => /:focus-visible/.test(r.selector) && /outline:\s*(?!none)\S/.test(r.body));
  ok('every ring takes TowerTorch\'s width, 3px with more contrast', rings.length > 0 && rings.every((r) => /outline:\s*var\(--tt-focus-ring-width, 2px\) solid var\(--fs-focus\)/.test(r.body)), rings.filter((r) => !/--tt-focus-ring-width/.test(r.body)).map((r) => r.selector).join(' | '));
  const rbtn = all.find((r) => r.selector === '#fs-info .fs-rbtn:focus-visible');
  ok('a README button draws the same ring inside its edge', !!rbtn && /box-shadow:\s*inset 0 0 0 var\(--tt-focus-ring-width, 2px\) var\(--fs-focus\) !important/.test(rbtn.body), rbtn && rbtn.body);
  ok('no translucent halo is left', !all.some((r) => /45%, transparent\)/.test(r.body)));
}
{
  const ph = rules(read('firesquire-info.css')).find((r) => /input\.fs-amount::placeholder/.test(r.selector));
  ok('the amount\'s placeholder takes GlimStone\'s placeholder colour through TowerTorch, 4.5:1 on every fill', !!ph && /color:\s*var\(--tt-field-placeholder, #c6c6c6\)/.test(ph.body), ph && ph.body);
}
ok('and sits on the button, where its rainbow position is set', !!tint && /fs-btn|fs-win-btn|fs-f-go/.test(tint.selector));
const tinted = css.filter((r) => gated(r) && reached(r) && /var\(--fs-btn-tint\)/.test(r.body) && /button\.fs-win-btn|#fs-info \.fs-btn/.test(r.selector));
ok('a disabled button stays as it is', tinted.length > 0 && tinted.every((r) => /:not\(:disabled\)/.test(r.selector)), tinted.filter((r) => !/:not\(:disabled\)/.test(r.selector)).map((r) => r.selector).join(' | '));
{
  const lit = css.filter((r) => gated(r) && /:hover/.test(r.selector) && /background:\s*var\(--tt-hover, var\(--fs-(tab|chip)\)\)/.test(r.body)).map((r) => r.selector).join(' | ');
  ok('an idle tab lights in the hover too', /#fs-info \.fs-tab:not\(\[aria-selected="true"\]\):hover/.test(lit), lit);
  ok('and so does a choice in a strip and a network', /\.fs-seg-opt:not\(\[aria-checked="true"\]\)/.test(lit) && /\.fs-net:not\(\[aria-selected="true"\]\)/.test(lit), lit);
}
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

console.log('\nA README button keeps the descenders of its name');
{
  const name = rules(read('firesquire-info.css')).find((r) => r.selector === '#fs-info .fs-rbtn-name');
  ok('the clip that ends a long name reaches past its line and gives the room back', !!name && /overflow:\s*hidden;[^}]*padding-block:\s*\.15em;\s*margin-block:\s*-\.15em;/.test(name.body), name && name.body);
}

done();
