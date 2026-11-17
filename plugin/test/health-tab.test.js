// The Health tab: the seven areas, each with its light in words and colour, the findings behind
// it a click away, and a strip of the last 30 days. The advice on the settings stands in a card of
// its own below, without a light. The tab shows the last check and runs one by itself when there
// is none since the server started, and Check now runs one on request.
const vm = require('vm');
const { read, ok, done, rules } = require('./lib');

const en = JSON.parse(read('lang/en.json'));

class El {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.listeners = {}; this.own = ''; this.className = ''; this.disabled = false; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  set textContent(v) { this.own = String(v); this.children = []; }
  get textContent() { return this.own + this.children.map((c) => c.textContent).join(''); }
  set innerHTML(v) { this.own = ''; this.children = []; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  fire(t) { (this.listeners[t] || []).forEach((fn) => fn({ target: this })); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  all() { return [this].concat(...this.children.map((c) => c.all())); }
  find(cls) { return this.all().filter((e) => (' ' + e.className + ' ').includes(' ' + cls + ' ')); }
  querySelector(sel) { return this.find(sel.slice(1))[0] || null; }
}

const fill = (s, a) => (a || []).reduce((m, x, i) => m.split('{' + i + '}').join(x), s);
const lights = { disks: 'yellow', array: 'green', docker: 'green', vms: 'grey', flash: 'green', network: 'red', fortress: 'grey' };
const state = {
  last: {
    generated: '2026-11-17 04:30:02', verdict: 'GO',
    areas: Object.fromEntries(Object.entries(lights).map(([k, v]) => [k, { light: v, findings: v === 'grey' ? [] :
      [{ tier: 'health', status: v === 'red' ? 'fail' : v === 'yellow' ? 'warn' : 'pass', key: 'net_ok', args: [k, '1000'] }] }])),
    config: [{ tier: 'config', status: 'warn', key: 'cfg_pool_missing', args: ['scratch', 'fastpool'] }],
  },
  history: Array.from({ length: 30 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, '0')}`, lights: i === 29 ? lights : {} })),
};

function tab(answers) {
  const root = new El('div');
  root.id = 'fs-health';
  const asked = [];
  const el = (tag, cls, text) => { const e = new El(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const UI = { el, t: (k, a) => (en[k] == null ? null : fill(typeof en[k] === 'object' ? en[k].other : en[k], a)), hue() {},
    button: (cls, glyph, label) => { const b = el('button', cls); b.glyph = glyph; b.appendChild(el('span', 'fs-btn-l', label)); return b; } };
  let pending = null;
  const ctx = {
    window: { fireSquireUI: UI },
    document: { getElementById: (id) => (id === 'fs-health' ? root : null) },
    fetch: (url) => { asked.push(url); const a = answers.shift(); return new Promise((res) => { pending = () => res({ json: () => Promise.resolve(a) }); }); },
    Object, Array, String, Promise,
  };
  vm.runInNewContext(read('firesquire-health.js'), ctx);
  const answer = async () => { pending(); for (let i = 0; i < 5; i++) await Promise.resolve(); };
  return { root, asked, answer };
}

(async () => {
  console.log('\nThe areas');
  let p = tab([state]);
  await p.answer();
  ok('the tab asks for the last check', /FireSquireHealth\.php$/.test(p.asked[0]), p.asked.join());
  const areas = p.root.find('fs-area');
  ok('seven areas in their order, each named', areas.length === 7 && areas.map((a) => a.find('fs-area-name')[0].textContent).join() ===
    ['disks', 'array', 'docker', 'vms', 'flash', 'network', 'fortress'].map((k) => en['h_area_' + k]).join(), areas.map((a) => a.textContent).join(' | '));
  ok('each light in colour and in words', areas.every((a, i) => {
    const l = Object.values(lights)[i];
    return a.className.includes('fs-light-' + l) && a.find('fs-area-word')[0].textContent === en['h_light_' + l];
  }));
  ok('the findings behind an area are a click away', areas[0].find('fs-area-more').length === 1 && areas[0].find('fs-finding').length === 1 &&
    areas[0].find('fs-finding')[0].textContent === fill(en.net_ok, ['disks', '1000']));
  const strip = areas[0].find('fs-days')[0];
  ok('a strip of the last 30 days, a day without a check in grey', strip && strip.children.length === 30 && strip.children[0].className.includes('fs-light-grey') &&
    strip.children[29].className.includes('fs-light-yellow'));
  ok('each day names its date and light', strip.children[29].getAttribute('title') === fill(en.h_day, ['2026-10-30', en.h_light_yellow]), strip.children[29].getAttribute('title'));
  ok('the strip reads as a whole to a screen reader', strip.getAttribute('role') === 'img' && strip.getAttribute('aria-label') === en.h_days);
  ok('the time of the last check is shown', p.root.textContent.includes(fill(en.h_checked, ['2026-11-17 04:30:02'])));

  console.log('\nThe settings advice');
  const cfg = p.root.find('fs-card-config')[0];
  ok('stands in a card of its own, without a light', cfg && cfg.find('fs-area').length === 0 && cfg.find('fs-finding')[0].textContent === fill(en.cfg_pool_missing, ['scratch', 'fastpool']));

  console.log('\nChecking');
  const btn = p.root.find('fs-health-run')[0];
  ok('Check now wears the check glyph', btn && btn.glyph === 'Check' && btn.textContent === en.h_check);
  btn.fire('click');
  ok('runs the check and says so while it runs', /run=1/.test(p.asked[1]) && btn.disabled && btn.textContent === en.h_checking, p.asked.join());
  p = tab([{ last: null, history: state.history }, state]);
  await p.answer();
  ok('no check since the server started runs one by itself', /run=1/.test(p.asked[1] || ''), p.asked.join());
  p = tab([null]);
  await p.answer();
  ok('an answer that is no state says the check could not run', p.root.textContent.includes(en.h_failed));

  console.log('\nThe page');
  const page = read('FireSquireTools.page');
  ok('the tools page loads the tab', /firesquire-health\.js/.test(page));
  const info = read('firesquire-info.js');
  ok('the Health tab stands right after General, with GlimStone\'s health glyph', /pane\("general"[\s\S]*?pane\("health", t\("t_health"\), "Health"\)/.test(info));
  ok('the glyph is in FireSquire\'s copy', /^\s+Health: \["/m.test(read('firesquire-glyphs.js')));
  const css = rules(read('firesquire-info.css'));
  const has = (sel, re) => css.some((r) => r.selector.split(',').map((x) => x.trim()).includes(sel) && re.test(r.body));
  ok('the lights take the verdict colours of every theme', has('.fs-light-green', /var\(--fs-go\)/) && has('.fs-light-yellow', /var\(--fs-caution\)/) &&
    has('.fs-light-red', /var\(--fs-nogo\)/) && has('.fs-light-grey', /var\(--fs-neutral\)/));
  const missing = ['t_health', 'h_title', 'h_lead', 'h_checked', 'h_never', 'h_check', 'h_checking', 'h_failed', 'h_light_green', 'h_light_yellow',
    'h_light_red', 'h_light_grey', 'h_days', 'h_day', 'h_config', 'h_config_lead'].filter((k) => !(k in en));
  ok('every text is in en.json', missing.length === 0, missing.join(', '));
  done();
})();
