// Advice on the server's settings, in a group of its own on the Health tab so it never drowns the
// lights: a cache-only share with files on the array, the shares of appdata, docker.img, libvirt
// and the VM disks set to end up on the array, a share that names a pool that does not exist,
// plugins with an update waiting and plugins not made for this Unraid version. Nothing here
// wakes a disk: only array disks Unraid reports awake are looked at.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done } = require('./lib');

const MORE = path.join(DIR, 'firesquire-more.sh').replace(/\\/g, '/');
const CONFIG = path.join(DIR, 'firesquire-config.sh').replace(/\\/g, '/');
const FIX = path.join(__dirname, 'fixtures').replace(/\\/g, '/');
const en = JSON.parse(read('lang/en.json'));
const PLURAL = read('firesquire-check.sh').match(/^plural\(\) \{.*\}$/m)[0];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-config-'));
const T = tmp.replace(/\\/g, '/');
for (const d of ['mnt/disk1/media', 'mnt/disk2/media', 'mnt/disk1/films', 'pools', 'plugins', 'new']) fs.mkdirSync(path.join(tmp, d), { recursive: true });
fs.writeFileSync(path.join(tmp, 'pools', 'cache.cfg'), '');
for (const p of ['ca.plg', 'old.plg', 'fine.plg', 'unRAIDServer.plg']) fs.writeFileSync(path.join(tmp, 'plugins', p), p);
for (const p of ['ca.plg', 'fine.plg', 'unRAIDServer.plg']) fs.writeFileSync(path.join(tmp, 'new', p), 'new-' + p);
fs.writeFileSync(path.join(tmp, 'unraid-version'), 'version="7.2.0"\n');

function config(body) {
  const script = `
set -u
source "${MORE}"
source "${CONFIG}"
add() { local IFS=$'\\x1f'; printf '%s\\n' "$*"; }
${PLURAL}
FS_SHARES_INI="${FIX}/shares.ini"; FS_DISKS_INI="${FIX}/disks-config.ini"; FS_MNT="${T}/mnt"; FS_POOLS="${T}/pools"
FS_DOCKER_CFG="${FIX}/docker-paths.cfg"; FS_DOMAIN_CFG="${FIX}/domain-paths.cfg"
FS_PLUGINS="${T}/plugins"; FS_PLUGINS_NEW="${T}/new"; FS_UNRAID_VERSION="${T}/unraid-version"
plg() { case "$1:$(cat "$2")" in
  version:ca.plg) echo 2026.01.01 ;; version:new-ca.plg) echo 2026.03.01 ;;
  version:fine.plg|version:new-fine.plg) echo 1.0 ;;
  version:unRAIDServer.plg) echo 7.2.0 ;; version:new-unRAIDServer.plg) echo 7.3.0 ;;
  version:old.plg) echo 2019.1 ;; max:old.plg) echo 6.12.99 ;;
  min:fine.plg) echo 6.9.0 ;;
  *) echo "plugin: $1 attribute not present" ;; esac; }
${body}
`;
  return execFileSync('bash', ['-c', script], { encoding: 'utf8' }).split('\n').filter(Boolean).map((l) => {
    const [tier, id, status, key, args, message] = l.split('\x1f');
    return { tier, id, status, key, args: args ? args.split('|') : [], message };
  });
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keyed = (r, k) => r.filter((f) => f.key === k);

console.log('\nShares');
let r = config('config_shares');
ok('every finding is configuration advice, never part of the verdict', r.length > 0 && r.every((f) => f.tier === 'config'), JSON.stringify(r));
let f = keyed(r, 'cfg_cache_only_array');
ok('a cache-only share with files on an awake array disk names the share and the disk', f.length === 1 && same(f[0].args, ['media', 'disk1']) && f[0].status === 'warn', JSON.stringify(f));
ok('a sleeping disk is not looked at', !f.some((x) => x.args[1].includes('disk2')));
ok('a share Unraid keeps on its pool alone needs no look', !r.some((x) => x.args[0] === 'isos'));
f = keyed(r, 'cfg_on_array');
ok('the share of appdata set to move to the array is named with the path it holds',
  f.length === 1 && same(f[0].args, ['appdata', '/mnt/user/appdata/', 'yes']), JSON.stringify(f));
ok('system and domains on their pool are fine', !f.some((x) => x.args[0] === 'system'));
f = keyed(r, 'cfg_pool_missing');
ok('a share naming a pool that does not exist is named with the pool', f.length === 1 && same(f[0].args, ['scratch', 'fastpool']), JSON.stringify(f));

console.log('\nPlugins');
r = config('config_plugins');
f = keyed(r, 'cfg_plugin_update');
ok('plugins with an update waiting are listed, Unraid itself is not', f.length === 1 && same(f[0].args, ['ca', '1']) && f[0].tier === 'config', JSON.stringify(r));
f = keyed(r, 'cfg_plugin_unfit');
ok('a plugin made only up to an older Unraid is named', f.length === 1 && same(f[0].args, ['old', '1', '7.2.0']), JSON.stringify(r));

console.log('\nAll in order');
fs.writeFileSync(path.join(tmp, 'shares-ok.ini'), '["isos"]\nname="isos"\nuseCache="only"\ncachePool="cache"\nexclusive="yes"\n');
r = config(`FS_SHARES_INI="${T}/shares-ok.ini"; FS_PLUGINS_NEW="${T}/none"; rm -f "${T}/plugins/old.plg"\nconfig_shares; config_plugins; config_done`);
ok('nothing to change passes once', r.length === 1 && r[0].key === 'cfg_ok' && r[0].status === 'pass' && r[0].tier === 'config', JSON.stringify(r));
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\nThe engine and the texts');
const engine = read('firesquire-check.sh');
ok('the engine runs the configuration checks', /\. "\$HERE\/firesquire-config\.sh"/.test(engine) && /^config_shares$/m.test(engine) && /^config_plugins$/m.test(engine) && /^config_done$/m.test(engine));
const missing = ['cfg_cache_only_array', 'cfg_on_array', 'cfg_pool_missing', 'cfg_plugin_update', 'cfg_plugin_unfit', 'cfg_ok'].filter((k) => !(k in en));
ok('every text is in en.json', missing.length === 0, missing.join(', '));
ok('ShellCheck covers the new file', /firesquire-config\.sh/.test(fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'lint.yml'), 'utf8')));

done();
