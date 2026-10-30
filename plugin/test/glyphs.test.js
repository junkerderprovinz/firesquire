// Every button FireSquire draws wears a GlimStone glyph, and every glyph it asks for is in its
// copy of the assortment.
const { read, ok, done } = require('./lib');

const table = read('firesquire-glyphs.js');
const have = new Set([...table.matchAll(/^\s+(\w+): \["/gm)].map((m) => m[1]));
const sources = { 'firesquire.js': read('firesquire.js'), 'firesquire-info.js': read('firesquire-info.js') };

console.log('\nThe copy names its release');
ok('copied from GlimStone 3.8.0', /GlimStone 3\.8\.0/.test(table));

for (const [file, src] of Object.entries(sources)) {
  console.log('\n' + file);
  const asked = [...src.matchAll(/(?<!function )(?:UI\.)?button\([^,()]*, "?'?(\w+)'?"?, /g)].map((m) => m[1])
    .concat([...src.matchAll(/glyph\('(\w+)'\)/g)].map((m) => m[1]));
  for (const name of new Set(asked)) ok(`${name} is in the table`, have.has(name));
}

console.log('\nThe meanings follow the glyph map');
const js = sources['firesquire.js'], info = sources['firesquire-info.js'];
ok('Close wears Close', /button\('fs-win-btn', 'Close', fsT\('give_close'\)\)/.test(js));
ok('Check again wears Retry', /button\('fs-win-btn', 'Retry', fsT\('retry'\)\)/.test(js));
ok('the way to a finding wears Forward', /button\('fs-f-go', 'Forward', fsT\('goto'\), 'a'\)/.test(js));
ok('the button beside Reboot wears Check', /button\('fs-main-btn', 'Check', 'FireSquire'\)/.test(js));
ok('running the check wears Check', /UI\.button\(cls, "Check", t\("tools_btn"\)\)/.test(info));
ok('Copy wears Copy', /UI\.button\("fs-win-btn fs-copy", "Copy", t\("crypto_copy"\)\)/.test(info));

done();
