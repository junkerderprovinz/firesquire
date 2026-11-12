// Joining the fortress from the settings page with GlimStone's fortress card. The phrase reaches
// the helper on its input once and is kept nowhere, the directory holds only the keys fortress join
// derives. The state FireSquire answers carries every other app of the fortress the way the card
// draws it. The server side runs against a stand-in helper, the adapter against a stand-in page.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done, fortressAdapter } = require('./lib');

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
  { id: 'a', kind: 'instance', app: { id: 'bombvault', name: 'BombVault', version: '3.8.0', icon: 'data:image/svg+xml;base64,PHN2Zy8+' }, device: 'Tower', deployment: 'container', online: true, direct: true },
  { id: 'b', kind: 'instance', app: { id: 'shiplog', name: 'shiplog', version: '2.4.0' }, device: 'Mithallia', deployment: 'plugin', online: false, direct: false, lastSeen: '2026-11-12T21:40:00Z' },
  { id: 'c', kind: 'mobile', app: { id: '', name: '' }, device: 'Phone', online: true },
  { id: 'd', kind: 'instance', app: { id: '', name: '', version: '' }, device: 'Bottich', online: false },
  { id: 'e', kind: 'instance', app: { id: 'knightloader', name: 'KnightLoader', version: '1.2.0' }, device: 'Laptop', deployment: 'desktop', online: true, direct: false },
]);
x = php(`return fs_fortress_members('${dir}', $run);`, [[0, listed, '']]);
ok('the helper lists them as JSON and waits a moment for them', /^members -dir \S+ -json -wait \d+s$/.test((x.calls[0] || { args: [] }).args.join(' ')), JSON.stringify(x.calls));
ok('each app shows the way the card draws it', JSON.stringify(x.r.members) === JSON.stringify([
  { id: 'a', app: 'bombvault', name: 'BombVault', device: 'Tower', form: 'container', version: '3.8.0', icon: 'data:image/svg+xml;base64,PHN2Zy8+', online: true, relay: false, lastSeen: '' },
  { id: 'b', app: 'shiplog', name: 'ShipLog', device: 'Mithallia', form: 'plugin', version: '2.4.0', icon: '', online: false, relay: false, lastSeen: '2026-11-12T21:40:00Z' },
  { id: 'e', app: 'knightloader', name: 'KnightLoader', device: 'Laptop', form: 'desktop', version: '1.2.0', icon: '', online: true, relay: true, lastSeen: '' },
]), JSON.stringify(x.r));
ok('a member that never said which app it runs is left out', !x.r.members.some((m) => m.device === 'Bottich'), JSON.stringify(x.r));
x = php(`return fs_fortress_members('${dir}', $run);`, [[1, '', 'fortress: dial tcp: no route to host']]);
ok('a helper that fails names why', x.r.error === 'dial tcp: no route to host', JSON.stringify(x.r));

console.log('\nThe state');
const kept = path.join(tmp, 'fortress-removed.json').replace(/\\/g, '/');
x = php(`return fs_fortress_state('${dir}', '${kept}', 'Tower', $run);`, [[0, listed, '']]);
ok('in a fortress it carries the server, the members and who is out, in one answer', x.r.joined === true && x.r.device === 'Tower' && x.r.removedHere === false
  && x.r.members.length === 3 && Array.isArray(x.r.removed) && x.calls.length === 1, JSON.stringify(x.r));
ok('and leaves out the apps that keep the phrase, which the card works out from the form', !('keepers' in x.r), JSON.stringify(x.r));
x = php(`return fs_fortress_state('${dir}', '${kept}', 'Tower', $run);`, [[1, '', 'fortress: dial tcp: no route to host']]);
ok('members out of reach leave the rest of the state standing', x.r.joined === true && x.r.members.length === 0, JSON.stringify(x.r));

console.log('\nLeaving');
x = php(`return fs_fortress_leave('${dir}');`);
ok('takes the membership and its state away', x.r.ok === true && !fs.existsSync(dir), JSON.stringify(x.r));
x = php(`return fs_fortress_leave('${dir}');`);
ok('outside a fortress there is nothing to leave', x.r.error === 'notMember', JSON.stringify(x.r));
x = php(`return fs_fortress_state('${dir}', '${kept}', 'Tower', $run);`);
ok('and the state asks the helper for nobody', x.r.joined === false && x.r.members.length === 0 && x.calls.length === 0, JSON.stringify(x));

console.log('\nThe endpoint');
const endpoint = read('include/FireSquireFortress.php');
ok('keeps the membership with the other state', /\/boot\/config\/plugins\/firesquire\/fortress/.test(endpoint));
ok('passes nothing unescaped to the shell', /escapeshellarg/.test(endpoint) && !/shell_exec|passthru|system\(/.test(endpoint));
const writes = (endpoint + read('include/fs_fortress.php')).match(/file_put_contents\(\$\w+|fwrite\(\$(?!pipes\[0\])|fopen\(/g) || [];
ok('writes no file of its own but the list of the removed', writes.join() === 'file_put_contents($part', writes.join(' | '));
ok('answers join and leave with the codes the card words', /'phrase'/.test(read('include/fs_fortress.php')) && /409/.test(endpoint));
ok('answers every step with the whole state', (endpoint.match(/fs_answer\(200, fs_state\(/g) || []).length === 4, (endpoint.match(/fs_answer\(200[^;]*/g) || []).join(' | '));
fs.rmSync(tmp, { recursive: true, force: true });

console.log('\nThe card');
const ENDPOINT = '/plugins/firesquire/include/FireSquireFortress.php';
const OUT = { helper: true, joined: false, device: 'Tower', removedHere: false, members: [], removed: [] };
const IN = { ...OUT, joined: true, members: [{ id: 'a', app: 'bombvault', name: 'BombVault', device: 'Tower', form: 'container', online: true }] };
const refused = (promise) => promise.then(() => null, (e) => e);

(async () => {
  let p = fortressAdapter(OUT, { join: () => IN });
  ok('GlimStone\'s card goes into the fortress place on the page', p.mounts.length === 1 && p.mounts[0].el === p.box);
  ok('as FireSquire, in the language of the page', p.opts.lang === 'de' && p.opts.app.id === 'firesquire' && p.opts.app.name === 'FireSquire', JSON.stringify(p.opts));
  ok('with no rows of FireSquire\'s own', !p.opts.rows || p.opts.rows.length === 0, JSON.stringify(p.opts.rows));
  let s = await p.adapter.load();
  ok('the state comes from FireSquire\'s endpoint as it is', p.gets.join() === ENDPOINT && JSON.stringify(s) === JSON.stringify(OUT), p.gets.join() + ' ' + JSON.stringify(s));
  s = await p.adapter.join(WORDS.split(' '));
  ok('the twelve words go out as the phrase, with the token', p.posts.length === 1 && p.posts[0].do === 'join' && p.posts[0].phrase === WORDS && p.posts[0].csrf_token === 'tok', JSON.stringify(p.posts));
  ok('URL-encoded, since the webGUI never answers a multipart post', p.bodies[0] instanceof URLSearchParams, String(p.bodies[0]));
  ok('and the card gets the state inside', s.joined === true && s.members.length === 1, JSON.stringify(s));

  p = fortressAdapter(OUT, { join: () => ({ error: 'phrase' }) });
  let e = await refused(p.adapter.join(WORDS.split(' ')));
  ok('words that open no fortress are refused as phrase', e && e.code === 'phrase', JSON.stringify(e));
  p = fortressAdapter(OUT, { join: () => ({ error: 'member' }) });
  e = await refused(p.adapter.join(WORDS.split(' ')));
  ok('a second join is refused as member, so the card reloads', e && e.code === 'member', JSON.stringify(e));
  p = fortressAdapter(OUT, { join: () => ({ error: 'mkdir /boot/config: read-only file system' }) });
  e = await refused(p.adapter.join(WORDS.split(' ')));
  ok('any other failure is refused too', e && e.code === 'mkdir /boot/config: read-only file system', JSON.stringify(e));
  p = fortressAdapter(OUT, { join: () => 'down' });
  ok('a server out of reach is refused', (await refused(p.adapter.join(WORDS.split(' ')))) !== null);
  p = fortressAdapter('html', {});
  ok('so is a page that is no answer, such as the login after a restart', (await refused(p.adapter.load())) !== null);

  p = fortressAdapter({ helper: false }, {});
  ok('without the helper the card stays hidden', (await p.adapter.load()) === null);

  console.log('\nLeaving');
  p = fortressAdapter(IN, { leave: () => OUT });
  s = await p.adapter.leave();
  ok('Leave goes out with the token', p.posts.length === 1 && p.posts[0].do === 'leave' && p.posts[0].csrf_token === 'tok', JSON.stringify(p.posts));
  ok('and the card gets the state outside', s.joined === false, JSON.stringify(s));
  p = fortressAdapter(OUT, { leave: () => ({ error: 'notMember' }) });
  e = await refused(p.adapter.leave());
  ok('outside a fortress already, leaving is refused as notMember, which the card closes quietly', e && e.code === 'notMember', JSON.stringify(e));

  console.log('\nThe page');
  ok('the settings page loads the card and the adapter', /fortress-card\.js/.test(read('FireSquireTools.page')) && /firesquire-fortress\.js/.test(read('FireSquireTools.page')));
  ok('the card stands before the notifications', /"fs-fortress"[\s\S]*"fs-notify"/.test(read('firesquire-info.js')));
  ok('no texts of the old card are left', !Object.keys(JSON.parse(read('lang/en.json'))).some((k) => /^f_/.test(k)));

  done();
})();
