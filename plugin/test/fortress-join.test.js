// Joining the fortress from the settings page: one hidden field for the twelve words, no address
// and no relay. The phrase reaches the helper on its input once and is kept nowhere, the directory
// holds only the keys fortress join derives. Joined, the card lists the members as connected or not
// reachable and offers a way out. The server side runs against a stand-in helper, the card against
// a small stand-in for the page.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done, fortressCard } = require('./lib');

const en = JSON.parse(read('lang/en.json'));
const fill = (s, args) => args.reduce((m, a, i) => m.split('{' + i + '}').join(a), s);
const LIB = path.join(DIR, 'include', 'fs_fortress.php').replace(/\\/g, '/');
const WORDS = 'abandon ability able about above absent absorb abstract absurd abuse access accident';

// Runs code against the library with a helper that records each call and answers as told.
function php(code, answers) {
  const out = execFileSync('php', ['-r', `require '${LIB}';
    $answers = json_decode(stream_get_contents(STDIN), true); $calls = [];
    $run = function ($args, $stdin) use (&$answers, &$calls) { $calls[] = ['args' => $args, 'stdin' => $stdin]; return array_shift($answers) ?: [0, '', '']; };
    $r = (function () use ($run) { ${code} })();
    echo json_encode(['r' => $r, 'calls' => $calls]);`], { input: JSON.stringify(answers || []), encoding: 'utf8' });
  return JSON.parse(out);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-join-'));
const dir = path.join(tmp, 'fortress').replace(/\\/g, '/');
const ident = path.join(tmp, 'ident.cfg').replace(/\\/g, '/');
fs.writeFileSync(ident, 'NAME="Tower"\nCOMMENT="media server"\n');

console.log('\nJoining');
let x = php(`return fs_fortress_join('${dir}', "  ${WORDS.split(' ').join('  \\n ')} ", 'Tower', $run);`);
const call = x.calls[0] || { args: [] };
ok('the helper joins for FireSquire under the server\'s name', call.args.slice(0, 7).join(' ') === `join -dir ${dir} -app firesquire -name Tower`, call.args.join(' '));
ok('it may ask BombVault for the last flash backup', call.args.join(' ').includes('-uses backup.last'), call.args.join(' '));
const icon = call.args[call.args.indexOf('-icon') + 1] || '';
ok('it hands the helper FireSquire\'s logo for the other apps', icon === '/usr/local/emhttp/plugins/firesquire/images/firesquire.svg', call.args.join(' '));
const logo = fs.existsSync(path.join(DIR, 'images', 'firesquire.svg')) ? read('images/firesquire.svg') : '';
ok('the logo ships with the plugin, a plain SVG under 16 KiB', logo.startsWith('<svg xmlns="http://www.w3.org/2000/svg"') && Buffer.byteLength(logo) <= 16384 && !/<script|\son\w+=/i.test(logo), logo.slice(0, 80));
ok('no address and no relay go along', !call.args.some((a) => /^-relay/.test(a)), call.args.join(' '));
ok('the phrase goes in on one line, on the input alone', call.stdin === WORDS + '\n' && !call.args.some((a) => a.includes('abandon')), JSON.stringify(call.stdin));
ok('a join that worked says so', x.r.ok === true, JSON.stringify(x.r));
x = php(`return fs_fortress_join('${dir}', 'one two three', 'Tower', $run);`, [[1, '', 'fortress: phrase: the phrase has 3 words, it needs 12']]);
ok('words that are no phrase come back as phrase', x.r.error === 'phrase', JSON.stringify(x.r));
x = php(`return fs_fortress_join('${dir}', '${WORDS}', 'Tower', $run);`, [[1, '', 'fortress: mkdir /boot/config: read-only file system']]);
ok('any other failure names itself', x.r.error === 'mkdir /boot/config: read-only file system', JSON.stringify(x.r));
x = php(`return fs_fortress_join('${dir}', '', 'Tower', $run);`);
ok('an empty field calls no helper', x.r.error === 'phrase' && x.calls.length === 0, JSON.stringify(x));
fs.mkdirSync(dir);
fs.writeFileSync(path.join(dir, 'fortress.json'), '{}');
fs.writeFileSync(path.join(dir, 'state.json'), '{}');
x = php(`return fs_fortress_join('${dir}', '${WORDS}', 'Tower', $run);`);
ok('in a fortress already, it does not join again', x.r.error === 'member' && x.calls.length === 0, JSON.stringify(x));

console.log('\nThe server\'s name');
x = php(`return fs_fortress_device('${ident}');`);
ok('comes from Unraid\'s identity', x.r === 'Tower', JSON.stringify(x.r));
x = php(`return fs_fortress_device('${tmp.replace(/\\/g, '/')}/none.cfg');`);
ok('or from the host name', typeof x.r === 'string' && x.r.length > 0, JSON.stringify(x.r));

console.log('\nThe members');
const listed = JSON.stringify([
  { id: 'a', kind: 'instance', app: { id: 'bombvault', name: 'BombVault' }, device: 'Tower', online: true },
  { id: 'b', kind: 'instance', app: { id: 'shiplog', name: 'shiplog' }, device: 'Mithallia', online: false },
  { id: 'c', kind: 'mobile', app: { id: '', name: '' }, device: 'Phone', online: true },
  { id: 'd', kind: 'instance', app: { id: '', name: '', version: '' }, device: 'Bottich', online: false },
]);
x = php(`return fs_fortress_members('${dir}', $run);`, [[0, listed, '']]);
ok('the helper lists them as JSON and waits a moment for them', /^members -dir \S+ -json -wait \d+s$/.test((x.calls[0] || { args: [] }).args.join(' ')), JSON.stringify(x.calls));
ok('each app shows with its device and whether it is in reach', JSON.stringify(x.r.members) === JSON.stringify([
  { id: 'a', app: 'BombVault', device: 'Tower', online: true }, { id: 'b', app: 'ShipLog', device: 'Mithallia', online: false }]), JSON.stringify(x.r));
ok('a member that never said which app it runs is left out', !x.r.members.some((m) => m.device === 'Bottich'), JSON.stringify(x.r));
x = php(`return fs_fortress_members('${dir}', $run);`, [[1, '', 'fortress: dial tcp: no route to host']]);
ok('a helper that fails names why', x.r.error === 'dial tcp: no route to host', JSON.stringify(x.r));

console.log('\nLeaving');
x = php(`return fs_fortress_leave('${dir}');`);
ok('takes the membership and its state away', x.r.ok === true && !fs.existsSync(dir), JSON.stringify(x.r));
x = php(`return fs_fortress_leave('${dir}');`);
ok('outside a fortress there is nothing to leave', x.r.error === 'notMember', JSON.stringify(x.r));

console.log('\nThe endpoint');
const endpoint = read('include/FireSquireFortress.php');
ok('keeps the membership with the other state', /\/boot\/config\/plugins\/firesquire\/fortress/.test(endpoint));
ok('passes nothing unescaped to the shell', /escapeshellarg/.test(endpoint) && !/shell_exec|passthru|system\(/.test(endpoint));
const writes = (endpoint + read('include/fs_fortress.php')).match(/file_put_contents\(\$\w+|fwrite\(\$(?!pipes\[0\])|fopen\(/g) || [];
ok('writes no file of its own but the list of the removed', writes.join() === 'file_put_contents($part', writes.join(' | '));
ok('answers join and leave with the codes the card words', /'phrase'/.test(read('include/fs_fortress.php')) && /409/.test(endpoint));
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\nThe card');
const field = (p) => p.find((e) => e.tagName === 'INPUT');
const MEMBERS = { members: [{ app: 'BombVault', device: 'Tower', online: true }, { app: 'ShipLog', device: 'Mithallia', online: false }] };

(async () => {
  let p = fortressCard({ helper: true, joined: false, device: 'Tower' }, { join: () => ({ helper: true, joined: true, device: 'Tower' }), members: MEMBERS });
  await p.settle();
  const f = field(p);
  ok('outside a fortress there is one field for the phrase', p.box.all().filter((e) => e.tagName === 'INPUT').length === 1);
  ok('it hides what is typed and offers nothing to remember', f && f.type === 'password' && f.autocomplete === 'off' && f.spellcheck === false);
  ok('it names the twelve words', f.placeholder === en.f_join_ph && p.text().includes(en.f_join));
  ok('and asks for no address and no relay', !/relay|address/i.test(p.text()));
  const labels = p.box.all().filter((e) => e.tagName === 'BUTTON').map((e) => e.textContent);
  ok('no button joins or saves', labels.length === 0, labels.join(', '));
  f.value = 'abandon ability able'; f.fire('input'); p.wait(2000);
  await p.settle();
  ok('a few words send nothing', p.posts.length === 0);
  f.value = WORDS; f.fire('input');
  ok('twelve words wait for the typing to pause', p.posts.length === 0);
  p.wait(2000);
  await p.settle();
  ok('then join on their own', p.posts.length === 1 && p.posts[0].do === 'join' && p.posts[0].phrase === WORDS && p.posts[0].csrf_token === 'tok', JSON.stringify(p.posts));
  ok('URL-encoded, since the webGUI never answers a multipart post', p.bodies[0] instanceof URLSearchParams, String(p.bodies[0]));
  await p.settle();
  ok('the welcome follows', p.text().includes(en.f_joined), p.text());
  ok('the field is gone with the words in it', !field(p));
  ok('the card names the server in the fortress', p.text().includes(fill(en.f_in, ['Tower'])));
  ok('and lists each member with its state', p.text().includes(fill(en.f_member, ['BombVault', 'Tower'])) && p.text().includes(en.f_connected)
    && p.text().includes(fill(en.f_member, ['ShipLog', 'Mithallia'])) && p.text().includes(en.f_unreachable), p.text());

  p = fortressCard({ helper: true, joined: false, device: 'Tower' }, { join: () => ({ error: 'phrase' }) });
  await p.settle();
  field(p).value = 'abandon ability'; field(p).fire('keydown', { key: 'Enter' });
  await p.settle();
  ok('Enter joins at once', p.posts.length === 1);
  ok('words that are no phrase say so and stay to be fixed', p.text().includes(en.f_err_phrase) && field(p) && field(p).value === 'abandon ability' && !field(p).disabled, p.text());
  p = fortressCard({ helper: true, joined: false, device: 'Tower' }, { join: () => ({ error: 'member' }) });
  await p.settle();
  field(p).value = WORDS; field(p).fire('keydown', { key: 'Enter' });
  await p.settle();
  ok('a second join says FireSquire is in already', p.text().includes(en.f_err_member), p.text());
  p = fortressCard({ helper: true, joined: false, device: 'Tower' }, { join: () => 'down' });
  await p.settle();
  field(p).value = WORDS; field(p).fire('keydown', { key: 'Enter' });
  await p.settle();
  ok('a server out of reach is said so', p.text().includes(fill(en.n_failed, ['network'])), p.text());

  p = fortressCard({ helper: false, joined: false, device: 'Tower' }, {});
  await p.settle();
  ok('without the helper the card says so and offers no field', p.text().includes(en.f_nohelper) && !field(p));

  console.log('\nIn a fortress');
  p = fortressCard({ helper: true, joined: true, device: 'Tower' }, { members: { members: [] }, leave: () => ({ helper: true, joined: false, device: 'Tower' }) });
  await p.settle();
  ok('the members are asked for once', p.gets.filter((u) => /do=members/.test(u)).length === 1, JSON.stringify(p.gets));
  ok('a fortress with nobody else says so', p.text().includes(en.f_none), p.text());
  const leave = p.find((e) => e.tagName === 'BUTTON' && e.textContent === en.f_leave);
  ok('the way out wears GlimStone\'s sign-out glyph', leave && leave.glyph === 'SignOut');
  leave.fire('click');
  ok('leaving asks first', p.windows.length === 1 && p.posts.length === 0 && p.windows[0].o.title === en.f_leave_title);
  const w = p.windows[0];
  ok('and says what ends', w.body.textContent.includes(en.f_leave_body));
  const go = w.act.all().find((e) => e.tagName === 'BUTTON' && e.textContent === en.f_leave);
  ok('the window has Leave and Cancel', !!go && go.glyph === 'SignOut' && w.act.all().some((e) => e.textContent === en.g_cancel));
  go.fire('click');
  await p.settle();
  ok('Leave closes the window and goes out', w.closed && p.posts.length === 1 && p.posts[0].do === 'leave');
  ok('and the field for the phrase is back', !!field(p) && p.text().includes(en.f_left), p.text());

  p = fortressCard({ helper: true, joined: true, device: 'Tower' }, { members: 'down' });
  await p.settle();
  ok('members out of reach of the page are said so', p.text().includes(fill(en.n_failed, ['network'])), p.text());

  console.log('\nThe strings and glyphs');
  const src = read('firesquire-fortress.js');
  const asked = [...src.matchAll(/\bt\("([\w-]+)"\)/g)].map((m) => m[1]);
  const unknown = [...new Set(asked)].filter((k) => !(k in en));
  ok('every text it asks for is in en.json', asked.length > 10 && unknown.length === 0, unknown.join(', '));
  ok('the settings page loads it', /firesquire-fortress\.js/.test(read('FireSquireTools.page')));
  ok('the card stands before the notifications', /"fs-fortress"[\s\S]*"fs-notify"/.test(read('firesquire-info.js')));

  done();
})();
