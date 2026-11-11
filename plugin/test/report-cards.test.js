// The three levels carry the fire in their names: All clear, Smouldering and The roof is on fire, in
// German Alles klar, Es glimmt and Feuer am Dach, in every other language a local saying of the same
// meaning or a faithful translation. The engine keeps
// GO, CAUTION and NO-GO as its codes. The report draws every finding as a card of its own in
// GlimStone's style, grouped by level, the same markup with and without TowerTorch, which only
// recolours them.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { DIR, read, ok, done, rules, grabFn } = require('./lib');

const langDir = path.join(DIR, 'lang');
const langs = Object.fromEntries(fs.readdirSync(langDir).map((f) => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(langDir, f), 'utf8'))]));
const names = (l) => [l.v_GO, l.v_CAUTION, l['v_NO-GO']];

console.log('\nThe names of the levels');
ok('English says All clear, Smouldering and The roof is on fire', JSON.stringify(names(langs.en)) === JSON.stringify(['All clear', 'Smouldering', 'The roof is on fire']), names(langs.en).join(' / '));
ok('German says Alles klar, Es glimmt and Feuer am Dach', JSON.stringify(names(langs.de)) === JSON.stringify(['Alles klar', 'Es glimmt', 'Feuer am Dach']), names(langs.de).join(' / '));
const codes = Object.entries(langs).filter(([, l]) => names(l).some((n) => /^(GO|NO-GO|CAUTION)$/.test(n)) || new Set(names(l)).size !== 3);
ok('every language names the three in its own words', codes.length === 0, codes.map(([k]) => k).join(', '));
const stale = [];
for (const [k, l] of Object.entries(langs)) {
  for (const [key, v] of Object.entries(l)) if (/\bNO-GO\b|\(GO\b|\bGO\b \//.test([].concat(v).join(' '))) stale.push(`${k}:${key}`);
}
ok('no text still names the old levels', stale.length === 0, stale.join(', '));
const unnamed = Object.entries(langs).filter(([, l]) => !['n_lead', 'tools_lead'].every((k) => l[k].includes(l['v_NO-GO']))).map(([k]) => k);
ok('the lead texts name the top level as the badge does', unnamed.length === 0, unnamed.join(', '));
const js = read('firesquire.js');
ok('the English fallback carries the names', /v_GO: 'All clear', v_CAUTION: 'Smouldering', 'v_NO-GO': 'The roof is on fire'/.test(js));
ok('the engine keeps its codes', /VERDICT="GO"/.test(read('firesquire-check.sh')) && /VCLASS = \{ GO: 'fs-v-go', CAUTION: 'fs-v-caution', 'NO-GO': 'fs-v-nogo' \}/.test(js));
ok('the console report names the level too', /VNAME="All clear"/.test(read('firesquire-check.sh')) && /VNAME="The roof is on fire"/.test(read('firesquire-check.sh')) && /FIRESQUIRE: \$VNAME/.test(read('firesquire-check.sh')));
const repo = path.join(__dirname, '..', '..');
const readme = fs.readFileSync(path.join(repo, 'README.md'), 'utf8');
ok('the README names them', /All clear/.test(readme) && /Smouldering/.test(readme) && /The roof is on fire/.test(readme) && !/On fire/.test(readme) && !/GO \/ CAUTION \/ NO-GO/.test(readme));
const thread = fs.readFileSync(path.join(repo, '.github', 'SUPPORT_THREAD.html'), 'utf8');
ok('the support thread names them', /All clear/.test(thread) && /The roof is on fire/.test(thread) && !/GO \/ CAUTION \/ NO-GO/.test(thread));

console.log('\nThe cards');
function report(themed, checks) {
  const ctx = { FS_I18N: langs.en, FS_EN: {}, themed: () => themed, location: { hostname: 'tower' } };
  vm.createContext(ctx);
  const src = ['fsT', 'esc', 'glyph', 'fsLink', 'ownLink', 'message', 'logoHTML', 'lampHTML', 'verdictHTML', 'rowHTML', 'reportHTML'].map((n) => grabFn(js, n)).join('\n');
  const vars = ['VCLASS', 'STATUS', 'QUOTES_LOG', 'LEVELS'].map((n) => (new RegExp(`var ${n} = [^\\n]*;`).exec(js) || [''])[0]).join('\n');
  vm.runInContext(`var GLYPHS = {}; var LOGO_SVG = '<svg></svg>';\n${vars}\n${src}\nthis.out = reportHTML(${JSON.stringify({ verdict: 'NO-GO', checks })});`, ctx);
  return ctx.out;
}
const checks = [
  { tier: 'critical', status: 'pass', key: 'flash_ok', args: [], message: 'Flash fine.' },
  { tier: 'info', status: 'info', key: 'info_kernel', args: ['6.12'], message: 'Kernel' },
  { tier: 'warning', status: 'warn', key: 'vms_running', args: ['1'], message: 'VMs' },
  { tier: 'critical', status: 'fail', key: 'mover_running', args: [], message: 'Mover' },
  { tier: 'warning', status: 'warn', key: 'unclean', args: [], message: 'Unclean' },
];
const plain = report(false, checks), gs = report(true, checks);
ok('the report is the same with and without TowerTorch', plain === gs);
const groups = [...plain.matchAll(/<section class="fs-level fs-st-(\w+)"><h3 class="fs-level-h">([^<]*)<\/h3>/g)].map((m) => m[1] + ':' + m[2]);
ok('the findings stand by level, the worst first, each under its name', JSON.stringify(groups) === JSON.stringify(['fail:The roof is on fire', 'warn:Smouldering', 'pass:All clear', 'info:' + langs.en.tier_info]), groups.join(', '));
ok('every finding is a card of its own', (plain.match(/<div class="fs-f fs-st-\w+">/g) || []).length === checks.length);
ok('two cautions share their group', /fs-st-warn"><h3[^]*?fs-f fs-st-warn[^]*?fs-f fs-st-warn[^]*?<\/section>/.test(plain));
ok('a finding that leads to a page carries the button in both looks', /data-goto="\/Main"/.test(plain) && /data-goto="\/VMs"/.test(plain));

console.log('\nTowerTorch only recolours');
const css = rules(read('firesquire.css'));
const card = css.find((r) => r.selector === '.fs-f');
ok('a card has the card radius and surface without TowerTorch', !!card && /border-radius:\s*var\(--fs-r-card\)/.test(card.body) && /background:\s*var\(--fs-card\)/.test(card.body));
const layout = css.filter((r) => /tt-popups-on/.test(r.selector) && /\.fs-(f|f-ic|level|level-h)(?![\w-])/.test(r.selector) && /(^|;)\s*(padding|margin|min-height|height|width|display|border|flex|gap|border-radius)\s*:/.test(r.body));
ok('no TowerTorch rule changes the cards\' shape', layout.length === 0, layout.map((r) => r.selector).join(' | '));
ok('no tier headings are left', !/fs-tier/.test(read('firesquire.css') + js));

done();
