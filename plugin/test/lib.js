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

module.exports = { DIR, read, ok, done, rules, keyframes, grabFn };
