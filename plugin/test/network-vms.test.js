// The network and the VMs on the Health tab: a link that runs slower than a gigabit or at half
// duplex usually means a worn cable or a port that fell back, a bond with a member down has lost
// its spare, and a paused VM is often one whose virtual disk ran full. The tests build a stand-in
// /sys/class/net in a temporary folder.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done } = require('./lib');

const MORE = path.join(DIR, 'firesquire-more.sh').replace(/\\/g, '/');
const WATCH = path.join(DIR, 'firesquire-watch.sh').replace(/\\/g, '/');
const en = JSON.parse(read('lang/en.json'));
const PLURAL = read('firesquire-check.sh').match(/^plural\(\) \{.*\}$/m)[0];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-net-'));
const T = tmp.replace(/\\/g, '/');
function nic(name, { speed, duplex = 'full', state = 'up', phys = true }) {
  const d = path.join(tmp, 'net', name);
  fs.mkdirSync(d, { recursive: true });
  if (phys) fs.mkdirSync(path.join(d, 'device'), { recursive: true });
  fs.writeFileSync(path.join(d, 'operstate'), state + '\n');
  if (speed !== undefined) fs.writeFileSync(path.join(d, 'speed'), speed + '\n');
  fs.writeFileSync(path.join(d, 'duplex'), duplex + '\n');
}
function watch(body) {
  const script = `
set -u
source "${MORE}"
source "${WATCH}"
add() { local IFS=$'\x1f'; printf '%s\n' "$*"; }
have() { declare -F "$1" >/dev/null || command -v "$1" >/dev/null 2>&1; }
${PLURAL}
FS_SYSNET="${T}/net"; FS_BONDING="${T}/bonding"
${body}
`;
  return execFileSync('bash', ['-c', script], { encoding: 'utf8' }).split('\n').filter(Boolean).map((l) => {
    const [tier, id, status, key, args, message] = l.split('\x1f');
    return { tier, id, status, key, args: args ? args.split('|') : [], message };
  });
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const route = 'ip() { echo "default via 192.168.1.1 dev br0 proto dhcp src 192.168.1.10 metric 1007"; }';

console.log('\nThe network');
nic('eth0', { speed: 1000 });
nic('eth1', { speed: -1, state: 'down' });
nic('br0', { phys: false });
let r = watch(`${route}\nwatch_network`);
ok('a gigabit link passes, on the health tier', r.length === 1 && r[0].key === 'net_ok' && r[0].tier === 'health' && same(r[0].args, ['eth0', '1000']), JSON.stringify(r));
nic('eth0', { speed: 100 });
r = watch(`${route}\nwatch_network`);
ok('a link below a gigabit is worth a look, named with its speed', r.length === 1 && r[0].key === 'net_slow' && r[0].status === 'warn' && same(r[0].args, ['eth0', '100']), JSON.stringify(r));
ok('a port without a cable stays out', !r.some((f) => f.args[0] === 'eth1'));
nic('eth0', { speed: 1000, duplex: 'half' });
r = watch(`${route}\nwatch_network`);
ok('half duplex is worth a look too', r.length === 1 && r[0].key === 'net_half' && same(r[0].args, ['eth0']), JSON.stringify(r));
nic('eth0', { speed: 1000 });
fs.mkdirSync(path.join(tmp, 'bonding'));
fs.writeFileSync(path.join(tmp, 'bonding', 'bond0'), 'Bonding Mode: active-backup\nMII Status: up\n\nSlave Interface: eth0\nMII Status: up\n\nSlave Interface: eth1\nMII Status: down\n');
r = watch(`${route}\nwatch_network`);
ok('a bond with a member down has lost its spare', r.some((f) => f.key === 'net_bond' && f.status === 'warn' && same(f.args, ['bond0', 'eth1'])), JSON.stringify(r));
r = watch(`ip() { :; }\nwatch_network`);
ok('without a default route the server cannot reach out', r.some((f) => f.key === 'net_noroute' && f.status === 'warn'), JSON.stringify(r));

console.log('\nThe VMs');
r = watch(`libvirt_up() { return 0; }\nvirsh() { case "$*" in *paused*) printf 'Windows 11\nHome Assistant\n\n' ;; esac; }\nwatch_vms`);
ok('paused VMs are worth a look, by name', r.length === 1 && r[0].key === 'vm_paused' && r[0].tier === 'health' && same(r[0].args, ['Windows 11, Home Assistant', '2']), JSON.stringify(r));
r = watch(`libvirt_up() { return 0; }\nvirsh() { :; }\nwatch_vms`);
ok('none paused says so', r.length === 1 && r[0].key === 'vm_ok' && r[0].status === 'pass', JSON.stringify(r));
r = watch(`libvirt_up() { return 1; }\nwatch_vms`);
ok('without the VM service nothing is said', r.length === 0);
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\nThe engine and the texts');
const engine = read('firesquire-check.sh');
ok('the engine runs both', /^watch_network$/m.test(engine) && /^watch_vms$/m.test(engine));
const missing = ['net_ok', 'net_slow', 'net_half', 'net_bond', 'net_noroute', 'vm_paused', 'vm_ok'].filter((k) => !(k in en));
ok('every text is in en.json', missing.length === 0, missing.join(', '));

done();
