// FireSquire's motion rides GlimStone's engine as TowerTorch stamps it: every level answers every
// dial, the motion lives inside the reduced-motion gate, no rule names a lively level, and every
// transform keyframe comes to rest at transform: none.
const { read, ok, done, rules, keyframes } = require('./lib');

const sheets = ['firesquire.css', 'firesquire-info.css'];
const all = sheets.map(read).join('\n');
const css = rules(all);
const NO_PREF = (r) => r.at.some((a) => /prefers-reduced-motion:\s*no-preference/.test(a));

console.log('\nEvery level answers every dial');
const blocks = css.filter((r) => /^html(\[data-cc-motion="(subtle|off)"\])?$/.test(r.selector) && /--fs-motion-/.test(r.body));
const dials = (r) => [...r.body.matchAll(/(--fs-motion-[\w-]+)\s*:/g)].map((m) => m[1]).sort().join(',');
const still = blocks.find((r) => r.selector === 'html' && !NO_PREF(r));
ok('the still numbers stand outside the gate', !!still);
for (const sel of ['html', 'html[data-cc-motion="subtle"]', 'html[data-cc-motion="off"]']) {
  const b = blocks.find((r) => r.selector === sel && NO_PREF(r));
  ok(`${sel} sets every dial`, b && dials(b) === dials(still), b ? dials(b) : 'missing');
}

console.log('\nThe motion lives inside the gate');
const moving = css.filter((r) => /(^|;)\s*(animation|transition)\s*:/.test(r.body) && !/(^|;)\s*(animation|transition)\s*:\s*none\b/.test(r.body));
const loose = moving.filter((r) => !NO_PREF(r));
ok('every animation and transition is gated', loose.length === 0, loose.map((r) => r.selector).join(' | '));

console.log('\nNo rule names a lively level');
ok('nothing keys on wild', !/data-cc-motion="wild"/.test(all));

console.log('\nA transform keyframe rests at none');
for (const [name, body] of Object.entries(keyframes(all))) {
  if (!/transform\s*:/.test(body)) continue;
  const last = body.slice(body.lastIndexOf('{'));
  ok(`${name} ends at transform: none`, /transform\s*:\s*none/.test(last) || /0%\s*,\s*100%|100%\s*,\s*0%/.test(body), last.trim());
}

done();
