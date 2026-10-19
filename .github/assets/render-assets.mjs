/**
 * Generates FireSquire assets from the logo master firesquire.svg, which reads on
 * light and dark grounds alike. firesquire-app.svg is the same logo on the house
 * app tile, used for the card in unraid-apps. logo.svg is a copy of the master.
 *
 * Outputs:
 *   icon.png             : CA icon, the logo on a transparent 512 square
 *   banner.png/.svg      : white 1600x500, logo + "FireSquire" (Bree Serif) + claim (Lato)  [README light]
 *   banner-dark.png/.svg : dark 1600x500, logo + wordmark                                   [README <picture> dark]
 *   banner-logo.png/.svg : white 1600x500, logo only, no text                               [support thread]
 *   ../../src/.../firesquire/{images,icons}/firesquire.png + firesquire.png (root):
 *                          the CA icon again                                                [Plugins tile + menu icon + modal]
 *
 * Every embed reads the master's own viewBox. Fonts (OFL) are fetched to the OS temp
 * dir at runtime, not committed. Deps (global): @resvg/resvg-js, opentype.js.
 *
 * Run: node .github/assets/render-assets.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const gRoot = execSync('npm root -g').toString().trim();
const { Resvg } = require(`${gRoot}/@resvg/resvg-js`);
const opentype = require(`${gRoot}/opentype.js`);
const here = (p) => new URL(p, import.meta.url);

const NAME = 'FireSquire';
const CLAIM = 'Reads the beacon before your reboot catches fire.';
const W = 1600, H = 500;
const LH = 400, LW = 400;          // logo (square)
// House banner standard: name 132 / claim 44, logo-to-text gap 70, name-to-claim gap 8.
const nameSize = 132, gap = 70, lineGap = 8;
const PLUGIN = '../../src/usr/local/emhttp/plugins/firesquire/';
const LOGO = 'firesquire.svg';
const THEMES = [
  { suffix: '', bg: '#ffffff', name: '#1f2328', claim: '#5a5d5e' },
  { suffix: '-dark', bg: '#0d1117', name: '#e6edf3', claim: '#9aa4ad' },
];

async function getFont(file, url) {
  const p = join(tmpdir(), file);
  if (!existsSync(p)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font fetch ${res.status} ${url}`);
    writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  }
  return opentype.parse(readFileSync(p));
}

// Embed a master verbatim at (x,y,w,h): drop the XML decl, reposition its <svg>,
// preserving the master's own viewBox (never hardcode it).
function embedLogo(file, x, y, w, h) {
  const raw = readFileSync(here('./' + file), 'utf8').replace(/<\?xml[^>]*\?>\s*/, '');
  const vb = (raw.match(/viewBox="([^"]+)"/) || [, '0 0 1000 1000'])[1];
  return raw.replace(/<svg\b[^>]*>/,
    `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">`);
}
const png = (svg, size, bg) =>
  new Resvg(Buffer.from(svg), { fitTo: { mode: 'width', value: size }, background: bg || 'rgba(0,0,0,0)' }).render().asPng();

// 1) CA icon and plugin tile: the logo centred on a transparent square.
// The tile backs .plg <ICON> (images/), the .page Icon= menu icon (icons/) and
// the check-result modal <img> (root).
const S = 512;
const icon = png(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  ${embedLogo(LOGO, 0, 0, S, S)}
</svg>`, S);
writeFileSync(here('./icon.png'), icon);
for (const rel of ['firesquire.png', 'images/firesquire.png', 'icons/firesquire.png']) {
  writeFileSync(here(PLUGIN + rel), icon);
}

// 2) Banners (Bree Serif name + Lato claim, text rendered to paths).
const bree = await getFont('FireSquire-BreeSerif-Regular.ttf',
  'https://github.com/google/fonts/raw/main/ofl/breeserif/BreeSerif-Regular.ttf');
const claimFont = await getFont('FireSquire-Lato-Regular.ttf',
  'https://github.com/google/fonts/raw/main/ofl/lato/Lato-Regular.ttf');

const startX = 165; // left-anchored (house banner standard)
const LX = startX, LY = (H - LH) / 2;
const textX = startX + LW + gap;
// A claim wider than the room left of the right margin shrinks instead of running off the edge.
const rightMargin = 120;
const claimSize = Math.min(44, 44 * (W - textX - rightMargin) / claimFont.getAdvanceWidth(CLAIM, 44));

const nameAsc = bree.ascender * (nameSize / bree.unitsPerEm);
const nameDesc = -bree.descender * (nameSize / bree.unitsPerEm);
const claimAsc = claimFont.ascender * (claimSize / claimFont.unitsPerEm);
const blockH = nameAsc + nameDesc + lineGap + claimAsc;
const nameBaseline = H / 2 - blockH / 2 + nameAsc;
const claimBaseline = nameBaseline + nameDesc + lineGap + claimAsc;

// opentype.js's bezier flattening can emit a NaN in a glyph's curve data at some
// absolute x positions (Bree Serif's "e" is clean at x=0 but NaN once its
// cumulative advance lands past ~x=450 at this size, a float-precision edge case
// inside the library). So the path is computed at local origin x=0 and shifted
// into place with an SVG transform.
const namePath = bree.getPath(NAME, 0, nameBaseline, nameSize).toPathData(2);
const claimPath = claimFont.getPath(CLAIM, 0, claimBaseline, claimSize).toPathData(2);
if (namePath.includes('NaN') || claimPath.includes('NaN')) {
  throw new Error('NaN in glyph path even at local origin x=0');
}

for (const t of THEMES) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  ${embedLogo(LOGO, LX, LY, LW, LH)}
  <g transform="translate(${textX},0)">
    <path d="${namePath}" fill="${t.name}"/>
    <path d="${claimPath}" fill="${t.claim}"/>
  </g>
</svg>
`;
  writeFileSync(here(`./banner${t.suffix}.svg`), svg);
  writeFileSync(here(`./banner${t.suffix}.png`), png(svg, W, t.bg));
}

// 3) Text-free support-thread banner: the logo centred, no text.
const logoLX = (W - LW) / 2, logoLY = (H - LH) / 2;
const logoOnly = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  ${embedLogo(LOGO, logoLX, logoLY, LW, LH)}
</svg>
`;
writeFileSync(here('./banner-logo.svg'), logoOnly);
writeFileSync(here('./banner-logo.png'), png(logoOnly, W, '#ffffff'));

console.log('wrote icon.png, banner{,-dark,-logo}.{svg,png}, 3 plugin tile PNGs');
