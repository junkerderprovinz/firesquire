// The fortress took a new phrase that FireSquire could not follow, since FireSquire keeps no phrase
// and no app that took the new one was in reach to hand over its keys. The helper then keeps that
// app in the book under FireSquire's group as moved, so the card asks for the new phrase, and
// joining with it keeps FireSquire the member the others know.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, ok, done } = require('./lib');

const LIB = path.join(DIR, 'include', 'fs_fortress.php').replace(/\\/g, '/');
const WORDS = 'abandon ability able about above absent absorb abstract absurd abuse access accident';

function php(code, answers) {
  const out = execFileSync('php', ['-r', `require '${LIB}';
    $answers = json_decode(stream_get_contents(STDIN), true); $calls = [];
    $run = function ($args, $stdin) use (&$answers, &$calls) { $calls[] = ['args' => $args, 'stdin' => $stdin]; return array_shift($answers) ?: [0, '', '']; };
    $r = (function () use ($run) { ${code} })();
    echo json_encode(['r' => $r, 'calls' => $calls]);`], { input: JSON.stringify(answers || []), encoding: 'utf8' });
  return JSON.parse(out);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-phrase-'));
const dir = path.join(tmp, 'fortress').replace(/\\/g, '/');
const kept = path.join(tmp, 'fortress-removed.json').replace(/\\/g, '/');
fs.mkdirSync(dir);
const joined = (group) => fs.writeFileSync(path.join(dir, 'fortress.json'), JSON.stringify({ app: 'firesquire', group }));
const book = (group, members) => fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ group: {}, fortress: { group, members } }));
const BOMBVAULT = { app: { id: 'bombvault', name: 'BombVault', version: '3.8.0' } };
const changed = () => php(`return fs_fortress_phrase_changed('${dir}');`).r;

console.log('\nThe new phrase');
ok('outside a fortress there is nothing to follow', changed() === false);
joined('g1');
ok('a fortress without a book yet says nothing', changed() === false);
book('g1', { a: BOMBVAULT });
ok('nor does a book where every app is on FireSquire\'s phrase', changed() === false);
book('g1', { a: { ...BOMBVAULT, moved: true, changed: '2026-11-12T20:00:00Z' } });
ok('an app that took a new phrase means FireSquire lacks it', changed() === true);
book('g0', { a: { ...BOMBVAULT, moved: true } });
ok('a book left from the phrase before says nothing', changed() === false);
book('g1', { a: { ...BOMBVAULT, moved: true } });
let x = php(`return fs_fortress_state('${dir}', '${kept}', 'Tower', $run);`, [[0, '[]', '']]);
ok('the state carries it', x.r.joined === true && x.r.phraseChanged === true, JSON.stringify(x.r));
x = php(`$follow = function ($args, $stdin) {
    file_put_contents('${dir}/fortress.json', json_encode(['app' => 'firesquire', 'group' => 'g2']));
    return [0, '[]', ''];
  };
  return fs_fortress_state('${dir}', '${kept}', 'Tower', $follow);`);
ok('and lets it go once the helper followed on the way', x.r.phraseChanged === false, JSON.stringify(x.r));
x = php(`return fs_fortress_state('${dir}', '${kept}', 'Tower', $run);`, [[0, '[]', '']]);
ok('outside the new phrase\'s book the state is plain again', x.r.phraseChanged === false, JSON.stringify(x.r));

console.log('\nJoining with it');
joined('g1');
x = php(`return fs_fortress_join('${dir}', '${WORDS}', 'Tower', $run);`);
ok('goes to the helper while FireSquire lacks the new phrase', x.r.ok === true && (x.calls[0] || { args: [] }).args[0] === 'join' && x.calls[0].stdin === WORDS + '\n', JSON.stringify(x));
book('g1', { a: BOMBVAULT });
x = php(`return fs_fortress_join('${dir}', '${WORDS}', 'Tower', $run);`);
ok('and stays refused as member otherwise', x.r.error === 'member' && x.calls.length === 0, JSON.stringify(x));
fs.rmSync(tmp, { recursive: true, force: true });

done();
