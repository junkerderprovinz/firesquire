// The fortress card is GlimStone's own, unchanged: every plugin of the house shows the same card, so
// glimstone.json keeps it as a copy target, and each copy matches its file at GlimStone's tag
// v<version> byte for byte, or on rel/<version> until that release is tagged.
const fs = require('fs');
const path = require('path');
const { ok, done } = require('./lib');

const ROOT = path.join(__dirname, '..', '..');
const card = JSON.parse(fs.readFileSync(path.join(ROOT, 'glimstone.json'), 'utf8'))
  .targets.find((t) => t.mode === 'copy' && t.name === 'fortress card') || { files: [] };

async function glimstoneFile(version, file) {
  for (const ref of [`v${version}`, `rel/${version}`]) {
    const url = `https://raw.githubusercontent.com/junkerderprovinz/glimstone/${ref}/${file}`;
    const res = await fetch(url);
    if (res.status === 404) continue;
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return { ref, body: Buffer.from(await res.arrayBuffer()) };
  }
  throw new Error(`GlimStone has ${file} neither at v${version} nor on rel/${version}`);
}

(async () => {
  console.log('\nThe fortress card is GlimStone\'s own, unchanged');
  ok('glimstone.json names the GlimStone version of the card', /^\d+\.\d+\.\d+$/.test(card.version || ''), card.version);
  ok('and both files of the card', card.files.map((f) => path.basename(f.from)).sort().join() === 'fortress-card.css,fortress-card.js', JSON.stringify(card.files));
  for (const { from, to } of card.files) {
    let want = null, why = '';
    try {
      want = await glimstoneFile(card.version, from);
    } catch (e) {
      why = e.message;
    }
    const have = fs.existsSync(path.join(ROOT, to)) ? fs.readFileSync(path.join(ROOT, to)) : null;
    ok(`${to} is GlimStone's ${from} at ${card.version}`, want !== null && have !== null && have.equals(want.body),
      why || (have ? `${to} differs from GlimStone ${want.ref}; copy ${from} again` : `${to} is missing`));
  }
  done();
})();
