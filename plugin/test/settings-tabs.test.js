// The settings page has the tab column of ShipLog's and TowerTorch's: General first, the
// Fortress second when its helper is in, then FireSquire's own parts and Info last. The arrows
// move between the tabs, and the tab chosen last opens again on the next visit.
const vm = require('vm');
const { read, ok, done, rules } = require('./lib');

const en = JSON.parse(read('lang/en.json'));

class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attrs = {};
    this.listeners = {};
    this.own = '';
    this.className = '';
    this.hidden = false;
    this.tabIndex = 0;
    this.style = { setProperty() {}, removeProperty() {} };
    this.classList = { add: (c) => { this.className += ' ' + c; }, contains: (c) => (' ' + this.className + ' ').includes(' ' + c + ' ') };
  }
  appendChild(c) {
    if (c.parentNode) c.parentNode.children.splice(c.parentNode.children.indexOf(c), 1);
    this.children.push(c);
    c.parentNode = this;
    return c;
  }
  set innerHTML(v) { this.own = String(v); this.children = []; }
  get innerHTML() { return this.own; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  fire(type, extra) { (this.listeners[type] || []).forEach((fn) => fn({ target: this, key: '', preventDefault() {}, ...extra })); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  removeAttribute(k) { delete this.attrs[k]; }
  focus() { El.focused = this; }
  get textContent() { return this.own + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.own = String(v); this.children = []; }
  all() { return [this].concat(...this.children.map((c) => c.all())); }
  querySelectorAll(sel) { return this.all().slice(1).filter((e) => (' ' + e.className + ' ').includes(' ' + sel.slice(1) + ' ')); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

function page({ themed = true, fortress = true, notify = true, stored = null, narrow = false } = {}) {
  const root = new El('div'), tools = new El('div');
  root.setAttribute('data-fs-ver', '1.4.0');
  if (fortress) root.setAttribute('data-fs-fortress', '');
  if (notify) root.setAttribute('data-fs-notify', '');
  const store = stored ? { 'firesquire.settings.tab': stored } : {};
  const el = (tag, cls, text) => { const e = new El(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const UI = {
    el, rtl: false, themed: () => themed, hue() {}, glyph: (name) => `<svg data-glyph="${name}"></svg>`,
    button: (cls, glyph, label) => el('button', cls, label), info: (tip) => el('span', 'fs-info', tip),
  };
  const ctx = {
    window: {
      fireSquireUI: UI, fireSquireI18n: en, fireSquireMarks: { brand: {}, coin: {} }, addEventListener() {},
      matchMedia: () => ({ matches: narrow, addEventListener() {} }),
    },
    document: {
      documentElement: new El('html'),
      getElementById: (id) => (id === 'fs-info' ? root : id === 'ss-tools' ? tools : null),
      querySelector: () => null,
      addEventListener() {},
    },
    MutationObserver: class { observe() {} },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    String, Array, Object,
  };
  vm.runInNewContext(read('firesquire-info.js'), ctx);
  const tabs = root.all().filter((e) => e.getAttribute('role') === 'tab');
  const panes = root.all().filter((e) => e.getAttribute('role') === 'tabpanel');
  const pane = (name) => panes.find((p) => p.id === 'fs-pane-' + name);
  const open = () => tabs.filter((t) => t.getAttribute('aria-selected') === 'true').map((t) => t.getAttribute('data-fs-tab'));
  const shown = () => panes.filter((p) => !p.hidden).map((p) => p.id.replace('fs-pane-', ''));
  return { root, tools, tabs, panes, pane, open, shown, store, names: tabs.map((t) => t.getAttribute('data-fs-tab')) };
}

console.log('\nThe tabs');
let p = page();
ok('General, Notifications, Fortress and Info, in that order', p.names.join() === 'general,notify,fortress,info', p.names.join());
ok('each named in the page\'s words', p.tabs.map((t) => t.querySelector('.fs-tablbl').textContent).join() === [en.t_general, en.n_card, en.t_fortress, en.t_info].join(),
  p.tabs.map((t) => t.textContent).join());
ok('each wearing its glyph from GlimStone\'s set, the Fortress the shield', p.tabs.map((t) => /data-glyph="(\w+)"/.exec(t.querySelector('.fs-tabico').innerHTML)[1]).join() === 'TabGeneral,Notifications,ShieldOn,Info',
  p.tabs.map((t) => t.querySelector('.fs-tabico').innerHTML).join());
const list = p.root.all().find((e) => e.getAttribute('role') === 'tablist');
ok('one vertical tab list', list && list.getAttribute('aria-orientation') === 'vertical' && list.children.length === 4);
ok('every tab controls its panel and the panel names its tab', p.tabs.every((t) => {
  const q = p.panes.find((x) => x.id === t.getAttribute('aria-controls'));
  return q && q.getAttribute('aria-labelledby') === t.id;
}));
ok('General opens first, the others wait', p.open().join() === 'general' && p.shown().join() === 'general', p.shown().join());
ok('only the open tab is in the tab order', p.tabs.map((t) => t.tabIndex).join() === '0,-1,-1,-1', p.tabs.map((t) => t.tabIndex).join());

console.log('\nWhat each tab holds');
ok('General holds the card of what the check looks at', p.pane('general').querySelector('.fs-card-tools') !== null);
const mount = p.pane('fortress').children[0];
ok('the Fortress an empty place for GlimStone\'s card', p.pane('fortress').children.length === 1 && mount.id === 'fs-fortress' && mount.children.length === 0);
ok('Notifications the place of the notification and schedule cards', p.pane('notify').children.length === 1 && p.pane('notify').children[0].id === 'fs-notify');
ok('Info the Version, Help and About cards', p.pane('info').querySelectorAll('.fs-card').map((c) => c.getAttribute('data-glim-title')).join() === [en.ver_title, en.help_title, en.about_title].join(),
  p.pane('info').querySelectorAll('.fs-card').map((c) => c.getAttribute('data-glim-title')).join());
p = page({ themed: false });
ok('in Unraid\'s look General holds the description of the check', p.pane('general').children.includes(p.tools) && p.pane('general').querySelector('.fs-card-tools') === null);

console.log('\nWithout a helper');
p = page({ fortress: false });
ok('no Fortress tab without the fortress helper', p.names.join() === 'general,notify,info', p.names.join());
p = page({ notify: false });
ok('no Notifications tab without the notify helper', p.names.join() === 'general,fortress,info', p.names.join());
p = page({ fortress: false, notify: false });
ok('and General and Info without either', p.names.join() === 'general,info', p.names.join());

console.log('\nSwitching');
p = page();
p.tabs[3].fire('click');
ok('a click opens its tab and hides the others', p.open().join() === 'info' && p.shown().join() === 'info', p.shown().join());
ok('the open tab takes the tab order', p.tabs.map((t) => t.tabIndex).join() === '-1,-1,-1,0');
ok('and is kept for the next visit', p.store['firesquire.settings.tab'] === 'info', JSON.stringify(p.store));
p = page();
p.tabs[0].fire('keydown', { key: 'ArrowDown' });
ok('the down arrow opens the next tab and moves the focus there', p.open().join() === 'notify' && El.focused === p.tabs[1]);
p.tabs[1].fire('keydown', { key: 'ArrowUp' });
p.tabs[0].fire('keydown', { key: 'ArrowUp' });
ok('the up arrow on the first wraps to the last', p.open().join() === 'info' && El.focused === p.tabs[3]);
p.tabs[3].fire('keydown', { key: 'Home' });
ok('Home goes to the first', p.open().join() === 'general');
p.tabs[0].fire('keydown', { key: 'End' });
ok('End to the last', p.open().join() === 'info');

console.log('\nThe tab chosen last');
p = page({ stored: 'notify' });
ok('opens again on the next visit', p.open().join() === 'notify' && p.shown().join() === 'notify', p.shown().join());
p = page({ stored: 'fortress', fortress: false });
ok('a tab that is gone with its helper falls back to General', p.open().join() === 'general' && p.shown().join() === 'general', p.shown().join());

console.log('\nNarrow');
p = page({ narrow: true });
ok('below 1024 px a tab shows its glyph and keeps its name as its bubble', p.tabs.every((t) => t.getAttribute('data-tip') === t.querySelector('.fs-tablbl').textContent));
p = page();
ok('wider, the name stands beside the glyph and needs no bubble', p.tabs.every((t) => !t.hasAttribute('data-tip')));

console.log('\nThe look, as on ShipLog\'s page');
const css = rules(read('firesquire-info.css'));
const rule = (sel, at) => css.find((r) => r.selector === sel && (at ? r.at.some((a) => a.includes(at)) : !r.at.length)) || { body: '' };
ok('a 204 px column with 4 px between the tiles', /width: 204px/.test(rule('.fs-tabs').body) && /gap: 4px/.test(rule('.fs-tabs').body), rule('.fs-tabs').body);
ok('beside the cards, 24 px apart', /display: flex/.test(rule('.fs-body').body) && /gap: 24px/.test(rule('.fs-body').body), rule('.fs-body').body);
ok('66 px tiles', /height: 66px/.test(rule('#fs-info .fs-tab').body), rule('#fs-info .fs-tab').body);
ok('the glyph 20 px', /width: 20px; height: 20px/.test(rule('.fs-tabico svg').body));
ok('the open tile in the heading colour', /background: var\(--fs-head\); color: var\(--fs-head-ink\)/.test(rule('#fs-info .fs-tab[aria-selected="true"],\n#fs-info .fs-tab[aria-selected="true"]:hover').body));
ok('below 1024 px a 52 px column of glyphs', /width: 52px/.test(rule('.fs-tabs', 'max-width: 1023px').body) && /clip: rect\(0 0 0 0\)/.test(rule('.fs-tablbl', 'max-width: 1023px').body));
ok('a hidden panel stays hidden', /display: none/.test(rule('#fs-info .fs-pane[hidden]').body));

done();
