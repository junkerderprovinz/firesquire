// The settings for channels and the schedule save as they change, without a button: a choice at
// once, typing once it pauses, one save at a time. A short confirmation follows, and a failure says
// what went wrong. The test runs firesquire-notify.js against a small stand-in for the page.
const vm = require('vm');
const { read, ok, done } = require('./lib');

const en = JSON.parse(read('lang/en.json'));
const fill = (s, args) => args.reduce((m, a, i) => m.split('{' + i + '}').join(a), s);

class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.listeners = {};
    this.attrs = {};
    this.own = '';
    this.value = '';
    this.hidden = false;
    this.className = '';
  }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  removeAttribute(k) { delete this.attrs[k]; }
  get textContent() { return this.own + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.own = String(v); this.children = []; }
  fire(type) { (this.listeners[type] || []).forEach((fn) => fn({ target: this, preventDefault() {} })); }
  all() { return [this].concat(...this.children.map((c) => c.all())); }
}

function page(answers) {
  const box = new El('div');
  const posts = [], bodies = [];
  let timers = [];
  const el = (tag, cls, text) => { const e = new El(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const window = {
    csrf_token: 'tok',
    fireSquireI18n: en,
    fireSquireUI: { el, button: (cls, glyph, label) => el('button', cls, label), info: () => el('span') },
  };
  const ctx = {
    window,
    document: { getElementById: (id) => (id === 'fs-notify' ? box : null) },
    FormData, URLSearchParams,
    fetch: (url, o) => {
      if (!o || o.method !== 'POST') {
        return Promise.resolve({ json: () => ({ helper: true, schedule: { every: 'off', hour: 4 },
          channels: [{ id: 'a', kind: 'gotify', name: 'Phone', enabled: true, on: 'always', gotify: { url: 'https://gotify.example.org', token: '********' } }] }) });
      }
      const d = Object.fromEntries(o.body);
      bodies.push(o.body);
      posts.push(d);
      const answer = answers(d, posts.length);
      return answer instanceof Promise ? answer : answer === 'down' ? Promise.reject(new Error('down')) : Promise.resolve({ json: () => answer });
    },
    setTimeout: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t; },
    clearTimeout: (t) => { timers = timers.filter((x) => x !== t); },
    JSON, Date, Object, String, parseInt, Promise,
  };
  vm.runInNewContext(read('firesquire-notify.js'), ctx);
  const find = (pred) => box.all().find(pred);
  return {
    box, posts, bodies, find,
    // Runs the timers that are due within ms, the way the browser would after a pause.
    wait: (ms) => { const due = timers.filter((t) => t.ms <= ms); timers = timers.filter((t) => t.ms > ms); due.forEach((t) => t.fn()); },
    pending: () => timers.filter((t) => t.ms > 0 && t.ms < 2000).length,
    settle: () => new Promise((r) => setImmediate(r)).then(() => new Promise((r) => setImmediate(r))),
    msg: (card) => box.all().filter((e) => e.className === 'fs-n-msg')[card].textContent,
  };
}
const saved = (d) => ({ channels: JSON.parse(d.channels) });

(async () => {
  console.log('\nNo button saves');
  let p = page(saved);
  await p.settle();
  const labels = p.box.all().filter((e) => e.tagName === 'BUTTON').map((e) => e.textContent);
  ok('neither card has a save button', !labels.some((l) => /^(Save|Apply|Done)$/.test(l)), labels.join(', '));
  ok('the actions that are not settings stay', labels.includes(en.n_add) && labels.includes(en.n_test) && labels.includes(en.n_remove), labels.join(', '));

  console.log('\nTyping saves once it pauses');
  const url = p.find((e) => e.tagName === 'INPUT' && e.value === 'https://gotify.example.org');
  url.value = 'https://gotify.example.org/a'; url.fire('input');
  url.value = 'https://gotify.example.org/ab'; url.fire('input');
  ok('nothing goes out while typing', p.posts.length === 0);
  p.wait(1000);
  await p.settle();
  ok('one save goes out after the pause', p.posts.length === 1 && p.posts[0].do === 'save' && p.posts[0].csrf_token === 'tok');
  ok('URL-encoded, since the webGUI never answers a multipart post', p.bodies[0] instanceof URLSearchParams, String(p.bodies[0]));
  const sent = JSON.parse(p.posts[0].channels)[0];
  ok('with what was typed last and the masked token as it came', sent.gotify.url === 'https://gotify.example.org/ab' && sent.gotify.token === '********', JSON.stringify(sent));
  ok('a short confirmation follows', p.msg(0) === en.n_saved, p.msg(0));
  p.wait(5000);
  ok('and goes away again', p.msg(0) === '', p.msg(0));

  console.log('\nA choice saves at once');
  const on = p.find((e) => e.tagName === 'INPUT' && e.type === 'checkbox');
  on.checked = false; on.fire('change');
  await p.settle();
  ok('switching a channel off saves right away', p.posts.length === 2 && JSON.parse(p.posts[1].channels)[0].enabled === false);
  p.find((e) => e.tagName === 'BUTTON' && e.textContent === en.n_remove).fire('click');
  await p.settle();
  ok('removing a channel saves right away', p.posts.length === 3 && JSON.parse(p.posts[2].channels).length === 0);
  p.find((e) => e.tagName === 'BUTTON' && e.textContent === en.n_add).fire('click');
  await p.settle();
  ok('adding a channel saves it right away', p.posts.length === 4 && JSON.parse(p.posts[3].channels)[0].kind === 'unraid');

  console.log('\nA failure says what went wrong');
  p = page((d) => (d.do === 'save' ? { problems: [{ index: 0, channel: 'a', field: 'gotify.url', code: 'bad_url' }] } : {}));
  await p.settle();
  const u2 = p.find((e) => e.tagName === 'INPUT' && e.value === 'https://gotify.example.org');
  u2.value = 'gotify'; u2.fire('input'); p.wait(1000);
  await p.settle();
  const err = p.find((e) => e.className === 'fs-field-err' && u2.getAttribute('aria-describedby') === e.id);
  ok('a field the server refuses says so right under it', !!err && !err.hidden && err.textContent === fill(en.n_problem, [en.n_f_url, 'Phone']), err && err.textContent);
  ok('and is marked invalid', u2.getAttribute('aria-invalid') === 'true');
  ok('while the line under the card stays quiet', p.msg(0) === '', p.msg(0));
  p.wait(5000);
  ok('the line stays until the value changes', !err.hidden && err.textContent !== '');
  u2.value = 'https://gotify.example.org'; u2.fire('input');
  ok('and goes once it does', err.hidden && err.textContent === '' && u2.getAttribute('aria-invalid') === undefined);
  p = page(() => 'down');
  await p.settle();
  p.find((e) => e.tagName === 'INPUT' && e.type === 'checkbox').fire('change');
  await p.settle();
  ok('a server out of reach is said so', p.msg(0) === fill(en.n_failed, ['network']), p.msg(0));

  console.log('\nOne save at a time');
  let release;
  p = page((d, n) => (n === 1 ? new Promise((r) => { release = () => r({ json: () => saved(d) }); }) : saved(d)));
  await p.settle();
  const box = p.find((e) => e.tagName === 'INPUT' && e.type === 'checkbox');
  box.checked = false; box.fire('change');
  box.checked = true; box.fire('change');
  await p.settle();
  ok('a change during a save waits for it', p.posts.length === 1, p.posts.length);
  release();
  await p.settle();
  await p.settle();
  ok('and then goes out with the latest state', p.posts.length === 2 && JSON.parse(p.posts[1].channels)[0].enabled === true, p.posts.length);

  console.log('\nThe schedule');
  p = page((d) => (d.do === 'schedule' ? { every: d.every, hour: Number(d.hour) } : saved(d)));
  await p.settle();
  const selects = p.box.all().filter((e) => e.tagName === 'SELECT');
  const every = selects[selects.length - 2], hour = selects[selects.length - 1];
  every.value = 'weekly'; every.fire('change');
  await p.settle();
  ok('choosing how often saves at once', p.posts.length === 1 && p.posts[0].do === 'schedule' && p.posts[0].every === 'weekly' && p.posts[0].hour === '4', JSON.stringify(p.posts));
  ok('with a confirmation', p.msg(1) === en.n_sched_saved, p.msg(1));
  ok('and goes out URL-encoded as well', p.bodies[0] instanceof URLSearchParams, String(p.bodies[0]));
  hour.value = '22'; hour.fire('change');
  await p.settle();
  ok('choosing the hour saves at once', p.posts.length === 2 && p.posts[1].hour === '22');
  p = page(() => ({ error: 'invalid' }));
  await p.settle();
  const ev = p.box.all().filter((e) => e.tagName === 'SELECT');
  ev[ev.length - 2].value = 'daily'; ev[ev.length - 2].fire('change');
  await p.settle();
  ok('a refused schedule says so', p.msg(1) === fill(en.n_failed, ['invalid']), p.msg(1));

  done();
})();
