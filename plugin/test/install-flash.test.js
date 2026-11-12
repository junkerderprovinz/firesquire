// The install step on a flash drive that still holds packages from earlier versions. It runs the
// .plg's own install script against temporary folders, with installpkg and removepkg stubbed, and
// expects only the package it just installed to stay on the flash.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { ok, done } = require('./lib');

const plg = fs.readFileSync(path.join(__dirname, '..', 'firesquire.plg'), 'utf8');
const entities = Object.fromEntries([...plg.matchAll(/<!ENTITY\s+(\w+)\s+"([^"]*)">/g)].map((m) => [m[1], m[2]]));
const install = plg.match(/<!-- Install -->\s*<FILE Run="\/bin\/bash">\s*<INLINE>([\s\S]*?)<\/INLINE>/)[1];

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-install-'));
const flash = path.join(root, 'flash');
const web = path.join(root, 'web');
const bin = path.join(root, 'bin');
for (const d of [flash, web, bin]) fs.mkdirSync(d);
for (const tool of ['installpkg', 'removepkg']) {
  fs.writeFileSync(path.join(bin, tool), '#!/bin/bash\nexit 0\n', { mode: 0o755 });
}

const version = entities.version;
const current = `${entities.pkg}-${version}.txz`;
const others = ['firesquire-3.0.0.txz', 'firesquire-3.1.2.txz', 'firesquire-1.2.0.txz'];
for (const name of [current, ...others]) fs.writeFileSync(path.join(flash, name), 'x');
fs.writeFileSync(path.join(flash, 'crc.state'), '{}');
fs.writeFileSync(path.join(flash, 'firesquire.cfg'), 'x');

const vars = { ...entities, plgPath: flash, emhttp: web };
const expand = (s) => s.replace(/&(\w+);/g, (m, n) => (n in vars ? expand(vars[n]) : m));
const script = expand(install).replaceAll('/var/log/packages/', path.join(root, 'packages') + '/');

const bash = process.platform === 'win32' ? 'C:\\Program Files\\Git\\bin\\bash.exe' : 'bash';
const posix = (p) => (process.platform === 'win32' ? p.replace(/^([A-Za-z]):/, (m, d) => '/' + d.toLowerCase()).replaceAll('\\', '/') : p);
const env = { ...process.env, PATH: posix(bin) + ':' + (process.platform === 'win32' ? '/usr/bin:/bin' : process.env.PATH) };
execFileSync(bash, ['-c', script.replaceAll(root, posix(root))], { env, stdio: 'pipe' });

const left = fs.readdirSync(flash).sort();
console.log('\nThe flash after an update');
ok('keeps the package it just installed', left.includes(current), left.join(' '));
ok('drops the packages of earlier versions', others.every((n) => !left.includes(n)), left.join(' '));
ok('leaves the CRC counts and the settings alone', left.includes('crc.state') && left.includes('firesquire.cfg'), left.join(' '));

console.log('\nThe install message');
ok('says the plugin is ready in English', /FireSquire is ready!/.test(install) && !/ ist ready/.test(install));

fs.rmSync(root, { recursive: true, force: true });
done();
