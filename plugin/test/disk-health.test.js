// Disk health: degraded ZFS pools and faulty devices are NO-GO, btrfs device errors too, and a
// SMART CRC count that rose since the last run is CAUTION. Every finding names the disk with the
// port from /dev/disk/by-path, so it is clear which cable to look at. The tests feed the sample
// outputs in fixtures/ to firesquire-health.sh instead of real hardware.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done } = require('./lib');

const HEALTH = path.join(DIR, 'firesquire-health.sh').replace(/\\/g, '/');
const FIX = path.join(__dirname, 'fixtures').replace(/\\/g, '/');
const en = JSON.parse(read('lang/en.json'));
const PLURAL = read('firesquire-check.sh').match(/^plural\(\) \{.*\}$/m)[0];

// Runs body after sourcing the health checks, with the engine's add(), have() and plural(),
// the sample link lists in place of /dev/disk, and stand-ins for the commands. Returns the
// findings.
function health(body, env = {}) {
  const script = `
set -u
source "${HEALTH}"
add() { local IFS=$'\\x1f'; printf '%s\\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }
${PLURAL}
links() { case "$1" in *by-path) cat "${FIX}/by-path.txt" ;; *by-id) cat "${FIX}/by-id.txt" ;; esac; }
${body}
`;
  const out = execFileSync('bash', ['-c', script], { encoding: 'utf8', env: { ...process.env, ...env } });
  return out.split('\n').filter(Boolean).map((l) => {
    const [tier, id, status, key, args, message, link] = l.split('\x1f');
    return { tier, id, status, key, args: args ? args.split('|') : [], message, link };
  });
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keyed = (list, key) => list.filter((f) => f.key === key);

console.log('\nPorts');
let r = health('disk_label sdc1; echo; disk_label ata-WDC_WD40EFRX-68N32N0_WD-WCC7K1234567-part1; echo; disk_label nvme0n1p1; echo; disk_label loop2; echo');
const labels = r.map((f) => f.tier);
ok('a partition is named by its disk and port', labels[0] === 'sdc [pci-0000:00:17.0-ata-3]', labels[0]);
ok('a by-id name resolves to the disk behind it', labels[1] === 'sdd [pci-0000:00:17.0-ata-4]', labels[1]);
ok('an NVMe partition keeps the namespace', labels[2] === 'nvme0n1 [pci-0000:01:00.0-nvme-1]', labels[2]);
ok('a device without a port is named alone', labels[3] === 'loop2', labels[3]);

console.log('\nZFS');
r = health(`zpool() { cat "${FIX}/zpool-degraded.txt"; }\nhealth_zfs`);
const pool = keyed(r, 'zfs_degraded');
ok('a degraded pool is NO-GO', pool.length === 1 && pool[0].tier === 'critical' && pool[0].status === 'fail' && same(pool[0].args, ['tank', 'DEGRADED']), JSON.stringify(pool));
const errs = keyed(r, 'zfs_dev_errors');
ok('a device with checksum errors is NO-GO with its port and counts',
  errs.length === 1 && errs[0].status === 'fail' && same(errs[0].args, ['tank', 'sdc [pci-0000:00:17.0-ata-3]', '0', '0', '3']), JSON.stringify(errs));
const gone = keyed(r, 'zfs_dev_state');
ok('an unavailable device is NO-GO with its port',
  gone.length === 1 && gone[0].status === 'fail' && same(gone[0].args, ['tank', 'sdd [pci-0000:00:17.0-ata-4]', 'UNAVAIL']), JSON.stringify(gone));
ok('vdevs, healthy devices and spares stay out', r.length === 3, JSON.stringify(r));
r = health(`zpool() { cat "${FIX}/zpool-online.txt"; }\nhealth_zfs`);
ok('healthy pools pass with their count', r.length === 1 && r[0].key === 'zfs_ok' && r[0].status === 'pass' && same(r[0].args, ['2']), JSON.stringify(r));
r = health(`zpool() { echo "no pools available"; }\nhealth_zfs`);
ok('without pools nothing is said', r.length === 0, JSON.stringify(r));
r = health('PATH=/nonexistent\nhealth_zfs');
ok('without zpool nothing is said', r.length === 0, JSON.stringify(r));

console.log('\nbtrfs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-health-'));
const calls = path.join(tmp, 'calls').replace(/\\/g, '/');
r = health(`FS_MOUNTS="${FIX}/mounts.txt"
btrfs() { echo "$3" >> "${calls}"; case "$3" in /mnt/cache) cat "${FIX}/btrfs-cache-errors.txt" ;; *) cat "${FIX}/btrfs-clean.txt" ;; esac; }
health_btrfs`);
const bt = keyed(r, 'btrfs_dev_errors');
ok('a device with error counters is NO-GO with its port and the counters',
  bt.length === 1 && bt[0].tier === 'critical' && bt[0].status === 'fail' &&
  same(bt[0].args, ['/mnt/cache', 'sde [pci-0000:00:17.0-ata-5]', 'corruption_errs=2, generation_errs=1']), JSON.stringify(bt));
ok('clean devices stay out', r.length === 1, JSON.stringify(r));
ok('each filesystem is asked once, other filesystems never',
  same(fs.readFileSync(calls, 'utf8').trim().split('\n'), ['/mnt/cache', '/var/lib/docker']), fs.readFileSync(calls, 'utf8'));
r = health(`FS_MOUNTS="${FIX}/mounts.txt"\nbtrfs() { cat "${FIX}/btrfs-clean.txt"; }\nhealth_btrfs`);
ok('clean filesystems pass with their count', r.length === 1 && r[0].key === 'btrfs_ok' && same(r[0].args, ['2']), JSON.stringify(r));

console.log('\nCRC counts');
const state = path.join(tmp, 'state').replace(/\\/g, '/');
const crc = (notes) => health(`FS_STATE="${state}"\n${notes}\ncrc_report`);
r = health(`smart_crc_note sdc "$(cat "${FIX}/smartctl-sdc.txt")"\necho "$CRC_SEEN"`);
ok('the count and serial come from smartctl', r.length === 1 && r[0].tier === 'sdc WD-WCC7K7654321 12', JSON.stringify(r));
r = crc('crc_note sdc SER1 0\ncrc_note sde SER2 5');
ok('a count above zero is CAUTION the first time FireSquire sees the disk',
  r.length === 1 && r[0].key === 'crc_found' && r[0].tier === 'warning' && r[0].status === 'warn' && same(r[0].args, ['sde [pci-0000:00:17.0-ata-5]', '5']), JSON.stringify(r));
ok('the counts are kept by serial', same(fs.readFileSync(path.join(state, 'crc.state'), 'utf8').trim().split('\n').sort(), ['SER1 0', 'SER2 5']));
r = crc('crc_note sdc SER1 2\ncrc_note sde SER2 5');
ok('a count that rose since the last run is CAUTION with the old and new count',
  r.length === 1 && r[0].key === 'crc_rose' && r[0].status === 'warn' && same(r[0].args, ['sdc [pci-0000:00:17.0-ata-3]', '0', '2']), JSON.stringify(r));
r = crc('crc_note sdc SER1 2\ncrc_note sde SER2 5');
ok('an unchanged count stays quiet', r.length === 0, JSON.stringify(r));
r = crc('crc_note sdc SER1 2');
ok('a disk missing from one run keeps its count', same(fs.readFileSync(path.join(state, 'crc.state'), 'utf8').trim().split('\n').sort(), ['SER1 2', 'SER2 5']));
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\nScrutiny');
const scrutiny = `docker() { case "$1" in ps) echo "scrutiny ghcr.io/analogj/scrutiny:master-omnibus" ;; port) echo "0.0.0.0:8081" ;; esac; }`;
r = health(`${scrutiny}\nFS_DISK_TROUBLE=1\nhealth_hint`);
ok('a running Scrutiny is linked on its port', r.length === 1 && r[0].key === 'scrutiny_link' && r[0].status === 'info' && r[0].link === ':8081/web/dashboard', JSON.stringify(r));
r = health(`docker() { :; }\nFS_DISK_TROUBLE=1\nhealth_hint`);
ok('without it Scrutiny is a tip', r.length === 1 && r[0].key === 'scrutiny_tip', JSON.stringify(r));
r = health(`${scrutiny}\nhealth_hint`);
ok('healthy disks need neither', r.length === 0, JSON.stringify(r));

console.log('\nThe engine and the report');
const engine = read('firesquire-check.sh');
ok('the engine sources the health checks', /\. "\$HERE\/firesquire-health\.sh"/.test(engine));
ok('the engine notes the CRC count of every disk it reads', /smart_crc_note "\$d" "\$A"/.test(engine));
ok('the attribute warning leaves CRC to the new check', !/crc=\$cr/.test(engine));
const js = read('firesquire.js');
ok('a finding with its own link leads there', /x\.link/.test(js));
const keys = ['p_pools', 'zfs_degraded', 'zfs_dev_errors', 'zfs_dev_state', 'zfs_ok', 'btrfs_dev_errors', 'btrfs_ok',
  'crc_found', 'crc_rose', 'scrutiny_link', 'scrutiny_tip', 'tools_g_health'];
const missing = keys.filter((k) => !(k in en));
ok('every disk health text is in en.json', missing.length === 0, missing.join(', '));

done();
