// One markup, two looks: Unraid's own without TowerTorch, GlimStone's with it, switched by
// html.cc-popups-on, the class TowerTorch sets on every page (GlimStone 3.8.0, "Unraid plugins").
const { read, ok, done, rules } = require('./lib');

const files = ['firesquire.css', 'firesquire-info.css', 'firesquire.js', 'firesquire-info.js', 'FireSquireTools.page'];

console.log('\nThe gate');
for (const f of files) ok(`${f} does not key on cc-tools-on`, !/cc-tools-on/.test(read(f)));
const js = read('firesquire.js');
ok('the script asks the same class', /classList\.contains\('cc-popups-on'\)/.test(js));

console.log('\nTowerTorch tokens only behind the gate');
const css = rules(read('firesquire.css'));
const leaks = css.filter((r) => /var\(--cc-(accent|surface|text|ok|warn|err)/.test(r.body) && !/cc-popups-on/.test(r.selector));
ok('no rule outside the gate reads a TowerTorch colour', leaks.length === 0, leaks.map((r) => r.selector).join(' | '));

console.log('\nEvery page loads what it draws with');
const buttons = read('FireSquireButtons.page');
ok('every page loads the stylesheet', /firesquire\.css/.test(buttons));
ok('the glyphs load before the script', buttons.indexOf('firesquire-glyphs.js') > 0 && buttons.indexOf('firesquire-glyphs.js') < buttons.indexOf('firesquire.js?'));

done();
