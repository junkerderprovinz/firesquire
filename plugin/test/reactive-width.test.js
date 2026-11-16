// In TowerTorch's reactive label mode a button keeps the width it has with glyph and words, and the
// words open inside it, as GlimStone's reactive buttons keep their width stage. A button that grew
// under the pointer could move away from it in a row that wraps, close and come back.
const { read, ok, done, rules, grabFn } = require('./lib');

const css = read('firesquire.css');
const all = rules(css);
const js = read('firesquire.js');
const plain = css.replace(/\/\*[\s\S]*?\*\//g, '');

console.log('\nThe sheet holds the measured width');
ok('a reactive button is at least as wide as with its words', /html\.tt-popups-on\[data-tt-labels-buttons="reactive"\] \.fs-btn \{ min-width: var\(--fs-btn-w, auto\); \}/.test(css));
ok('one that its words widened rests with its glyph in the middle', /html\.tt-popups-on\[data-tt-labels-buttons="reactive"\] \.fs-btn\[data-fs-fit\] \{ justify-content: center; \}/.test(css));
ok('measuring shows the words as the pointer would, without a transition',
  /html\.tt-popups-on\[data-tt-labels-buttons="reactive"\] \.fs-btn\[data-fs-measure\] \{ gap: \.45em; \}/.test(css)
  && /html\.tt-popups-on\[data-tt-labels-buttons="reactive"\] \.fs-btn\[data-fs-measure\] \.fs-btn-l \{ max-width: 16em; opacity: 1; \}/.test(css)
  && /html\.tt-popups-on \.fs-btn\[data-fs-still\], html\.tt-popups-on \.fs-btn\[data-fs-still\] \* \{ transition: none !important; \}/.test(css));
ok('nothing changes a button\'s width under the pointer', !/:hover[^{]*\{[^}]*(?<![-\w])width:/.test(plain), all.filter((r) => /:hover/.test(r.selector) && /(?<![-\w])width:/.test(r.body)).map((r) => r.selector).join(' | '));
ok('and no button animates its width', !all.some((r) => /\.fs-btn|#ss-reboot-btn/.test(r.selector) && /transition:[^;]*(?<![-\w])width\b/.test(r.body)));

console.log('\nThe Main tab\'s button rests at its measured width beside Unraid\'s');
{
  const rest = all.find((r) => r.selector.includes('[data-tt-labels-buttons="reactive"] #ss-reboot-btn:not([data-fs-measure])') && r.at.some((a) => /@layer/.test(a)));
  ok('reactive keeps the width it has with its words', !!rest && /width: var\(--fs-btn-w, var\(--tt-lgb-h, 36px\)\) !important/.test(rest.body), rest && rest.body);
  const glyph = all.find((r) => r.selector === 'html.tt-popups-on[data-tt-labels-buttons="glyph"] #ss-reboot-btn' && r.at.some((a) => /@layer/.test(a)));
  ok('glyph mode keeps its square', !!glyph && /width: var\(--tt-lgb-h, 36px\) !important/.test(glyph.body), glyph && glyph.body);
}

console.log('\nThe measurement');
{
  const holdWidth = new Function('getComputedStyle', grabFn(js, 'holdWidth') + '\nreturn holdWidth;');
  const button = ({ open, rest, shown = true, sizing = 'content-box' }) => {
    const attrs = {}, props = {}, seen = [];
    return {
      attrs, props, seen, isConnected: true,
      getClientRects: () => (shown ? [{}] : []),
      setAttribute(k, v) { attrs[k] = v; if (k === 'data-fs-measure') seen.push('measure'); },
      removeAttribute(k) { delete attrs[k]; },
      hasAttribute(k) { return k in attrs; },
      get offsetWidth() { return 'data-fs-measure' in attrs ? open : rest; },
      style: { setProperty(k, v) { props[k] = v; }, removeProperty(k) { delete props[k]; }, getPropertyValue(k) { return props[k] || ''; } },
      cs: { boxSizing: sizing, paddingLeft: '10px', paddingRight: '10px', borderLeftWidth: '1px', borderRightWidth: '1px' },
    };
  };
  const run = (b, reactive) => { holdWidth((el) => el.cs)(b, reactive); return b; };
  let b = run(button({ open: 120.4, rest: 34 }), true);
  ok('it measures the button with its words open, less its resting padding and border', b.props['--fs-btn-w'] === '99px', JSON.stringify(b.props));
  ok('marks a button its words widened', 'data-fs-fit' in b.attrs);
  ok('and leaves no measuring or still mark behind', !('data-fs-measure' in b.attrs) && !('data-fs-still' in b.attrs), JSON.stringify(b.attrs));
  b = run(button({ open: 120, rest: 34, sizing: 'border-box' }), true);
  ok('a border box keeps its full width', b.props['--fs-btn-w'] === '120px');
  b = run(button({ open: 120, rest: 34, shown: false }), true);
  ok('a button that is not shown waits until it is', !('--fs-btn-w' in b.props) && b.seen.length === 0);
  b = button({ open: 120, rest: 34 }); b.props['--fs-btn-w'] = '99px'; b.attrs['data-fs-fit'] = '';
  run(b, false);
  ok('outside reactive the width and the mark go', !('--fs-btn-w' in b.props) && !('data-fs-fit' in b.attrs));
  const make = grabFn(js, 'button');
  ok('every button is watched from the start, so it is measured once it is shown', /holdOn\(b\)/.test(make));
  ok('a change of mode, of caption or of the fonts measures again',
    /new MutationObserver\(function \(\) \{ labelTips\(\); holdAll\(\); \}\)\.observe\(html/.test(js) && /characterData: true/.test(grabFn(js, 'holdOn')) && /document\.fonts\.addEventListener\('loadingdone', holdAll\)/.test(js));
}

done();
