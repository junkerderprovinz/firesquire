// Close, Check again and every other answer in a window's foot is a filled button under
// TowerTorch (GlimStone rules 3 and 15): without a ground of its own it reads as a word.
const { read, ok, done, rules } = require('./lib');

const js = read('firesquire.js') + read('firesquire-info.js');
const css = rules(read('firesquire.css') + read('firesquire-info.css'));
const CLEAR = /^(transparent|none|initial|unset|inherit)\b/;

console.log('\nThe buttons in a foot');
const foot = [...js.matchAll(/button\((['"])([^'"]*)\1, '?"?\w+'?"?, [^)]*\)\)?;?/g)].map((m) => m[2]);
const answers = [...js.matchAll(/(\w+) = (?:UI\.)?button\((['"])([^'"]*)\2/g)].filter((m) => /^(close|retry|copy)$/.test(m[1]));
ok('Close, Check again and Copy are window buttons', answers.length === 3 && answers.every((m) => /\bfs-win-btn\b/.test(m[3])), answers.map((m) => m[1] + ':' + m[3]).join(', '));
ok('the foot holds nothing but window buttons', foot.length > 0);

console.log('\nTheir ground under TowerTorch');
const own = css.filter((r) => /fs-win-btn/.test(r.selector));
const filled = own.filter((r) => /cc-popups-on/.test(r.selector) && !/:hover/.test(r.selector) && /(^|;)\s*background(-color)?\s*:\s*(?!transparent|none)/.test(r.body));
ok('a rule fills them', filled.length > 0);
const cleared = own.filter((r) => /(^|;)\s*background(-color)?\s*:\s*([^;]+)/.test(r.body) && CLEAR.test(r.body.match(/background(?:-color)?\s*:\s*([^;]+)/)[1].trim()));
ok('no rule clears the fill', cleared.length === 0, cleared.map((r) => r.selector).join(' | '));

done();
