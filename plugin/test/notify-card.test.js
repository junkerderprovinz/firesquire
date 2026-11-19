// The notification channels are the house's notification card, the same files as in the other
// plugins, fed by FireSquire's adapter: the channels come from and go to FireSquireNotify.php in
// kit/notify's format, Healthchecks among the services since FireSquire sends its own pings, and
// a test says whether it went through TollRoll's hub or straight to the channel. The schedule
// keeps its own card.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { DIR, read, ok, done } = require('./lib');

const en = JSON.parse(read('lang/en.json'));
const timeField = require(path.join(DIR, 'scripts', 'time-field.js'));
const de = JSON.parse(read('lang/de.json'));

class El {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.listeners = {}; this.attrs = {}; this.own = ''; this.value = ''; this.hidden = false; this.className = ''; }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  get textContent() { return this.own + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.own = String(v); this.children = []; }
  all() { return [this].concat(...this.children.map((c) => c.all())); }
}
const tick = () => new Promise((r) => setImmediate(r));

async function page(answers, i18n = en) {
  const box = new El('div');
  const posts = [], mounts = [];
  const el = (tag, cls, text) => { const e = new El(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const ctx = {
    window: {
      csrf_token: 'tok', fireSquireI18n: i18n, fireSquireLang: 'de', GlimNotifyMarks: { marks: {}, tiles: {} },
      fireSquireUI: { el, button: (cls, g, label) => el('button', cls, label), info: () => el('span') },
      GlimNotifyCard: { mount: (place, adapter, opts) => { mounts.push({ place, adapter, opts }); return {}; } },
      GlimTimeField: { enhance: (b, opts) => { b.timeLabel = opts.label; return b; }, parse: timeField.parse, format: timeField.format },
    },
    document: { getElementById: (id) => (id === 'fs-notify' ? box : null), addEventListener() {} },
    URLSearchParams, JSON, Object, String, Array, Promise,
    fetch: (url, o) => {
      if (!o || o.method !== 'POST') return Promise.resolve({ json: () => answers.get });
      const d = Object.fromEntries(o.body);
      posts.push(d);
      return Promise.resolve({ json: () => answers[d.do](d) });
    },
    setTimeout: () => 0, clearTimeout: () => {},
  };
  vm.runInNewContext(read('firesquire-notify.js'), ctx);
  await tick(); await tick();
  return { box, posts, mounts, m: mounts[0] || {} };
}
const get = { helper: true, hub: false, schedule: { every: 'daily', hour: 3 }, channels: [{ id: 'unraid', kind: 'unraid', enabled: true, on: 'always' }] };

(async () => {
  console.log('\nThe card');
  let p = await page({ get });
  ok('the house\'s card draws the channels inside the Notifications card', p.mounts.length === 1 && p.m.place.className === 'fs-n-channels' &&
    p.box.all().some((e) => e.getAttribute('data-glim-title') === en.n_card && e.all().includes(p.m.place)));
  ok('it offers every service of kit/notify, Healthchecks too, since FireSquire sends its own pings',
    JSON.stringify(p.m.opts.kinds) === '["unraid","discord","slack","ntfy","gotify","matrix","apprise","smtp","webhook","healthchecks"]', JSON.stringify(p.m.opts.kinds));
  ok('in Unraid\'s language, with FireSquire\'s fields and buttons', p.m.opts.lang === 'de' && p.m.opts.t.nc_add === en.nc_add && p.m.opts.classes.input === 'fs-in' && p.m.opts.classes.button === 'fs-btn');
  const channels = await p.m.adapter.load();
  ok('it loads the channels FireSquire keeps', JSON.stringify(channels) === JSON.stringify(get.channels));

  console.log('\nSaving');
  p = await page({ get, save: (d) => ({ channels: JSON.parse(d.channels) }) });
  const kept = await p.m.adapter.save([{ id: 'ntfy', kind: 'ntfy', enabled: true, on: 'always', ntfy: { url: 'https://ntfy.example/x' } }]);
  ok('a change goes out URL-encoded with Unraid\'s form token, the whole list at once', p.posts[0].do === 'save' && p.posts[0].csrf_token === 'tok' && JSON.parse(p.posts[0].channels)[0].id === 'ntfy');
  ok('and the card gets the list as saved', kept[0].id === 'ntfy');
  p = await page({ get, save: () => ({ problems: [{ index: 0, field: 'ntfy.url', code: 'required' }] }) });
  let refused = null;
  await p.m.adapter.save([{ id: 'ntfy', kind: 'ntfy', enabled: true }]).catch((e) => { refused = e; });
  ok('a list the helper refuses comes back with its problems', refused && refused.code === 'invalid' && refused.problems.length === 1, JSON.stringify(refused));
  ok('the card\'s saved line shows under it', p.box.all().some((e) => e.className === 'fs-n-msg') && typeof p.m.opts.saved === 'function');

  console.log('\nThe test of a channel');
  p = await page({ get, test: () => ({ ok: true, hub: true }) }, de);
  let r = await p.m.adapter.test(get.channels[0]);
  ok('a test TollRoll took counts and says so', r.ok === true && p.m.opts.t.nc_test_ok === de.n_sent_hub && p.posts[0].do === 'test');
  p = await page({ get, test: () => ({ ok: true, hub: false }) }, de);
  r = await p.m.adapter.test(get.channels[0]);
  ok('one TollRoll did not take says it went straight to the channel', r.ok === true && p.m.opts.t.nc_test_ok === de.nc_test_ok + '. ' + de.n_hub_skipped, p.m.opts.t.nc_test_ok);
  p = await page({ get, test: () => ({ ok: false, code: 'timeout' }) });
  r = await p.m.adapter.test(get.channels[0]);
  ok('a failed test carries the code the card explains', r.ok === false && r.code === 'timeout' && p.m.opts.t.nc_test_ok === en.nc_test_ok);

  console.log('\nThe schedule and the hub');
  p = await page({ get: { ...get, hub: true }, schedule: () => ({ every: 'weekly', hour: 3 }) });
  const selects = p.box.all().filter((e) => e.tagName === 'SELECT');
  const at = p.box.all().find((e) => e.className === 'fs-n-at');
  ok('the schedule keeps its card and shows the one set', selects.length === 1 && selects[0].value === 'daily' && at.value === '03:30', at && at.value);
  ok('its time is the house\'s time field, named for the reader', at.timeLabel === en.n_sched_hour);
  selects[0].value = 'weekly';
  selects[0].listeners.change[0]();
  ok('and saves as it changes', p.posts.some((d) => d.do === 'schedule' && d.every === 'weekly'));
  at.value = '05:15';
  at.listeners.change[0]();
  ok('a time picked goes out as its hour and minute', p.posts.some((d) => d.do === 'schedule' && d.hour === '5' && d.minute === '15'), JSON.stringify(p.posts));
  ok('the hub line shows while TollRoll takes over', p.box.all().some((e) => /fs-n-hub/.test(e.className) && !e.hidden));

  console.log("\nGlimStone's catalog");
  const nc = require(path.join(DIR, 'scripts', 'notify-card.js'));
  const { version } = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'glimstone.json'), 'utf8')).targets.find((t) => t.name === 'plugin');
  const res = await fetch(`https://raw.githubusercontent.com/junkerderprovinz/glimstone/v${version}/packages/core/src/notifyProviders.ts`);
  const src = res.ok ? await res.text() : '';
  // One entry to a line in GlimStone's source, the Shoutrrr words in a list of their own.
  const words = (list) => [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const shoutrrr = /const SHOUTRRR = \[([^\]]*)\]/.exec(src);
  const theirs = [...src.matchAll(/^\s*\{ id: "([^"]+)".*\},?$/gm)].map(([line, id]) => {
    const e = { id, name: /name: "([^"]+)"/.exec(line)[1], group: /group: "([^"]+)"/.exec(line)[1] };
    const kind = /kind: "([^"]+)"/.exec(line), glyph = /glyph: "([^"]+)"/.exec(line), terms = /terms: (\[[^\]]*\]|\w+)/.exec(line);
    if (kind) e.kind = kind[1];
    if (terms) e.terms = terms[1].startsWith('[') ? words(terms[1]) : words(shoutrrr[1]);
    if (glyph) e.glyph = glyph[1];
    if (/word: true/.test(line)) e.word = true;
    return e;
  });
  ok(`the card's catalog is NOTIFY_PROVIDERS of GlimStone ${version}, marks aside`, theirs.length >= 10 && require('util').isDeepStrictEqual(nc.CATALOG.entries, theirs), res.status);
  const before = {
    unraid: ['Unraid', 'service'], discord: ['Discord', 'service'], slack: ['Slack', 'service'], ntfy: ['ntfy', 'service'],
    gotify: ['Gotify', 'service'], matrix: ['Matrix', 'service'], apprise: ['Apprise', 'service'], healthchecks: ['Healthchecks.io', 'service'],
    smtp: [en.nc_smtp, 'standard'], webhook: [en.nc_webhook, 'standard']
  };
  const all = Object.keys(before);
  const tiles = nc.sections(all, [], en, 'en').flatMap((s) => s.tiles.map((x) => [x.kind, x.name, s.id, x.sub]));
  ok('every channel kind finds the entry it had before', Object.keys(nc.FIELDS).sort().join() === all.slice().sort().join() && tiles.length === all.length &&
    tiles.every(([kind, name, group]) => before[kind][0] === name && before[kind][1] === group), JSON.stringify(tiles));
  ok('mail carries SMTP as its second line, and only mail', tiles.every(([kind, , , sub]) => sub === (kind === 'smtp' ? 'SMTP' : '')));
  const found = (q) => nc.sections(all, [], en, 'en', q).flatMap((s) => s.tiles.map((x) => x.kind)).join();
  ok("the catalog's words find a tile", found('element') === 'matrix' && found('http') === 'webhook' && found('telegram') === '');
  ok('the webhook stays last whatever its name', nc.sections(all, [], Object.assign({}, en, { nc_webhook: 'Aaa' }), 'en')[1].tiles.map((x) => x.kind).join() === 'smtp,webhook');

  console.log('\nThe shared files');
  const card = read('scripts/notify-card.js');
  ok('the card is the house\'s file, which serves every plugin as it is', /the same file serves every plugin/.test(card) && /root\.GlimNotifyCard = factory\(\)/.test(card));
  ok('with its marks, its sheet and where the marks come from', ['scripts/notify-marks.js', 'styles/notify-card.css', 'marks/README.md', 'marks/LICENSE-dashboard-icons.txt'].every((f) => fs.existsSync(path.join(DIR, f))));
  const pg = read('FireSquireTools.page');
  ok('the settings page loads them before the adapter', pg.indexOf('styles/notify-card.css') > 0 && pg.indexOf('scripts/notify-marks.js') < pg.indexOf('scripts/notify-card.js') &&
    pg.indexOf('scripts/notify-card.js') < pg.indexOf('firesquire-notify.js'));
  const asked = new Set([...card.matchAll(/\bnc_[a-z_]+/g)].map((m) => m[0]).filter((k) => !/^nc_fail_$/.test(k)));
  const langs = fs.readdirSync(path.join(DIR, 'lang'));
  const lacking = langs.flatMap((f) => { const l = JSON.parse(read('lang/' + f)); return [...asked].filter((k) => !(k in l) && !/_$/.test(k)).map((k) => f + ':' + k); });
  ok('every text the card asks for is in all 26 languages', asked.size > 30 && lacking.length === 0, lacking.slice(0, 8).join(', '));
  done();
})();
