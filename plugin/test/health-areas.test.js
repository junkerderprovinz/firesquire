// How the server stands, area by area: every finding of a full check falls into Disks, Array and
// pools, Docker, VMs, Flash, Network or Fortress, and each area takes the light of its worst
// finding. What only matters while it lasts, such as a running parity check or a busy app, stays
// out, and the advice on the settings stands apart. The lights of the last 30 days live on the
// flash, each day at its worst, written only when a light changed. The same lights become
// FireSquire's status in the fortress's report format, and an area that got worse is sent out.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done } = require('./lib');

const LIB = path.join(DIR, 'include', 'fs_health.php').replace(/\\/g, '/');
const CLI = path.join(DIR, 'firesquire-history.php');
const en = JSON.parse(read('lang/en.json'));
const de = JSON.parse(read('lang/de.json'));
const php = (code, input) => JSON.parse(execFileSync('php', ['-r', `require '${LIB}'; echo json_encode(${code});`], { input: input || '', encoding: 'utf8' }));
const T0 = 1794916800;

const report = { verdict: 'CAUTION', checks: [
  { tier: 'warning', id: 'smart', status: 'pass', key: 'smart_ok', args: ['3'] },
  { tier: 'health', id: 'smart_trend', status: 'warn', key: 'smart_realloc_rose', args: ['sdc', '0', '8', '2026-11-17'] },
  { tier: 'critical', id: 'array_op', status: 'fail', key: 'array_op_running', args: ['check'] },
  { tier: 'critical', id: 'zfs', status: 'pass', key: 'zfs_ok', args: ['1'] },
  { tier: 'warning', id: 'vms', status: 'warn', key: 'vms_running', args: ['2'] },
  { tier: 'health', id: 'vm_state', status: 'pass', key: 'vm_ok', args: [] },
  { tier: 'critical', id: 'flash', status: 'pass', key: 'flash_ok', args: [] },
  { tier: 'health', id: 'cert', status: 'fail', key: 'cert_expired', args: ['Tower_unraid_bundle.pem', '2026-11-01'] },
  { tier: 'info', id: 'fortress', status: 'info', key: 'fortress_unanswered', args: ['ShipLog', 'tower'] },
  { tier: 'warning', id: 'syslog', status: 'warn', key: 'syslog_crashes', args: ['2', 'x'] },
  { tier: 'warning', id: 'space_rootfs', status: 'pass', key: 'space_ok', args: ['rootfs', '40'] },
  { tier: 'warning', id: 'svc_emhttp', status: 'pass', key: 'svc_emhttp_ok', args: [] },
  { tier: 'warning', id: 'svc_docker', status: 'pass', key: 'svc_docker_ok', args: [] },
  { tier: 'config', id: 'plugins', status: 'warn', key: 'cfg_plugin_update', args: ['ca', '1'] },
  { tier: 'health', id: 'smart_trend', status: 'warn', key: 'smart_realloc_rose', args: ['sdc', '0', '8', '2026-11-17'] },
] };

console.log('\nThe areas');
const h = php(`fs_health_areas(json_decode(stream_get_contents(STDIN), true))`, JSON.stringify(report));
ok('eight areas in their order', Object.keys(h.areas).join() === 'disks,array,docker,vms,flash,network,system,fortress', Object.keys(h.areas).join());
const lights = Object.fromEntries(Object.entries(h.areas).map(([k, v]) => [k, v.light]));
ok('each takes the light of its worst finding, grey without one',
  JSON.stringify(lights) === JSON.stringify({ disks: 'yellow', array: 'green', docker: 'grey', vms: 'green', flash: 'green', network: 'red', system: 'yellow', fortress: 'yellow' }), JSON.stringify(lights));
ok('the worst finding of an area comes first', h.areas.disks.findings[0].key === 'smart_realloc_rose');
ok('a finding twice in the report shows once', h.areas.disks.findings.filter((f) => f.key === 'smart_realloc_rose').length === 1);
ok('a running parity check and running VMs say nothing about health', !h.areas.array.findings.some((f) => f.key === 'array_op_running') && !h.areas.vms.findings.some((f) => f.key === 'vms_running'));
ok('an app that offers a status and does not answer is worth a look', h.areas.fortress.findings[0].status === 'warn');
ok('crash lines, the space in RAM and the core services make up System', ['syslog_crashes', 'space_ok', 'svc_emhttp_ok', 'svc_docker_ok'].every((k) => h.areas.system.findings.some((f) => f.key === k)) &&
  h.areas.system.findings[0].key === 'syslog_crashes', h.areas.system.findings.map((f) => f.key).join());
ok('the advice on the settings stands apart', h.config.length === 1 && h.config[0].key === 'cfg_plugin_update');

console.log('\nThe history');
let text = php(`fs_history_add('', '2026-11-17', array('disks' => 'green', 'array' => 'green'))`);
ok('a day is one line of area:light', text === '2026-11-17 disks:green array:green\n', JSON.stringify(text));
text = php(`fs_history_add(${JSON.stringify(text)}, '2026-11-17', array('disks' => 'yellow', 'array' => 'green'))`);
text = php(`fs_history_add(${JSON.stringify(text)}, '2026-11-17', array('disks' => 'green', 'array' => 'green'))`);
ok('each area keeps the worst light of the day', text === '2026-11-17 disks:yellow array:green\n', JSON.stringify(text));
let old = '';
for (let d = 1; d <= 31; d++) old += `2026-10-${String(d).padStart(2, '0')} disks:green\n`;
text = php(`fs_history_add(${JSON.stringify(old)}, '2026-11-17', array('disks' => 'red'))`);
const days = text.trim().split('\n').map((l) => l.split(' ')[0]);
ok('days older than 30 drop out', days[0] === '2026-10-19' && days[days.length - 1] === '2026-11-17' && !days.includes('2026-10-18'), days.join(' '));

console.log('\nAfter every check');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-history-'));
const out_ = path.join(tmp, 'fortress');
const env = { ...process.env, FS_STATE: path.join(tmp, 'state'), FS_RUN: path.join(tmp, 'run'), FS_FORTRESS_OUT: out_, FS_NOW: String(T0) };
const cli = (r, lang = 'en') => execFileSync('php', [CLI, lang, 'tower', '1.5.0'], { input: JSON.stringify(r), encoding: 'utf8', env });
let out = cli(report);
const last = JSON.parse(fs.readFileSync(path.join(tmp, 'run', 'last.json'), 'utf8'));
ok('the report with its areas waits in RAM for the Health tab', last.areas.disks.light === 'yellow' && last.config.length === 1 && last.verdict === 'CAUTION');
ok('the day goes into the history on the flash', /^2026-11-17 disks:yellow array:green docker:grey vms:green flash:green network:red system:yellow fortress:yellow$/m.test(fs.readFileSync(path.join(tmp, 'state', 'health.history'), 'utf8')));
const ev = JSON.parse(out);
ok('the areas that got worse go out, the worst as a failure', ev.kind === 'health.worse' && ev.severity === 'failure' &&
  ev.title === en.n_health_title.replace('{0}', 'tower').replace('{1}', [en.h_area_disks, en.h_area_network, en.h_area_system, en.h_area_fortress].join(', ')), JSON.stringify(ev));
ok('with what was found', ev.body.split('\n').length === 4 && ev.body.startsWith('• '), ev.body);
const hist = path.join(tmp, 'state', 'health.history');
fs.utimesSync(hist, new Date(2000, 0, 1), new Date(2000, 0, 1));
out = cli(report);
ok('the same lights again send nothing', out === '');
ok('and leave the history on the flash untouched', fs.statSync(hist).mtime.getFullYear() === 2000);

console.log('\nThe status for the fortress');
const st = JSON.parse(fs.readFileSync(path.join(out_, 'firesquire.json'), 'utf8'));
ok('it waits in RAM where TollRoll reads the plugins of the server', fs.existsSync(path.join(out_, 'firesquire.json')));
ok('it follows the report format, contract 1', st.contract === 1 && st.app.id === 'firesquire' && st.app.name === 'FireSquire' && st.app.version === '1.5.0' && st.instance.name === 'tower');
ok('the worst light is the state', st.state === 'failed');
const icon = st.app.icon || '';
const svg = Buffer.from(icon.replace(/^data:image\/svg\+xml;base64,/, ''), 'base64').toString('utf8');
ok('it carries FireSquire\'s logo as the fortress format wants it, an SVG of at most 16 KiB',
  /^data:image\/svg\+xml;base64,[A-Za-z0-9+/]+=*$/.test(icon) && /<svg[\s>]/.test(svg) && svg.length <= 16384 && !/<script|\son\w+=/i.test(svg), icon.slice(0, 40));
ok('every area not green is a need, red as an error', st.needsYou.map((n) => n.id + ':' + n.severity).join() === 'health.disks:warn,health.network:error,health.system:warn,health.fortress:warn', JSON.stringify(st.needsYou));
ok('its text names the area and the finding', st.needsYou[0].text.startsWith(en.h_area_disks + ': ') && st.counts.needsYou === 4);
ok('a need keeps the time it began', st.needsYou[0].since === new Date(T0 * 1000).toISOString().replace('.000', ''));
const langs = fs.readdirSync(path.join(DIR, 'lang')).map((f) => f.slice(0, -5));
ok('every language has a file of its own', langs.every((l) => fs.existsSync(path.join(out_, `firesquire.${l}.json`))));
const stDe = JSON.parse(fs.readFileSync(path.join(out_, 'firesquire.de.json'), 'utf8'));
ok('in its words', stDe.needsYou[0].text.startsWith(de.h_area_disks + ': ') && stDe.state === st.state, stDe.needsYou[0].text);
ok('and each is replaced in one rename, no part file left', !fs.readdirSync(out_).some((f) => !/^firesquire(\.[a-z]{2})?\.json$/.test(f)), fs.readdirSync(out_).join());

console.log('\nEvery hour');
const plain = path.join(out_, 'firesquire.json');
fs.utimesSync(plain, new Date(2000, 0, 1), new Date(2000, 0, 1));
execFileSync('php', [CLI, '--refresh'], { encoding: 'utf8', env: { ...env, FS_NOW: String(T0 + 3600) } });
const again = JSON.parse(fs.readFileSync(plain, 'utf8'));
ok('the status is written again from the last check', fs.statSync(plain).mtime.getFullYear() > 2000 && again.state === st.state);
ok('and still says when that check ran', again.sampledAt === st.sampledAt, again.sampledAt);
ok('it keeps the history on the flash as it is', fs.statSync(hist).mtime.getFullYear() === 2000);
ok('the plugin asks for it every hour', /^\s*cron="47 \* \* \* \* \/usr\/bin\/php &emhttp;\/&pkg;-history\.php --refresh /m.test(fs.readFileSync(path.join(__dirname, '..', 'firesquire.plg'), 'utf8')));
cli({ verdict: 'GO', checks: [{ tier: 'critical', id: 'flash', status: 'pass', key: 'flash_ok', args: [] }] }, 'de');
const calm = JSON.parse(fs.readFileSync(plain, 'utf8'));
ok('all green is ok', calm.state === 'ok' && calm.needsYou.length === 0);
ok('the plain file speaks Unraid\'s language', JSON.parse(fs.readFileSync(path.join(out_, 'firesquire.de.json'), 'utf8')).sampledAt === calm.sampledAt);
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\nThe apps of the fortress');
const fortress = execFileSync('php', [path.join(DIR, 'firesquire-fortress.php')], { encoding: 'utf8', input: JSON.stringify([
  { app: { id: 'bombvault', name: 'BombVault' }, device: 'tower', report: { app: { name: 'BombVault' }, state: 'overdue', work: [] } },
  { app: { id: 'shiplog', name: 'ShipLog' }, device: 'tower', report: { app: { name: 'ShipLog' }, state: 'failed', work: [] } },
  { app: { id: 'tollroll', name: 'TollRoll' }, device: 'tower', report: { app: { name: 'TollRoll' }, state: 'ok', work: [] } },
]) }).split('\n').filter(Boolean).map((l) => l.split('\x1f'));
ok('an app that is behind or failing is a health finding, never a reboot one',
  fortress.filter((f) => f[0] === 'health').map((f) => f[1] + ':' + f[2]).join() === 'warn:fortress_app_overdue,fail:fortress_app_failed', JSON.stringify(fortress));

console.log('\nThe engine and the texts');
const engine = read('firesquire-check.sh');
ok('the engine hands every report to the history', /php "\$HERE\/firesquire-history\.php"/.test(engine));
const keys = ['h_area_disks', 'h_area_array', 'h_area_docker', 'h_area_vms', 'h_area_flash', 'h_area_network', 'h_area_system', 'h_area_fortress', 'n_health_title',
  'fortress_app_warning', 'fortress_app_overdue', 'fortress_app_failed'];
const missing = keys.filter((k) => !(k in en));
ok('every text is in en.json', missing.length === 0, missing.join(', '));
ok('and in German', keys.every((k) => k in de));

done();
