// Notifications: a check that ends in CAUTION or NO-GO goes to the channels, and so does the way
// back to GO; a GO after a GO stays quiet. The message comes in Unraid's language from the same
// texts as the report. The channels are kit/notify's, sent through ParleyPort's notify helper, and
// a schedule runs the check without a click.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done } = require('./lib');

const LIB = path.join(DIR, 'include', 'fs_notify.php').replace(/\\/g, '/');
const en = JSON.parse(read('lang/en.json'));
const de = JSON.parse(read('lang/de.json'));

function php(code, stdin) {
  return execFileSync('php', ['-r', `require '${LIB}'; ${code}`], { input: stdin || '', encoding: 'utf8' });
}
const event = (report, last, lang) => {
  const out = php(`echo json_encode(fs_event(json_decode(stream_get_contents(STDIN), true), '${last}', '${lang}', 'tower'));`, JSON.stringify(report));
  return JSON.parse(out);
};
const fill = (s, args) => args.reduce((m, a, i) => m.split('{' + i + '}').join(a), s);

const nogo = {
  verdict: 'NO-GO',
  checks: [
    { tier: 'critical', id: 'mover', status: 'fail', key: 'mover_running', args: [], message: 'Mover is running.' },
    { tier: 'warning', id: 'crc', status: 'warn', key: 'crc_rose', args: ['sdc [pci-0000:00:17.0-ata-3]', '0', '2'], message: 'x' },
    { tier: 'critical', id: 'flash', status: 'pass', key: 'flash_ok', args: [], message: 'Flash fine.' },
    { tier: 'info', id: 'kernel', status: 'info', key: 'info_kernel', args: ['6.12'], message: 'Kernel' },
  ],
};

console.log('\nWhat goes out');
let e = event(nogo, 'GO', 'de');
ok('NO-GO is a failure', e.severity === 'failure' && e.kind === 'check.nogo' && e.ping === 'fail', JSON.stringify(e));
ok('the title names the server in Unraid\'s language', e.title === fill(de.n_title, ['tower', de['v_NO-GO']]), e.title);
ok('the body lists each problem in that language', e.body === [de.mover_running, fill(de.crc_rose, ['sdc [pci-0000:00:17.0-ata-3]', '0', '2'])].map((l) => '• ' + l).join('\n'), e.body);
ok('passed checks and notes stay out', !e.body.includes(de.flash_ok) && !e.body.includes('6.12'));
e = event({ ...nogo, verdict: 'CAUTION', checks: nogo.checks.slice(1) }, 'CAUTION', 'en');
ok('CAUTION is a warning, again on every run', e.severity === 'warning' && e.kind === 'check.caution' && e.title === fill(en.n_title, ['tower', en.v_CAUTION]), JSON.stringify(e));
e = event({ verdict: 'GO', checks: [] }, 'NO-GO', 'en');
ok('the way back to GO is a success', e.severity === 'success' && e.kind === 'check.go' && e.ping === 'success' && e.title === fill(en.n_title_go, ['tower', en.v_GO]) && e.body === en.n_body_go, JSON.stringify(e));
ok('a GO after a GO sends nothing', event({ verdict: 'GO', checks: [] }, 'GO', 'en') === null);
ok('a first GO sends nothing', event({ verdict: 'GO', checks: [] }, '', 'en') === null);
e = event(nogo, 'GO', 'xx');
ok('an unknown language falls back to English', e.title === fill(en.n_title, ['tower', en['v_NO-GO']]), e.title);

console.log('\nThe test message and the schedule');
e = JSON.parse(php(`echo json_encode(fs_test_event('de'));`));
ok('the test message is in Unraid\'s language', e.title === de.n_test_title && e.body === de.n_test_body && e.severity === 'info', JSON.stringify(e));
ok('a daily check runs at the chosen hour', php(`echo fs_cron('daily', 4);`).includes('30 4 * * * '));
ok('a weekly check runs on Sundays', php(`echo fs_cron('weekly', 23);`).includes('30 23 * * 0 '));
ok('the schedule runs the engine', /\/bin\/bash \/usr\/local\/emhttp\/plugins\/firesquire\/firesquire-check\.sh --json/.test(php(`echo fs_cron('daily', 4);`)));
ok('off has no line', php(`echo fs_cron('off', 4);`) === '');
ok('a bad hour has no line', php(`echo fs_cron('daily', 24);`) === '' && php(`echo fs_cron('hourly', 4);`) === '');

console.log('\nThe engine sends in the background and remembers the verdict');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-notify-'));
const state = path.join(tmp, 'state');
fs.mkdirSync(state);
fs.writeFileSync(path.join(state, 'notify.json'), '[{"id":"u","kind":"unraid","enabled":true,"on":"always"}]');
const helper = path.join(tmp, 'notify');
const got = path.join(tmp, 'got').replace(/\\/g, '/');
fs.writeFileSync(helper, `#!/bin/bash\n{ printf '%s\\n' "$*"; cat; } > "${got}.part"\nmv "${got}.part" "${got}"\n`);
fs.chmodSync(helper, 0o755);
let raw;
try {
  raw = execFileSync('bash', [path.join(DIR, 'firesquire-check.sh'), '--json'], {
    env: { ...process.env, FIRESQUIRE_NOTIFY: helper, FS_STATE: state.replace(/\\/g, '/'), FIRESQUIRE_FORTRESS_DIR: path.join(tmp, 'none') },
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  });
} catch (err) {
  raw = err.stdout;
}
const verdict = JSON.parse(raw).verdict;
const until = Date.now() + 10000;
while (!fs.existsSync(got) && Date.now() < until) execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},100)']);
const remembered = fs.existsSync(path.join(state, 'last.verdict')) ? fs.readFileSync(path.join(state, 'last.verdict'), 'utf8').trim() : null;
ok('the engine remembers the verdict', remembered === verdict, `${remembered} vs ${verdict}`);
if (verdict === 'GO') {
  ok('a first GO calls no helper', !fs.existsSync(got));
} else {
  const sent = fs.existsSync(got) ? fs.readFileSync(got, 'utf8') : '';
  const [args, ...body] = sent.split('\n');
  ok('a CAUTION or NO-GO goes to the helper with the channels', /^send -channels \S+notify\.json -source FireSquire$/.test(args), args);
  let ev = null;
  try { ev = JSON.parse(body.join('\n')); } catch (err) { /* reported below */ }
  ok('with the event on its input', ev && ev.title && ev.title.startsWith('FireSquire'), body.join('\n'));
}
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\nThe settings page');
const page = read('firesquire-notify.js');
const kinds = ['unraid', 'apprise', 'ntfy', 'gotify', 'matrix', 'discord', 'slack', 'smtp', 'webhook', 'healthchecks'];
const missingKinds = kinds.filter((k) => !new RegExp(`\\b${k}: \\[`).test(page));
ok('every service of kit/notify has its fields', missingKinds.length === 0, missingKinds.join(', '));
ok('every channel takes every message FireSquire sends', /on = "always"/.test(page));
ok('changes go out with Unraid\'s form token', /csrf_token/.test(page));
ok('the tools page loads it', /firesquire-notify\.js/.test(read('FireSquireTools.page')));
const asked = [...page.matchAll(/\bt\("([\w-]+)"\)/g)].map((m) => m[1]);
const unknown = [...new Set(asked)].filter((k) => !(k in en));
ok('every text it asks for is in en.json', asked.length > 20 && unknown.length === 0, unknown.join(', '));
const endpoint = read('include/FireSquireNotify.php');
ok('the endpoint keeps the channels with the other state', /\/boot\/config\/plugins\/firesquire\/notify\.json/.test(endpoint));
ok('the endpoint passes nothing unescaped to the shell', !/shell_exec|exec\(|system\(|passthru/.test(endpoint) || /escapeshellarg/.test(endpoint));

done();
