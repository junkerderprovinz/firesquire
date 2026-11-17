// Seconds read the same in every string of a language: the unit its readers expect, with or
// without a space before it as the language writes it, and never spelled out in one place and
// abbreviated in the next. The engine's English messages follow the English form.
const fs = require('fs');
const path = require('path');
const { DIR, read, ok, done } = require('./lib');

// The form of each language: what stands between the number and the unit, and the unit.
const FORM = {
  en: ' s', de: ' s', fr: ' s', es: ' s', it: ' s', pt: ' s', nl: ' s', sv: ' s', da: ' s', no: ' s', fi: ' s',
  pl: ' s', cs: ' s', ro: ' s', hu: ' mp', tr: ' sn', el: ' δ', ru: ' с', uk: ' с', he: ' ש׳', ar: ' ث',
  ja: ' 秒', zh: ' 秒', ko: '초', th: ' วินาที', vi: ' giây',
};
// Every way a number of seconds can be written in these languages, short or spelled out.
const UNIT = /\{\d\}(\s?)(seconds?|Sekunden|sekunder|seconden|segundos|secondes|secondi|sekund\w*|secunde|sekunti\w*|másodperc\w*|saniye\w*|δευτερόλεπτ\w*|секунд\w*|שניות|ثوان\w*|ثانية|s(?![\p{L}])|с(?![\p{L}])|sn(?![\p{L}])|mp(?![\p{L}])|δ(?![\p{L}])|ש׳|ث(?![\p{L}])|秒|초|วินาที|giây)/gu;

const strings = (v) => (typeof v === 'string' ? [v] : Array.isArray(v) ? v : Object.values(v));
const langDir = path.join(DIR, 'lang');
const files = fs.readdirSync(langDir).filter((f) => f.endsWith('.json'));
ok('every language has its form', files.every((f) => f.slice(0, -5) in FORM), files.filter((f) => !(f.slice(0, -5) in FORM)).join());

console.log('\nEvery language');
for (const f of files) {
  const lang = f.slice(0, -5), want = FORM[lang];
  const l = JSON.parse(fs.readFileSync(path.join(langDir, f), 'utf8'));
  const bad = [];
  let seen = 0;
  for (const [k, v] of Object.entries(l)) {
    for (const s of strings(v)) {
      for (const m of s.matchAll(UNIT)) {
        seen++;
        if (m[1] + m[2] !== want) bad.push(`${k}: "${m[0]}"`);
      }
    }
  }
  ok(`${lang} writes seconds as "{n}${want}" everywhere`, seen > 0 && bad.length === 0, bad.join(', '));
}

console.log('\nThe engine');
const engine = ['firesquire-more.sh', 'firesquire-stop.sh'].map(read).join('\n');
const shell = [...engine.matchAll(/\$\{?(\w+)\}?(\s?)(seconds?|s)\b/g)].filter((m) => /timeout|stop|vmt|now|need|suggest|shutdown|vm\b/i.test(m[1]));
ok('the English messages of the engine use the English form', shell.length > 0 && shell.every((m) => m[2] + m[3] === ' s'), shell.filter((m) => m[2] + m[3] !== ' s').map((m) => m[0]).join(', '));

done();
