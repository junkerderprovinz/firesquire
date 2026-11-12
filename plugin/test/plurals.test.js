// A count reads as the language says it: "1 VM", "2 VMs", and in Russian, Polish or Arabic the
// forms their numbers ask for. A text that changes with a number holds a form per plural category
// of its language, the report and the notifications pick the form by the same rules, and no text
// hedges with "(s)".
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done, grabFn } = require('./lib');

const langs = Object.fromEntries(fs.readdirSync(path.join(DIR, 'lang')).map((f) => [f.slice(0, -5), JSON.parse(read('lang/' + f))]));
const js = read('firesquire.js');
const COUNTED = new Function('return ' + /var COUNTED = (\{[^\n]*\});/.exec(js)[1])();
const holes = (s) => (s.match(/\{\d+\}/g) || []).sort();

console.log('\nNo text hedges');
const HEDGE = /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}]\((?!z\))\p{L}{1,6}\)/u;
const strings = (v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v : Object.values(v));
for (const [lang, l] of Object.entries(langs)) {
  const hedged = Object.entries(l).filter(([, v]) => strings(v).some((s) => HEDGE.test(s))).map(([k]) => k);
  ok(`${lang}: no "(s)" or the like`, hedged.length === 0, hedged.join(', '));
}
const sources = ['firesquire.js', 'firesquire-check.sh', 'firesquire-health.sh', 'firesquire-more.sh', 'firesquire-fortress.php'];
const hedges = (f) => /\w\(s\)(?!\{)/.test(read(f));
ok('nor does an English message of the engine', !sources.some(hedges), sources.filter(hedges).join(', '));

console.log('\nEvery plural text fits its language');
for (const [lang, l] of Object.entries(langs)) {
  const rules = new Intl.PluralRules(lang);
  const used = new Set(Array.from({ length: 1001 }, (_, n) => rules.select(n)));
  const known = new Set(rules.resolvedOptions().pluralCategories);
  const bad = [];
  for (const [k, v] of Object.entries(l)) {
    if (typeof v !== 'object' || Array.isArray(v)) continue;
    if (!(k in COUNTED)) bad.push(k + ' counts nothing');
    if (typeof v.other !== 'string') bad.push(k + ' has no other form');
    for (const c of Object.keys(v)) if (!known.has(c)) bad.push(`${k}.${c} is no category of ${lang}`);
    for (const c of used) if (typeof v[c] !== 'string') bad.push(`${k} lacks ${c}`);
    for (const [c, s] of Object.entries(v)) if (holes(s).some((h) => !holes(v.other).includes(h))) bad.push(`${k}.${c} has a placeholder the other form lacks`);
  }
  ok(`${lang}: every form a number can ask for, and no other`, bad.length === 0, bad.join(', '));
}
const counted = Object.entries(langs.en).filter(([, v]) => typeof v === 'object' && !Array.isArray(v)).map(([k]) => k).sort();
ok('English gives every counted text its forms', JSON.stringify(counted) === JSON.stringify(Object.keys(COUNTED).sort()), counted.join(', '));

console.log('\nThe report picks the form');
const say = (lang, key, args) => {
  const ctx = { FS_I18N: langs[lang], FS_EN: {}, FS_LANGCODE: lang, COUNTED, Intl };
  return new Function(...Object.keys(ctx), grabFn(js, 'plural') + grabFn(js, 'fsT') + '; return fsT;')(...Object.values(ctx))(key, args);
};
ok('1 VM', say('en', 'vms_running', ['1']) === '1 VM running. Shut it down gracefully before rebooting.');
ok('2 VMs', say('en', 'vms_running', ['2']) === '2 VMs running. Shut them down gracefully before rebooting.');
ok('a file open', say('en', 'share_open', ['SMB', 'media', 'Laptop', '1']) === 'Laptop has 1 file open on the share media over SMB.');
ok('two days old', say('en', 'flash_backup_ok', ['2', 'Unraid Connect']) === 'The last flash backup (Unraid Connect) is 2 days old.');
ok('one disk named by the list\'s count', say('en', 'array_bad_devices', ['disk3', '1']) === 'Array not clean, unhealthy data disk: disk3');
ok('German: 1 VM läuft, 3 VMs laufen', say('de', 'vms_running', ['1']).startsWith('1 VM läuft') && say('de', 'vms_running', ['3']).startsWith('3 VMs laufen'));
ok('Russian: 1 день, 3 дня, 5 дней, 21 день', ['1 день', '3 дня', '5 дней', '21 день'].every((w) => say('ru', 'flash_backup_ok', [w.split(' ')[0], 'BombVault']).includes(w)));
ok('Polish: 1 dzień, 22 dni', say('pl', 'flash_backup_ok', ['1', 'X']).includes('1 dzień') && say('pl', 'flash_backup_ok', ['22', 'X']).includes('22 dni'));
ok('Polish: 2 pliki, 5 plików', say('pl', 'share_open', ['SMB', 'm', 'L', '2']).includes('2 otwarte pliki') && say('pl', 'share_open', ['SMB', 'm', 'L', '5']).includes('5 otwartych plików'));
ok('Arabic: two machines in the dual', say('ar', 'vms_running', ['2']).startsWith('جهازان'));
ok('Japanese keeps its one form', say('ja', 'vms_running', ['2']) === langs.ja.vms_running.replace('{0}', '2'));

console.log('\nThe notifications pick it alike');
const php = read('include/fs_notify.php');
const phpCounted = Object.fromEntries([...(/const FS_COUNTED = array\(([\s\S]*?)\);/.exec(php) || ['', ''])[1].matchAll(/'(\w+)' => (\d+)/g)].map((m) => [m[1], +m[2]]));
ok('they count the same argument', JSON.stringify(Object.entries(phpCounted).sort()) === JSON.stringify(Object.entries(COUNTED).sort()));
let cats = null;
try {
  const lib = path.join(DIR, 'include', 'fs_notify.php').replace(/\\/g, '/');
  cats = JSON.parse(execFileSync('php', ['-r', `require '${lib}'; $o = []; foreach (${JSON.stringify(Object.keys(langs)).replace(/\[/, 'array(').replace(/\]$/, ')')} as $l) for ($n = 0; $n <= 1000; $n++) $o[$l][] = fs_plural_category($l, $n); echo json_encode($o);`], { encoding: 'utf8' }));
} catch (e) {
  cats = { error: e.message };
}
const differ = Object.keys(langs).filter((l) => !cats[l] || cats[l].some((c, n) => c !== new Intl.PluralRules(l).select(n)));
ok('by the same rules for every number up to 1000', differ.length === 0, differ.join(', ') || cats.error);
const de = execFileSync('php', ['-r', `require '${path.join(DIR, 'include', 'fs_notify.php').replace(/\\/g, '/')}'; echo fs_text(fs_texts('de'), 'vms_running', ['1'], 'de');`], { encoding: 'utf8' });
ok('a German notification about one VM says so', de === langs.de.vms_running.one, de);

console.log('\nThe engine\'s own words');
const MORE = path.join(DIR, 'firesquire-more.sh').replace(/\\/g, '/');
const PLURAL = read('firesquire-check.sh').match(/^plural\(\) \{.*\}$/m)[0];
const msg = (body) => execFileSync('bash', ['-c', `source "${MORE}"\nadd() { printf '%s\\n' "$6"; }\n${PLURAL}\n${body}`], { encoding: 'utf8' }).trim();
ok('one file open', msg('share_finding SMB media Laptop 1 0') === 'Laptop has 1 file open on the share media over SMB.');
ok('two files being written', msg('share_finding SMB media Laptop 2 2') === 'Laptop is writing 2 files to the share media over SMB, maybe a copy.');

done();
