// A field of a notification channel keeps its label short. How to fill it in, such as one address
// per line, sits in the (i) bubble beside the label, the way the other hints on the page do, and
// not as a paragraph of its own.
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

(async () => {
  const box = new El('div');
  const el = (tag, cls, text) => { const e = new El(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const ctx = {
    window: { csrf_token: 'tok', fireSquireI18n: en, fireSquireUI: { el, button: (cls, g, label) => el('button', cls, label), info: (tip) => { const s = el('span', 'fs-info'); s.tip = tip; return s; } } },
    document: { getElementById: (id) => (id === 'fs-notify' ? box : null) },
    FormData, URLSearchParams, JSON, Date, Object, String, parseInt, Promise,
    fetch: () => Promise.resolve({ json: () => ({ helper: true, schedule: { every: 'off', hour: 4 },
      channels: [{ id: 'a', kind: 'apprise', enabled: true, on: 'always', apprise: { url: '', urls: [] } }, { id: 'w', kind: 'webhook', enabled: true, on: 'always', webhook: {} }] }) }),
    setTimeout: () => 0, clearTimeout: () => {},
  };
  vm.runInNewContext(read('firesquire-notify.js'), ctx);
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  const labels = box.all().filter((e) => e.tagName === 'LABEL');
  const urls = labels.find((l) => l.own === en.n_f_urls);
  ok('the Apprise addresses have a short label', !!urls && !/line/.test(en.n_f_urls), labels.map((l) => l.own).join(' | '));
  ok('and the hint in a bubble beside it', urls && urls.children.some((c) => c.className === 'fs-info' && c.tip === en.n_f_urls_tip));
  const headers = labels.find((l) => l.own === en.n_f_headers);
  ok('so do the headers of a webhook', headers && headers.children.some((c) => c.className === 'fs-info' && c.tip === en.n_f_headers_tip));
  ok('no field has a paragraph of help under it', !box.all().some((e) => e.tagName === 'P' && !e.hidden && /line/.test(e.textContent)));
  done();
})();
