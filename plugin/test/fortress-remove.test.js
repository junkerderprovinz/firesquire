// Taking another app out of the fortress from the settings page. The helper removes it there and at
// every member in reach, and FireSquire keeps the names on the flash until the phrase changes,
// since the old phrase still lets a removed app back in. FireSquire keeps no phrase, so Change
// phrase leads to an app of the fortress that keeps one.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done, fortressCard } = require('./lib');

const en = JSON.parse(read('lang/en.json'));
const fill = (s, args) => args.reduce((m, a, i) => m.split('{' + i + '}').join(a), s);
const LIB = path.join(DIR, 'include', 'fs_fortress.php').replace(/\\/g, '/');
const BRAVO = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';

function php(code, answers) {
  const out = execFileSync('php', ['-r', `require '${LIB}';
    $answers = json_decode(stream_get_contents(STDIN), true); $calls = [];
    $run = function ($args, $stdin) use (&$answers, &$calls) { $calls[] = ['args' => $args, 'stdin' => $stdin]; return array_shift($answers) ?: [0, '', '']; };
    $r = (function () use ($run) { ${code} })();
    echo json_encode(['r' => $r, 'calls' => $calls]);`], { input: JSON.stringify(answers || []), encoding: 'utf8' });
  return JSON.parse(out);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-remove-'));
const dir = path.join(tmp, 'fortress').replace(/\\/g, '/');
const kept = path.join(tmp, 'fortress-removed.json').replace(/\\/g, '/');
const joinedUnder = (group) => fs.writeFileSync(path.join(dir, 'fortress.json'), JSON.stringify({ app: 'firesquire', group }));
const gone = (id, app, name, device) => [0, JSON.stringify({ id, kind: 'instance', app: { id: app, name }, device, online: true }), ''];

console.log('\nRemoving');
let x = php(`return fs_fortress_remove('${dir}', '${kept}', '${BRAVO}', $run);`);
ok('outside a fortress there is nobody to remove', x.r.error === 'notMember' && x.calls.length === 0, JSON.stringify(x));
fs.mkdirSync(dir);
joinedUnder('g1');
x = php(`return fs_fortress_remove('${dir}', '${kept}', '-wait', $run);`);
ok('an id that reads like a flag reaches no helper', x.r.error === 'invalid' && x.calls.length === 0, JSON.stringify(x));
x = php(`return fs_fortress_remove('${dir}', '${kept}', '${BRAVO}', $run);`, [gone(BRAVO, 'tollroll', 'tollroll', 'Bottich')]);
ok('the helper takes the member out by its id', (x.calls[0] || { args: [] }).args.join(' ') === `remove -dir ${dir} -wait 4s ${BRAVO}`, JSON.stringify(x.calls));
ok('and FireSquire names it the way the house writes it', x.r.ok === true && JSON.stringify(x.r.removed) === JSON.stringify([{ app: 'TollRoll', device: 'Bottich' }]), JSON.stringify(x.r));
x = php(`return fs_fortress_remove('${dir}', '${kept}', 'ffff0000', $run);`, [[1, '', 'fortress: no member ffff0000 is in reach']]);
ok('a member the fortress does not know is a clear error', x.r.error === 'noMember', JSON.stringify(x.r));
x = php(`return fs_fortress_remove('${dir}', '${kept}', 'c0ffee', $run);`, [[1, '', 'fortress: dial tcp: no route to host']]);
ok('any other failure names itself', x.r.error === 'dial tcp: no route to host', JSON.stringify(x.r));

console.log('\nThe list of the removed');
ok('stays on the flash, readable by its owner alone', fs.existsSync(kept) && (process.platform === 'win32' || (fs.statSync(kept).mode & 0o777) === 0o600));
ok('holds the names, not the phrase or a key', !/abandon|seed|frame|peerAuth/i.test(fs.readFileSync(kept, 'utf8')), fs.readFileSync(kept, 'utf8'));
x = php(`return fs_fortress_removed('${dir}', '${kept}');`);
ok('a new run reads it back, so a restart keeps it', JSON.stringify(x.r) === JSON.stringify([{ id: BRAVO, app: 'TollRoll', device: 'Bottich' }]), JSON.stringify(x.r));
x = php(`return fs_fortress_remove('${dir}', '${kept}', 'beef01', $run);`, [gone('beef01', 'bombvault', 'BombVault', 'Tower')]);
ok('a second removal joins the first', x.r.removed.map((m) => m.app).join(',') === 'TollRoll,BombVault', JSON.stringify(x.r));
x = php(`return fs_fortress_remove('${dir}', '${kept}', '${BRAVO}', $run);`, [gone(BRAVO, 'tollroll', 'TollRoll', 'Bottich')]);
ok('the same member twice stays once', x.r.removed.length === 2, JSON.stringify(x.r));
joinedUnder('g2');
x = php(`return fs_fortress_removed('${dir}', '${kept}');`);
ok('a new phrase, followed or joined with, clears it', Array.isArray(x.r) && x.r.length === 0, JSON.stringify(x.r));
ok('and takes the file away', !fs.existsSync(kept));

console.log('\nThe members');
const listed = JSON.stringify([
  { id: 'a', kind: 'instance', app: { id: 'bombvault', name: 'BombVault' }, device: 'Tower', deployment: 'container', address: 'http://192.168.1.5:7877', online: true },
  { id: 'b', kind: 'instance', app: { id: 'shiplog', name: 'shiplog' }, device: 'Tower', deployment: 'plugin', address: 'http://192.168.1.5', online: true },
  { id: 'c', kind: 'instance', app: { id: 'knightloader', name: 'KnightLoader' }, device: 'Atlas', deployment: 'container', address: 'javascript:alert(1)', online: true },
]);
x = php(`return fs_fortress_members('${dir}', $run);`, [[0, listed, '']]);
ok('each carries its id for Remove', x.r.members.map((m) => m.id).join(',') === 'a,b,c', JSON.stringify(x.r));
ok('the phrase is changed at an app that keeps it, in reach and with a web address', JSON.stringify(x.r.phraseAt) === JSON.stringify({ app: 'BombVault', device: 'Tower', address: 'http://192.168.1.5:7877' }), JSON.stringify(x.r.phraseAt));
x = php(`return fs_fortress_members('${dir}', $run);`, [[0, JSON.stringify(JSON.parse(listed).slice(1)), '']]);
ok('a plugin keeps no phrase, and an address that is no web address is never offered', x.r.phraseAt === null, JSON.stringify(x.r.phraseAt));

console.log('\nThe endpoint');
const endpoint = read('include/FireSquireFortress.php');
ok('removes on a post, as join and leave do', /case 'remove':[\s\S]*fs_fortress_remove\(\$fsDir, \$fsRemoved, \(string\) \(\$_POST\['id'\] \?\? ''\), \$fsRun\)/.test(endpoint), endpoint.match(/case 'remove':[\s\S]{0,300}/)?.[0]);
ok('keeps the list on the flash next to the membership', /\$fsRemoved = '\/boot\/config\/plugins\/firesquire\/fortress-removed\.json'/.test(endpoint));
ok('answers an unknown member with 404', /'noMember' => 404/.test(endpoint));
ok('and says who is out with the state', /'removed' =>/.test(endpoint));
fs.rmSync(tmp, { recursive: true, force: true });

const IN = { helper: true, joined: true, device: 'Tower', removed: [] };
const MEMBERS = {
  members: [{ id: 'a', app: 'BombVault', device: 'Tower', online: true }, { id: BRAVO, app: 'TollRoll', device: 'Bottich', online: true }],
  phraseAt: { app: 'BombVault', device: 'Tower', address: 'http://192.168.1.5:7877' },
};
const buttons = (root, label) => root.all().filter((e) => e.tagName === 'BUTTON' && e.textContent === label);

(async () => {
  console.log('\nThe card');
  let p = fortressCard(IN, { members: MEMBERS, remove: () => ({ ...IN, removed: [{ app: 'TollRoll', device: 'Bottich' }] }) });
  await p.settle();
  const removes = buttons(p.box, en.f_remove);
  ok('every other app has Remove', removes.length === 2, p.text());
  ok('it wears the trash glyph and is not painted red', removes.every((b) => b.glyph === 'Trash' && !/danger|red|warn/.test(b.className)), removes.map((b) => b.className).join(' '));
  ok('FireSquire itself has none, since it leaves instead', !p.text().includes(fill(en.f_member, ['FireSquire', 'Tower'])) && buttons(p.box, en.f_leave).length === 1);
  removes[1].fire('click');
  const w = p.windows[0];
  const name = fill(en.f_member, ['TollRoll', 'Bottich']);
  ok('Remove asks first and sends nothing yet', p.windows.length === 1 && p.posts.length === 0);
  ok('the window names app and device', w && w.title.textContent === fill(en.f_remove_title, [name]), w && w.title.textContent);
  ok('and says the access ends for good', w.body.textContent.includes(fill(en.f_remove_body, [name])) && w.body.textContent.includes(en.f_remove_back), w.body.textContent);
  const go = buttons(w.act, en.f_remove)[0];
  ok('Remove and Cancel, the focus on Remove', !!go && buttons(w.act, en.g_cancel).length === 1 && p.focused() === go);
  go.fire('click');
  await p.settle();
  ok('Remove sends the member\'s id with the token', p.posts.length === 1 && p.posts[0].do === 'remove' && p.posts[0].id === BRAVO && p.posts[0].csrf_token === 'tok', JSON.stringify(p.posts));
  ok('URL-encoded, as every post of the page', p.bodies[0] instanceof URLSearchParams);
  ok('the same window then asks to change the phrase', !w.closed && w.title.textContent === en.f_removed_title && w.body.textContent.includes(fill(en.f_removed_body, [name])), w.title.textContent + ' | ' + w.body.textContent);
  ok('and says where, since FireSquire keeps no phrase', w.body.textContent.includes(fill(en.f_change_where, [fill(en.f_member, ['BombVault', 'Tower'])])), w.body.textContent);
  const change = buttons(w.act, en.f_change)[0];
  ok('Change phrase and Later, the focus on Change phrase', !!change && buttons(w.act, en.f_later).length === 1 && buttons(w.act, en.g_cancel).length === 0 && p.focused() === change);
  ok('the reminder names who is out', p.text().includes(fill(en.f_removed_note, ['TollRoll on Bottich'])), p.text());
  change.fire('click');
  ok('Change phrase opens the app that keeps the phrase in a tab of its own', p.opened.length === 1 && p.opened[0].url === 'http://192.168.1.5:7877' && p.opened[0].target === '_blank' && /noopener/.test(p.opened[0].features), JSON.stringify(p.opened));
  ok('and closes the window', w.closed);

  p = fortressCard({ ...IN, removed: [{ app: 'TollRoll', device: 'Bottich' }, { app: 'ShipLog', device: 'Tower' }] }, { members: MEMBERS });
  await p.settle();
  ok('after a restart the reminder is still there', p.text().includes(fill(en.f_removed_note, ['TollRoll on Bottich, ShipLog on Tower'])), p.text());
  const remind = buttons(p.box, en.f_change)[0];
  ok('with its own Change phrase', !!remind && remind.glyph === 'Key');
  remind.fire('click');
  ok('which opens the same app', p.opened.length === 1 && p.opened[0].url === 'http://192.168.1.5:7877', JSON.stringify(p.opened));

  p = fortressCard({ ...IN, removed: [{ app: 'TollRoll', device: 'Bottich' }] }, { members: { members: [], phraseAt: null } });
  await p.settle();
  ok('with no app in reach that keeps the phrase, the line says where to change it', p.text().includes(en.f_change_none) && buttons(p.box, en.f_change).length === 0, p.text());

  p = fortressCard(IN, { members: MEMBERS, remove: () => ({ error: 'noMember' }) });
  await p.settle();
  buttons(p.box, en.f_remove)[0].fire('click');
  buttons(p.windows[0].act, en.f_remove)[0].fire('click');
  await p.settle();
  ok('a member that is gone already says so in the window', p.windows[0].body.textContent.includes(en.f_err_no_member) && p.windows[0].title.textContent !== en.f_removed_title, p.windows[0].body.textContent);

  p = fortressCard(IN, { members: { ...MEMBERS, phraseAt: null }, remove: () => ({ ...IN, removed: [{ app: 'TollRoll', device: 'Bottich' }] }) });
  await p.settle();
  buttons(p.box, en.f_remove)[1].fire('click');
  buttons(p.windows[0].act, en.f_remove)[0].fire('click');
  await p.settle();
  ok('without an app to change it at, the window says where and offers Later alone', p.windows[0].body.textContent.includes(en.f_change_none)
    && buttons(p.windows[0].act, en.f_change).length === 0 && buttons(p.windows[0].act, en.f_later).length === 1, p.windows[0].body.textContent);

  console.log('\nThe strings and glyphs');
  for (const k of ['f_remove', 'f_remove_title', 'f_remove_body', 'f_remove_back', 'f_removed_title', 'f_removed_body', 'f_later', 'f_removed_note', 'f_change', 'f_change_where', 'f_change_none', 'f_err_no_member']) {
    ok(`${k} is in en.json`, typeof en[k] === 'string', en[k]);
  }
  ok('Trash and Key are in the table', /^\s+Trash: \["/m.test(read('firesquire-glyphs.js')) && /^\s+Key: \["/m.test(read('firesquire-glyphs.js')));

  done();
})();
