// TollRoll's notification hub: when a TollRoll of the fortress lists notify.hub in its status,
// FireSquire hands it every message through the fortress action notify.deliver. Only a reply of
// {"taken":true} counts as sent; anything else, and a TollRoll out of reach, sends the message
// the way it always went, through the notify helper and the channels on the flash. Healthchecks
// pings stay with FireSquire. Every message carries a key, so the way back to All clear closes
// it, and a level that changes closes the one before.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done } = require('./lib');

const HUB = path.join(DIR, 'firesquire-hub.sh').replace(/\\/g, '/');
const LIB = path.join(DIR, 'include', 'fs_notify.php').replace(/\\/g, '/');
const FLIB = path.join(DIR, 'include', 'fs_fortress.php').replace(/\\/g, '/');
const en = JSON.parse(read('lang/en.json'));
const de = JSON.parse(read('lang/de.json'));
const fill = (s, a) => a.reduce((m, x, i) => m.split('{' + i + '}').join(x), s);
const php = (code, input) => execFileSync('php', ['-r', code], { input: input || '', encoding: 'utf8' });

console.log('\nThe keys of the messages');
const event = (report, last, lang = 'en') => JSON.parse(php(`require '${LIB}'; echo json_encode(fs_event(json_decode(stream_get_contents(STDIN), true), '${last}', '${lang}', 'tower'));`, JSON.stringify(report)));
const nogo = { verdict: 'NO-GO', checks: [{ tier: 'critical', id: 'mover', status: 'fail', key: 'mover_running', args: [] }] };
let e = event(nogo, 'CAUTION');
ok('The roof is on fire has a key of its own and closes Smouldering', e.key === 'firesquire.check.nogo' && JSON.stringify(e.hub.resolve) === '["firesquire.check.caution"]', JSON.stringify(e));
ok('the hub gets a title without FireSquire\'s name, which TollRoll puts in front', e.hub.title === fill(en.n_hub_title, ['tower', en['v_NO-GO']]) && !/FireSquire/.test(e.hub.title), e.hub.title);
e = event({ ...nogo, verdict: 'CAUTION' }, 'CAUTION');
ok('Smouldering again closes nothing', e.key === 'firesquire.check.caution' && e.hub.resolve.length === 0);
e = event({ verdict: 'GO', checks: [] }, 'NO-GO', 'de');
ok('the way back to All clear is a success with the key it closes', e.severity === 'success' && e.key === 'firesquire.check.nogo' && e.hub.title === fill(de.n_hub_title_go, ['tower', de.v_GO]), JSON.stringify(e));

const linked = JSON.parse(execFileSync('php', ['-r', `require '${LIB}'; echo json_encode(fs_event(json_decode(stream_get_contents(STDIN), true), 'GO', 'en', 'tower'));`],
  { input: JSON.stringify(nogo), encoding: 'utf8', env: { ...process.env, FS_NGINX_INI: path.join(__dirname, 'fixtures', 'nginx.ini') } }));
ok('every message links to FireSquire\'s settings by its path, which TollRoll makes whole for the outside', linked.link === '/Settings/FireSquireTools', linked.link);
ok('also without Unraid\'s address', event(nogo, 'GO').link === '/Settings/FireSquireTools');

console.log('\nFinding TollRoll');
const hubs = (members) => php(`require '${FLIB}'; echo implode(',', fs_fortress_hubs(stream_get_contents(STDIN)));`, JSON.stringify(members));
const member = (id, app, caps, report = true) => ({ id, app: { id: app }, ...(report ? { report: { capabilities: caps } } : {}) });
ok('a TollRoll that takes over is a hub', hubs([member('t1', 'tollroll', ['notify.hub']), member('b1', 'bombvault', ['notify.hub']), member('t2', 'tollroll', []), member('t3', 'tollroll', null, false)]) === 't1');
ok('several are tried in turn', hubs([member('t1', 'tollroll', ['notify.hub']), member('t2', 'tollroll', ['notify.hub'])]) === 't1,t2');
ok('a status that is no list finds none', hubs('oops') === '');

console.log('\nAsking to use notify.deliver');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-hub-'));
const T = tmp.replace(/\\/g, '/');
fs.mkdirSync(path.join(tmp, 'fortress'));
const fj = path.join(tmp, 'fortress', 'fortress.json');
fs.writeFileSync(fj, JSON.stringify({ app: 'firesquire', name: 'tower', uses: ['backup.last'], seed: 'x' }));
php(`require '${FLIB}'; fs_fortress_uses_ensure('${T}/fortress');`);
ok('a member that joined before learns to use notify.deliver', JSON.stringify(JSON.parse(fs.readFileSync(fj, 'utf8')).uses) === '["backup.last","notify.deliver"]');
ok('and keeps everything else', JSON.parse(fs.readFileSync(fj, 'utf8')).seed === 'x');
fs.utimesSync(fj, new Date(2000, 0, 1), new Date(2000, 0, 1));
php(`require '${FLIB}'; fs_fortress_uses_ensure('${T}/fortress');`);
ok('the file is left alone once it does', fs.statSync(fj).mtime.getFullYear() === 2000);
ok('a new member joins with both', /const FS_FORTRESS_USES = 'backup\.last,notify\.deliver';/.test(read('include/fs_fortress.php')));
ok('the install adds it to a membership from before', /fs_fortress_uses_ensure\(/.test(fs.readFileSync(path.join(__dirname, '..', 'firesquire.plg'), 'utf8')));

console.log('\nSending');
fs.mkdirSync(path.join(tmp, 'state'));
fs.writeFileSync(path.join(tmp, 'state', 'notify.json'), JSON.stringify([
  { id: 'u', kind: 'unraid', enabled: true, on: 'always' },
  { id: 'n', kind: 'ntfy', enabled: true, on: 'always', url: 'https://ntfy.example/x' },
  { id: 'h', kind: 'healthchecks', enabled: true, on: 'always', url: 'https://hc.example/ping/abc' },
]));
fs.writeFileSync(path.join(tmp, 'fortress-helper'), `#!/bin/bash
echo "$*" >> "${T}/acts"
case "$6" in
  ${'$'}{FAKE_OK:-none}) echo '{"taken":true}' ;;
  down) exit 1 ;;
  *) echo '{"error":"hub_off"}' ;;
esac
`);
fs.writeFileSync(path.join(tmp, 'notify-helper'), `#!/bin/bash
{ echo "$*"; cat "$3"; echo; cat; } >> "${T}/sent"
`);
for (const h of ['fortress-helper', 'notify-helper']) fs.chmodSync(path.join(tmp, h), 0o755);
const ev = JSON.stringify({ kind: 'check.caution', severity: 'warning', ping: 'fail', key: 'firesquire.check.caution', title: 'FireSquire on tower: Smouldering', body: '• x', link: '/Settings/FireSquireTools',
  hub: { title: 'tower: Smouldering', resolve: ['firesquire.check.nogo'] } });
function send(hubList, okId) {
  for (const f of ['acts', 'sent']) fs.rmSync(path.join(tmp, f), { force: true });
  execFileSync('bash', ['-c', `set -u
source "${HUB}"
FORTRESS="${T}/fortress-helper"; FORTRESS_DIR="${T}/fortress"; NOTIFY="${T}/notify-helper"; FS_STATE="${T}/state"; FS_RUN="${T}/run"; HERE="${DIR.replace(/\\/g, '/')}"
hub_send '${hubList}' "$(cat)"`], { input: ev, encoding: 'utf8', env: { ...process.env, FAKE_OK: okId || 'none', FS_NGINX_INI: path.join(__dirname, 'fixtures', 'nginx.ini') } });
  const rd = (f) => (fs.existsSync(path.join(tmp, f)) ? fs.readFileSync(path.join(tmp, f), 'utf8') : '');
  // Each send is the helper's arguments, the channel list it got and the event.
  const sends = rd('sent').split(/^(?=send -channels )/m).filter(Boolean).map((b) => {
    const [args, list, event] = b.split('\n').filter(Boolean);
    return { args, kinds: (JSON.parse(list || '[]')).map((c) => c.kind).join(','), event: JSON.parse(event || '{}') };
  });
  return { acts: rd('acts').trim().split('\n').filter(Boolean), sent: rd('sent'), sends };
}
let r = send('t1', 't1');
const deliver = r.acts.find((a) => / t1 notify\.deliver \{"kind"/.test(a));
ok('a hub that takes it gets it through notify.deliver', !!deliver && /-dir \S+fortress -wait \d+s t1 notify\.deliver /.test(deliver), r.acts.join(' | '));
const body = deliver ? JSON.parse(deliver.slice(deliver.indexOf('notify.deliver ') + 15)) : {};
ok('with its title, its key and no ping', body.title === 'tower: Smouldering' && body.key === 'firesquire.check.caution' && body.severity === 'warning' && !('ping' in body) && !('hub' in body), JSON.stringify(body));
ok('the level before is closed first', r.acts.some((a) => /notify\.deliver \{"key":"firesquire\.check\.nogo","resolved":true\}$/.test(a)), r.acts.join(' | '));
ok('the channels on the flash get only the Healthchecks ping', /healthchecks/.test(r.sent) && !/ntfy/.test(r.sent) && /"ping":"fail"/.test(r.sent), r.sent);
ok('and the copy of that channel list is gone afterwards', !fs.existsSync(path.join(tmp, 'run')) || fs.readdirSync(path.join(tmp, 'run')).length === 0);
r = send('t1', '');
ok('a hub that is off leaves the message to the channels on the flash', /ntfy/.test(r.sent) && !/"hub"/.test(r.sent), r.sent);
const own = r.sends.find((x) => x.kinds === 'unraid'), out = r.sends.find((x) => x.kinds === 'ntfy,healthchecks');
ok('Unraid\'s own notification gets the link as a path, which its WebGUI opens', own && own.event.link === '/Settings/FireSquireTools', JSON.stringify(r.sends));
ok('the channels outside get it whole, from Unraid\'s own address', out && out.event.link === 'https://tower.local:443/Settings/FireSquireTools', JSON.stringify(r.sends));
ok('each channel hears the message once', r.sends.length === 2);

console.log('\nThe way back');
const back = event({ verdict: 'GO', checks: [] }, 'CAUTION');
ok('the way back to All clear is marked as a recovery', back.recovery === true && back.severity === 'success');
ok('a level that is no way back is not', !('recovery' in event(nogo, 'GO')));
fs.writeFileSync(path.join(tmp, 'state', 'notify.json'), JSON.stringify([
  { id: 'n', kind: 'ntfy', enabled: true, on: 'failure', url: 'https://ntfy.example/x' },
  { id: 'm', kind: 'matrix', enabled: true, on: 'always', matrix: { homeserver: 'https://m.example', room: '!r', token: 't' } },
]));
const sendEvent = (e) => {
  fs.rmSync(path.join(tmp, 'sent'), { force: true });
  execFileSync('bash', ['-c', `set -u
source "${HUB}"
FORTRESS="${T}/fortress-helper"; FORTRESS_DIR="${T}/fortress"; NOTIFY="${T}/notify-helper"; FS_STATE="${T}/state"; FS_RUN="${T}/run"; HERE="${DIR.replace(/\\/g, '/')}"
hub_send '' "$(cat)"`], { input: JSON.stringify(e), encoding: 'utf8' });
  const sent = fs.readFileSync(path.join(tmp, 'sent'), 'utf8').split('\n').filter(Boolean);
  return { list: JSON.parse(sent[1]), event: JSON.parse(sent[2]) };
};
let s = sendEvent({ ...back, hub: undefined });
ok('the helper hears that it is a recovery, which a channel set to failures takes', s.event.recovery === true, JSON.stringify(s.event));
ok('and gets the channels as they are set', s.list.find((c) => c.id === 'n').on === 'failure' && s.list.find((c) => c.id === 'm').on === 'always', JSON.stringify(s.list));
ok('no copy of the channels is made for it', !fs.existsSync(path.join(tmp, 'run')) || fs.readdirSync(path.join(tmp, 'run')).length === 0);
s = sendEvent({ kind: 'check.caution', severity: 'warning', title: 'x', body: 'y', key: 'k' });
ok('any other message is no recovery', !('recovery' in s.event), JSON.stringify(s.event));
const hubBody = (e) => JSON.parse(php(`$argv = ['', 'body']; require '${DIR.replace(/\\/g, '/')}/firesquire-hub.php';`, JSON.stringify(e)));
ok('the hub hears it as well', hubBody(back).recovery === true && !('recovery' in hubBody(nogo)), JSON.stringify(hubBody(back)));
r = send('down,t2', 't2');
ok('a TollRoll out of reach is skipped for the next', r.acts.some((a) => / t2 notify\.deliver \{"kind"/.test(a)) && !/ntfy/.test(r.sent), r.acts.join(' | '));
r = send('', '');
ok('without a hub nothing goes to the fortress', r.acts.length === 0 && /ntfy/.test(r.sent));
fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });

console.log('\nThe engine and the texts');
const engine = read('firesquire-check.sh');
ok('the engine sends through the hub when the fortress has one', /\. "\$HERE\/firesquire-hub\.sh"/.test(engine) && /hub_send "\$HUBS"/.test(engine) && /fs_fortress_hubs/.test(read('firesquire-hub.php')));
const keys = ['n_hub_title', 'n_hub_title_go', 'n_hub_health'];
const missing = keys.filter((k) => !(k in en));
ok('every hub title is in en.json, without FireSquire\'s name', missing.length === 0 && keys.every((k) => !/FireSquire/.test(en[k])), missing.join(', '));
ok('ShellCheck covers the new file', /firesquire-hub\.sh/.test(read('../../../../../../.github/workflows/lint.yml')));

done();
