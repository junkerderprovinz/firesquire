// The Version card shows every version without its "v" and links each one to its own release.
// With TowerTorch it also names the GlimStone release the page is drawn in and offers the
// release notes, a secondary button with the information glyph.
const { read, ok, done, grabFn } = require('./lib');

const info = read('firesquire-info.js');
const el = (tag, cls, text) => ({ tagName: tag.toUpperCase(), className: cls, textContent: text == null ? '' : String(text) });
const blank = (a) => a;
const version = new Function('el', 'blank', grabFn(info, 'version') + '\nreturn version;')(el, blank);

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

console.log('\nThe card under TowerTorch');
ok('GlimStone is 3.8.0', /var GLS_VER = "3\.8\.0";/.test(info));
ok('GlimStone links to its own repository', /version\(GLS_VER, GLS_REPO\)/.test(info) && /var GLS_REPO = "https:\/\/github\.com\/junkerderprovinz\/glimstone";/.test(info));
ok('the release notes wear the information glyph', /UI\.button\(null, "Info", t\("rel_notes"\), "a"\)/.test(info));
ok('no version anywhere is printed with a v', !/"v" \+ v\b|'v' \+ v\b/.test(info + read('firesquire.js')));

done();
