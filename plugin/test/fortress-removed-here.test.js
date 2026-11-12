// Taken out by another app. The fortress helper forgets the membership when it hears so and leaves
// removed-here in FireSquire's fortress directory on the flash, so the settings page still says it
// after a restart, until FireSquire joins again.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done, fortressCard } = require('./lib');

const en = JSON.parse(read('lang/en.json'));
const LIB = path.join(DIR, 'include', 'fs_fortress.php').replace(/\\/g, '/');

function php(code, answers) {
  const out = execFileSync('php', ['-r', `require '${LIB}';
    $answers = json_decode(stream_get_contents(STDIN), true);
    $run = function ($args, $stdin) use (&$answers) { return array_shift($answers) ?: [0, '', '']; };
    $r = (function () use ($run) { ${code} })();
    echo json_encode(['r' => $r]);`], { input: JSON.stringify(answers || []), encoding: 'utf8' });
  return JSON.parse(out).r;
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-removed-here-'));
const dir = path.join(tmp, 'fortress').replace(/\\/g, '/');
fs.mkdirSync(dir);

console.log('\nOn the flash');
ok('a fortress that never knew FireSquire says nothing', php(`return fs_fortress_removed_here('${dir}');`) === false);
fs.writeFileSync(path.join(dir, 'removed-here'), '');
ok('the helper\'s word says FireSquire was taken out', php(`return fs_fortress_removed_here('${dir}');`) === true);
fs.writeFileSync(path.join(dir, 'fortress.json'), '{}');
ok('a membership that is back wins over the old word', php(`return fs_fortress_removed_here('${dir}');`) === false);
fs.rmSync(path.join(dir, 'fortress.json'));
const helperSays = [1, '', 'fortress: this member was taken out of the fortress; join again with the current phrase'];
ok('the members list says so when the helper finds out', php(`return fs_fortress_members('${dir}', $run);`, [helperSays]).error === 'removedHere');
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\nThe endpoint');
const endpoint = read('include/FireSquireFortress.php');
ok('the state carries it', /'removedHere' => fs_fortress_removed_here\(\$dir\)/.test(endpoint), endpoint.match(/function fs_state[\s\S]{0,300}/)?.[0]);
ok('and the members answer with the state once it happened', /removedHere[\s\S]{0,120}410/.test(endpoint));

(async () => {
  console.log('\nThe card');
  const OUT = { helper: true, joined: false, device: 'Tower', removed: [], removedHere: true };
  let p = fortressCard(OUT, {});
  await p.settle();
  ok('after a restart the card still says FireSquire was taken out', p.text().includes(en.f_removed_here), p.text());
  ok('and offers to join again', p.box.all().some((e) => e.tagName === 'INPUT'));

  p = fortressCard({ ...OUT, removedHere: false }, {});
  await p.settle();
  ok('a card that was never taken out says nothing of it', !p.text().includes(en.f_removed_here), p.text());

  p = fortressCard({ helper: true, joined: true, device: 'Tower', removed: [] }, { members: OUT });
  await p.settle();
  ok('when the members list finds out, the card turns to the hint', p.text().includes(en.f_removed_here), p.text());

  ok('f_removed_here is in en.json', typeof en.f_removed_here === 'string');
  done();
})();
