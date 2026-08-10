/**
 * Generates FireSquire assets from the three logo masters in this folder:
 *   firesquire-dunkel.svg  (dark ring)   -> light surfaces
 *   firesquire-hell.svg    (white ring)   -> dark surfaces
 *   firesquire-unraid.svg  (double ring)  -> the Unraid plugin tile (reads on any theme)
 *   logo.svg = a copy of the dunkel master (kept for README/CA references).
 *
 * Outputs:
 *   icon.png             : CA icon — dunkel logo on a WHITE 512 tile (stands out on the dark CA page)
 *   banner.png/.svg      : white 1600x500, dunkel logo + "FireSquire" (Bree Serif) + claim (Lato)  [README light]
 *   banner-dark.png/.svg : dark 1600x500, hell logo + wordmark                                       [README <picture> dark]
 *   banner-logo.png/.svg : white 1600x500, dunkel logo only, NO text                                 [support thread]
 *   ../../src/.../firesquire/{images,icons}/firesquire.png + firesquire.png (root):
 *                          the unraid (flip-compatible) variant, transparent 512  [Plugins tile + menu icon + modal]
 *
 * viewBox-agnostic: every embed reads the master's OWN viewBox (the masters differ:
 * dunkel/hell are 955.7x953.78, unraid is 1000x1000). Fonts (OFL) are fetched to the OS
 * temp dir at runtime, NOT committed. Deps (global): @resvg/resvg-js, opentype.js.
 *
 * Run: node .github/assets/render-assets.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const gRoot = execSync('npm root -g').toString().trim();
const { Resvg } = require(`${gRoot}/@resvg/resvg-js`);
const opentype = require(`${gRoot}/opentype.js`);
const here = (p) => new URL(p, import.meta.url);

// ---- content + styling ------------------------------------------------------
const NAME = 'FireSquire';
const CLAIM = 'Reads the beacon before your reboot catches fire.';
const W = 1600, H = 500;
const LH = 400, LW = 400;          // logo (square)
// House banner standard: name 132 / claim 44, logo-to-text gap 70, name-to-claim gap 8.
const nameSize = 132, claimSize = 44, gap = 70, lineGap = 8;
const PLUGIN = '../../src/usr/local/emhttp/plugins/firesquire/';
// Each theme embeds the logo variant that reads on its background (no recolour).
const THEMES = [
  { suffix: '', bg: '#ffffff', name: '#1f2328', claim: '#5a5d5e', logo: 'firesquire-dunkel.svg' },
  { suffix: '-dark', bg: '#0d1117', name: '#e6edf3', claim: '#9aa4ad', logo: 'firesquire-hell.svg' },
];
// -----------------------------------------------------------------------------

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
// preserving the master's OWN viewBox (never hardcode it).
function embedLogo(file, x, y, w, h) {
  const raw = readFileSync(here('./' + file), 'utf8').replace(/<\?xml[^>]*\?>\s*/, '');
  const vb = (raw.match(/viewBox="([^"]+)"/) || [, '0 0 1000 1000'])[1];
  return raw.replace(/<svg\b[^>]*>/,
    `<svg x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">`);
}
const png = (svg, size, bg) =>
  new Resvg(Buffer.from(svg), { fitTo: { mode: 'width', value: size }, background: bg || 'rgba(0,0,0,0)' }).render().asPng();

// ---- 1) CA icon: dunkel logo, white ONLY inside the dark diamond frame -----
// The diamond frame is a hollow path (no separate inner fill) — its "white"
// interior only exists because of this rect behind it. A flat rect would
// leave the 4 corners OUTSIDE the diamond opaque white too (square-looking
// tile). Flood-fill the border-connected white to transparent afterwards so
// only the disk enclosed by the frame stays opaque (jdp, 2026-08-10: "nur
// innerhalb des schwarzen Rahmens einen weißen Hintergrund").
const dunkelRaw = readFileSync(here('./firesquire-dunkel.svg'), 'utf8').replace(/<\?xml[^>]*\?>\s*/, '');
const dvb = (dunkelRaw.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/) || [, '1000', '1000']);
const iconSvg = dunkelRaw.replace(/(<svg\b[^>]*>)/, `$1<rect width="${dvb[1]}" height="${dvb[2]}" fill="#ffffff"/>`);
// No canvas-level background here — the <rect> above is the only fill; the
// canvas itself must stay transparent so the flood fill below has an outer
// boundary to work from.
const iconPngPath = here('./icon.png');
writeFileSync(iconPngPath, png(iconSvg, 512));
execSync(`python3 "${fileURLToPath(here('./flood-transparent.py'))}" "${fileURLToPath(iconPngPath)}"`);

// ---- 2) plugin tile PNGs: the flip-compatible unraid variant, transparent --
// Backs .plg <ICON> (images/), the .page Icon= menu icon (icons/), and the
// check-result modal <img> (root). Reads on every Unraid theme from one PNG.
const tile = png(readFileSync(here('./firesquire-unraid.svg'), 'utf8'), 512);
for (const rel of ['firesquire.png', 'images/firesquire.png', 'icons/firesquire.png']) {
  writeFileSync(here(PLUGIN + rel), tile);
}

// ---- 3) banners (Bree Serif name + Lato claim, text rendered to paths) -----
const bree = await getFont('FireSquire-BreeSerif-Regular.ttf',
  'https://github.com/google/fonts/raw/main/ofl/breeserif/BreeSerif-Regular.ttf');
const claimFont = await getFont('FireSquire-Lato-Regular.ttf',
  'https://github.com/google/fonts/raw/main/ofl/lato/Lato-Regular.ttf');

const nameW = bree.getAdvanceWidth(NAME, nameSize);
const claimW = claimFont.getAdvanceWidth(CLAIM, claimSize);
const groupW = LW + gap + Math.max(nameW, claimW);
const startX = 165; // left-anchored (house banner standard)
const LX = startX, LY = (H - LH) / 2;
const textX = startX + LW + gap;

const nameAsc = bree.ascender * (nameSize / bree.unitsPerEm);
const nameDesc = -bree.descender * (nameSize / bree.unitsPerEm);
const claimAsc = claimFont.ascender * (claimSize / claimFont.unitsPerEm);
const blockH = nameAsc + nameDesc + lineGap + claimAsc;
const nameBaseline = H / 2 - blockH / 2 + nameAsc;
const claimBaseline = nameBaseline + nameDesc + lineGap + claimAsc;

// opentype.js's bezier flattening can emit a NaN in a glyph's curve data at some
// specific ABSOLUTE x position (reproduced: Bree Serif's "e" is clean at x=0 but
// NaN once its cumulative advance lands past ~x=450 at this size — a float-
// precision edge case inside the library, unrelated to which text precedes it).
// Fix: always compute the path at LOCAL origin x=0 (verified NaN-free), then
// shift it into place with an SVG transform instead of feeding opentype.js the
// "poisoned" absolute coordinate.
const namePath = bree.getPath(NAME, 0, nameBaseline, nameSize).toPathData(2);
const claimPath = claimFont.getPath(CLAIM, 0, claimBaseline, claimSize).toPathData(2);
if (namePath.includes('NaN') || claimPath.includes('NaN')) {
  throw new Error('NaN in glyph path even at local origin x=0 — needs a fresh look');
}

for (const t of THEMES) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  ${embedLogo(t.logo, LX, LY, LW, LH)}
  <g transform="translate(${textX},0)">
    <path d="${namePath}" fill="${t.name}"/>
    <path d="${claimPath}" fill="${t.claim}"/>
  </g>
</svg>
`;
  writeFileSync(here(`./banner${t.suffix}.svg`), svg);
  writeFileSync(here(`./banner${t.suffix}.png`), png(svg, W, t.bg));
}

// ---- 4) text-free support-thread banner: dunkel logo centred, NO text ------
const logoLX = (W - LW) / 2, logoLY = (H - LH) / 2;
const logoOnly = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  ${embedLogo('firesquire-dunkel.svg', logoLX, logoLY, LW, LH)}
</svg>
`;
writeFileSync(here('./banner-logo.svg'), logoOnly);
writeFileSync(here('./banner-logo.png'), png(logoOnly, W, '#ffffff'));

console.log('wrote icon.png, banner{,-dark,-logo}.{svg,png}, 3 plugin tile PNGs');
