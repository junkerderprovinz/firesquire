// What else stands in the way of a clean reboot: a flash that takes no file or keeps the test file,
// time-outs that do not add up, an unclean last shutdown, files open over SMB or NFS, a UPS on
// battery and an old flash backup. The tests feed sample outputs from fixtures/ to
// firesquire-more.sh instead of a real server.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done } = require('./lib');

const MORE = path.join(DIR, 'firesquire-more.sh').replace(/\\/g, '/');
const FIX = path.join(__dirname, 'fixtures').replace(/\\/g, '/');
const en = JSON.parse(read('lang/en.json'));

function more(body) {
  const script = `
set -u
source "${MORE}"
add() { local IFS=$'\\x1f'; printf '%s\\n' "$*"; }
have() { declare -F "$1" >/dev/null || command -v "$1" >/dev/null 2>&1; }
${body}
`;
  const out = execFileSync('bash', ['-c', script], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean).map((l) => {
    const [tier, id, status, key, args, message, link] = l.split('\x1f');
    return { tier, id, status, key, args: args ? args.split('|') : [], message, link };
  });
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const one = (r, key, status, args) => r.length === 1 && r[0].key === key && r[0].status === status && same(r[0].args, args);

console.log('\nShutdown time-outs');
const docker = (stops) => `docker() { case "$1" in info) return 0 ;; ps) echo "a b c" ;; inspect) printf '%s\\n' ${stops} ;; esac; }`;
const env = (ini) => `FS_VAR_INI="${FIX}/${ini}"; FS_DOCKER_CFG="${FIX}/docker.cfg"; FS_DOMAIN_CFG="${FIX}/domain.cfg"`;
let r = more(`${env('var-running.ini')}\n${docker('"/plex <nil>" "/sonarr 10"')}\nlibvirt_up() { return 0; }\nmore_timeouts`);
ok('a time-out that covers containers and VMs passes', one(r, 'timeouts_ok', 'pass', ['90', '70']), JSON.stringify(r));
r = more(`${env('var-unclean.ini')}\n${docker('"/plex <nil>"')}\nlibvirt_up() { return 0; }\nmore_timeouts`);
ok('a time-out shorter than containers and VMs together is CAUTION', one(r, 'timeouts_short', 'warn', ['60', '10', '60', '70']) && r[0].tier === 'warning', JSON.stringify(r));
r = more(`${env('var-unclean.ini')}\n${docker('"/plex <nil>"')}\nlibvirt_up() { return 1; }\nmore_timeouts`);
ok('without VMs only the containers count', one(r, 'timeouts_ok', 'pass', ['60', '10']), JSON.stringify(r));
r = more(`${env('var-running.ini')}\n${docker('"/mariadb 300" "/plex <nil>" "/nextcloud 60"')}\nlibvirt_up() { return 0; }\nmore_timeouts`);
ok('containers that ask for more time than Unraid gives them are CAUTION, by name',
  one(r, 'timeouts_container', 'warn', ['mariadb (300s), nextcloud (60s)', '10']), JSON.stringify(r));
r = more(`${env('var-running.ini')}\ndocker() { return 1; }\nlibvirt_up() { return 1; }\nmore_timeouts`);
ok('without Docker and VMs nothing is said', r.length === 0, JSON.stringify(r));

console.log('\nAn unclean last shutdown');
r = more(`FS_VAR_INI="${FIX}/var-unclean.ini"\nmore_unclean`);
ok('Unraid\'s flag for an unclean shutdown is CAUTION', one(r, 'unclean', 'warn', []) && r[0].tier === 'warning', JSON.stringify(r));
r = more(`FS_VAR_INI="${FIX}/var-running.ini"\nmore_unclean`);
ok('a clean state says nothing', r.length === 0, JSON.stringify(r));

console.log('\nOpen files on shares');
const smb = (locked) => `smbstatus() { case "$1" in -L) cat "${FIX}/${locked}" ;; -S) cat "${FIX}/smbstatus-S.txt" ;; esac; }`;
r = more(`${smb('smbstatus-L.txt')}\nFS_NFSD="${FIX}/nfsd"\nmore_shares`);
const keyed = (k) => r.filter((f) => f.key === k).map((f) => f.args);
ok('a file written over SMB is CAUTION with share and machine', same(keyed('share_writing').filter((a) => a[0] === 'SMB'), [['SMB', 'media', '192.168.1.20', '1']]), JSON.stringify(r));
ok('a file read over SMB is CAUTION with share and machine', same(keyed('share_open'), [['SMB', 'backup', '192.168.1.31', '1']]), JSON.stringify(r));
ok('a file written over NFS is CAUTION with share and client', same(keyed('share_writing').filter((a) => a[0] === 'NFS'), [['NFS', 'isos', '192.168.1.40', '1']]), JSON.stringify(r));
ok('every one of them is CAUTION', r.length === 3 && r.every((f) => f.status === 'warn' && f.tier === 'warning'), JSON.stringify(r));
r = more(`${smb('smbstatus-L-none.txt')}\nFS_NFSD="${FIX}/none"\nmore_shares`);
ok('no open file passes', one(r, 'shares_ok', 'pass', []), JSON.stringify(r));
r = more(`FS_NFSD="${FIX}/none"\nPATH=/nonexistent\nmore_shares`);
ok('without Samba and NFS nothing is said', r.length === 0, JSON.stringify(r));

console.log('\nThe UPS');
const ups = (f, up = 0) => more(`ups_up() { return ${up}; }\napcaccess() { cat "${FIX}/apcaccess-${f}.txt"; }\nmore_ups`);
ok('on mains power it passes with the charge', one(ups('online'), 'ups_ok', 'pass', ['100']), JSON.stringify(ups('online')));
ok('on battery it is CAUTION with charge and time left', one(ups('onbatt'), 'ups_battery', 'warn', ['64', '18']), JSON.stringify(ups('onbatt')));
ok('an almost empty battery is CAUTION', one(ups('lowbatt'), 'ups_low', 'warn', ['9', '2']), JSON.stringify(ups('lowbatt')));
ok('the low-battery flag of the UPS counts as almost empty', one(ups('lowflag'), 'ups_low', 'warn', ['35', '3']), JSON.stringify(ups('lowflag')));
ok('without Unraid\'s UPS service nothing is said', ups('onbatt', 1).length === 0);

console.log('\nThe flash backup');
const now = 'FS_NOW=1794398400'; // 2026-11-11 12:00 UTC
const fortress = (answer, code = 0) => `FORTRESS=fortress_stub; FORTRESS_DIR=/x; fortress_stub() { echo "$*" > /dev/null; printf '%s\\n' '${answer}'; return ${code}; }; fortress_helper() { return 0; }; joined() { return 0; }`;
r = more(`${now}\n${fortress('{"domain":"flash","at":"2026-11-01T03:00:00Z","ok":true}')}\nFS_BOOT=/nonexistent\nmore_flash`);
ok('BombVault in the fortress tells the date, ten days is CAUTION', one(r, 'flash_backup_old', 'warn', ['10', 'BombVault']) && r[0].tier === 'warning', JSON.stringify(r));
r = more(`${now}\n${fortress('{"domain":"flash","at":"2026-11-09T03:00:00Z","ok":true}')}\nFS_BOOT=/nonexistent\nmore_flash`);
ok('two days passes', one(r, 'flash_backup_ok', 'pass', ['2', 'BombVault']), JSON.stringify(r));
r = more(`${now}\n${fortress('', 1)}\nFS_BOOT="${FIX}"; boot_git() { echo 1794225600; }\nmore_flash`);
ok('Unraid Connect\'s backup on the flash counts too', one(r, 'flash_backup_ok', 'pass', ['2', 'Unraid Connect']), JSON.stringify(r));
r = more(`${now}\n${fortress('{"domain":"flash","at":"2026-10-01T03:00:00Z","ok":true}')}\nFS_BOOT="${FIX}"; boot_git() { echo 1794225600; }\nmore_flash`);
ok('the newer of the two wins', one(r, 'flash_backup_ok', 'pass', ['2', 'Unraid Connect']), JSON.stringify(r));
r = more(`${now}\n${fortress('', 1)}\nFS_BOOT=/nonexistent\nmore_flash`);
ok('without any backup FireSquire says so', one(r, 'flash_backup_none', 'info', []), JSON.stringify(r));
r = more(`${now}
FORTRESS=/nonexistent
FS_BOOT=/nonexistent
more_flash`);
ok('without the fortress helper it names Unraid Connect alone', one(r, 'flash_backup_none_connect', 'info', []), JSON.stringify(r));
r = more(`${now}
FORTRESS=/nonexistent
FS_BOOT="${FIX}"; boot_git() { echo 1794225600; }
more_flash`);
ok('and still reads Unraid Connect\'s backup', one(r, 'flash_backup_ok', 'pass', ['2', 'Unraid Connect']), JSON.stringify(r));

console.log('\nThe flash write test');
const boot = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-boot-')).replace(/\\/g, '/');
r = more(`FS_BOOT="${boot}"; boot_mounted() { return 0; }\nmore_probe`);
ok('a writable flash passes in one card', one(r, 'flash_ok', 'pass', []) && r[0].tier === 'critical', JSON.stringify(r));
ok('and keeps no test file', fs.readdirSync(boot).length === 0, fs.readdirSync(boot).join(', '));
r = more(`FS_BOOT="${boot}"; boot_mounted() { return 0; }; rm() { return 1; }\nmore_probe`);
const left = r.find((f) => f.key === 'flash_probe_left');
ok('a test file it cannot delete gets a card of its own', r.length === 2 && r[0].key === 'flash_ok' && !!left && left.status === 'warn'
  && left.tier === 'warning' && /\/\.firesquire_write_test\.\d+$/.test(left.args[0]), JSON.stringify(r));
fs.rmSync(boot, { recursive: true, force: true });
r = more('FS_BOOT=/nonexistent; boot_mounted() { return 0; }\nmore_probe');
ok('a flash that takes no file is NO-GO', one(r, 'flash_ro', 'fail', []), JSON.stringify(r));
r = more('FS_BOOT=/nonexistent; boot_mounted() { return 1; }\nmore_probe');
ok('an unmounted flash is NO-GO', one(r, 'flash_unmounted', 'fail', []), JSON.stringify(r));

console.log('\nThe texts');
const keys = ['p_timeouts', 'timeouts_ok', 'timeouts_short', 'timeouts_container', 'unclean', 'p_shares', 'share_open', 'share_writing',
  'shares_ok', 'p_ups', 'ups_ok', 'ups_battery', 'ups_low', 'p_flashbak', 'flash_backup_ok', 'flash_backup_old', 'flash_backup_none', 'flash_backup_none_connect',
  'flash_probe_left', 'tools_g_shutdown', 'g_ask_reboot', 'g_ask_shutdown', 'g_reboot', 'g_shutdown', 'g_cancel'];
const missing = keys.filter((k) => !(k in en));
ok('every new text is in en.json', missing.length === 0, missing.join(', '));
const engine = read('firesquire-check.sh');
ok('the engine sources the checks and runs each of them', /\. "\$HERE\/firesquire-more\.sh"/.test(engine) &&
  ['more_probe', 'more_timeouts', 'more_unclean', 'more_shares', 'more_ups', 'more_flash'].every((f) => engine.includes(f)));

done();
