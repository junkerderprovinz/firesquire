// FireSquire checks before every reboot and shutdown of the WebGUI. Unraid sends both as a form to
// Boot.php (Main, the Dashboard, the update banner, the boot pool), by form.submit() or by a submit
// event, so FireSquire catches the form and leaves Unraid's files alone. A GO goes straight on; a
// CAUTION, a NO-GO or a check that could not run keeps the findings in view and asks.
const { read, ok, done, grabFn } = require('./lib');

const js = read('firesquire.js');
const en = JSON.parse(read('lang/en.json'));

// A form as Unraid writes it, with the fields it carries.
function form(action, fields) {
  return {
    tagName: 'FORM', fsChecked: false, sent: 0,
    getAttribute: (k) => (k === 'action' ? action : null),
    querySelectorAll: (sel) => (sel === '[name="cmd"]' ? fields.map((v) => ({ value: v })) : []),
  };
}

function setup() {
  const listeners = [];
  const proto = { submit() { this.sent++; } };
  const win = { HTMLFormElement: { prototype: proto }, document: { addEventListener: (t, fn, cap) => listeners.push({ t, fn, cap }) } };
  const asked = [];
  const make = new Function('location', 'URL', grabFn(js, 'bootCmd') + '\n' + grabFn(js, 'installGuard') + '\nreturn installGuard;');
  make({ href: 'http://tower/Main' }, URL)(win, (cmd, proceed) => asked.push({ cmd, proceed }));
  const submitEvent = (f) => {
    const e = { target: f, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
    listeners.filter((l) => l.t === 'submit').forEach((l) => l.fn(e));
    return e;
  };
  return { proto, asked, submitEvent, listen: listeners };
}

console.log('\nCatching the reboot');
let s = setup();
ok('the submit event is caught before any page handler', s.listen.some((l) => l.t === 'submit' && l.cap === true));
const dash = form('/webGui/include/Boot.php', ['reboot']);
s.proto.submit.call(dash);
ok('the Dashboard\'s reboot waits for the check', dash.sent === 0 && s.asked.length === 1 && s.asked[0].cmd === 'reboot');
s.asked[0].proceed();
ok('and goes out once the check lets it', dash.sent === 1 && dash.fsChecked === true);
s.proto.submit.call(dash);
ok('a form the check let through is not asked again', dash.sent === 2 && s.asked.length === 1);

const main = form('/webGui/include/Boot.php', ['', 'shutdown']);
const ev = s.submitEvent(main);
ok('a shutdown sent by a submit event is held as well', ev.prevented && ev.stopped && s.asked[1].cmd === 'shutdown');
ok('the last cmd field counts, as PHP reads it', s.asked[1].cmd === 'shutdown');

const banner = form('http://tower/webGui/include/Boot.php', ['reboot']);
s.proto.submit.call(banner);
ok('a full address to Boot.php counts too', s.asked.length === 3 && banner.sent === 0);

const other = form('/update.php', ['reboot']);
s.proto.submit.call(other);
ok('any other form goes out untouched', other.sent === 1 && s.asked.length === 3);
const sleep = form('/webGui/include/Boot.php', ['sleep']);
s.proto.submit.call(sleep);
ok('other commands of Boot.php go out untouched', sleep.sent === 1 && s.asked.length === 3);
const plain = s.submitEvent(form('/webGui/include/Settings.php', []));
ok('and their events are left alone', !plain.prevented && !plain.stopped);

console.log('\nAsking after the check');
const nodes = [];
const mk = (tag, cls, text) => ({ tagName: tag, className: cls || '', textContent: text || '', listeners: {}, removed: false,
  addEventListener(t, fn) { this.listeners[t] = fn; }, remove() { this.removed = true; }, querySelector() { return null; } });
const close = { label: mk('span', 'fs-btn-l', en.give_close) };
const act = {
  kids: [],
  insertBefore(n) { this.kids.unshift(n); nodes.push(n); },
  appendChild(n) { this.kids.push(n); nodes.push(n); },
  querySelector(sel) { return sel === '.fs-win-btn .fs-btn-l' ? close.label : null; },
  querySelectorAll(sel) { return sel === '.fs-ask' ? this.kids.filter((k) => /fs-ask/.test(k.className)) : []; },
  get firstChild() { return this.kids[0]; },
};
const ask = new Function('el', 'button', 'fsT', grabFn(js, 'ask') + '\nreturn ask;')(
  mk, (cls, glyph, label) => mk('button', cls, label), (k) => en[k]);
let closed = 0, went = 0;
ask({ cmd: 'reboot', proceed: () => went++ }, act, () => closed++);
const go = act.kids.find((k) => k.tagName === 'button');
ok('the question names the reboot', act.kids.some((k) => k.textContent === en.g_ask_reboot));
ok('the way on is a button that says what it does', go && go.textContent === en.g_reboot);
ok('closing reads as cancel', close.label.textContent === en.g_cancel);
go.listeners.click();
ok('the button closes the window and reboots', closed === 1 && went === 1);
ask({ cmd: 'shutdown', proceed: () => {} }, act, () => {});
ok('a second answer replaces the first question', act.kids.filter((k) => !k.removed && /fs-ask/.test(k.className)).length === 2 &&
  act.kids.filter((k) => !k.removed).some((k) => k.textContent === en.g_shutdown));

console.log('\nThe report under the guard');
const runSrc = grabFn(js, 'run');
ok('a GO goes straight on', /guard && data && data\.verdict === 'GO'[\s\S]*?guard\.proceed\(\)/.test(runSrc));
ok('anything else asks, even a check that could not run', /if \(guard\) ask\(guard, act, win\.close\)/.test(runSrc));
ok('every page installs the guard', /installGuard\(window, function\(cmd, proceed\)\{ run\(null, \{ cmd: cmd, proceed: proceed \}\); \}\)/.test(js));

done();
