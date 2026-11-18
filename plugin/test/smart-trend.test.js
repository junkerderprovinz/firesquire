// SMART history: FireSquire remembers the reallocated and pending sectors, the temperature and the
// power-on hours of every disk by its serial, and warns on the Health tab as soon as a sector count
// rises, long before SMART calls the disk failing. A rise stays in view for 30 days. A disk that
// sleeps is never woken: Unraid's own spin-down state and smartctl -n standby keep it asleep.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done } = require('./lib');

const HEALTH = path.join(DIR, 'firesquire-health.sh').replace(/\\/g, '/');
const FIX = path.join(__dirname, 'fixtures').replace(/\\/g, '/');
const en = JSON.parse(read('lang/en.json'));
const PLURAL = read('firesquire-check.sh').match(/^plural\(\) \{.*\}$/m)[0];
const DAY = 86400;
const T0 = 1794916800; // 2026-11-17 12:00 UTC

function health(body, env = {}) {
  const script = `
set -u
source "${HEALTH}"
add() { local IFS=$'\\x1f'; printf '%s\\n' "$*"; }
have() { declare -F "$1" >/dev/null || command -v "$1" >/dev/null 2>&1; }
${PLURAL}
links() { case "$1" in *by-path) cat "${FIX}/by-path.txt" ;; *by-id) cat "${FIX}/by-id.txt" ;; esac; }
${body}
`;
  const out = execFileSync('bash', ['-c', script], { encoding: 'utf8', env: { ...process.env, TZ: 'UTC', ...env } });
  return out.split('\n').filter(Boolean).map((l) => {
    const [tier, id, status, key, args, message] = l.split('\x1f');
    return { tier, id, status, key, args: args ? args.split('|') : [], message };
  });
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SDC = 'sdc [pci-0000:00:17.0-ata-3]';

console.log('\nReading the values');
let r = health(`smart_trend_note sdc "$(cat "${FIX}/smartctl-sdc.txt")"\nprintf '%s' "$SMART_SEEN"`);
ok('a SATA disk gives serial, sectors, temperature and hours', r[0].tier === 'sdc WD-WCC7K7654321 0 0 32 21345', r[0] && r[0].tier);
r = health(`smart_trend_note nvme0n1 "$(cat "${FIX}/smartctl-nvme.txt")"\nprintf '%s' "$SMART_SEEN"`);
ok('an NVMe drive gives its temperature and hours, and no sector counts', r[0].tier === 'nvme0n1 S5GXNX0T123456A - - 41 12034', r[0] && r[0].tier);

console.log('\nNever waking a disk');
r = health(`FS_DISKS_INI="${FIX}/disks-spundown.ini"\nspun_down sde && echo asleep; spun_down sdc || echo awake; spun_down sdz || echo unknown`);
ok('Unraid\'s spun-down parity counts as asleep', r.map((x) => x.tier).join() === 'asleep,awake,unknown', r.map((x) => x.tier).join());
const calls = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'fs-smart-')), 'calls').replace(/\\/g, '/');
r = health(`smartctl() { echo "$*" >> "${calls}"; cat "${FIX}/smartctl-standby.txt"; return 2; }\nsmart_read /dev/sdf >/dev/null && echo read || echo asleep`);
ok('smartctl is asked with -n standby', /-n standby/.test(fs.readFileSync(calls, 'utf8')), fs.readFileSync(calls, 'utf8'));
ok('and a disk in standby counts as asleep', r[0].tier === 'asleep');
r = health(`smartctl() { cat "${FIX}/smartctl-sdc.txt"; }\nsmart_read /dev/sdc | grep -c Serial; smart_read /dev/sdc >/dev/null && echo read`);
ok('an awake disk is read in one call', r.map((x) => x.tier).join() === '1,read', r.map((x) => x.tier).join());
const engine = read('firesquire-check.sh');
ok('the engine skips a spun-down disk before it asks smartctl', /spun_down "\$d" && \{ SMART_ASLEEP=/.test(engine));
ok('and reads the others only through smart_read', /smart_read "\$dev"/.test(engine) && !/smartctl -H "\$dev"/.test(engine) && !/smartctl -i -A "\$dev"/.test(engine));

console.log('\nThe trend');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-trend-'));
const state = path.join(tmp, 'state').replace(/\\/g, '/');
const run = (notes, days = 0) => health(`FS_STATE="${state}"\nFS_NOW=${T0 + days * DAY}\n${notes}\nsmart_trend_report`);
const note = (serial, re, pe, tp, poh, dev = 'sdc') => `SMART_SEEN="${dev} ${serial} ${re} ${pe} ${tp} ${poh}"$'\\n'`;
r = run(note('SER1', 0, 0, 32, 21000));
ok('the first look shows each disk with its values', r.length === 1 && r[0].tier === 'health' && r[0].key === 'smart_disk' && r[0].status === 'pass' &&
  same(r[0].args, [SDC, '32', '0', '0', '21000']), JSON.stringify(r));
ok('and remembers it by serial on the flash', /^SER1 /m.test(fs.readFileSync(path.join(state, 'smart.state'), 'utf8')));
r = run(note('SER1', 8, 0, 32, 21024), 1);
ok('reallocated sectors that rose are a warning with old and new count and the day',
  r.length === 1 && r[0].key === 'smart_realloc_rose' && r[0].status === 'warn' && same(r[0].args, [SDC, '0', '8', '2026-11-18']), JSON.stringify(r));
r = run(note('SER1', 8, 0, 32, 21048), 2);
ok('the rise stays in view on the next days', r.length === 1 && r[0].key === 'smart_realloc_rose' && same(r[0].args, [SDC, '0', '8', '2026-11-18']), JSON.stringify(r));
r = run(note('SER1', 8, 0, 32, 21800), 32);
ok('after 30 calm days the disk is fine again', r.length === 1 && r[0].key === 'smart_disk' && r[0].status === 'pass', JSON.stringify(r));
r = run(note('SER1', 8, 3, 32, 21824), 33);
ok('pending sectors that rose are a warning too', r.length === 1 && r[0].key === 'smart_pending_rose' && same(r[0].args, [SDC, '0', '3', '2026-12-20']), JSON.stringify(r));
r = run(note('SER1', 8, 3, 33, 21848), 34);
ok('the newer rise is the one shown', r[0].key === 'smart_pending_rose');

console.log('\nThe temperature');
r = run(note('SER2', 0, 0, 30, 500, 'sde'));
r = run(note('SER2', 0, 0, 31, 524, 'sde'), 1);
ok('a degree or two is no rise', r.length === 1 && r[0].key === 'smart_disk', JSON.stringify(r));
r = run(note('SER2', 0, 0, 44, 548, 'sde'), 2);
ok('eight degrees over the disk\'s usual is a warning with both', r.length === 1 && r[0].key === 'smart_temp_rose' && r[0].status === 'warn' &&
  same(r[0].args, ['sde [pci-0000:00:17.0-ata-5]', '44', '30']), JSON.stringify(r));
r = run(note('SER2', 0, 0, 31, 572, 'sde'), 3);
ok('and over once it cools down', r.length === 1 && r[0].key === 'smart_disk', JSON.stringify(r));

console.log('\nThe flash');
const file = path.join(state, 'smart.state');
r = run(note('SER3', 0, 0, 35, 100, 'sdd'), 40);
fs.utimesSync(file, new Date(2000, 0, 1), new Date(2000, 0, 1));
r = run(note('SER3', 0, 0, 35, 100, 'sdd'), 40);
ok('the state is written only when a value changed', fs.statSync(file).mtime.getFullYear() === 2000);
ok('a disk missing from a run keeps its record', /^SER1 /m.test(fs.readFileSync(file, 'utf8')) && /^SER2 /m.test(fs.readFileSync(file, 'utf8')));
r = health(`FS_STATE="${state}"\nFS_NOW=${T0}\nSMART_ASLEEP=2\nsmart_trend_report`);
ok('sleeping disks are named as left alone', r.length === 1 && r[0].key === 'smart_asleep' && r[0].status === 'info' && same(r[0].args, ['2']), JSON.stringify(r));
r = run(note('SER4', 0, '-', 31, 900, 'sdc'), 41);
ok('a drive without a pending count is shown without one', r.length === 1 && r[0].key === 'smart_disk_short' && same(r[0].args, [SDC, '31', '900']), JSON.stringify(r));
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\nThe health verdict of SMART');
const failed = (file) => health(`smart_failed "$(cat "${FIX}/${file}")" && echo failed || echo passed`)[0].tier;
ok('the column WHEN_FAILED of the attribute table is no failure', failed('smartctl-sdc.txt') === 'passed' && /WHEN_FAILED/.test(fs.readFileSync(path.join(__dirname, 'fixtures', 'smartctl-sdc.txt'), 'utf8')));
ok('a self-assessment that failed is one', failed('smartctl-failed.txt') === 'failed');
ok('and so is an attribute failing now', health(`smart_failed "  5 Reallocated_Sector_Ct 0x0033 001 001 010 Pre-fail Always FAILING_NOW 3000" && echo failed || echo passed`)[0].tier === 'failed');
ok('the engine asks smart_failed', /smart_failed "\$A"/.test(engine) && !/grep -qiE 'FAILED\|FAILING'/.test(engine));

console.log('\nThe texts');
const keys = ['smart_disk', 'smart_realloc_rose', 'smart_pending_rose', 'smart_temp_rose', 'smart_asleep'];
const missing = keys.filter((k) => !(k in en));
ok('every trend text is in en.json', missing.length === 0, missing.join(', '));
ok('the engine reports the trend after the SMART scan', /smart_trend_note "\$d" "\$A"/.test(engine) && /^smart_trend_report$/m.test(engine));

done();
