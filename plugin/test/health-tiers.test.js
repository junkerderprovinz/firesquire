// Findings about how the server stands and advice on its settings ride along with the pre-reboot
// check without moving its verdict: they carry the tier health or config, the reboot report and
// its notification leave them out, and the console prints them in groups of their own.
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done, grabFn } = require('./lib');

const ENGINE = path.join(DIR, 'firesquire-check.sh').replace(/\\/g, '/');
const LIB = path.join(DIR, 'include', 'fs_notify.php').replace(/\\/g, '/');
const en = JSON.parse(read('lang/en.json'));

// Runs the engine's add() on the findings and prints the worst level and the JSON items.
function engine(calls) {
  const script = `
set -u
eval "$(sed -n '/^json_escape() {/,/^}/p;/^add() {/,/^}/p' "${ENGINE}")"
WORST=0; JSON_ITEMS=""; TXT_CRIT=""; TXT_WARN=""; TXT_INFO=""; TXT_HEALTH=""; TXT_CONFIG=""
${calls}
printf '%s\\n' "$WORST" "[$JSON_ITEMS]"
printf '%s' "$TXT_HEALTH" | tr '\\n' '~'; echo
printf '%s' "$TXT_CONFIG" | tr '\\n' '~'; echo
`;
  const [worst, items, health, config] = execFileSync('bash', ['-c', script], { encoding: 'utf8' }).split('\n');
  return { worst: Number(worst), items: JSON.parse(items), health, config };
}

console.log('\nThe verdict');
let r = engine(`add health smart_trend warn smart_trend_rose "sdc|Reallocated|0|8" "x"
add config share_cache warn cfg_cache_only_array "media|disk1" "y"
add health net_link fail net_down "eth0" "z"`);
ok('health and configuration findings leave the verdict at All clear', r.worst === 0, r.worst);
ok('and still reach the JSON with their tier', r.items.map((i) => i.tier).join() === 'health,config,health', JSON.stringify(r.items));
ok('the console groups them apart', /smart_trend|x/.test(r.health) && /y/.test(r.config) && !/y/.test(r.health), JSON.stringify([r.health, r.config]));
r = engine(`add warning crc warn crc_rose "sdc|0|2" "x"\nadd health smart_trend pass smart_trend_ok "" "y"`);
ok('a reboot warning still makes it Smouldering', r.worst === 1);
r = engine(`add critical mover fail mover_running "" "x"`);
ok('a critical failure still sets the roof on fire', r.worst === 2);

const src = read('firesquire-check.sh');
ok('the console prints a Health and a Configuration group', /-- Health --/.test(src) && /-- Configuration --/.test(src));

console.log('\nThe reboot report');
const js = read('firesquire.js');
const ctx = { FS_I18N: en, FS_EN: {}, FS_LANGCODE: 'en', Intl, location: { hostname: 'tower' }, GLYPHS: {}, COUNTED: {} };
const fns = ['plural', 'fsT', 'esc', 'glyph', 'fsLink', 'ownLink', 'message', 'lampHTML', 'verdictHTML', 'rowHTML', 'reportHTML'].map((n) => grabFn(js, n)).join('\n');
const consts = /var VCLASS[^\n]*\n\s*var STATUS[^\n]*\n[\s\S]*?var QUOTES_LOG[^\n]*/.exec(js)[0] + '\n' + /var LEVELS = [^\n]*/.exec(js)[0] + '\n' + /var AFTERCARE = [^\n]*/.exec(js)[0];
const reportHTML = vm.runInNewContext(`${consts}\n${fns}\nreportHTML`, ctx);
const html = reportHTML({ verdict: 'GO', checks: [
  { tier: 'critical', id: 'flash', status: 'pass', key: 'flash_ok', args: [] },
  { tier: 'health', id: 'smart_trend', status: 'warn', key: 'zz_health', args: [], message: 'HEALTH-ONLY' },
  { tier: 'config', id: 'share', status: 'warn', key: 'zz_config', args: [], message: 'CONFIG-ONLY' },
] });
ok('shows the reboot findings', html.includes(en.flash_ok));
ok('and leaves health and configuration out', !html.includes('HEALTH-ONLY') && !html.includes('CONFIG-ONLY'));

console.log('\nThe notification');
const out = execFileSync('php', ['-r', `require '${LIB}'; echo json_encode(fs_event(json_decode(stream_get_contents(STDIN), true), 'GO', 'en', 'tower'));`], {
  encoding: 'utf8',
  input: JSON.stringify({ verdict: 'CAUTION', checks: [
    { tier: 'warning', id: 'crc', status: 'warn', key: 'crc_rose', args: ['sdc', '0', '2'] },
    { tier: 'health', id: 'smart_trend', status: 'warn', key: 'zz', args: [], message: 'HEALTH-ONLY' },
    { tier: 'config', id: 'share', status: 'warn', key: 'zz', args: [], message: 'CONFIG-ONLY' },
  ] }),
});
const ev = JSON.parse(out);
ok('the reboot notification lists only what stands in the reboot\'s way', ev.body.split('\n').length === 1 && !/ONLY/.test(ev.body), ev.body);

done();
