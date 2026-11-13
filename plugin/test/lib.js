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

// FireSquire's side of GlimStone's fortress card on a stand-in page: the card records what it is
// handed, a GET is answered with `state` (with answers.status for a member's status) and each POST
// with answers[do]. 'down' is a server out of reach, 'html' a page that is no JSON.
function fortressAdapter(state, answers) {
  const box = { id: 'fs-fortress' };
  const mounts = [], posts = [], bodies = [], gets = [];
  const answer = (a) => {
    if (a === 'down') return Promise.reject(new Error('down'));
    if (a === 'html') return Promise.resolve({ json: () => Promise.reject(new SyntaxError('Unexpected token <')) });
    return Promise.resolve({ json: () => Promise.resolve(a) });
  };
  const ctx = {
    window: {
      csrf_token: 'tok',
      fireSquireLang: 'de',
      GlimFortressCard: { mount: (el, adapter, opts) => { mounts.push({ el, adapter, opts }); return {}; } },
    },
    document: { getElementById: (id) => (id === 'fs-fortress' ? box : null) },
    URLSearchParams,
    fetch: (url, o) => {
      if (!o || o.method !== 'POST') { gets.push(url); return answer(/do=status/.test(url) ? answers.status : state); }
      const d = Object.fromEntries(o.body);
      bodies.push(o.body);
      posts.push(d);
      return answer(answers[d.do](d));
    },
  };
  require('vm').runInNewContext(read('firesquire-fortress.js'), ctx);
  const m = mounts[0] || {};
  return { box, mounts, adapter: m.adapter, opts: m.opts, posts, bodies, gets };
}

// hearsTheNetwork says a helper command waits long enough for one round of
// the apps announcing themselves on this network, which takes them five
// seconds, and for their answer.
function hearsTheNetwork(args) {
  const m = / -wait (\d+)s\b/.exec(' ' + args);
  return !!m && Number(m[1]) >= 7;
}

module.exports = { DIR, read, ok, done, rules, keyframes, grabFn, fortressAdapter, hearsTheNetwork };
