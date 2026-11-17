// While TollRoll's hub takes over, the Notifications card says so: TollRoll sends FireSquire's
// messages, and the channels below step in when it does not take one. The last check notes in RAM
// which TollRolls it found, since asking the fortress while the page opens would take seconds.
const vm = require('vm');
const { read, ok, done } = require('./lib');

const en = JSON.parse(read('lang/en.json'));

class El {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.listeners = {}; this.attrs = {}; this.own = ''; this.value = ''; this.hidden = false; this.className = ''; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  removeAttribute(k) { delete this.attrs[k]; }
  get textContent() { return this.own + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.own = String(v); this.children = []; }
  all() { return [this].concat(...this.children.map((c) => c.all())); }
}

async function page(answer) {
  const box = new El('div');
  const el = (tag, cls, text) => { const e = new El(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const ctx = {
    window: { csrf_token: 'tok', fireSquireI18n: en, fireSquireUI: { el, button: (cls, g, label) => el('button', cls, label), info: () => el('span') } },
    document: { getElementById: (id) => (id === 'fs-notify' ? box : null) },
    FormData, URLSearchParams, JSON, Date, Object, String, parseInt, Promise,
    fetch: () => Promise.resolve({ json: () => answer }),
    setTimeout: () => 0, clearTimeout: () => {},
  };
  vm.runInNewContext(read('firesquire-notify.js'), ctx);
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  return box.all().find((e) => / fs-n-hub$/.test(' ' + e.className) || e.className === 'fs-prose fs-n-hub');
}

(async () => {
  console.log('\nThe line on the Notifications card');
  let line = await page({ helper: true, hub: true, schedule: { every: 'off', hour: 4 }, channels: [] });
  ok('while TollRoll is the hub the card says that TollRoll sends the messages', line && !line.hidden && line.textContent === en.n_hub_on, line && line.textContent);
  ok('and the text names TollRoll and the channels that step in', /TollRoll/.test(en.n_hub_on) && /channels/.test(en.n_hub_on), en.n_hub_on);
  line = await page({ helper: true, hub: false, schedule: { every: 'off', hour: 4 }, channels: [] });
  ok('without a hub the line stays hidden', line && line.hidden);
  line = await page({ helper: true, schedule: { every: 'off', hour: 4 }, channels: [] });
  ok('and so it does when the server does not say', line && line.hidden);

  console.log('\nWhere the page learns it');
  ok('the endpoint reports the hub from the note of the last check', /'hub'|"hub"/.test(read('include/FireSquireNotify.php')) && /\/var\/local\/firesquire\/hubs/.test(read('include/FireSquireNotify.php')));
  const engine = read('firesquire-check.sh');
  ok('every full check writes the TollRolls it found, and removes the note without one', /printf '%s\\n' "\$HUBS" > "\$FS_RUN\/hubs"/.test(engine) && /rm -f "\$FS_RUN\/hubs"/.test(engine));
  done();
})();
