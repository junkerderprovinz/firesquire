// FireSquire runs no daemon, so a phrase change reaches it through cron: the install puts a
// schedule on the flash that runs firesquire-follow.sh, and that runs the fortress helper once,
// which follows on its own or keeps the app that moved in the book for the card.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done } = require('./lib');

const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash';
const posix = (p) => (process.platform === 'win32' ? p.replace(/^([A-Za-z]):/, (m, d) => '/' + d.toLowerCase()).replaceAll('\\', '/') : p);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-follow-'));
const bin = path.join(root, 'bin');
fs.mkdirSync(bin);
const PATH = posix(bin) + ':' + (process.platform === 'win32' ? '/usr/bin:/bin' : process.env.PATH);

const plg = fs.readFileSync(path.join(__dirname, '..', 'firesquire.plg'), 'utf8');
const entities = Object.fromEntries([...plg.matchAll(/<!ENTITY\s+(\w+)\s+"([^"]*)">/g)].map((m) => [m[1], m[2]]));
const install = plg.match(/<!-- Install -->\s*<FILE Run="\/bin\/bash">\s*<INLINE>([\s\S]*?)<\/INLINE>/)[1];
const flash = path.join(root, 'flash');
const web = path.join(root, 'web');
for (const d of [flash, web]) fs.mkdirSync(d);
for (const tool of ['installpkg', 'removepkg']) fs.writeFileSync(path.join(bin, tool), '#!/bin/bash\nexit 0\n', { mode: 0o755 });
fs.writeFileSync(path.join(bin, 'curl'), '#!/bin/bash\nexit 1\n', { mode: 0o755 });
const vars = { ...entities, plgPath: flash, emhttp: web };
const expand = (s) => s.replace(/&(\w+);/g, (m, n) => (n in vars ? expand(vars[n]) : m));
const script = expand(install).replaceAll('/var/log/packages/', path.join(root, 'packages') + '/').replaceAll(root, posix(root));
const runInstall = () => execFileSync(bash, ['-c', script], { env: { ...process.env, PATH }, stdio: 'pipe' });

console.log('\nThe schedule');
runInstall();
const cronFile = path.join(flash, 'fortress.cron');
const line = fs.existsSync(cronFile) ? fs.readFileSync(cronFile, 'utf8').trim() : '';
const [minutes, ...rest] = line.split(' ');
const command = rest.slice(4).join(' ');
ok('the install puts it on the flash, where update_cron finds it', line !== '', line);
ok('it runs every 15 minutes', minutes.split(',').length === 4 && rest.slice(0, 4).join(' ') === '* * * *', line);
ok('clear of the check, which runs at half past', !minutes.split(',').includes('30'), line);
ok('and runs the follow script', /^\/bin\/bash \S+\/firesquire-follow\.sh$/.test(command), line);
fs.writeFileSync(cronFile, 'old\n');
runInstall();
ok('an update brings it up to date', fs.readFileSync(cronFile, 'utf8').trim() === line);
ok('joining starts it on a fresh install', /case 'join':[\s\S]*?update_cron[\s\S]*?case 'remove':/.test(read('include/FireSquireFortress.php')));

console.log('\nThe follow script');
const calls = path.join(root, 'calls');
const helper = path.join(root, 'fortress');
const dir = path.join(root, 'membership');
fs.writeFileSync(helper, `#!/bin/bash\necho "$*" >> "${posix(calls)}"\nexit "\${HELPER_EXIT:-0}"\n`, { mode: 0o755 });
const follow = (extra) => {
  try {
    execFileSync(bash, [posix(path.join(DIR, 'firesquire-follow.sh'))], {
      env: { ...process.env, PATH, FIRESQUIRE_FORTRESS: posix(helper), FIRESQUIRE_FORTRESS_DIR: posix(dir), ...extra },
      stdio: 'pipe',
    });
    return 0;
  } catch (e) {
    return e.status;
  }
};
const called = () => (fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n') : []);

ok('outside a fortress it leaves the helper alone', follow() === 0 && called().length === 0, called().join(' | '));
fs.mkdirSync(dir);
fs.writeFileSync(path.join(dir, 'fortress.json'), '{}');
ok('in one it runs the helper once on the membership', follow() === 0 && called().length === 1 && called()[0] === `members -dir ${posix(dir)} -wait 8s`, called().join(' | '));
ok('and a fortress that turns FireSquire away is no failure for cron', follow({ HELPER_EXIT: '3' }) === 0);

fs.rmSync(root, { recursive: true, force: true });
done();
