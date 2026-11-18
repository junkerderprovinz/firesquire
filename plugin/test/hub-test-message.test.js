// A test message from the Notifications card goes through TollRoll's hub too while the last check
// found one, so the test shows the way a real message takes. It carries a key of its own every
// time, since the hub tells a key only once, and the card says when TollRoll took it.
const path = require('path');
const { execFileSync } = require('child_process');
const { read, ok, done, DIR } = require('./lib');

const LIB = path.join(DIR, 'include', 'fs_notify.php').replace(/\\/g, '/');
const en = JSON.parse(read('lang/en.json'));
const de = JSON.parse(read('lang/de.json'));

// fs_hub_test with a stand-in for the fortress helper that answers per member.
function hubTest(hubs, answers, lang = 'en') {
  const code = `require '${LIB}';
$calls = array();
$run = function ($args) use (&$calls) { $calls[] = $args; $a = json_decode('${JSON.stringify(answers).replace(/'/g, "\'")}', true); $id = $args[5] ?? ''; return array_key_exists($id, $a) ? $a[$id] : array(1, '', 'gone'); };
$took = fs_hub_test(${JSON.stringify(hubs)}, '/tmp/fortress', '${lang}', $run);
echo json_encode(array('took' => $took, 'calls' => $calls));`;
  return JSON.parse(execFileSync('php', ['-r', code], { encoding: 'utf8' }));
}

console.log('\nThrough the hub');
let r = hubTest(['t1'], { t1: [0, '{"taken":true}', ''] });
ok('a hub that takes the test counts', r.took === true && r.calls.length === 1, JSON.stringify(r));
const a = r.calls[0];
ok('it goes through notify.deliver of that TollRoll', a.slice(0, 7).join(' ') === 'act -dir /tmp/fortress -wait 8s t1 notify.deliver', a.join(' '));
const body = JSON.parse(a[7]);
ok('with the test\'s title for the hub, its text and a key of its own', body.title === en.n_hub_test_title && body.body === en.n_test_body && /^firesquire\.test\.\d+$/.test(body.key) && body.severity === 'info', a[7]);
ok('in Unraid\'s language', JSON.parse(hubTest(['t1'], { t1: [0, '{"taken":true}', ''] }, 'de').calls[0][7]).title === de.n_hub_test_title);
r = hubTest(['t1', 't2'], { t1: [0, '{"error":"hub_off"}', ''], t2: [0, '{"taken":true}', ''] });
ok('a hub that is off is skipped for the next', r.took === true && r.calls.length === 2);
r = hubTest(['t1'], { t1: [0, '{"error":"hub_off"}', ''] });
ok('no hub that takes it is no hub', r.took === false);
ok('without a hub nothing is asked', hubTest([], {}).calls.length === 0);

ok('it links to FireSquire\'s settings by the page\'s path', JSON.parse(hubTest(['t1'], { t1: [0, '{"taken":true}', ''] }).calls[0][7]).link === '/Settings/FireSquireTools');
const lang = (env) => execFileSync('php', ['-r', `require '${LIB}'; echo fs_ui_lang();`], { encoding: 'utf8', env: { ...process.env, ...env } });
ok('the language is the one Unraid shows, from its settings when the page has no session', lang({ FS_DYNAMIX_CFG: path.join(__dirname, 'fixtures', 'dynamix.cfg') }) === 'de');
ok('and English without them', lang({ FS_DYNAMIX_CFG: path.join(__dirname, 'fixtures', 'none.cfg') }) === 'en');
const test = JSON.parse(execFileSync('php', ['-r', `require '${LIB}'; echo json_encode(fs_test_event('de'));`], { encoding: 'utf8' }));
ok('the test for the channels is linked too, in that language', test.link === '/Settings/FireSquireTools' && test.title === de.n_test_title, JSON.stringify(test));
const endpoint0 = read('include/FireSquireNotify.php');
ok('the endpoint asks Unraid\'s language and makes the link whole for a channel outside', /fs_ui_lang\(\)/.test(endpoint0) && /fs_absolute\(/.test(endpoint0));

console.log('\nThe card and the endpoint');
const endpoint = read('include/FireSquireNotify.php');
ok('the endpoint asks the hubs the last check noted', /fs_hub_test\(/.test(endpoint) && /\/var\/local\/firesquire\/hubs/.test(endpoint) && /'hub'|"hub"/.test(endpoint));
const page = read('firesquire-notify.js');
ok('the card says when TollRoll took the test', /r\.hub/.test(page) && /n_sent_hub/.test(page));
const missing = ['n_hub_test_title', 'n_sent_hub'].filter((k) => !(k in en));
ok('both texts are in en.json, the hub\'s title without FireSquire\'s name', missing.length === 0 && !/FireSquire/.test(en.n_hub_test_title) && /TollRoll/.test(en.n_sent_hub), missing.join());

done();
