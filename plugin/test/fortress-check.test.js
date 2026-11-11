// The fortress group: the engine asks the other apps of the fortress through the helper and reports
// work that a reboot would cut short as NO-GO. What an app needs from you has nothing to do with a
// reboot and stays out; TollRoll shows it. Without a helper or a joined directory the group stays
// out of the report.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, ok, done } = require('./lib');

const ENGINE = path.join(DIR, 'firesquire-check.sh');
const en = JSON.parse(fs.readFileSync(path.join(DIR, 'lang', 'en.json'), 'utf8'));

// A helper that records how it was called and answers with the given output and exit code.
function helper(tmp, answer, code) {
  const out = path.join(tmp, 'answer.json');
  fs.writeFileSync(out, JSON.stringify(answer));
  const bin = path.join(tmp, 'fortress');
  fs.writeFileSync(bin, `#!/bin/bash\nprintf '%s\\n' "$*" >> "${path.join(tmp, 'args').replace(/\\/g, '/')}"\ncat "${out.replace(/\\/g, '/')}"\nexit ${code || 0}\n`);
  fs.chmodSync(bin, 0o755);
  return bin;
}

function engine({ answer, code, joined = true, withHelper = true }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-fortress-'));
  const dir = path.join(tmp, 'membership');
  fs.mkdirSync(dir);
  if (joined) fs.writeFileSync(path.join(dir, 'fortress.json'), '{}');
  const bin = withHelper ? helper(tmp, answer || [], code) : path.join(tmp, 'missing');
  let raw;
  try {
    raw = execFileSync('bash', [ENGINE, '--json'], {
      env: { ...process.env, FIRESQUIRE_FORTRESS: bin, FIRESQUIRE_FORTRESS_DIR: dir },
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (e) {
    raw = e.stdout; // the exit code is the verdict
  }
  const args = fs.existsSync(path.join(tmp, 'args')) ? fs.readFileSync(path.join(tmp, 'args'), 'utf8').trim() : null;
  fs.rmSync(tmp, { recursive: true, force: true });
  const report = JSON.parse(raw);
  return { checks: report.checks.filter((c) => c.id === 'fortress'), args, dir };
}

const report = (r) => ({ contract: 1, state: 'ok', needsYou: [], work: [], next: [], capabilities: [], ...r });
const member = (id, app, name, device, extra) => ({ id, kind: 'instance', app: { id: app, name, version: '1.0.0' }, device, online: true, ...extra });
const find = (checks, key) => checks.filter((c) => c.key === key);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\nWithout a fortress');
let r = engine({ joined: false });
ok('a directory without a membership adds nothing', r.checks.length === 0, JSON.stringify(r.checks));
ok('and does not start the helper', r.args === null);
r = engine({ withHelper: false });
ok('a missing helper adds nothing', r.checks.length === 0, JSON.stringify(r.checks));

console.log('\nThe apps at work');
r = engine({
  answer: [
    member('m1', 'bombvault', 'BombVault', 'Tower', {
      report: report({
        work: [
          { id: 'w1', kind: 'backup', title: 'Nightly backup', progress: 0.42, blocksRestart: true },
          { id: 'w2', kind: 'check', title: 'Integrity check', progress: 0.5, blocksRestart: false },
        ],
        needsYou: [
          { id: 'n1', severity: 'error', code: 'backup.failed', text: 'The last backup of Plex failed.\nSee the log.' },
          { id: 'n2', severity: 'warn', code: 'update', text: 'An update is ready' },
        ],
      }),
    }),
    member('m2', 'knightloader', 'KnightLoader', 'Tower', {
      report: report({ work: [{ id: 'w3', kind: 'download', title: 'Ubuntu | ISO', blocksRestart: true }] }),
    }),
    member('m3', 'arrowloop', 'ArrowLoop', 'Laptop', { error: 'context deadline exceeded' }),
  ],
});
ok('the helper is asked for the status as JSON in the joined directory',
  /^status -dir \S*membership -json\b/m.test(r.args || ''), r.args);
const busy = find(r.checks, 'fortress_busy');
ok('work that blocks a restart is NO-GO with app, device, title and progress',
  busy.length === 1 && busy[0].tier === 'critical' && busy[0].status === 'fail' && same(busy[0].args, ['BombVault', 'Tower', 'Nightly backup', '42%']),
  JSON.stringify(busy));
const open = find(r.checks, 'fortress_busy_open');
ok('work without a progress is NO-GO without one',
  open.length === 1 && open[0].status === 'fail' && same(open[0].args, ['KnightLoader', 'Tower', 'Ubuntu ISO']), JSON.stringify(open));
ok('work that does not block a restart stays out', !JSON.stringify(r.checks).includes('Integrity check'));
ok('what an app needs from you stays out, even an error', !JSON.stringify(r.checks).includes('Plex') && !JSON.stringify(r.checks).includes('An update is ready'), JSON.stringify(r.checks));
const quiet = find(r.checks, 'fortress_unanswered');
ok('an app that did not answer is a note', quiet.length === 1 && quiet[0].status === 'info' && same(quiet[0].args, ['ArrowLoop', 'Laptop']), JSON.stringify(quiet));
ok('nothing claims the fortress is idle', find(r.checks, 'fortress_ok').length === 0);
ok('every finding names its English message', r.checks.every((c) => c.message && !c.message.includes('{')));

console.log('\nA quiet fortress');
r = engine({ answer: [member('m1', 'bombvault', 'BombVault', 'Tower', { report: report({}) })] });
ok('says how many apps answered and that none is busy',
  r.checks.length === 1 && r.checks[0].key === 'fortress_ok' && r.checks[0].status === 'pass' && same(r.checks[0].args, ['1']), JSON.stringify(r.checks));
r = engine({ answer: [] });
ok('with no app in reach it says so', r.checks.length === 1 && r.checks[0].key === 'fortress_alone' && r.checks[0].status === 'info', JSON.stringify(r.checks));

console.log('\nA helper that fails');
r = engine({ answer: 'relay down', code: 1 });
ok('is a note, not a verdict', r.checks.length === 1 && r.checks[0].key === 'fortress_skip' && r.checks[0].status === 'info', JSON.stringify(r.checks));

console.log('\nThe texts');
const keys = ['fortress_busy', 'fortress_busy_open', 'fortress_unanswered', 'fortress_ok', 'fortress_alone', 'fortress_skip', 'p_fortress', 'tools_g_fortress'];
const missing = keys.filter((k) => !(k in en));
ok('every fortress text is in en.json', missing.length === 0, missing.join(', '));
ok('and the need texts are gone', !('fortress_needs' in en));

done();
