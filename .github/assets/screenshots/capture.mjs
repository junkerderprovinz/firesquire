// Takes the raw pictures for the README screenshots from a running Unraid server with TowerTorch
// installed, so the report and the settings page wear GlimStone's look. FireSquire itself comes
// from this checkout: every file under /plugins/firesquire/ is served from src/, and the
// settings page's markup is cut from FireSquireTools.page. The check never runs. The report
// endpoints are answered with the made-up reports below. render.mjs frames the pictures.
//
// The server is only read. Every request other than a GET is dropped, apart from the login form,
// and the look (accent, header, motion) is handed to the page in TowerTorch's settings response
// and never written back. The windows are opened by calling FireSquire's own run(), so no
// button on the server that could reboot it is ever pressed.
//
// Unraid prints its text in the server's language. TowerTorch follows the lang attribute,
// Unraid's scripts get an English translate.js, FireSquire gets lang/en.json, and what PHP
// printed is mapped back through the server's own language files.
//
// SHOT_DENY takes comma-separated words that must not show on a page. Hits are printed and the
// picture is still taken, so it can be checked.
//
// Deps (global): playwright-core with its Chromium installed.
// Run: UNRAID_URL=https://<server> UNRAID_PW=<root password> node .github/assets/screenshots/capture.mjs [shot...]

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require(`${execSync("npm root -g").toString().trim()}/playwright-core`);

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const web = join(repo, "src", "usr", "local", "emhttp", "plugins", "firesquire");
const out = join(here, "captures");
const BASE = (process.env.UNRAID_URL || "").replace(/\/+$/, "");
const USER = process.env.UNRAID_USER || "root";
const PASSWORD = process.env.UNRAID_PW;
if (!BASE || !PASSWORD) throw new Error("set UNRAID_URL and UNRAID_PW");
const DENY = (process.env.SHOT_DENY || "").split(",").map((w) => w.trim()).filter(Boolean);
const CHOSEN = process.argv.slice(2);

const VIEW = { width: 1280, height: 800 };
const DEMO_NAME = "Tower";
const DEMO_DESCRIPTION = "Media server";
const VERSION = process.env.FS_VERSION ||
  /<!ENTITY\s+version\s+"([^"]+)"/.exec(readFileSync(join(repo, "plugin", "firesquire.plg"), "utf8"))[1];
const ENGLISH_UI = readFileSync(join(web, "lang", "en.json"), "utf8");

const SETTINGS = /\/plugins\/towertorch\/server\/ttapi\.php\?path=config(&|$)/;
// The house accent, the name in the header without the server's own picture, and still motion,
// so the beacon stands where the picture is taken.
const LOOK = {
  "tt.theming": "1",
  "tt.accent": "#FCC419",
  "tt.rainbow": "0",
  "tt.flagmode": "0",
  "tt.anim": "off",
  "tt.brand.logo": "0",
  "tt.brand.color": "#FCC419",
  "tt.diskview": "tiles",
  "tt.enable.header": "1",
  "tt.enable.main": "1",
  "tt.enable.settings": "1",
};

const pass = (key, ...args) => ({ status: "pass", key, args });
const warn = (key, ...args) => ({ status: "warn", key, args });
const fail = (key, ...args) => ({ status: "fail", key, args });

// The made-up reports, in the order the engine lists its checks. A disk carries its port the way
// the engine prints it from /dev/disk/by-path.
const REPORTS = {
  smouldering: {
    verdict: "CAUTION",
    checks: [
      pass("array_ok"),
      pass("array_op_ok"),
      pass("smart_ok", "6"),
      warn("crc_rose", "sdd [pci-0000:00:17.0-ata-4]", "2", "14"),
      warn("timeouts_short", "90", "120", "60", "180"),
      warn("share_open", "SMB", "documents", "Office-PC", "1"),
      warn("ups_battery", "64", "23"),
      warn("flash_backup_old", "12", "Unraid Connect"),
    ],
  },
  fire: {
    verdict: "NO-GO",
    checks: [
      pass("array_ok"),
      fail("array_op_running", "check P"),
      fail("zfs_degraded", "cache", "DEGRADED"),
      pass("flash_ok"),
      warn("vms_running", "2"),
      pass("smart_ok", "6"),
      warn("share_writing", "NFS", "backups", "media-box", "5"),
      pass("ups_ok", "100"),
    ],
  },
  guard: {
    verdict: "CAUTION",
    checks: [
      pass("array_ok"),
      pass("array_op_ok"),
      pass("mover_ok"),
      warn("vms_running", "1"),
      warn("timeouts_container", "Nextcloud, Immich", "10", "2"),
      warn("share_open", "SMB", "photos", "Laptop", "2"),
      pass("flash_backup_ok", "2", "Unraid Connect"),
    ],
  },
};

// The Dashboard's clock at a working hour, and the server tile without the make of the
// server's processor.
async function dashboard(page) {
  await page.evaluate(() => {
    for (const id of ["current_time", "current_time_"]) {
      const n = document.getElementById(id);
      if (n) n.textContent = "9:41";
    }
    const walker = document.createTreeWalker(document.getElementById("displaybox"), NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (/\b(Intel|AMD|Ryzen|Xeon|EPYC)\b/.test(n.nodeValue)) n.nodeValue = "";
    }
  });
}

// TowerTorch pins the menu while the page scrolls, and a scrolled picture would show the page
// running under it.
async function unpin(page) {
  await page.addStyleTag({ content: "#menu { position: static !important; }" });
}

// What each picture shows. open runs once the page has settled, and a shot with hover keeps the
// pointer where open left it.
const SHOTS = [
  {
    name: "report",
    path: "/Dashboard",
    open: async (page) => { await page.locator("#ss-dash-icon").click(); },
    report: "smouldering",
  },
  {
    name: "fire",
    path: "/Settings/FireSquireTools",
    open: async (page) => { await page.locator(".fs-card-tools .fs-btn").click(); },
    report: "fire",
  },
  {
    name: "guard",
    path: "/Main",
    open: async (page) => { await page.evaluate(() => window.firesquireRun(null, { cmd: "reboot", proceed() {} })); },
    report: "guard",
  },
  {
    name: "button",
    path: "/Main",
    hover: true,
    // The server's boot device reads as unmountable to the array, which puts a notice and the
    // Format row into the array's column. A demo server has neither. Between the array's disks
    // and its operations only sections would stand that need a POST to fill in, and they would
    // say they failed.
    open: async (page) => {
      await unpin(page);
      await page.evaluate(() => {
        const sections = [...document.querySelectorAll("#displaybox section.tab-content")];
        for (const sec of sections.slice(1)) if (!sec.querySelector("form[name=arrayOps]")) sec.remove();
        const form = document.forms.arrayOps;
        const rows = form ? [...form.querySelectorAll("tr")] : [];
        for (const tr of rows) {
          const odd = /einhängbar|unmountable/i.test(tr.textContent) || tr.querySelector("#btnFormat");
          if (odd && ![...tr.querySelectorAll("tr")].some((inner) => rows.includes(inner))) tr.remove();
        }
        scrollTo(0, document.documentElement.scrollHeight);
      });
      await page.locator("#ss-reboot-btn").hover();
    },
  },
  {
    name: "dashboard",
    path: "/Dashboard",
    hover: true,
    open: async (page) => { await page.locator("#ss-dash-icon").hover(); },
  },
  { name: "settings", path: "/Settings/FireSquireTools" },
  {
    name: "settings-info",
    path: "/Settings/FireSquireTools",
    open: async (page) => {
      await unpin(page);
      await page.locator("#fs-info > .fs-card:not(.fs-card-tools)").first().evaluate((c) => {
        c.style.scrollMarginTop = "28px";
        c.scrollIntoView({ block: "start" });
      });
    },
  },
];

// The stream FireSquireStream.php sends: the progress markers, then the report as its last line.
function stream(report) {
  const json = JSON.stringify({ verdict: report.verdict, worst: { GO: 0, CAUTION: 1, "NO-GO": 2 }[report.verdict], generated: "2026-11-12 09:41:00",
    checks: report.checks.map((c) => ({ tier: "warning", id: c.key, message: "", ...c })) });
  return ["@@FSP 40 p_array", "@@FSP 80 p_shares", "@@FSP 100 p_done", json, ""].join("\n");
}

// FireSquireTools.page as PHP would print it on a server without ParleyPort's helpers: the PHP
// blocks and the fortress and notification parts gone, the version from the plugin file and
// every autov() a plain address.
function settingsMarkup() {
  const page = readFileSync(join(web, "FireSquireTools.page"), "utf8").replace(/\r\n/g, "\n");
  return page.slice(page.indexOf("\n---\n") + 5)
    .replace(/<\?php[\s\S]*?\?>/g, "")
    .replace(/<\?if \(\$fs\w+\):\?>[\s\S]*?<\?endif;\?>\n?/g, "")
    .replace(/<\?=\$fs\w+ \?[^>]*\?>/g, "")
    .replace(/<\?=\s*htmlspecialchars\(\$fsVer[^?]*\?>/g, VERSION)
    .replace(/<\?autov\('([^']+)'\)\?>/g, "$1");
}

// The page's own copy of FireSquireTools.page, from its <style> to the end of the content.
function spliceSettings(html) {
  const mark = html.indexOf("plugins/firesquire/FireSquireTools.page");
  if (mark < 0) return html;
  const start = html.indexOf("<style>", mark);
  const end = html.lastIndexOf("</div>", html.lastIndexOf("</div>", html.indexOf('<footer id="footer"', mark)) - 1);
  return html.slice(0, start) + settingsMarkup() + "\n" + html.slice(end);
}

const TYPES = { ".js": "application/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };

// The language files whose strings show on these pages. Unraid has no listing of the folder.
const LANG_FILES = ["translations", "main", "dashboard", "settings", "tools", "javascript"];

// Words the language files lack, give for more than one English key, or that plugins print on
// their own. These win over the files.
const ENGLISH = {
  "Gestoppt": "Stopped",
  "Gestartet": "Started",
  "Array gestartet": "Array Started",
  "nicht verfügbar": "not available",
  "Keine": "None",
  "Legende": "Legend",
  "Arbeitsspeicher": "Memory",
  "Verwendbar": "Usable",
  "Maximal": "Maximum",
  "Frei": "Free",
  "Gesamt Stromversorgung": "Total Power",
  "Montag": "Monday", "Dienstag": "Tuesday", "Mittwoch": "Wednesday", "Donnerstag": "Thursday", "Freitag": "Friday",
  "Samstag": "Saturday", "Sonntag": "Sunday",
  "zwei": "two", "drei": "three", "vier": "four", "fünf": "five", "sechs": "six",
};
const NAV = { "/Dashboard": "Dashboard", "/Main": "Main", "/Shares": "Shares", "/Users": "Users", "/Settings": "Settings",
  "/Plugins": "Plugins", "/Docker": "Docker", "/VMs": "VMs", "/Apps": "Apps", "/Tools": "Tools", "/Stats": "Stats", "/Favorites": "Favorites" };

function parseLang(text) {
  const pairs = [];
  let help = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^:\w+:$/.test(line)) { help = line !== ":end"; continue; }
    if (help || !line || line.startsWith(";")) continue;
    const at = line.indexOf("=");
    if (at > 0) pairs.push([line.slice(0, at).trim(), line.slice(at + 1).trim()]);
  }
  return pairs;
}

// The server's language back to English. A value that is also its own key stays as it is,
// otherwise the first file to name it wins. Strings with a %s placeholder become patterns.
async function englishMap(ctx, locale) {
  const back = {};
  const patterns = [];
  for (const file of LANG_FILES) {
    const res = await ctx.request.get(`${BASE}/languages/${locale}/${file}.txt`);
    if (!res.ok()) continue;
    for (const [en, local] of parseLang(await res.text())) {
      if (local.length < 2 || /[<*]/.test(local) || /^\d+$/.test(local)) continue;
      if (local.includes("%s")) {
        const literal = local.replace(/%s/g, "").trim();
        const source = local.split("%s").map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.+?)");
        if (literal.length >= 4) patterns.push([`^${source}$`, en]);
        continue;
      }
      if (!(local in back) || en === local) back[local] = en;
    }
  }
  return { exact: Object.assign(back, ENGLISH), patterns };
}

// One scrubber for every text the page receives and everything it shows: the server's name and
// description, private addresses, MAC addresses, disk serial numbers and the license fields of
// Unraid's server state.
function scrubber(server) {
  const serials = new Map();
  const fake = (real) => {
    if (!serials.has(real)) {
      let h = 0;
      for (const c of real) h = (h * 31 + c.charCodeAt(0)) >>> 0;
      const pool = /^\d+$/.test(real) ? "0123456789" : "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
      let s = "";
      for (let i = 0; i < real.length; i++) { h = (h * 1103515245 + 12345) >>> 0; s += pool[h % pool.length]; }
      serials.set(real, s);
    }
    return serials.get(real);
  };
  const words = [[server.name, DEMO_NAME], [server.description, DEMO_DESCRIPTION]].filter(([w]) => w && w.length > 2);
  const edges = (w) => new RegExp(`(?<![\\w-])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`, "g");
  const swaps = [];
  for (const [w, demo] of words) {
    swaps.push([edges(w), demo], [edges(w.toLowerCase()), demo.toLowerCase()], [edges(w.toUpperCase()), demo.toUpperCase()]);
  }
  const fn = (text) => {
    let t = text;
    t = t.replace(/((?:&quot;|")(?:guid|regGuid|flashGuid|keyfile|regTo|email|site|wanFQDN)(?:&quot;|"):(?:&quot;|"))(.*?)((?:&quot;|"))/g, "$1$3");
    for (const [re, demo] of swaps) t = t.replace(re, demo);
    t = t.replace(/(?<![\d.])(10|100|172|192)\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?![\d.])/g, (all, a, b, c, d) => {
      const priv = a === "10" || (a === "172" && b >= 16 && b <= 31) || (a === "192" && b === "168") || (a === "100" && b >= 64 && b <= 127);
      return priv ? `192.168.1.${d}` : all;
    });
    t = t.replace(/\bbr0\.\d+\b/g, "br0");
    t = t.replace(/\b([0-9a-f]{2}:){5}[0-9a-f]{2}\b/gi, (m) => `52:54:00:${fake(m).slice(0, 6).replace(/(..)(?=.)/g, "$1:").toLowerCase()}`);
    t = t.replace(/\b([A-Za-z][A-Za-z0-9.-]*(?:_[A-Za-z0-9.-]+)*)_((?=[A-Z]*\d)[A-Z0-9]{8,24})(?=\b|-0:0)/g, (m, model, serial) => `${model}_${fake(serial)}`);
    t = t.replace(/\b0x5[0-9a-f]{15}\b/g, (m) => `0x5000c500${fake(m).slice(0, 7).toLowerCase().replace(/[^0-9a-f]/g, "a")}`);
    t = t.replace(/\beui\.[0-9a-f]{16}\b/g, (m) => `eui.0025385${fake(m).slice(0, 9).toLowerCase().replace(/[^0-9a-f]/g, "b")}`);
    for (const [real, demo] of serials) t = t.split(real).join(demo);
    return t;
  };
  fn.serials = serials;
  return fn;
}

async function login(page) {
  await page.goto(`${BASE}/login`, { timeout: 120000 });
  await page.fill("input[name=username]", USER);
  await page.fill("input[name=password]", PASSWORD);
  await Promise.all([
    page.waitForURL((u) => !/login/.test(String(u)), { waitUntil: "commit", timeout: 60000 }),
    page.click("button[type=submit], input[type=submit]"),
  ]);
}

// Runs in the page: puts the English and the demo names into every text node and every attribute
// a tooltip reads. The scrubbing itself happens in Node through shotScrub, the same function the
// responses went through.
async function curate({ english, nav }) {
  for (const a of document.querySelectorAll("a[href]")) {
    const label = nav[new URL(a.href, location.href).pathname];
    if (!label || a.closest("#displaybox")) continue;
    const walker = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeValue.trim()) { n.nodeValue = n.nodeValue.replace(/\S(.*\S)?/s, label); break; }
    }
  }
  const exact = english.exact;
  const patterns = english.patterns.map(([re, en]) => [new RegExp(re), en]);
  const word = (core) => {
    if (exact[core]) return exact[core];
    const dots = /^(.*?)(\.\.\.|…)$/.exec(core);
    if (dots && exact[dots[1]]) return exact[dots[1]] + dots[2];
    const counted = /^(.+?) (\d+)$/.exec(core);
    if (counted && exact[counted[1]]) return exact[counted[1]] + " " + counted[2];
    // "Frei: 10.0 GiB" and "Donnerstag, 12.11.2026": a word in front of a value.
    const lead = /^([^:,]+)([:,] .+)$/.exec(core);
    if (lead && exact[lead[1]]) return exact[lead[1]] + lead[2];
    for (const [re, en] of patterns) {
      const hit = re.exec(core);
      if (!hit) continue;
      const parts = hit.slice(1).map((p) => exact[p] || p);
      return en.replace(/%s/g, () => parts.shift());
    }
    return null;
  };
  const translate = (s) => {
    const m = /^(\s*\(?)(.*?)([):.…]*\s*)$/s.exec(s);
    if (!m || !m[2]) return s;
    const unit = (en) => (x, n) => n + " " + en + (n === "1" ? "" : "s");
    const core = m[2]
      .replace(/\b(\d+) Tage?n?\b/g, unit("day"))
      .replace(/\b(\d+) Stunden?\b/g, unit("hour"))
      .replace(/\b(\d+) Minuten?\b/g, unit("minute"))
      .replace(/\b(\d+) Sekunden?\b/g, unit("second"));
    return m[1] + (word(core) || core) + m[3];
  };
  const ATTRS = ["title", "alt", "placeholder", "aria-label", "data-tip", "data-tt-tip", "data-original-title"];
  // FireSquire's own text is English already and passes through untouched.
  const ours = (n) => (n.nodeType === Node.TEXT_NODE ? n.parentElement : n)?.closest?.(".fs-win, #fs-info, .fs-hero, #ss-reboot-btn");
  const visit = (each) => {
    const roots = [document.documentElement];
    for (let i = 0; i < roots.length; i++) {
      const walker = document.createTreeWalker(roots[i], NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = walker.currentNode; n; n = walker.nextNode()) {
        if (n.shadowRoot) roots.push(n.shadowRoot);
        if (ours(n)) continue;
        if (n.nodeType !== Node.TEXT_NODE || !/^(SCRIPT|STYLE)$/.test(n.parentNode?.nodeName)) each(n);
      }
    }
  };
  const seen = new Set();
  visit((n) => {
    if (n.nodeType === Node.TEXT_NODE) { seen.add(n.nodeValue); return; }
    for (const at of ATTRS) if (n.getAttribute(at)) seen.add(n.getAttribute(at));
    if (n.nodeName === "INPUT" && n.value) seen.add(n.value);
  });
  const list = [...seen];
  const done = await window.shotScrub(list);
  const scrubbed = new Map(list.map((v, i) => [v, done[i]]));
  const fix = (s) => translate(scrubbed.get(s) ?? s);
  visit((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const v = fix(n.nodeValue);
      if (v !== n.nodeValue) n.nodeValue = v;
      return;
    }
    for (const at of ATTRS) if (n.getAttribute(at)) n.setAttribute(at, fix(n.getAttribute(at)));
    if (n.nodeName === "INPUT" && /^(button|submit|text)$/.test(n.type) && n.value) n.value = fix(n.value);
  });
}

// Runs in the page: every visible place where a denied word or a private address is left.
function leaks({ deny, demoNet }) {
  const hits = [];
  const check = (text, where) => {
    for (const w of deny) if (text.toLowerCase().includes(w.toLowerCase())) hits.push(w + " in " + where + ": " + text.trim().slice(0, 90));
    for (const ip of text.match(/(?<![\d.])\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?![\d.])/g) || []) {
      if (!ip.startsWith(demoNet) && !/^(127\.|0\.0\.0\.0)/.test(ip)) hits.push("address " + ip + " in " + where);
    }
  };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.currentNode; n; n = walker.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      if (/^(SCRIPT|STYLE)$/.test(n.parentNode?.nodeName)) continue;
      const box = n.parentElement?.getBoundingClientRect();
      if (box && box.width && box.height && box.bottom > 0 && box.top < innerHeight) check(n.nodeValue, String(n.parentElement.className || n.parentElement.nodeName));
    } else if (n.nodeName !== "OPTION") {
      const box = n.getBoundingClientRect();
      const shown = box.width && box.height && box.bottom > 0 && box.top < innerHeight;
      for (const at of ["title", "data-tip", shown && "alt", shown && "placeholder", shown && "value"].filter(Boolean)) {
        const v = n.getAttribute(at);
        if (v) check(v, n.nodeName.toLowerCase() + "[" + at + "]");
      }
    }
  }
  return [...new Set(hits)];
}

mkdirSync(out, { recursive: true });
// Unraid's live tables come over WebSockets, which Chrome refuses from a page whose document was
// handed over by the route below unless the local network checks are off.
const browser = await chromium.launch({ args: ["--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessChecksWebSockets,PrivateNetworkAccessChecks"] });
try {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: VIEW, deviceScaleFactor: 2, locale: "en-US", colorScheme: "dark" });
  const page = await ctx.newPage();
  // Until the login is through, the only thing allowed to go out besides GETs is the login form.
  await page.route(/./, (r) => (r.request().method() === "GET" || /\/login/.test(r.request().url()) ? r.continue() : r.abort()));
  await login(page);
  await page.unrouteAll({ behavior: "ignoreErrors" });

  await page.goto(`${BASE}/Dashboard`, { waitUntil: "load" });
  const server = await page.evaluate(() => {
    try { return JSON.parse(document.querySelector("[server]").getAttribute("server")); } catch { return {}; }
  });
  server.name = server.name || (await page.title()).split("/")[0];
  const locale = server.locale || (await page.evaluate(() => document.documentElement.lang)) || "en_US";
  const english = /^en/.test(locale) ? { exact: {}, patterns: [] } : await englishMap(ctx, locale);
  const scrub = scrubber(server);
  await page.exposeFunction("shotScrub", (list) => list.map(scrub));

  let state = { frozen: false, report: null };
  // A request made while the page is frozen is held, not refused: a refused one would put an
  // error toast into the picture.
  const held = [];
  await page.route(/./, async (route) => {
    const req = route.request();
    const url = req.url();
    const path = new URL(url).pathname;
    if (state.frozen && req.resourceType() !== "image") return void held.push(route);
    if (req.method() !== "GET") return route.abort();
    if (/\/webGui\/javascript\/translate\.[A-Za-z_]+\.js/.test(url)) {
      return route.fulfill({ contentType: "application/javascript", body: "function _(t){return t;}" });
    }
    if (path === "/plugins/firesquire/include/FireSquireStream.php") {
      return route.fulfill({ contentType: "text/event-stream; charset=utf-8", body: stream(REPORTS[state.report]) });
    }
    if (path === "/plugins/firesquire/include/FireSquireReport.php") {
      return route.fulfill({ contentType: "application/json", body: stream(REPORTS[state.report]).split("\n").at(-2) });
    }
    if (path.startsWith("/plugins/firesquire/") && !path.endsWith(".php")) {
      const file = join(web, decodeURIComponent(path.slice("/plugins/firesquire/".length)));
      if (existsSync(file)) return route.fulfill({ contentType: TYPES[extname(file)] || "application/octet-stream", body: readFileSync(file) });
    }
    if (SETTINGS.test(url)) {
      const res = await route.fetch();
      const json = await res.json();
      json.ui_settings = Object.assign(json.ui_settings || {}, LOOK);
      return route.fulfill({ response: res, body: scrub(JSON.stringify(json)), contentType: "application/json" });
    }
    if (!/^(document|xhr|fetch)$/.test(req.resourceType())) return route.continue();
    const res = await route.fetch();
    if (!/json|html|text\/plain/.test(res.headers()["content-type"] || "")) return route.fulfill({ response: res });
    let body = await res.text();
    if (req.resourceType() === "document") {
      body = body.replace(/<html([^>]*?)\blang="[^"]*"/, '<html$1lang="en"')
        .replace(/<script>window\.fireSquireLang=[\s\S]*?<\/script>/, () => `<script>window.fireSquireLang="en";window.fireSquireI18n=${ENGLISH_UI};</script>`);
      body = spliceSettings(body);
    }
    return route.fulfill({ response: res, body: scrub(body) });
  });
  await page.routeWebSocket(/./, (ws) => {
    const upstream = ws.connectToServer();
    ws.onMessage((m) => upstream.send(m));
    upstream.onMessage((m) => { if (!state.frozen) ws.send(typeof m === "string" ? scrub(m) : m); });
  });

  for (const shot of SHOTS.filter((s) => !CHOSEN.length || CHOSEN.includes(s.name))) {
    state = { frozen: false, report: shot.report };
    for (const route of held.splice(0)) route.abort().catch(() => {});
    await page.goto(`${BASE}/Dashboard`, { waitUntil: "load" });
    await page.evaluate((s) => { for (const [k, v] of Object.entries(s)) window.__ttLS ? window.__ttLS(k, v) : localStorage.setItem(k, v); }, LOOK);
    await page.goto(`${BASE}${shot.path}`, { waitUntil: "load", timeout: 60000 });
    await page.waitForTimeout(6000);
    if (shot.open) await shot.open(page);
    await page.waitForTimeout(2000);
    if (!shot.hover) await page.mouse.move(VIEW.width - 2, VIEW.height - 2);
    state.frozen = true;
    await page.evaluate(() => {
      const last = setTimeout(() => {}, 0);
      for (let i = 0; i <= last; i++) { clearTimeout(i); clearInterval(i); }
    });
    if (shot.path === "/Dashboard") await dashboard(page);
    const args = { english, nav: NAV };
    await page.evaluate(curate, args);
    await page.waitForTimeout(1000);
    await page.evaluate(curate, args);
    await page.addStyleTag({ content: "*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }" });
    const hits = await page.evaluate(leaks, { deny: [...DENY, server.name, ...[...scrub.serials.keys()]].filter((w) => w && w.length > 2), demoNet: "192.168.1." });
    for (const h of hits) console.log(`  ${shot.name}: ${h}`);
    await page.screenshot({ path: join(out, `${shot.name}.png`) });
    console.log(`wrote ${shot.name}.png`);
  }
} finally {
  await browser.close();
}
