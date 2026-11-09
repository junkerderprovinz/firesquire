// The check writes one probe file to /boot and deletes it, so no text may claim that it never
// changes anything, and the English texts name the flash write test instead.
const fs = require('fs');
const path = require('path');
const { DIR, read, ok, done } = require('./lib');

const ROOT = path.join(DIR, '..', '..', '..', '..', '..', '..');
const en = JSON.parse(read('lang/en.json'));
const sources = {
  'firesquire-check.sh': read('firesquire-check.sh'),
  'firesquire.js': read('firesquire.js'),
  'lang/en.json': read('lang/en.json'),
  'plugin README.md': read('README.md'),
  'README.md': fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8'),
  'SUPPORT_THREAD.html': fs.readFileSync(path.join(ROOT, '.github', 'SUPPORT_THREAD.html'), 'utf8'),
};

console.log('\nThe probe on the flash is part of what the check does');
ok('the engine still writes and removes its probe file', /tf="\/boot\/\.firesquire_write_test\.\$\$"[\s\S]*?rm -f "\$tf"/.test(sources['firesquire-check.sh']));

console.log('\nNo text claims that nothing is ever changed');
const claim = /never (changes|touches)|nothing was changed|changes the system/i;
for (const [name, src] of Object.entries(sources)) {
  ok(`${name} makes no such claim`, !claim.test(src), (src.match(claim) || [])[0]);
}

console.log('\nThe English texts name the flash write test');
for (const k of ['subtitle', 'tools_lead', 'tools_note']) {
  ok(`${k} mentions the flash`, /flash/i.test(en[k]), en[k]);
}
for (const name of ['firesquire-check.sh', 'plugin README.md', 'README.md', 'SUPPORT_THREAD.html']) {
  ok(`${name} mentions the flash write test`, /test file|write test/i.test(sources[name]));
}

done();
