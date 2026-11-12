// Open on another plugin of the fortress shows its status in a window. The helper asks every
// instance in reach for its report in the page's language, and FireSquire answers the one the card
// asked for. The helper reads no log, so the log stays empty.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done, fortressAdapter } = require('./lib');

const LIB = path.join(DIR, 'include', 'fs_fortress.php').replace(/\\/g, '/');
const SHIPLOG = 'b1c2d3e4f5a60718293a4b5c6d7e8f90';

function php(code, answers) {
  const out = execFileSync('php', ['-r', `require '${LIB}';
    $answers = json_decode(stream_get_contents(STDIN), true); $calls = [];
    $run = function ($args, $stdin) use (&$answers, &$calls) { $calls[] = ['args' => $args, 'stdin' => $stdin]; return array_shift($answers) ?: [0, '', '']; };
    $r = (function () use ($run) { ${code} })();
    echo json_encode(['r' => $r, 'calls' => $calls]);`], { input: JSON.stringify(answers || []), encoding: 'utf8' });
  return JSON.parse(out);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-status-'));
const dir = path.join(tmp, 'fortress').replace(/\\/g, '/');

const REPORT = { contract: 1, app: { id: 'shiplog', name: 'ShipLog' }, state: 'ok', needsYou: [{ severity: 'warn', text: 'Ein Ziel ist voll' }],
  work: [{ title: 'Sicherung', progress: 0.4 }], next: [{ kind: 'backup', title: 'Nächste Sicherung', at: '2026-11-14T02:00:00Z' }] };
const helperSays = JSON.stringify([
  { id: 'a', kind: 'instance', app: { id: 'bombvault', name: 'BombVault' }, device: 'Tower', online: true, error: 'fortress: a refused with "not_found" (404)' },
  { id: SHIPLOG, kind: 'instance', app: { id: 'shiplog', name: 'ShipLog' }, device: 'Tower', deployment: 'plugin', online: true, report: REPORT },
]);

console.log('\nThe status of a member');
let x = php(`return fs_fortress_status('${dir}', '${SHIPLOG}', 'de', $run);`);
ok('outside a fortress there is nobody to ask', x.r.error === 'notMember' && x.calls.length === 0, JSON.stringify(x));
fs.mkdirSync(dir);
fs.writeFileSync(path.join(dir, 'fortress.json'), '{}');
x = php(`return fs_fortress_status('${dir}', '-wait', 'de', $run);`);
ok('an id that reads like a flag reaches no helper', x.r.error === 'invalid' && x.calls.length === 0, JSON.stringify(x));
x = php(`return fs_fortress_status('${dir}', '${SHIPLOG}', 'de', $run);`, [[0, helperSays, '']]);
ok('the helper reads the reports in the page\'s language', (x.calls[0] || { args: [] }).args.join(' ') === `status -dir ${dir} -json -wait 4s -lang de`, JSON.stringify(x.calls));
ok('and FireSquire answers the one asked for', JSON.stringify(x.r.report) === JSON.stringify(REPORT), JSON.stringify(x.r));
ok('with an empty log, which the helper does not read', Array.isArray(x.r.log) && x.r.log.length === 0, JSON.stringify(x.r));
x = php(`return fs_fortress_status('${dir}', '${SHIPLOG}', 'de; rm -rf', $run);`, [[0, helperSays, '']]);
ok('a language that is no language code stays off the line', !(x.calls[0] || { args: [] }).args.includes('-lang'), JSON.stringify(x.calls));
x = php(`return fs_fortress_status('${dir}', 'a', 'de', $run);`, [[0, helperSays, '']]);
ok('a member that offers no status is said so', x.r.error === 'unanswered', JSON.stringify(x.r));
x = php(`return fs_fortress_status('${dir}', 'ffff0000', 'de', $run);`, [[0, helperSays, '']]);
ok('a member out of reach is noMember', x.r.error === 'noMember', JSON.stringify(x.r));
x = php(`return fs_fortress_status('${dir}', '${SHIPLOG}', 'de', $run);`, [[1, '', 'fortress: dial tcp: no route to host']]);
ok('a helper that fails names why', x.r.error === 'dial tcp: no route to host', JSON.stringify(x.r));
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\nThe endpoint');
const endpoint = read('include/FireSquireFortress.php');
ok('answers do=status on a GET with the member and the language', /fs_fortress_status\(\$fsDir, \(string\) \(\$_GET\['id'\] \?\? ''\), \(string\) \(\$_GET\['lang'\] \?\? ''\), \$fsRun\)/.test(endpoint),
  (endpoint.match(/fs_fortress_status\([^;]*/) || [])[0]);

(async () => {
  console.log('\nThe card');
  const p = fortressAdapter({}, { status: { report: REPORT, log: [] } });
  const r = await p.adapter.status(SHIPLOG);
  ok('asks the endpoint for that member in the page\'s language', p.gets.join() === `/plugins/firesquire/include/FireSquireFortress.php?do=status&id=${SHIPLOG}&lang=de`, p.gets.join());
  const at = new Date(REPORT.next[0].at).toLocaleString('de', { dateStyle: 'medium', timeStyle: 'short' });
  ok('hands the card the report with its times written for the page', r.report.next[0].at === at && r.report.needsYou[0].text === 'Ein Ziel ist voll', JSON.stringify(r.report.next));
  ok('and the empty log', Array.isArray(r.log) && r.log.length === 0, JSON.stringify(r));
  const q = fortressAdapter({}, { status: { error: 'unanswered' } });
  const e = await q.adapter.status(SHIPLOG).then(() => null, (err) => err);
  ok('a member that does not answer is refused, so the window says it failed', e && e.code === 'unanswered', JSON.stringify(e));
  done();
})();
