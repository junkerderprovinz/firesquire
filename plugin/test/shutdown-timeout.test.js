// After an unclean shutdown FireSquire names the time-out to set. Unraid keeps the syslog of the
// last shutdown in /boot/logs/syslog-previous, and it shows how long the VMs and the containers
// took to stop and whether Unraid gave up waiting. From that, plus a margin for unmounting,
// comes a concrete number of seconds, rounded up to the next half minute. A shutdown that ran
// out of time after both had stopped was held by something else, and the log names the mount.
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done } = require('./lib');

const MORE = path.join(DIR, 'firesquire-more.sh').replace(/\\/g, '/');
const FIX = path.join(__dirname, 'fixtures').replace(/\\/g, '/');
const en = JSON.parse(read('lang/en.json'));
const PLURAL = read('firesquire-check.sh').match(/^plural\(\) \{.*\}$/m)[0];

function more(body) {
  const script = `
set -u
source "${MORE}"
add() { local IFS=$'\\x1f'; printf '%s\\n' "$*"; }
have() { declare -F "$1" >/dev/null || command -v "$1" >/dev/null 2>&1; }
${PLURAL}
FS_DOCKER_CFG="${FIX}/docker.cfg"; FS_DOMAIN_CFG="${FIX}/domain.cfg"
${body}
`;
  return execFileSync('bash', ['-c', script], { encoding: 'utf8' }).split('\n').filter(Boolean).map((l) => {
    const [tier, id, status, key, args, message] = l.split('\x1f');
    return { tier, id, status, key, args: args ? args.split('|') : [], message };
  });
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const one = (r, key, status, args) => r.length === 1 && r[0].key === key && r[0].status === status && same(r[0].args, args);
const last = (log, ini = 'var-running.ini') => more(`FS_VAR_INI="${FIX}/${ini}"\nFS_PREV_SYSLOG="${FIX}/${log}"\nmore_last_shutdown`);

console.log('\nThe last shutdown');
let r = last('syslog-previous-vms.txt');
ok('VMs still stopping when the time ran out give the time-out to set',
  one(r, 'timeout_suggest', 'warn', ['90', '97', '150']) && r[0].tier === 'warning', JSON.stringify(r));
ok('in words that name Disk Settings and the seconds', /Disk Settings/.test(r[0] && r[0].message) && /150 seconds/.test(r[0] && r[0].message), r[0] && r[0].message);
r = last('syslog-previous-held.txt');
ok('a shutdown held after VMs and containers had stopped names the busy mounts',
  one(r, 'shutdown_held', 'warn', ['90', '/mnt/user, /mnt/cache']), JSON.stringify(r));
r = last('syslog-previous-docker.txt');
ok('across midnight the time still adds up, and a time-out raised since then passes', one(r, 'timeout_raised', 'pass', ['60', '90']), JSON.stringify(r));
r = last('syslog-previous-clean.txt');
ok('a clean shutdown says nothing, with the timestamps Unraid writes in ISO form too', r.length === 0, JSON.stringify(r));
r = last('missing.txt');
ok('without the log nothing is said', r.length === 0, JSON.stringify(r));

console.log('\nThe unclean flag of the array');
r = more(`FS_VAR_INI="${FIX}/var-unclean.ini"\nFS_PREV_SYSLOG="${FIX}/missing.txt"\nmore_unclean`);
ok('without the log the time-out comes from Docker\'s and the VMs\' own time-outs',
  one(r, 'unclean_suggest', 'warn', ['10', '60', '120']) && r[0].tier === 'warning', JSON.stringify(r));
r = more(`FS_VAR_INI="${FIX}/var-unclean.ini"\nFS_PREV_SYSLOG="${FIX}/syslog-previous-vms.txt"\nmore_unclean`);
ok('with the log that finding speaks, and the flag keeps its plain line', one(r, 'unclean', 'warn', []), JSON.stringify(r));

console.log('\nThe engine and the texts');
const engine = read('firesquire-check.sh');
ok('the engine looks at the last shutdown', /^more_last_shutdown$/m.test(engine));
const missing = ['timeout_suggest', 'shutdown_held', 'timeout_raised', 'unclean_suggest'].filter((k) => !(k in en));
ok('every text is in en.json', missing.length === 0, missing.join(', '));

done();
