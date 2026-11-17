// The flash stick and Unraid's certificate: read errors of the stick in the syslog are a reason to
// think twice before a reboot, since the server boots from it. Little room on the stick and a
// certificate about to run out belong to the Health tab. The tests feed sample outputs from
// fixtures/ to firesquire-watch.sh instead of a real server.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done } = require('./lib');

const WATCH = path.join(DIR, 'firesquire-watch.sh').replace(/\\/g, '/');
const MORE = path.join(DIR, 'firesquire-more.sh').replace(/\\/g, '/');
const FIX = path.join(__dirname, 'fixtures').replace(/\\/g, '/');
const en = JSON.parse(read('lang/en.json'));
const PLURAL = read('firesquire-check.sh').match(/^plural\(\) \{.*\}$/m)[0];
const T0 = 1794916800; // 2026-11-17 12:00 UTC

function watch(body) {
  const script = `
set -u
source "${MORE}"
source "${WATCH}"
add() { local IFS=$'\\x1f'; printf '%s\\n' "$*"; }
have() { declare -F "$1" >/dev/null || command -v "$1" >/dev/null 2>&1; }
${PLURAL}
FS_MOUNTS="${FIX}/mounts-boot.txt"
${body}
`;
  const out = execFileSync('bash', ['-c', script], { encoding: 'utf8', env: { ...process.env, TZ: 'UTC' } });
  return out.split('\n').filter(Boolean).map((l) => {
    const [tier, id, status, key, args, message] = l.split('\x1f');
    return { tier, id, status, key, args: args ? args.split('|') : [], message };
  });
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const one = (r, key, status, args) => r.length === 1 && r[0].key === key && r[0].status === status && (!args || same(r[0].args, args));

console.log('\nRead errors of the stick');
let r = watch(`flash_disk`);
ok('the stick is the disk behind /boot', r[0] && r[0].tier === 'sda', JSON.stringify(r));
r = watch(`FS_SYSLOG="${FIX}/syslog-flash.txt"\nwatch_flash_errors`);
ok('its errors are Smouldering before a reboot, counted with the latest line', one(r, 'flash_errors', 'warn') && r[0].tier === 'warning' && r[0].args[0] === '3' &&
  /Buffer I\/O error on dev sda1/.test(r[0].args[1]), JSON.stringify(r));
ok('another disk and a name that only starts the same stay out', !/sdc|sdab/.test(r[0].args[1]));
r = watch(`FS_SYSLOG="${FIX}/smbstatus-S.txt"\nwatch_flash_errors`);
ok('a quiet syslog passes', one(r, 'flash_errors_ok', 'pass'), JSON.stringify(r));

console.log('\nRoom on the stick');
const size = 'boot_version_kb() { echo 1258291; }';
const df = (availKb) => `df() { printf 'Filesystem 1024-blocks Used Available Capacity Mounted on\\n/dev/sda1 61553280 1 ${availKb} 50%% /boot\\n'; }`;
r = watch(`${size}\n${df(400000)}\nwatch_flash_space`);
ok('less room than the current version takes is a health warning, in GB', one(r, 'flash_space_low', 'warn', ['0.4', '1.2']) && r[0].tier === 'health', JSON.stringify(r));
r = watch(`${size}\n${df(4000000)}\nwatch_flash_space`);
ok('enough room passes', one(r, 'flash_space_ok', 'pass', ['3.8']), JSON.stringify(r));

console.log('\nUnraid\'s certificate');
const certs = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-certs-'));
for (const f of ['Tower_unraid_bundle.pem', 'Old_unraid_bundle.pem', 'certificate_bundle.pem']) fs.writeFileSync(path.join(certs, f), f);
const C = certs.replace(/\\/g, '/');
const ini = path.join(certs, 'var.ini');
const ssl = (use, ends) => {
  fs.writeFileSync(ini, `NAME="Tower"\nUSE_SSL="${use}"\n`);
  return watch(`FS_VAR_INI="${ini.replace(/\\/g, '/')}"\nFS_CERTS="${C}"\nFS_NOW=${T0}
openssl() { case "$(cat "$5")" in ${ends} *) echo "notAfter=Jan 26 10:10:32 2034 GMT" ;; esac; }
watch_cert`);
};
r = ssl('yes', `certificate_bundle.pem) echo "notAfter=Nov 27 12:00:00 2026 GMT" ;;`);
ok('a certificate that runs out within two weeks is a health warning with the day', r.length === 2 && r.some((f) => f.key === 'cert_soon' && f.status === 'warn' && f.tier === 'health' &&
  same(f.args, ['certificate_bundle.pem', '2026-11-27', '10'])), JSON.stringify(r));
ok('the server\'s own one passes', r.some((f) => f.key === 'cert_ok' && f.args[0] === 'Tower_unraid_bundle.pem'));
ok('a stale one of an old server name stays out', !r.some((f) => f.args[0] === 'Old_unraid_bundle.pem'));
r = ssl('yes', `Tower_unraid_bundle.pem) echo "notAfter=Nov 01 12:00:00 2026 GMT" ;;`);
ok('one that ran out fails', r.some((f) => f.key === 'cert_expired' && f.status === 'fail' && same(f.args, ['Tower_unraid_bundle.pem', '2026-11-01'])), JSON.stringify(r));
r = ssl('no', `Tower_unraid_bundle.pem) echo "notAfter=Nov 01 12:00:00 2026 GMT" ;;`);
ok('with HTTPS off nothing is said', r.length === 0, JSON.stringify(r));
fs.rmSync(certs, { recursive: true, force: true });

console.log('\nThe engine and the texts');
const engine = read('firesquire-check.sh');
ok('the engine sources the watch checks', /\. "\$HERE\/firesquire-watch\.sh"/.test(engine));
ok('and runs them', ['watch_flash_errors', 'watch_flash_space', 'watch_cert'].every((f) => new RegExp('^' + f + '$', 'm').test(engine)));
const keys = ['flash_errors', 'flash_errors_ok', 'flash_space_low', 'flash_space_ok', 'cert_soon', 'cert_expired', 'cert_ok'];
const missing = keys.filter((k) => !(k in en));
ok('every text is in en.json', missing.length === 0, missing.join(', '));
ok('ShellCheck covers the new file', /firesquire-watch\.sh/.test(fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'lint.yml'), 'utf8')));

done();
