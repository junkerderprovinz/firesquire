// The Version card shows every version without its "v" and links each one to its own release.
// With TowerTorch it also names the GlimStone release the page is drawn in and offers the
// release notes, a secondary button with the information glyph. A version is a plain link in the
// page's link style, never a badge.
const { read, ok, done, grabFn, rules } = require('./lib');

const info = read('firesquire-info.js');
const el = (tag, cls, text) => ({ tagName: tag.toUpperCase(), className: cls, textContent: text == null ? '' : String(text) });
const blank = (a) => a;
const version = new Function('el', 'blank', grabFn(info, 'release') + '\n' + grabFn(info, 'version') + '\nreturn version;')(el, blank);

console.log('\nA version reads without its v');
const v = version('v3.0.3', 'R');
ok('a release is a link', v.tagName === 'A');
ok('it shows the number alone', v.textContent === '3.0.3', v.textContent);
ok('it leads to its tag', v.href === 'R/releases/tag/v3.0.3', v.href);
ok('a number without a v is not given one twice', version('3.0.3', 'R').href === 'R/releases/tag/v3.0.3');
ok('a release candidate links to its own tag', version('3.1.0-rc1', 'R').href === 'R/releases/tag/v3.1.0-rc1');
const dev = version('dev', 'R');
ok('a build without a release has no link', dev.tagName === 'SPAN' && dev.textContent === 'dev');
ok('an empty version shows a question mark', version('', 'R').textContent === '?');
ok('a version with anything after the number gets no link', version('3.1.0"><img src=x>', 'R').tagName === 'SPAN');

console.log('\nThe card under TowerTorch');
ok('GlimStone is the release the plugin ports', /var GLS_VER = "4\.4\.0";/.test(info)
  && JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'glimstone.json'), 'utf8')).targets[0].version === '4.4.0');
ok('GlimStone links to its own repository', /version\(GLS_VER, GLS_REPO\)/.test(info) && /var GLS_REPO = "https:\/\/github\.com\/junkerderprovinz\/glimstone";/.test(info));
ok('the release notes wear the information glyph', /UI\.button\(null, "Info", t\("rel_notes"\), "a"\)/.test(info));
ok('the release notes link to the release the card links to', /var rel = release\(ver\);\s*notes\.href = REPO \+ \(rel \? "\/releases\/tag\/v" \+ rel : "\/releases"\);/.test(info));
ok('no version anywhere is printed with a v', !/"v" \+ v\b|'v' \+ v\b/.test(info + read('firesquire.js')));

console.log('\nEvery version is a plain link, in both looks');
const css = rules(read('firesquire-info.css'));
const ver = css.filter((r) => /a\.fs-ver/.test(r.selector));
ok('no badge: no fill, no padding, no rounding', !ver.some((r) => /background|padding|border-radius|height/.test(r.body)), ver.map((r) => r.selector + ' { ' + r.body + ' }').join(' | '));
ok('in the page\'s link colour', ver.some((r) => r.selector === '#fs-info a.fs-ver' && /color: var\(--fs-link\)/.test(r.body)));
ok('the link colour is Unraid\'s, and TowerTorch\'s accent in its look', /--fs-link: var\(--link-text-color/.test(read('firesquire.css')) && /--fs-link: var\(--tt-accent-ink/.test(read('firesquire.css')));
ok('underlined under the pointer', ver.some((r) => /a\.fs-ver:hover/.test(r.selector) && /text-decoration: underline/.test(r.body)));
ok('with the house focus ring, past TowerTorch\'s sheets', ver.some((r) => /a\.fs-ver:focus-visible/.test(r.selector) && r.at.some((a) => /@layer/.test(a)) && /outline: 2px solid var\(--fs-focus\) !important/.test(r.body)));
ok('and never forced into the text colour', !ver.some((r) => /--tt-text/.test(r.body)));

done();
