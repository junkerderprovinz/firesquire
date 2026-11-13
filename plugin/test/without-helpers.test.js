// A fresh install without ParleyPort's helpers, as after a download that failed. The .plg pins
// the helpers to one ParleyPort release and their checksums, and the install goes on without
// them. The settings page then shows no fortress card and no notification or schedule cards, the
// check card leaves the fortress out, and the engine still walks every other stage. The flash
// backup then comes from Unraid Connect alone, and its hint names only that. With a helper in
// place its part comes back.
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const { DIR, read, ok, done } = require('./lib');

const en = JSON.parse(read('lang/en.json'));

console.log('\nThe install');
const plg = fs.readFileSync(path.join(__dirname, '..', 'firesquire.plg'), 'utf8');
const urls = [...plg.matchAll(/<URL>([^<]*)<\/URL>/g)].map((m) => m[1].trim());
ok('downloads only its own package', urls.length === 1 && urls[0] === '&pkgURL;', urls.join(' '));
const ent = (n) => (new RegExp('<!ENTITY ' + n + '\\s+"([^"]*)">').exec(plg) || [])[1] || '';
ok('takes the helpers from one ParleyPort release', /^v\d+\.\d+\.\d+$/.test(ent('helperVer'))
  && ent('helperURL') === 'https://github.com/junkerderprovinz/parleyport/releases/download/&helperVer;', ent('helperVer'));
ok('each pinned to its checksum', /^[0-9a-f]{64}$/.test(ent('fortressSHA')) && /^[0-9a-f]{64}$/.test(ent('notifySHA')));
ok('and a helper that fails to load leaves the install going', /helper fortress "&fortressSHA;"/.test(plg) && /helper notify "&notifySHA;"/.test(plg)
  && /sha256sum -c --status/.test(plg) && !/exit 1/.test(plg.split('<!-- Install -->')[1].split('</FILE>')[0]));

console.log('\nThe settings page');
const tools = read('FireSquireTools.page');
ok('asks whether each helper is installed', /is_executable\("\$fsWeb\/fortress"\)/.test(tools) && /is_executable\("\$fsWeb\/notify"\)/.test(tools));
ok('loads the fortress card only with its helper', /<\?if \(\$fsFortress\):\?>\s*<link type="text\/css" rel="stylesheet" href="<\?autov\('\/plugins\/firesquire\/fortress-card\.css'\)\?>">\s*<script src="<\?autov\('\/plugins\/firesquire\/fortress-card\.js'\)\?>"><\/script>\s*<script src="<\?autov\('\/plugins\/firesquire\/firesquire-fortress\.js'\)\?>"><\/script>\s*<\?endif;\?>/.test(tools));
ok('loads the notification cards only with their helper', /<\?if \(\$fsNotify\):\?>\s*<script src="<\?autov\('\/plugins\/firesquire\/firesquire-notify\.js'\)\?>"><\/script>\s*<\?endif;\?>/.test(tools));

class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attrs = {};
    this.own = '';
    this.className = '';
    this.style = { setProperty() {}, removeProperty() {} };
    this.classList = { add: (c) => { this.className += ' ' + c; } };
  }
  appendChild(c) { this.children.push(c); return c; }
  addEventListener() {}
  set innerHTML(v) { this.own = String(v); this.children = []; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  removeAttribute(k) { delete this.attrs[k]; }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  get textContent() { return this.own + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.own = String(v); this.children = []; }
  all() { return [this].concat(...this.children.map((c) => c.all())); }
  querySelectorAll(sel) { return this.all().slice(1).filter((e) => (' ' + e.className + ' ').includes(' ' + sel.slice(1) + ' ')); }
}

function settings({ themed, fortress, notify }) {
  const root = new El('div'), list = new El('div');
  root.setAttribute('data-fs-ver', '1.3.0');
  if (fortress) root.setAttribute('data-fs-fortress', '');
  if (notify) root.setAttribute('data-fs-notify', '');
  const el = (tag, cls, text) => { const e = new El(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const UI = { el, rtl: false, themed: () => themed, hue() {}, glyph: () => '', button: (cls, glyph, label) => el('button', cls, label), info: (tip) => el('span', 'fs-info', tip) };
  const html = new El('html');
  const ctx = {
    window: { fireSquireUI: UI, fireSquireI18n: en, fireSquireMarks: { brand: {}, coin: {} }, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }) },
    document: {
      documentElement: html,
      getElementById: (id) => (id === 'fs-info' ? root : id === 'ss-tools' ? list : null),
      querySelector: () => null,
      addEventListener() {},
    },
    MutationObserver: class { observe() {} },
    localStorage: { getItem: () => null, setItem() {} },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    String, Array, Object,
  };
  vm.runInNewContext(read('firesquire-info.js'), ctx);
  const ids = root.all().map((e) => e.id).filter(Boolean);
  return { root, list, ids, text: root.textContent + list.textContent };
}

const fortressLine = en.tools_li[4];
for (const themed of [true, false]) {
  const look = themed ? 'GlimStone\'s look' : 'Unraid\'s look';
  let p = settings({ themed, fortress: false, notify: false });
  ok(`${look}: no fortress card without its helper`, !p.ids.includes('fs-fortress'));
  ok(`${look}: no notification or schedule cards without their helper`, !p.ids.includes('fs-notify'));
  ok(`${look}: what the check looks at leaves the fortress out`, !p.text.includes(en.tools_g_fortress) && !p.text.includes(fortressLine), p.text.slice(0, 200));
  ok(`${look}: and names every other group`, en.tools_li.filter((x) => x !== fortressLine).every((x) => themed || p.text.includes(x)));
  p = settings({ themed, fortress: true, notify: true });
  ok(`${look}: with the helpers both come back`, p.ids.includes('fs-fortress') && p.ids.includes('fs-notify') && (themed ? p.text.includes(en.tools_g_fortress) : p.text.includes(fortressLine)));
  // The fortress sits where every plugin of the house has it, in the tab right after General.
  const tabs = p.root.all().filter((e) => e.getAttribute('role') === 'tab').map((e) => e.getAttribute('data-fs-tab'));
  ok(`${look}: the fortress has the tab right after General`, tabs.indexOf('fortress') === 1 && tabs[0] === 'general', tabs.join(' | '));
}

console.log('\nThe check');
const ENGINE = path.join(DIR, 'firesquire-check.sh');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-nohelpers-'));
const state = path.join(tmp, 'state');
fs.mkdirSync(state);
fs.writeFileSync(path.join(state, 'notify.json'), '[]');
let out;
try {
  out = execFileSync('bash', [ENGINE, '--json', '--progress'], {
    env: { ...process.env, FIRESQUIRE_FORTRESS: path.join(tmp, 'fortress'), FIRESQUIRE_NOTIFY: path.join(tmp, 'notify'), FS_STATE: state.replace(/\\/g, '/'), FIRESQUIRE_FORTRESS_DIR: path.join(tmp, 'membership') },
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  });
} catch (e) {
  out = e.stdout;
}
fs.rmSync(tmp, { recursive: true, force: true });
const stages = [...out.matchAll(/^@@FSP \d+ (\w+)$/gm)].map((m) => m[1]);
const wanted = [...read('firesquire-check.sh').matchAll(/fspush \d+ (p_\w+)/g)].map((m) => m[1]).filter((s) => s !== 'p_fortress');
ok('walks every stage but the fortress', wanted.every((s) => stages.includes(s)) && !stages.includes('p_fortress'), stages.join(' '));
const report = JSON.parse(out.split('\n').find((l) => l.startsWith('{')) || '{}');
ok('and ends in a verdict', ['GO', 'CAUTION', 'NO-GO'].includes(report.verdict));
ok('with nothing from a fortress', !(report.checks || []).some((c) => c.id === 'fortress'));
const flash = (report.checks || []).find((c) => c.id === 'flash_backup') || {};
ok('the flash backup hint names Unraid Connect alone', flash.key === 'flash_backup_none_connect' && !/fortress|BombVault/.test(flash.message || ''), JSON.stringify(flash));
ok('and every language has the hint', fs.readdirSync(path.join(DIR, 'lang')).every((f) => typeof JSON.parse(read('lang/' + f)).flash_backup_none_connect === 'string'));

done();
