// On a phone the room the wider layouts keep for the banner's silhouette would leave the name two
// letters, so there the text runs over the silhouette, which sits behind it.
const { read, ok, done, rules } = require('./lib');

const page = read('FireSquireTools.page');
const css = rules((page.match(/<style>([\s\S]*?)<\/style>/g) || []).join('\n').replace(/<\/?style>/g, ''));
const at = (r, q) => r.at.some((a) => a.replace(/\s+/g, ' ') === q);
const narrow = css.findIndex((r) => r.selector === '.fs-hero-text' && at(r, '@media (max-width: 1023px)'));
const phone = css.findIndex((r) => r.selector === '.fs-hero-text' && at(r, '@media (max-width: 599px)'));

console.log('\nThe banner on a phone');
ok('a phone keeps the whole width for the name', phone > narrow && narrow >= 0 && /max-width:\s*none/.test(css[phone].body), phone >= 0 ? css[phone].body : 'no phone rule');

done();
