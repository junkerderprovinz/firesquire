// The release notes live in the .plg's CHANGES, newest first, with the version on top. Each
// release is one changelog in the house's categories and order, a bold label per category, and
// the release workflow turns those labels into the release's headings. No note carries the
// plugin's former name or points at a release that is gone.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ok, done } = require('./lib');

const PLG = path.join(__dirname, '..', 'firesquire.plg');
const plg = fs.readFileSync(PLG, 'utf8');
const changes = (/<CHANGES>([\s\S]*?)<\/CHANGES>/.exec(plg) || [])[1] || '';
const versions = [...changes.matchAll(/^## (\d+\.\d+\.\d+)$/gm)].map((m) => m[1]);
const ORDER = ['✨ **Added**', '🎨 **Design**', '⚡ **Improved**', '🐛 **Fixed**', '🌐 **Translations**'];
const DASHES = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']| - ');

console.log('\nThe CHANGES');
ok('newest first', versions.join(' ') === '1.3.0 1.2.0 1.1.0 1.0.0', versions.join(' '));
ok('the version on top is the plugin\'s', (/<!ENTITY version\s+"([^"]+)">/.exec(plg) || [])[1] === versions[0]);
ok('no note carries the former name', !/smoke\s?signal/i.test(changes));
ok('no note points at a release of its own', !/\bv?\d+\.\d+\.\d+\b/.test(changes.replace(/^## \d+\.\d+\.\d+$/gm, '').replace(/(GlimStone|TowerTorch) \d+\.\d+\.\d+/g, '')));
ok('a pause is a full stop or a colon, never a dash', !DASHES.test(changes));
const blocks = changes.split(/^## \d+\.\d+\.\d+$/m).slice(1);
blocks.forEach((b, i) => {
  const labels = b.split('\n').filter((l) => /^\S/.test(l) && !/^- /.test(l)).map((l) => l.trim());
  ok(`${versions[i]}: only the house's categories, in their order`, labels.length > 0 && labels.every((l) => ORDER.includes(l))
    && labels.every((l, k) => k === 0 || ORDER.indexOf(labels[k - 1]) < ORDER.indexOf(l)), labels.join(' / '));
  ok(`${versions[i]}: every point under a category`, b.trim().split('\n').filter((l) => l.trim()).every((l) => /^- \*\*/.test(l) || ORDER.includes(l.trim())));
});

console.log('\nThe release workflow');
const yml = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'release.yml'), 'utf8');
const step = (/ver="\$\{\{ steps\.v\.outputs\.version \}\}"\n\s+(awk[\s\S]*?release-notes\.md)/.exec(yml) || [])[1] || '';
const notes = step ? execFileSync('bash', ['-c', `ver=${versions[0]}; cd "${path.join(__dirname, '..', '..').replace(/\\/g, '/')}"; ${step.replace(/> release-notes\.md$/, '')}`], { encoding: 'utf8' }) : '';
ok('takes the newest block', notes.includes('- **') && !/^## \d/m.test(notes));
ok('and gives each category a heading', /^## ✨ Added$/m.test(notes) && !/^\S+ \*\*[A-Z][a-z]+\*\*$/m.test(notes), notes.split('\n').filter((l) => /^#|\*\*$/.test(l)).join(' / '));
ok('pins the version as the owner, not as a bot', /git config user\.name "junkerderprovinz"/.test(yml) && !/github-actions\[bot\]/.test(yml));

done();
