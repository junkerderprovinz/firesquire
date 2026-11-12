// Shared pieces for the plugin checks: the sources, a tally, and a small CSS reader that knows
// which at-rules a rule sits in.
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'src', 'usr', 'local', 'emhttp', 'plugins', 'firesquire');
const read = (rel) => fs.readFileSync(path.join(DIR, rel), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
}
function done() {
  console.log('\n' + (fail ? `FAILED  ${pass} passed, ${fail} failed` : `OK  ${pass} passed`));
  process.exit(fail ? 1 : 0);
}

// Every rule as { selector, body, at }, where at lists the enclosing at-rule preludes.
function rules(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [], stack = [];
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      stack.push(css.slice(start, i).trim());
      start = i + 1;
    } else if (c === '}') {
      const head = stack.pop();
      const body = css.slice(start, i).trim();
      if (head !== undefined && !head.startsWith('@') && !/[{}]/.test(body)) {
        out.push({ selector: head, body, at: stack.filter((s) => s.startsWith('@')) });
      }
      start = i + 1;
    }
  }
  return out;
}
function keyframes(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = {};
  const re = /@keyframes\s+([\w-]+)\s*\{/g;
  let m;
  while ((m = re.exec(css))) {
    let d = 1, i = re.lastIndex;
    for (; i < css.length && d; i++) { if (css[i] === '{') d++; else if (css[i] === '}') d--; }
    out[m[1]] = css.slice(re.lastIndex, i - 1);
  }
  return out;
}
// The source of a named function, braces balanced.
function grabFn(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('function not found: ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('unbalanced function: ' + name);
}

// A small stand-in for the page the fortress card runs on: elements, FireSquire's UI kit, fetch
// answered by `answers`, and timers that run when the test says so.
class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.listeners = {};
    this.attrs = {};
    this.own = '';
    this.value = '';
    this.hidden = false;
    this.disabled = false;
    this.className = '';
  }
  appendChild(c) { this.children.push(c); c.parentNode = this; return c; }
  addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k]; }
  get textContent() { return this.own + this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.own = String(v); this.children = []; }
  fire(type, extra) { (this.listeners[type] || []).forEach((fn) => fn({ target: this, preventDefault() {}, ...extra })); }
  focus() { El.focused = this; }
  remove() { const kids = this.parentNode.children; kids.splice(kids.indexOf(this), 1); }
  all() { return [this].concat(...this.children.map((c) => c.all())); }
  querySelector(sel) { return this.all().slice(1).find((e) => (' ' + e.className + ' ').includes(' ' + sel.slice(1) + ' ')) || null; }
}

function fortressCard(state, answers) {
  const en = JSON.parse(read('lang/en.json'));
  const box = new El('div');
  const posts = [], bodies = [], gets = [], windows = [], opened = [];
  let timers = [];
  const el = (tag, cls, text) => { const e = new El(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const button = (cls, glyph, label) => { const b = el('button', cls); b.glyph = glyph; b.appendChild(el('span', 'fs-btn-l', label)); return b; };
  const window = {
    csrf_token: 'tok',
    fireSquireI18n: en,
    open: (url, target, features) => { opened.push({ url, target, features }); return null; },
    fireSquireUI: {
      el, button, info: (tip) => { const s = el('span', 'fs-info'); s.tip = tip; return s; },
      openWindow: (o) => {
        const w = { o, win: el('div', 'fs-win'), body: el('div'), act: el('div'), closed: false, close() { w.closed = true; } };
        w.title = w.win.appendChild(el('h2', 'fs-win-title', o.title));
        w.act.appendChild(button('fs-win-btn', 'Close', en.give_close));
        El.focused = o.build(w.body, w.win, w.act) || w.win;
        windows.push(w);
        return w;
      },
    },
  };
  const json = (a) => (a === 'down' ? Promise.reject(new Error('down')) : Promise.resolve({ json: () => a }));
  const ctx = {
    window,
    document: { getElementById: (id) => (id === 'fs-fortress' ? box : null) },
    FormData, URLSearchParams,
    fetch: (url, o) => {
      if (!o || o.method !== 'POST') { gets.push(url); return json(/do=members/.test(url) ? answers.members : state); }
      const d = Object.fromEntries(o.body);
      bodies.push(o.body);
      posts.push(d);
      return json(answers[d.do](d));
    },
    setTimeout: (fn, ms) => { const t = { fn, ms }; timers.push(t); return t; },
    clearTimeout: (t) => { timers = timers.filter((x) => x !== t); },
    JSON, String, Promise, Object,
  };
  require('vm').runInNewContext(read('firesquire-fortress.js'), ctx);
  return {
    box, posts, bodies, gets, windows, opened,
    focused: () => El.focused,
    find: (pred) => box.all().find(pred),
    text: () => box.textContent,
    wait: (ms) => { const due = timers.filter((t) => t.ms <= ms); timers = timers.filter((t) => t.ms > ms); due.forEach((t) => t.fn()); },
    settle: () => new Promise((r) => setImmediate(r)).then(() => new Promise((r) => setImmediate(r))),
  };
}

module.exports = { DIR, read, ok, done, rules, keyframes, grabFn, fortressCard };
