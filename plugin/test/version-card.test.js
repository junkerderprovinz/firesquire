// The Info tab carries GlimStone's Version and Components cards, in both looks. The Version card
// holds FireSquire and its number and one last row with where the updates stand, as Unraid's
// plugin manager sees them, and What's new, Check for updates and the way to the Plugins tab.
// What's new opens a window with the notes of the running release, or of the newer one.
// ParleyPort's helpers and GlimStone stand in Components. Every number reads as plain text that
// opens its project's newest release, never as a badge or a button.
const fs = require('fs');
const path = require('path');
const { read, ok, done, grabFn, rules } = require('./lib');

const info = read('firesquire-info.js');
const page = read('FireSquireTools.page');
const update = read('include/FireSquireUpdate.php');
const en = JSON.parse(read('lang/en.json'));
const de = JSON.parse(read('lang/de.json'));

class N {
  constructor(tag, cls, txt) { this.tagName = tag.toUpperCase(); this.cls = new Set((cls || '').split(' ').filter(Boolean)); this.kids = []; this.attrs = {}; this.style = {}; this.on = {}; this._t = txt == null ? '' : String(txt); this.disabled = false; }
  get textContent() { return this.kids.length ? this.kids.map((k) => k.textContent).join('') : this._t; }
  set textContent(v) { this._t = String(v); this.kids = []; }
  own() { if (this._t && !this.kids.length) { this.kids.push(new N('#text', '', this._t)); this._t = ''; } }
  get firstChild() { this.own(); return this.kids[0] || null; }
  appendChild(k) { this.own(); this.kids.push(k); return k; }
  insertBefore(k, ref) { this.own(); const i = this.kids.indexOf(ref); this.kids.splice(i < 0 ? this.kids.length : i, 0, k); return k; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(t, fn) { (this.on[t] = this.on[t] || []).push(fn); }
  click() { (this.on.click || []).forEach((fn) => fn({ type: 'click' })); }
  all() { const out = []; const walk = (n) => n.kids.forEach((k) => { out.push(k); walk(k); }); walk(this); return out; }
  find(c) { return this.all().find((n) => n.cls.has(c)); }
}
const tick = () => new Promise((r) => setTimeout(r, 0));

// The cards' functions, in the language given, with Unraid's answers and the page stubbed.
function load(L, opts) {
  const o = Object.assign({ ver: '1.5.3', helpers: 'v1.3.1', answers: [] }, opts);
  const log = { fetched: [], opened: [], went: [], windows: [] };
  const fetch = (url, init) => {
    log.fetched.push({ url, method: (init && init.method) || 'GET', body: init && init.body });
    const a = o.answers.shift();
    if (a instanceof Error) return Promise.reject(a);
    return Promise.resolve({ ok: !a.status, status: a.status || 200, json: () => Promise.resolve(a.body) });
  };
  const fill = (k, args) => (args || []).reduce((s, a, i) => s.split('{' + i + '}').join(a), L[k]);
  const UI = {
    lang: L === de ? 'de' : 'en', t: fill,
    info: (tip) => { const s = new N('span', 'fs-info'); s.setAttribute('data-tip', tip); return s; },
    button: (cls, glyph, label) => { const b = new N('button', 'fs-btn' + (cls ? ' ' + cls : '')); b.glyph = glyph; b.appendChild(new N('span', 'fs-btn-l', label)); return b; },
    openWindow: (w) => {
      const title = new N('h2', 'fs-win-title', w.title), body = new N('div', 'fs-win-body'), act = new N('div', 'fs-win-act');
      act.appendChild(UI.button('fs-win-btn', 'Close', 'Close'));
      const frame = { title, body, act, querySelector: (sel) => (sel === '.fs-win-title' ? title : null) };
      log.windows.push(Object.assign({ o: w, focus: w.build(body, frame, act) }, frame));
    },
  };
  const root = new N('div'); if (o.helpers) root.setAttribute('data-fs-helpers', o.helpers);
  const win = { csrf_token: 'tok', open: (u) => log.opened.push(u), location: { set href(v) { log.went.push(v); } } };
  class FormData { constructor() { this.f = []; } append(k, v) { this.f.push(k + '=' + v); } toString() { return this.f.join('&'); } }
  const consts = ['REPO', 'RELEASES_API', 'GLS_VER', 'GLS_REPO', 'PARLEYPORT_REPO', 'UPDATE_URL'].map((n) => (new RegExp('  var ' + n + ' = [^;]+;').exec(info) || [''])[0]).join('\n');
  const fns = ['card', 'blank', 'release', 'version', 'timeAgo', 'newer', 'versionCard', 'updateState', 'askUpdates', 'componentsCard', 'componentRow', 'notesSource', 'openNotes', 'notesInline', 'notesDom'].map((n) => grabFn(info, n)).join('\n');
  const api = new Function('UI', 'el', 't', 'root', 'ver', 'window', 'fetch', 'FormData', 'seq', 'document', consts + '\n' + fns + '\nreturn { versionCard: versionCard, componentsCard: componentsCard, version: version, newer: newer, notesDom: notesDom, notesSource: notesSource };')(
    UI, (t, c, x) => new N(t, c, x), (k) => L[k], root, o.ver, win, fetch, FormData, 0, { createTextNode: (x) => new N('#text', '', x) });
  return Object.assign(api, { log, answers: o.answers, into: () => new N('div') });
}
const face = (c) => ({
  line: c.find('fs-ver-line').textContent,
  note: (c.find('fs-ver-note') || { textContent: '' }).textContent,
  tone: c.find('fs-ver-state').getAttribute('data-tone'),
  check: c.find('fs-ver-check').style.display !== 'none',
  busy: c.find('fs-ver-check').disabled,
  go: c.find('fs-ver-go').style.display !== 'none',
});

console.log('\nThe Info tab runs Version, Components, Help, About');
{
  const order = [...info.slice(info.indexOf('var pInfo = pane(')).matchAll(/versionCard\(pInfo\)|componentsCard\(pInfo\)|card\(t\("(help|about)_title"\), pInfo\)/g)].map((m) => m[1] || m[0].replace(/\(pInfo\)/, ''));
  ok('in GlimStone\'s order, in both looks', order.slice(0, 4).join() === 'versionCard,componentsCard,help,about', order.join());
  ok('About is called About alone', en.about_title === 'About' && de.about_title === 'Über');
  ok('the old release notes link is gone', !/rel_notes|glimstoneVersion|GLS_RELEASE_URL/.test(info));
}

console.log('\nEvery version reads as text and opens its newest release');
{
  const pins = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'glimstone.json'), 'utf8')).targets.map((t) => t.version);
  ok('GlimStone is 4.8.2, and both pins name it', /var GLS_VER = "4\.8\.2";/.test(info) && pins.join() === '4.8.2,4.8.2', pins.join());
  const { version, newer } = load(en);
  const v = version('v3.0.3', 'R');
  ok('a release is a link that shows the number alone', v.tagName === 'A' && v.textContent === '3.0.3');
  ok('it opens the newest release in a new tab', v.href === 'R/releases/latest' && v.target === '_blank' && v.rel === 'noopener noreferrer');
  ok('it is no button', !v.cls.has('fs-btn') && v.cls.has('fs-ver'));
  const dev = version('dev', 'R');
  ok('a build without a release says so, without a link', dev.tagName === 'SPAN' && dev.textContent === 'dev, not a released build');
  ok('an empty version shows a question mark', version('', 'R').textContent === '?, not a released build');
  ok('a version with anything after the number gets no link', version('3.1.0"><img src=x>', 'R').tagName === 'SPAN');
  ok('in German too', load(de).version('dev', 'R').textContent === 'dev, kein veröffentlichter Stand');
  ok('a newer release is newer, by its numbers', newer('1.6.0', '1.5.3') > 0 && newer('1.10.0', '1.9.0') > 0 && newer('1.5.3', '1.5.3') === 0 && newer('1.5.2', '1.5.3') < 0);
  ok('and any release is newer than a dev build', newer('1.0.0', 'dev') > 0 && newer('dev', '1.0.0') === 0);
  ok('no version anywhere is printed with a v', !/"v" \+ v\b|'v' \+ v\b/.test(info + read('firesquire.js')));
  const css = rules(read('firesquire-info.css'));
  const num = css.filter((r) => /a\.fs-ver/.test(r.selector));
  ok('no badge: no fill, padding, rounding or underline', !num.some((r) => /background|padding|border-radius|height|text-decoration: underline/.test(r.body)), num.map((r) => r.selector + ' { ' + r.body + ' }').join(' | '));
  ok('in the text colour at rest', num.some((r) => r.selector === '#fs-info a.fs-ver' && /color: var\(--fs-text\)/.test(r.body) && !r.at.length));
  ok('in the link colour under the pointer', num.some((r) => r.selector === '#fs-info a.fs-ver:hover' && /color: var\(--fs-link\)/.test(r.body) && r.at.some((a) => /hover: hover/.test(a))));
  ok('past TowerTorch\'s sheets too', num.some((r) => r.selector === '#fs-info a.fs-ver' && /color: var\(--fs-text\) !important/.test(r.body) && r.at.some((a) => /@layer/.test(a))));
  ok('with the house focus ring', num.some((r) => /a\.fs-ver:focus-visible/.test(r.selector) && /outline: var\(--tt-focus-ring-width, 2px\) solid var\(--fs-focus\) !important/.test(r.body)));
}

(async () => {
  console.log('\nThe Version card shows where the updates stand, as Unraid sees them');
  const now = Math.round(Date.now() / 1000);
  {
    const s = load(en, { answers: [{ body: { installed: '1.5.3', latest: '1.5.3', checkedAt: now - 180 } }] });
    const into = s.into(); s.versionCard(into); const c = into.kids[0];
    ok('the card is called Version, with its (i) naming FireSquire', c.find('fs-h').kids[0].textContent === 'Version' && /^The version of FireSquire, /.test(c.find('fs-info').getAttribute('data-tip')));
    ok('the head holds the name and the number', c.find('fs-ver-app').textContent === 'FireSquire' && c.find('fs-ver-head').kids[1].textContent === '1.5.3');
    ok('while Unraid is asked, the card says so and the check waits', face(c).line === 'Checking …' && face(c).busy);
    await tick(); await tick();
    const f = face(c);
    ok('current: "Up to date" in the ok tone, with when Unraid last looked', f.line === 'Up to date' && f.tone === 'ok' && f.note === 'Last checked 3 minutes ago', JSON.stringify(f));
    ok('the check is there, and no Plugins tab button', f.check && !f.busy && !f.go);
    ok('it asked Unraid, not GitHub', s.log.fetched.length === 1 && s.log.fetched[0].url === '/plugins/firesquire/include/FireSquireUpdate.php' && s.log.fetched[0].method === 'GET');
    const acts = c.find('fs-ver-actions').kids.map((k) => [...k.cls].find((x) => /^fs-ver-(news|check|go)$/.test(x)));
    ok('What\'s new, Check for updates, then the one action', acts.join() === 'fs-ver-news,fs-ver-check,fs-ver-go', acts.join());
    const news = c.find('fs-ver-news');
    ok('What\'s new wears the gift and the dot, Check for updates the sync glyph', news.glyph === 'WhatsNew' && news.kids[0].cls.has('fs-ver-dot') && c.find('fs-ver-check').glyph === 'Sync');
    s.answers.push({ body: { tag_name: 'v1.5.3', body: '## ✨ Added\n- **Version card.** With **bold** and `code`.' } });
    news.click();
    const w = s.log.windows[0];
    ok('What\'s new opens a window of the plugin, titled for the running release', w && w.o.cls === 'fs-win-notes' && w.title.textContent === 'New in 1.5.3' && w.o.opener === news);
    ok('it shows that the notes load, then asks GitHub for that release', w.body.textContent === 'Loading the release notes …' && s.log.fetched[1].url === 'https://api.github.com/repos/junkerderprovinz/firesquire/releases/tags/v1.5.3');
    await tick(); await tick();
    const notes = w.body.find('fs-notes');
    ok('the notes stand in the window, heading and list built from elements', notes.find('fs-notes-h').textContent === '✨ Added' && notes.all().some((n) => n.tagName === 'UL') && notes.all().filter((n) => n.tagName === 'STRONG').length === 2);
    ok('the keyboard reaches the notes, which take the focus', notes.tabIndex === 0 && w.focus === notes);
    const link = w.act.kids[0];
    ok('the link to the release page opens the foot, Close ends it', link.cls.has('fs-win-link') && link.textContent === 'View on GitHub' && w.act.kids[1].textContent === 'Close');
    link.click();
    ok('and opens the release page', s.log.opened[0] === 'https://github.com/junkerderprovinz/firesquire/releases/tag/v1.5.3');
  }
  {
    const s = load(en, { answers: [{ body: { installed: '1.5.3', latest: '1.6.0', checkedAt: now } }] });
    const into = s.into(); s.versionCard(into); const c = into.kids[0];
    await tick(); await tick();
    const f = face(c);
    ok('available: "Update to 1.6.0 available" in the warn tone', f.line === 'Update to 1.6.0 available' && f.tone === 'warn', JSON.stringify(f));
    ok('the check goes, and the accent button leads to the Plugins tab', !f.check && f.go && c.find('fs-ver-go').cls.has('fs-acc') && c.find('fs-ver-go').textContent === 'Update in the Plugins tab');
    c.find('fs-ver-go').click();
    ok('to the Plugins tab', s.log.went[0] === '/Plugins');
    ok('the new number carries no link', !c.find('fs-ver-state').all().some((n) => n.tagName === 'A'));
    s.answers.push({ status: 404, body: {} });
    c.find('fs-ver-news').click();
    ok('What\'s new opens that version\'s notes', s.log.windows[0].title.textContent === 'New in 1.6.0' && s.log.fetched[1].url.endsWith('/releases/tags/v1.6.0'));
    await tick(); await tick();
    ok('a release GitHub does not know yet says so', s.log.windows[0].body.textContent === 'GitHub has no release notes for this version yet.');
  }
  {
    const s = load(en, { answers: [{ body: { installed: '1.5.3', latest: null, checkedAt: null } }, { body: { installed: '1.5.3', latest: '1.5.3', checkedAt: now } }] });
    const into = s.into(); s.versionCard(into); const c = into.kids[0];
    for (let i = 0; i < 4; i++) await tick();
    ok('Unraid has not looked since it booted: the first visit looks once', s.log.fetched.length === 2 && s.log.fetched[1].method === 'POST');
    ok('with the csrf token emhttp asks for, form-encoded', s.log.fetched[1].body === 'csrf_token=tok');
    ok('then shows what it found', face(c).line === 'Up to date' && face(c).note === 'Last checked now', JSON.stringify(face(c)));
  }
  {
    const s = load(en, { answers: [{ body: { installed: '1.5.3', latest: '1.5.3', checkedAt: now } }, { status: 502, body: { error: 'Network failure' } }] });
    const into = s.into(); s.versionCard(into); const c = into.kids[0];
    await tick(); await tick();
    c.find('fs-ver-check').click(); await tick(); await tick();
    const f = face(c);
    ok('a press on the check asks Unraid to look again', s.log.fetched[1].method === 'POST');
    ok('failed: "Check failed" in the fail tone with Unraid\'s reason', f.line === 'Check failed' && f.tone === 'fail' && f.note === 'Network failure', JSON.stringify(f));
    ok('and the check stays to try again', f.check && !f.busy && !f.go);
  }
  {
    const s = load(de, { answers: [{ body: { installed: '1.5.3', latest: '1.5.3', checkedAt: now - 180 } }] });
    const into = s.into(); s.versionCard(into); const c = into.kids[0];
    await tick(); await tick();
    ok('German: "Aktuell" and "Zuletzt geprüft vor 3 Minuten"', face(c).line === 'Aktuell' && face(c).note === 'Zuletzt geprüft vor 3 Minuten', JSON.stringify(face(c)));
    ok('and the buttons in German', /Neuigkeiten$/.test(c.find('fs-ver-news').textContent) && c.find('fs-ver-check').textContent === 'Nach Updates suchen' && c.find('fs-ver-go').textContent === 'Im Plugins-Tab aktualisieren');
  }
  ok('a plugin has no update switch', !/autoUpdate|auto_update/.test(info));

  console.log('\nUnraid answers through FireSquireUpdate.php');
  ok('a GET reads, a POST checks, nothing else passes', /if \(\$fsMethod !== 'GET' && \$fsMethod !== 'POST'\)/.test(update) && /http_response_code\(405\)/.test(update));
  ok('the check is Unraid\'s own, for this plugin only', /\$fsTool = '\/usr\/local\/emhttp\/plugins\/dynamix\.plugin\.manager\/scripts\/plugin';/.test(update) && /' check ' \. escapeshellarg\(\$fsPlg\)/.test(update) && /\$fsPlg = 'firesquire\.plg';/.test(update));
  ok('it reads the installed file and the one the check left', /"\/var\/log\/plugins\/\$fsPlg"/.test(update) && /\$fsLatest = "\/tmp\/plugins\/\$fsPlg";/.test(update) && /filemtime\(\$fsLatest\)/.test(update));

  console.log('\nThe release notes window');
  {
    const s = load(de, { ver: 'dev', answers: [{ body: { installed: '1.5.3', latest: '1.5.3', checkedAt: now } }, { body: { tag_name: 'v1.5.3', body: '' } }] });
    ok('a build without a release reads the latest notes', s.notesSource('dev').api === 'https://api.github.com/repos/junkerderprovinz/firesquire/releases/latest' && s.notesSource('dev').ver === '');
    const into = s.into(); s.versionCard(into); await tick(); await tick();
    into.kids[0].find('fs-ver-news').click();
    const w = s.log.windows[0];
    ok('its window starts as Neuigkeiten', w.title.textContent === 'Neuigkeiten');
    await tick(); await tick();
    ok('and takes the latest release\'s number once it is known', w.title.textContent === 'Neu in 1.5.3');
    ok('a release without notes says so, in German', w.body.textContent === 'Zu dieser Version gibt es keine Versionshinweise.');
    const card = new N('div');
    s.notesDom('<script>alert(1)</script>\n\n[page](https://example.org) and [trap](javascript:alert(2))\n\n```\n<b>raw</b>\n```', card);
    ok('markup in a release body stays text', !card.all().some((n) => /SCRIPT|^B$/.test(n.tagName)) && card.kids[0].textContent === '<script>alert(1)</script>');
    const links = card.all().filter((n) => n.tagName === 'A');
    ok('only an http link becomes an anchor, in a new tab', links.length === 1 && links[0].href === 'https://example.org' && links[0].target === '_blank');
    ok('no notes function writes innerHTML', !/innerHTML/.test(['openNotes', 'notesInline', 'notesDom'].map((n) => grabFn(info, n)).join('')));
    ok('the window is wide enough to read', /\.fs-win\.fs-win-notes \{ width: min\(760px, calc\(100vw - 32px\)\); \}/.test(read('firesquire-info.css')));
  }

  console.log('\nThe Components card');
  {
    const s = load(en);
    const into = s.into(); s.componentsCard(into); const c = into.kids[0];
    const rows = c.all().filter((n) => n.cls.has('fs-ver-row'));
    ok('ParleyPort\'s helpers first, GlimStone last', rows.map((r) => r.find('fs-ver-part').textContent).join() === 'ParleyPort,GlimStone');
    ok('the helpers show the version the plugin brings, opening ParleyPort\'s newest release', rows[0].kids[1].textContent === '1.3.1' && rows[0].kids[1].href === 'https://github.com/junkerderprovinz/parleyport/releases/latest');
    ok('GlimStone shows 4.8.2 and opens its newest release', rows[1].kids[1].textContent === '4.8.2' && rows[1].kids[1].href === 'https://github.com/junkerderprovinz/glimstone/releases/latest');
    ok('what each is stands in its (i), never under its name', rows[0].find('fs-info').getAttribute('data-tip') === en.comp_helpers && rows[1].find('fs-info').getAttribute('data-tip') === 'Design system');
    ok('the card is Components', c.find('fs-h').kids[0].textContent === 'Components');
    const bare = load(en, { helpers: null });
    const into2 = bare.into(); bare.componentsCard(into2);
    ok('without the helpers, only GlimStone', into2.kids[0].all().filter((n) => n.cls.has('fs-ver-row')).length === 1);
    ok('and no switch, since everything ships with the plugin', !/comp_update|comp_auto/.test(info));
  }
  ok('the page reads the helpers\' version from the installed plugin file', /<!ENTITY\\s\+helperVer\\s\+"\(\[\^"\]\+\)"\//.test(page) && /data-fs-helpers="/.test(page));

  done();
})();
