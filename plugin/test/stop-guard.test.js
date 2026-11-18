// Stopping the array: FireSquire catches Unraid's Stop the way it catches a reboot, and says what
// holds the array right now. A process with files open on a share or a disk, and a mount inside
// the array, such as a mounted snapshot or image, keep it from unmounting. A VM without its guest
// agent may ignore the request and be forced off, and containers and a short time-out are worth
// knowing. The form to update.htm on Main and the Dashboard's StopArrayNow are held until the
// check lets them through, and Unraid's files stay as they are.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done, grabFn } = require('./lib');

const MORE = path.join(DIR, 'firesquire-more.sh').replace(/\\/g, '/');
const STOP = path.join(DIR, 'firesquire-stop.sh').replace(/\\/g, '/');
const FIX = path.join(__dirname, 'fixtures').replace(/\\/g, '/');
const en = JSON.parse(read('lang/en.json'));
const PLURAL = read('firesquire-check.sh').match(/^plural\(\) \{.*\}$/m)[0];

function stop(body) {
  const script = `
set -u
source "${MORE}"
source "${STOP}"
add() { local IFS=$'\\x1f'; printf '%s\\n' "$*"; }
have() { declare -F "$1" >/dev/null || command -v "$1" >/dev/null 2>&1; }
${PLURAL}
FS_MOUNTS="${FIX}/mounts-stop.txt"; FS_POOLS="${FIX}/pools"; FS_DOMAIN_CFG="${FIX}/domain.cfg"
${body}
`;
  return execFileSync('bash', ['-c', script], { encoding: 'utf8' }).split('\n').filter(Boolean).map((l) => {
    const [tier, id, status, key, args, message] = l.split('\x1f');
    return { tier, id, status, key, args: args ? args.split('|') : [], message };
  });
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const plugins = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-plugins-'));
fs.mkdirSync(path.join(plugins, 'shiplog', 'event'), { recursive: true });
fs.writeFileSync(path.join(plugins, 'shiplog', 'event', 'stopping_svcs'), '#!/bin/bash\n');
const P = plugins.replace(/\\/g, '/');
const procs = `proc_links() { cat "${FIX}/proc-links.txt"; }
FS_PLUGINS_DIR="${P}"
proc_name() { case "$1" in 4100|4200) echo bash ;; 5200) echo rsync-with-a-long-name ;; 6000) echo Plex ;; 7000) echo cp ;; 8000) echo qemu-system-x86_64 ;;
  9100) echo smbd ;; 9200) echo virtiofsd ;; 9300) echo shiplog ;; 9400) echo rsyslogd ;; esac; }
proc_exe() { case "$1" in 9300) echo "${P}/shiplog/bin/shiplog" ;; *) echo /usr/bin/x ;; esac; }
in_container() { [ "$1" = 6000 ]; }`;

console.log('\nOpen files');
let r = stop(`${procs}\nstop_open_files`);
ok('a process with files open on a share or a disk holds the array, by its full name, pids and places',
  r.length === 1 && r[0].key === 'stop_open_files' && r[0].tier === 'critical' && r[0].status === 'fail' &&
  same(r[0].args, ['bash (4100, 4200) in /mnt/user/media /mnt/user/tv, rsync-with-a-long-name (5200) in /mnt/disk1/backup', '3']), JSON.stringify(r));
ok('containers and VMs stay out, Unraid stops them first, and so does a disk outside the array', !/Plex|qemu|cp \(/.test(r[0] && r[0].args[0]));
ok('so does what Unraid ends itself: file sharing, the VMs\' file service, syslog and plugins with a stop script', !/smbd|virtiofsd|rsyslogd|shiplog/.test(r[0] && r[0].args[0]));
ok('the name comes from the command line, which the kernel does not cut short', /tr '\\\\0' '\\\\n' < "\/proc\/\$1\/cmdline"|cmdline/.test(read('firesquire-stop.sh')));
fs.rmSync(plugins, { recursive: true, force: true });
r = stop(`proc_links() { :; }\nstop_open_files`);
ok('nothing open passes', r.length === 1 && r[0].key === 'stop_open_ok' && r[0].status === 'pass', JSON.stringify(r));

console.log('\nMounts inside the array');
r = stop(`losetup() { cat "${FIX}/losetup-stop.txt"; }\nstop_mounts`);
const m = r.find((f) => f.key === 'stop_mounts');
ok('a mounted snapshot, a mount on a share and a mounted image hold it, the pool\'s own datasets and Docker\'s layers do not',
  m && m.status === 'fail' && same(m.args, ['/mnt/cache/.zfs/snapshot/daily-2026-11-17, /mnt/user/cloud, /mnt/disk1/iso-mount', '3']), JSON.stringify(r));
const many = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-mounts-'));
fs.writeFileSync(path.join(many, 'mounts'), Array.from({ length: 12 }, (_, i) => `rclone:r${i} /mnt/user/cloud${i} fuse.rclone rw 0 0`).join('\n') + '\n');
const r2 = stop(`FS_MOUNTS="${many.replace(/\\/g, '/')}/mounts"\nlosetup() { :; }\nstop_mounts`);
ok('a long list shows the first few and the count', r2[0].args[1] === '12' && r2[0].args[0].split(', ').length === 6 && r2[0].args[0].endsWith(', …'), JSON.stringify(r2));
fs.rmSync(many, { recursive: true, force: true });
ok('docker.img is Unraid\'s to detach, another image is named with its file',
  r.some((f) => f.key === 'stop_loops' && same(f.args, ['/mnt/disk1/isos/debian.iso', '1'])) && !JSON.stringify(r).includes('docker.img'), JSON.stringify(r));

console.log('\nVMs without their guest agent');
const virsh = `virsh() { case "$1" in
  list) printf 'Windows 11\\nDebian\\n' ;;
  dumpxml) if [ "$2" = Debian ]; then echo "<target type='virtio' name='org.qemu.guest_agent.0' state='connected'/>"; else echo "<domain/>"; fi ;;
esac; }
libvirt_up() { return 0; }`;
r = stop(`${virsh}\nstop_vm_agents`);
ok('a running VM without a connected guest agent may ignore the request, named with the VMs\' time-out',
  r.length === 1 && r[0].key === 'stop_vm_agent' && r[0].status === 'warn' && r[0].tier === 'warning' && same(r[0].args, ['Windows 11', '1', '60']), JSON.stringify(r));

console.log('\nThe engine');
const engine = read('firesquire-check.sh');
ok('the engine has a mode for the array stop', /--stop\)\s+STOP=1/.test(engine));
ok('that mode runs the stop checks and the fortress', /stop_open_files/.test(engine) && /stop_mounts/.test(engine) && /stop_vm_agents/.test(engine) && /fortress_apps/.test(engine));
ok('it neither notifies nor touches the history', /\[ "\$STOP" -eq 1 \] \|\| health_keep/.test(engine) || /if \[ "\$STOP" -eq 0 \]/.test(engine));
const stream = read('include/FireSquireStream.php');
ok('the stream runs the stop check on request', /--stop/.test(stream) && /\$_GET\['for'\]/.test(stream));

console.log('\nCatching the Stop button');
const js = read('firesquire.js');
function form(action, fields) {
  return { tagName: 'FORM', sent: 0, getAttribute: (k) => (k === 'action' ? action : null),
    querySelectorAll: (sel) => { const n = /\[name="(\w+)"\]/.exec(sel); return n && n[1] in fields ? [{ value: fields[n[1]], type: 'hidden', remove() { delete fields[n[1]]; } }] : []; } };
}
const listeners = [];
const proto = { submit() { this.sent++; } };
const win = { HTMLFormElement: { prototype: proto }, document: { addEventListener: (t, fn) => listeners.push({ t, fn }) } };
const asked = [];
const make = new Function('location', 'URL', grabFn(js, 'bootCmd') + '\n' + grabFn(js, 'installGuard') + '\nreturn installGuard;');
make({ href: 'http://tower/Main' }, URL)(win, (cmd, proceed, cancel) => asked.push({ cmd, proceed, cancel }));
const main = form('/update.htm', { cmdStop: 'Stop', startState: 'STARTED' });
proto.submit.call(main);
ok('Main\'s Stop waits for the check', main.sent === 0 && asked.length === 1 && asked[0].cmd === 'stop');
asked[0].proceed();
ok('and goes out once the check lets it', main.sent === 1);
const start = form('/update.htm', { cmdStart: 'Start' });
proto.submit.call(start);
ok('Start goes out untouched', start.sent === 1 && asked.length === 1);
const fields = { cmdStop: 'Stop', startState: 'STARTED' };
const again = form('/update.htm', fields);
proto.submit.call(again);
asked[1].cancel();
ok('cancelling takes the stop out of the form again, as Unraid\'s own Cancel does', !('cmdStop' in fields) && 'startState' in fields && again.sent === 0, JSON.stringify(fields));
const boot = form('/webGui/include/Boot.php', {});
boot.querySelectorAll = (sel) => (sel === '[name="cmd"]' ? [{ value: 'reboot' }] : []);
proto.submit.call(boot);
ok('a cancelled reboot leaves its form as it was', typeof asked[2].cancel === 'function' && (asked[2].cancel(), boot.sent === 0));
const runSrc = grabFn(js, 'run');
ok('closing the window without going on counts as cancel', /onClose: function\(\)\{[^}]*guard\.cancel\(\)/.test(runSrc) && /guard\.went = true/.test(runSrc));
ok('the Dashboard\'s StopArrayNow is held the same way', /win\.StopArrayNow = held/.test(js) && /guardStop\(window\)/.test(js));
ok('the question names the stop', /g_ask_stop/.test(js) && /g_stop/.test(js) && 'g_ask_stop' in en && 'g_stop' in en);

console.log('\nThe words of a stop');
const fortress = (mode) => execFileSync('php', [path.join(DIR, 'firesquire-fortress.php')].concat(mode ? [mode] : []), { encoding: 'utf8', input: JSON.stringify([
  { app: { id: 'bombvault' }, device: 'tower', report: { app: { name: 'BombVault' }, state: 'ok', work: [{ title: 'Backup of photos', progress: 0.4, blocksRestart: true }, { title: 'Sync', blocksRestart: true }] } },
]) }).split('\n').filter(Boolean).map((l) => l.split('\x1f')[2]);
ok('before a stop, busy apps are named with the stop, not the reboot', fortress('stop').join() === 'fortress_busy_stop,fortress_busy_open_stop', fortress('stop').join());
ok('and before a reboot as before', fortress('').join() === 'fortress_busy,fortress_busy_open');
const calm = execFileSync('php', [path.join(DIR, 'firesquire-fortress.php'), 'stop'], { encoding: 'utf8', input: JSON.stringify([{ app: { id: 'tollroll' }, device: 'tower', report: { app: { name: 'TollRoll' }, state: 'ok', work: [] } }]) });
ok('an idle fortress says so for the stop', /fortress_ok_stop/.test(calm));
ok('the engine asks in the words of a stop when it checks for one', /firesquire-fortress\.php" "\$fortress_mode"/.test(read('firesquire-check.sh')));
ok('the texts are in en.json and speak of stopping the array', ['fortress_ok_stop', 'fortress_busy_stop', 'fortress_busy_open_stop'].every((k) => k in en && /stop the array|stop of the array/.test(JSON.stringify(en[k]))));

console.log('\nThe texts');
const missing = ['stop_open_files', 'stop_open_ok', 'stop_mounts', 'stop_loops', 'stop_vm_agent', 'stop_containers', 'title_stop', 'g_ask_stop', 'g_stop'].filter((k) => !(k in en));
ok('every text is in en.json', missing.length === 0, missing.join(', '));
ok('ShellCheck covers the new file', /firesquire-stop\.sh/.test(read('../../../../../../.github/workflows/lint.yml')));

done();
