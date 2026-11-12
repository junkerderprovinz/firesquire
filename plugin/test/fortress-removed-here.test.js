// Taken out by another app. The fortress helper forgets the membership when it hears so and leaves
// removed-here in FireSquire's fortress directory on the flash, so the settings page still says it
// after a restart, until FireSquire joins again.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done, fortressAdapter } = require('./lib');

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
const kept = path.join(tmp, 'fortress-removed.json').replace(/\\/g, '/');
fs.mkdirSync(dir);

console.log('\nOn the flash');
ok('a fortress that never knew FireSquire says nothing', php(`return fs_fortress_removed_here('${dir}');`) === false);
fs.writeFileSync(path.join(dir, 'removed-here'), '');
ok('the helper\'s word says FireSquire was taken out', php(`return fs_fortress_removed_here('${dir}');`) === true);
let s = php(`return fs_fortress_state('${dir}', '${kept}', 'Tower', $run);`);
ok('after a restart the state still says so', s.joined === false && s.removedHere === true, JSON.stringify(s));
fs.writeFileSync(path.join(dir, 'fortress.json'), '{}');
ok('a membership that is back wins over the old word', php(`return fs_fortress_removed_here('${dir}');`) === false);
fs.rmSync(path.join(dir, 'removed-here'));

// The helper finds out while it lists the members, forgets the membership and leaves its word.
s = php(`$taken = function ($args, $stdin) {
    unlink('${dir}/fortress.json');
    touch('${dir}/removed-here');
    return [1, '', 'fortress: this member was taken out of the fortress; join again with the current phrase'];
  };
  return fs_fortress_state('${dir}', '${kept}', 'Tower', $taken);`);
ok('when the helper finds out on the way, the same answer says so', s.joined === false && s.removedHere === true && s.members.length === 0, JSON.stringify(s));
fs.rmSync(tmp, { recursive: true, force: true });

(async () => {
  console.log('\nThe card');
  const OUT = { helper: true, joined: false, device: 'Tower', removedHere: true, members: [], removed: [] };
  const p = fortressAdapter(OUT, {});
  const state = await p.adapter.load();
  ok('gets the word with the state, so it says FireSquire was taken out and offers the phrase', state.removedHere === true && state.joined === false, JSON.stringify(state));
  ok('the endpoint reads it into every state', /fs_fortress_state\(/.test(read('include/FireSquireFortress.php')));
  done();
})();
