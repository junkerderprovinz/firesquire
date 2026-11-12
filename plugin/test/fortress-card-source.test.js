// The fortress card is GlimStone's own, unchanged: every plugin of the house shows the same card, so
// glimstone.json names the GlimStone commit and the source of each copy, and each copy matches that
// file byte for byte.
const fs = require('fs');
const path = require('path');
const { ok, done } = require('./lib');

const ROOT = path.join(__dirname, '..', '..');
const vanilla = JSON.parse(fs.readFileSync(path.join(ROOT, 'glimstone.json'), 'utf8')).vanilla || {};
const files = Object.entries(vanilla.files || {});

(async () => {
  console.log('\nThe fortress card is GlimStone\'s own, unchanged');
  ok('glimstone.json names the GlimStone commit', /^[0-9a-f]{7,40}$/.test(vanilla.ref || ''), vanilla.ref);
  ok('and both files of the card', files.map(([, src]) => path.basename(src)).sort().join() === 'fortress-card.css,fortress-card.js', files.join(' | '));
  for (const [copy, src] of files) {
    const url = `https://raw.githubusercontent.com/junkerderprovinz/glimstone/${vanilla.ref}/${src}`;
    let want = null, why = '';
    try {
      const res = await fetch(url);
      if (res.ok) want = Buffer.from(await res.arrayBuffer());
      else why = `${url} answered ${res.status}`;
    } catch (e) {
      why = `${url} could not be fetched: ${e.message}`;
    }
    const have = fs.existsSync(path.join(ROOT, copy)) ? fs.readFileSync(path.join(ROOT, copy)) : null;
    ok(`${copy} is GlimStone's ${src} at ${vanilla.ref}`, want !== null && have !== null && have.equals(want),
      why || (have ? `${copy} differs from GlimStone ${vanilla.ref}; copy ${src} again` : `${copy} is missing`));
  }
  done();
})();
