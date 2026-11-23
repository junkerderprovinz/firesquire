/* FireSquire's settings page under the banner, in tabs: General with what the
 * check looks at, Health with how the server stands, the notifications, the
 * Fortress and Info with the cards in GlimStone's order, Version, Components,
 * Help and About. The give buttons open their
 * windows inside the page: Buy Me a Coffee's widget, PayPal's buttons under
 * the house's own controls, and the crypto window with an address and a QR
 * code per network. Nothing from a payment provider loads before its window
 * opens. The windows and buttons come from firesquire.js. */
(function () {
  var root = document.getElementById("fs-info");
  var UI = window.fireSquireUI;
  if (!root || !UI) return;
  var tools = document.getElementById("ss-tools");
  var html = document.documentElement;
  var L = window.fireSquireI18n || {};
  var MARK = (window.fireSquireMarks || {}).brand || {};
  var COIN_MARK = (window.fireSquireMarks || {}).coin || {};
  var rtl = UI.rtl;

  var REPO = "https://github.com/junkerderprovinz/firesquire";
  var DISCORD = "https://discord.gg/ZPYM2gfq8V";
  var COFFEE_PAGE = "https://buymeacoffee.com/junkerderprovinz";
  // The one Buy Me a Coffee page that may be framed; the profile page answers
  // X-Frame-Options: SAMEORIGIN.
  var COFFEE_WIDGET = "https://buymeacoffee.com/widget/page/junkerderprovinz?description=&color=%23FFDD00";
  var PAYPAL_PAGE = "https://www.paypal.com/donate/?hosted_button_id=76FVV52TKXTUS";
  var CRYPTO_PAGE = "https://junkerderprovinz.github.io/junkerderprovinz/";
  var PAYPAL = {
    clientId: "BAAbFqgNYfuCIBT_gwVE64oqj-E-jmxFiLaoR1yMIF9KK-CW16x5Pt2bSjBloqbTF4TvjFYw3ZTLnRP8_U",
    // One plan per interval, each at 1 EUR a unit, so any whole amount is the
    // plan times a quantity.
    plans: { month: "P-2ND5083133959702RNK2375A", year: "P-2FN843952N550243RNK2375A" },
    currency: "EUR"
  };
  var AMOUNTS = ["10", "25", "50"];
  var DEFAULT_AMOUNT = "25";

  // Every network carries its own address, so a coin is never offered on a
  // chain nobody receives on. An EVM address is not a Tron or Solana address,
  // which is why Tron is absent.
  var BTC = "bc1q078lt57t4n5zq5md3knz3ythum0w78zmjw5eda";
  var EVM = "0xFF6726C5bd76C8FD6b6bE7Ea5CEd4621fde5e841";
  var SOL = "GrTyhSbZVArdaZAr3TqWDrkEGahomLtNZJ41qPLm3dHd";
  var SUI = "0xa76677f71d107c9a957c2d1814b68027cbd4ad9dbf28d911a97fad5d2fc3a414";
  var XRP = "rwMK2nXqChT4JYWVypMypnpctDcM9jgWmG";
  var ETHEREUM = { id: "ethereum", name: "Ethereum", address: EVM };
  var BASE = { id: "base", name: "Base", address: EVM };
  var OPTIMISM = { id: "optimism", name: "Optimism", address: EVM };
  var BSC = { id: "bsc", name: "BNB Smart Chain", address: EVM };
  var SOLANA = { id: "solana", name: "Solana", address: SOL };
  var COINS = [
    { id: "btc", symbol: "BTC", name: "Bitcoin", tile: ["#f7931a", "#ffffff"], networks: [{ id: "bitcoin", name: "Bitcoin", address: BTC }] },
    // Native ETH only; on BNB Smart Chain it is a bridged token.
    { id: "eth", symbol: "ETH", name: "Ethereum", tile: ["#627eea", "#ffffff"], networks: [ETHEREUM, BASE, OPTIMISM] },
    { id: "usdt", symbol: "USDT", name: "Tether", tile: ["#26a17b", "#ffffff"], networks: [ETHEREUM, BSC, SOLANA] },
    { id: "usdc", symbol: "USDC", name: "USD Coin", tile: ["#2775ca", "#ffffff"], networks: [ETHEREUM, BASE, SOLANA] },
    { id: "bnb", symbol: "BNB", name: "BNB", tile: ["#f0b90b", "#161616"], networks: [BSC] },
    { id: "sol", symbol: "SOL", name: "Solana", tile: ["#9945ff", "#ffffff"], networks: [SOLANA] },
    { id: "sui", symbol: "SUI", name: "Sui", tile: ["#4da2ff", "#ffffff"], networks: [{ id: "sui", name: "Sui", address: SUI }] },
    // Exchanges often ask for a destination tag; this account does not need one.
    { id: "xrp", symbol: "XRP", name: "XRP", tile: ["#23292f", "#ffffff"], rest: "var(--fs-coin-xrp)", networks: [{ id: "xrpl", name: "XRP Ledger", address: XRP, note: "crypto_notag" }] }
  ];

  var GLS_VER = "4.8.2";
  var GLS_REPO = "https://github.com/junkerderprovinz/glimstone";
  var RELEASES_API = "https://api.github.com/repos/junkerderprovinz/firesquire/releases";
  var PARLEYPORT_REPO = "https://github.com/junkerderprovinz/parleyport";
  var UPDATE_URL = "/plugins/firesquire/include/FireSquireUpdate.php";

  function t(k) { return L[k] == null ? k : String(L[k]); }
  var el = UI.el;
  function button(cls, text) { var b = el("button", cls, text); b.type = "button"; return b; }
  var hue = UI.hue;

  var seq = 0;
  function card(title, into, tip) {
    var c = el("section", "fs-card"), h = el("h3", "fs-h"), s = el("span", null, title);
    s.id = "fs-h-" + (++seq);
    c.setAttribute("aria-labelledby", s.id);
    c.setAttribute("data-glim", "Card");
    c.setAttribute("data-glim-title", title);
    h.appendChild(s);
    if (tip) h.appendChild(UI.info(tip));
    c.appendChild(h);
    into.appendChild(c);
    return c;
  }
  function prose(c, text) { c.appendChild(el("p", "fs-prose", text)); }
  function row(c, label, tip) {
    var r = el("div", "fs-row"), l = el("span", "fs-row-lbl", label), end = el("span", "fs-row-end");
    if (tip) l.appendChild(UI.info(tip));
    r.appendChild(l);
    r.appendChild(end);
    c.appendChild(r);
    return end;
  }
  function blank(a) {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }
  // The release a version names, without its "v", or "" for a build without one.
  function release(ver) {
    var v = String(ver || "").replace(/^v/, "");
    return /^\d+(\.\d+)+$/.test(v) ? v : "";
  }
  // A version reads as plain text without its "v" and opens the newest release
  // of its project, so a number never leads to a tag a folded patch took away.
  // A build without a release says so and has no link.
  function version(ver, repo) {
    var v = release(ver);
    if (!v) return el("span", "fs-ver fs-num", UI.t("ver_unreleased", [String(ver || "").replace(/^v/, "") || "?"]));
    var a = blank(el("a", "fs-ver fs-num", v));
    a.href = repo + "/releases/latest";
    return a;
  }
  // "3 minutes ago" or "yesterday" in the page's language, the way GlimStone's timeAgo says it.
  function timeAgo(at, now) {
    var f = new Intl.RelativeTimeFormat(UI.lang, { numeric: "auto" }), value = Math.round((at - now) / 1000);
    var steps = [["second", 60], ["minute", 60], ["hour", 24]];
    for (var i = 0; i < steps.length; i++) {
      if (Math.abs(value) < steps[i][1]) return f.format(i ? value : 0, steps[i][0]);
      value = Math.round(value / steps[i][1]);
    }
    return f.format(value, "day");
  }
  // Positive when version a is newer than b, by the numbers alone; a build
  // that is no release is older than any release.
  function newer(a, b) {
    var x = release(a).split("."), y = release(b).split(".");
    if (!x[0]) return 0;
    if (!y[0]) return 1;
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      var d = (+x[i] || 0) - (+y[i] || 0);
      if (d) return d;
    }
    return 0;
  }
  /* GlimStone's Version card: FireSquire and its number, then one last row
     with where the updates stand at its start and the buttons at its end. A
     plugin has no update switch, its check asks Unraid, and its one action
     leads to the Plugins tab, where Unraid installs the update. */
  function versionCard(into) {
    var c = card(t("ver_title"), into, t("ver_hint")), state = { kind: "checking" };
    var head = el("div", "fs-ver-head"), foot = el("div", "fs-ver-foot"), line = el("p", "fs-ver-state"), acts = el("div", "fs-ver-actions");
    head.appendChild(el("span", "fs-ver-app", "FireSquire"));
    head.appendChild(version(ver, REPO));
    line.setAttribute("role", "status");
    // While a new version is out, "What's new" opens that version's notes, so its number needs no link.
    var news = UI.button("fs-ver-news", "WhatsNew", t("ver_new"));
    news.insertBefore(el("span", "fs-ver-dot"), news.firstChild);
    news.addEventListener("click", function () { openNotes(news, state.kind === "available" ? state.version : ver); });
    var chk = UI.button("fs-ver-check", "Sync", t("ver_check"));
    chk.addEventListener("click", function () { run(true); });
    var go = UI.button("fs-acc fs-ver-go", "Sync", t("ver_plugins"));
    go.addEventListener("click", function () { window.location.href = "/Plugins"; });
    acts.appendChild(news);
    acts.appendChild(chk);
    acts.appendChild(go);
    foot.appendChild(line);
    foot.appendChild(acts);
    c.appendChild(head);
    c.appendChild(foot);
    function paint() {
      var face = {
        checking: [t("ver_checking"), "neutral"],
        current: [t("ver_current"), "ok", state.checkedAt && UI.t("ver_checked", [timeAgo(state.checkedAt, new Date())])],
        available: [UI.t("ver_available", [state.version]), "warn"],
        failed: [t("ver_failed"), "fail", state.reason]
      }[state.kind];
      line.textContent = "";
      line.setAttribute("data-tone", face[1]);
      line.appendChild(el("span", "fs-ver-line", face[0]));
      if (face[2]) line.appendChild(el("span", "fs-ver-note", face[2]));
      // Once a new version is found there is nothing left to look for.
      chk.style.display = state.kind === "available" ? "none" : "";
      chk.disabled = state.kind === "checking";
      go.style.display = state.kind === "available" ? "" : "none";
    }
    function run(check) {
      state = { kind: "checking" };
      paint();
      askUpdates(check).then(function (r) {
        var s = updateState(r);
        // Unraid has not looked yet on this boot, so the first visit looks once.
        if (!s && !check) return run(true);
        state = s || { kind: "failed" };
        paint();
      }).catch(function (e) {
        state = { kind: "failed", reason: (e && e.message) || String(e) };
        paint();
      });
    }
    run(false);
  }
  // Where the updates stand, in GlimStone's terms. Unraid's plugin manager
  // answers, and null means it has not checked since the server booted.
  function updateState(r) {
    if (!r || !r.latest) return null;
    if (newer(r.latest, r.installed || ver) > 0) return { kind: "available", version: release(r.latest) || String(r.latest) };
    return { kind: "current", checkedAt: r.checkedAt ? new Date(r.checkedAt * 1000) : null };
  }
  function askUpdates(check) {
    var opts = { credentials: "same-origin" };
    // A form-encoded body, since a multipart one can stall in front of emhttp's PHP.
    if (check) {
      opts.method = "POST";
      opts.headers = { "Content-Type": "application/x-www-form-urlencoded" };
      opts.body = "csrf_token=" + encodeURIComponent(window.csrf_token || "");
    }
    return fetch(UPDATE_URL, opts).then(function (r) {
      return r.json().catch(function () { return null; }).then(function (d) {
        if (!r.ok) throw new Error((d && d.error) || "HTTP " + r.status);
        return d;
      });
    });
  }
  // A version's notes from GitHub's release API: the running one's, or a newer
  // one's while it waits in the Plugins tab. A build without a release shows
  // the latest one.
  function notesSource(v) {
    var rel = release(v);
    if (rel) return { api: RELEASES_API + "/tags/v" + rel, page: REPO + "/releases/tag/v" + rel, ver: rel };
    return { api: RELEASES_API + "/latest", page: REPO + "/releases", ver: "" };
  }
  function openNotes(opener, v) {
    var src = notesSource(v);
    UI.openWindow({
      cls: "fs-win-notes", opener: opener, title: src.ver ? UI.t("notes_title", [src.ver]) : t("ver_new"),
      build: function (body, win, act) {
        var title = win.querySelector(".fs-win-title"), notes = el("div", "fs-notes");
        // Long notes scroll, and the keyboard needs a way in.
        notes.tabIndex = 0;
        body.appendChild(notes);
        var link = UI.button("fs-win-btn fs-win-link", "Forward", t("notes_github"));
        link.addEventListener("click", function () { window.open(src.page, "_blank", "noopener"); });
        act.insertBefore(link, act.firstChild);
        function say(text) { notes.textContent = ""; notes.appendChild(el("p", "fs-win-text", text)); }
        say(t("notes_loading"));
        fetch(src.api, { headers: { Accept: "application/vnd.github+json" } })
          .then(function (r) { if (r.status === 404) throw new Error("missing"); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
          .then(function (j) {
            var tag = release(j && j.tag_name);
            if (!src.ver && tag) { title.textContent = UI.t("notes_title", [tag]); src.page = REPO + "/releases/tag/v" + tag; }
            if (!j || !String(j.body || "").trim()) return say(t("notes_none"));
            notes.textContent = "";
            notesDom(j.body, notes);
          })
          .catch(function (e) { say(e && e.message === "missing" ? t("notes_missing") : t("notes_failed")); });
        return notes;
      }
    });
  }
  // A release body is GitHub Markdown. It is built from elements and text nodes,
  // so nothing in it is ever read as HTML, and a link becomes an anchor only when
  // it leads to http or https.
  function notesInline(text, into) {
    var re = /\*\*(.+?)\*\*|\x60([^\x60]+)\x60|\[([^\]]+)\]\(([^)\s]+)\)|\*(\S(?:.*?\S)?)\*/g, last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) into.appendChild(document.createTextNode(text.slice(last, m.index)));
      if (m[1] != null) { var b = el("strong"); notesInline(m[1], b); into.appendChild(b); }
      else if (m[2] != null) into.appendChild(el("code", null, m[2]));
      else if (m[3] != null) {
        if (/^https?:\/\//i.test(m[4])) { var a = blank(el("a", null, m[3])); a.href = m[4]; into.appendChild(a); }
        else into.appendChild(document.createTextNode(m[3]));
      } else { var i = el("em"); notesInline(m[5], i); into.appendChild(i); }
      last = re.lastIndex;
    }
    if (last < text.length) into.appendChild(document.createTextNode(text.slice(last)));
  }
  function notesDom(md, into) {
    var blocks = [], cur = null, code = null;
    String(md || "").replace(/\r\n?/g, "\n").split("\n").forEach(function (ln) {
      if (code) { if (/^\s*\x60{3}/.test(ln)) code = null; else code.text += (code.text ? "\n" : "") + ln; return; }
      var m;
      if (/^\s*\x60{3}/.test(ln)) { code = { type: "pre", text: "" }; blocks.push(code); cur = null; }
      else if (!ln.trim() || /^\s*([-*_])(\s*\1){2,}\s*$/.test(ln)) cur = null;
      else if ((m = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(ln))) { blocks.push({ type: "h", text: m[2] }); cur = null; }
      else if ((m = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(ln))) {
        var kind = /\d/.test(m[1]) ? "ol" : "ul";
        if (!cur || cur.type !== kind) { cur = { type: kind, items: [] }; blocks.push(cur); }
        cur.items.push(m[2]);
      } else if (cur && (cur.type === "ul" || cur.type === "ol")) cur.items[cur.items.length - 1] += " " + ln.trim();
      else if (cur && cur.type === "p") cur.text += " " + ln.trim().replace(/^>\s?/, "");
      else { cur = { type: "p", text: ln.trim().replace(/^>\s?/, "") }; blocks.push(cur); }
    });
    blocks.forEach(function (b) {
      if (b.type === "pre") { var pre = el("pre"); pre.appendChild(el("code", null, b.text)); into.appendChild(pre); return; }
      if (b.type === "h") { var h = el("div", "fs-notes-h"); h.setAttribute("role", "heading"); h.setAttribute("aria-level", "3"); notesInline(b.text, h); into.appendChild(h); return; }
      if (b.type === "p") { var p = el("p"); notesInline(b.text, p); into.appendChild(p); return; }
      var list = el(b.type);
      b.items.forEach(function (x) { var li = el("li"); notesInline(x, li); list.appendChild(li); });
      into.appendChild(list);
    });
  }
  /* GlimStone's Components card: every other version FireSquire brings along,
     what each is in its (i), and GlimStone's row last. ParleyPort's helpers
     come with the plugin's own release, so there is no switch to update them. */
  function componentsCard(into) {
    var c = card(t("comp_title"), into, t("comp_hint")), list = el("ul", "fs-ver-rows");
    var helpers = root.getAttribute("data-fs-helpers");
    if (helpers) list.appendChild(componentRow("ParleyPort", t("comp_helpers"), version(helpers, PARLEYPORT_REPO)));
    list.appendChild(componentRow("GlimStone", t("comp_design"), version(GLS_VER, GLS_REPO)));
    c.appendChild(list);
  }
  function componentRow(name, hint, number) {
    var li = el("li", "fs-ver-row"), nm = el("span", "fs-ver-name");
    nm.appendChild(el("span", "fs-ver-part", name));
    nm.appendChild(UI.info(hint));
    li.appendChild(nm);
    li.appendChild(number);
    return li;
  }
  // A button in the shape of the README's buttons. One with a window to open
  // keeps its address, so a middle click still reaches the hosted page.
  function rbtn(brand, name, href, open) {
    var unit = el("span", "fs-rbtn-unit fs-tile-" + brand), a = blank(el("a", "fs-rbtn"));
    a.href = href;
    a.setAttribute("aria-label", name);
    if (brand === "coffee") {
      var art = el("span", "fs-rbtn-art");
      art.innerHTML = MARK.coffee;
      a.appendChild(art);
    } else {
      var mark = el("span", "fs-rbtn-mark fs-" + brand + "-mark"), text = el("span", "fs-rbtn-text");
      mark.innerHTML = MARK[brand];
      text.appendChild(el("span", "fs-rbtn-name", name));
      a.appendChild(mark);
      a.appendChild(text);
    }
    if (open) {
      a.setAttribute("aria-haspopup", "dialog");
      a.addEventListener("click", function (e) {
        if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        // The window keeps the donor on the page, so Unraid's warning about
        // leaving for an outside site, delegated from <body>, has nothing to say.
        e.preventDefault();
        e.stopPropagation();
        open(a);
      });
    }
    unit.appendChild(a);
    unit.appendChild(el("span", "fs-rbtn-sheen"));
    return unit;
  }
  function rbtnRow(c, cls, units) {
    var r = el("div", "fs-rbtn-rows" + (cls ? " " + cls : ""));
    units.forEach(function (u) { r.appendChild(u); });
    c.appendChild(r);
  }

  /* The banner's silhouette takes the first rainbow position under the rainbow;
     otherwise the sheet gives it the accent, or Unraid's colours without
     TowerTorch. */
  function paintBanner() {
    var b = document.querySelector(".fs-hero");
    if (!b) return;
    if (rtl) b.dir = "rtl";
    var C = window.TTTheme;
    if (UI.themed() && get("tt.rainbow", "0") === "1" && C && C.rbColor) {
      b.style.setProperty("--fs-hero-rb", C.rbColor(0, (getComputedStyle(html).getPropertyValue("--tt-accent") || "").trim() || "#FCC419"));
    } else {
      b.style.removeProperty("--fs-hero-rb");
    }
  }
  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  // A private window refuses storage, and the tab then opens without being kept.
  function put(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* The tab column beside the cards, as on ShipLog's and TowerTorch's settings
     pages. The arrows move between the tabs, and the tab chosen last opens
     again on the next visit. */
  var body = el("div", "fs-body"), tabList = el("div", "fs-tabs"), main = el("div", "fs-main"), tabs = [], panes = [];
  tabList.setAttribute("role", "tablist");
  tabList.setAttribute("aria-orientation", "vertical");
  tabList.setAttribute("aria-label", "FireSquire");
  body.appendChild(tabList);
  body.appendChild(main);
  root.appendChild(body);
  function pane(name, label, glyph) {
    var tab = el("button", "fs-tab"), ico = el("span", "fs-tabico"), p = el("div", "fs-pane");
    tab.type = "button";
    tab.id = "fs-tab-" + name;
    p.id = "fs-pane-" + name;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", p.id);
    tab.setAttribute("data-fs-tab", name);
    p.setAttribute("role", "tabpanel");
    p.setAttribute("aria-labelledby", tab.id);
    ico.innerHTML = UI.glyph(glyph);
    tab.appendChild(ico);
    tab.appendChild(el("span", "fs-tablbl", label));
    tabList.appendChild(tab);
    main.appendChild(p);
    tabs.push(tab);
    panes.push(p);
    return p;
  }
  function openTab(tab, focus) {
    tabs.forEach(function (x, i) {
      var on = x === tab;
      x.setAttribute("aria-selected", on ? "true" : "false");
      x.tabIndex = on ? 0 : -1;
      panes[i].hidden = !on;
    });
    if (focus) tab.focus();
  }

  /* What the check looks at. Unraid's own look keeps it as prose with a list;
     GlimStone's makes it the first card, a row per group with the detail in
     its bubble, and the tab's one accent button at the end. */
  function runButton(cls) {
    var b = UI.button(cls, "Check", t("tools_btn"));
    b.addEventListener("click", function (e) { window.firesquireRun(e); });
    return b;
  }
  // The fortress and the notifications come with ParleyPort's helpers. Without
  // its helper a part stays off the page, and it appears once the helper is in.
  var withFortress = root.hasAttribute("data-fs-fortress"), withNotify = root.hasAttribute("data-fs-notify");
  var li = L.tools_li && L.tools_li.length ? L.tools_li : [];
  var groups = ["tools_g_array", "tools_g_ops", "tools_g_containers", "tools_g_host", "tools_g_fortress", "tools_g_health", "tools_g_shutdown"]
    .map(function (k, i) { return [k, li[i]]; })
    .filter(function (g) { return withFortress || g[0] !== "tools_g_fortress"; });
  var pGeneral = pane("general", t("t_general"), "TabGeneral");
  if (UI.themed()) {
    if (tools) tools.hidden = true;
    var cTools = card(t("tools_title"), pGeneral);
    cTools.classList.add("fs-card-tools");
    groups.forEach(function (g) { row(cTools, t(g[0]), g[1]); });
    row(cTools, t("tools_note"), t("tools_lead")).appendChild(runButton("fs-acc fs-key"));
  } else if (tools) {
    if (rtl) tools.dir = "rtl";
    tools.appendChild(el("p", "fs-tools-lead", t("tools_lead")));
    tools.appendChild(el("p", null, t("tools_intro")));
    var ul = el("ul", "fs-tools-list");
    groups.forEach(function (g) { if (g[1]) ul.appendChild(el("li", null, g[1])); });
    tools.appendChild(ul);
    tools.appendChild(runButton());
    pGeneral.appendChild(tools);
  }

  if (rtl) root.dir = "rtl";
  var ver = root.getAttribute("data-fs-ver");
  // firesquire-health.js draws the lights, GlimStone's fortress card draws
  // itself into its place, and firesquire-notify.js fills in the notification
  // and schedule cards.
  pane("health", t("t_health"), "Health").appendChild(el("div")).id = "fs-health";
  if (withNotify) pane("notify", t("n_card"), "Notifications").appendChild(el("div")).id = "fs-notify";
  if (withFortress) pane("fortress", t("t_fortress"), "ShieldOn").appendChild(el("div")).id = "fs-fortress";

  var pInfo = pane("info", t("t_info"), "Info");
  versionCard(pInfo);
  componentsCard(pInfo);

  var cHelp = card(t("help_title"), pInfo);
  prose(cHelp, t("help_body"));
  rbtnRow(cHelp, "", [rbtn("github", "GitHub", REPO + "/issues"), rbtn("discord", "Discord", DISCORD)]);

  var cAbout = card(t("about_title"), pInfo);
  prose(cAbout, t("about_body"));
  prose(cAbout, t("about_coin"));
  // Hosted pages first, the wallet last.
  rbtnRow(cAbout, "fs-give", [
    rbtn("coffee", "Buy me a coffee", COFFEE_PAGE, openCoffee),
    rbtn("paypal", "PayPal", PAYPAL_PAGE, openPaypal),
    rbtn("bitcoin", t("give_crypto"), CRYPTO_PAGE, openCrypto)
  ]);

  var kept = get("firesquire.settings.tab", "general");
  openTab(tabs.filter(function (x) { return x.getAttribute("data-fs-tab") === kept; })[0] || tabs[0], false);
  tabs.forEach(function (x, i) {
    x.addEventListener("click", function () {
      openTab(x, false);
      put("firesquire.settings.tab", x.getAttribute("data-fs-tab"));
    });
    x.addEventListener("keydown", function (e) {
      var n = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault();
      var next = tabs[(n + tabs.length) % tabs.length];
      openTab(next, true);
      put("firesquire.settings.tab", next.getAttribute("data-fs-tab"));
    });
  });
  // Below 1024 px the tabs show their glyphs alone, and the name moves into the bubble.
  var narrow = window.matchMedia("(max-width: 1023px)");
  function tabTips() {
    tabs.forEach(function (x) {
      if (narrow.matches) x.setAttribute("data-tip", x.querySelector(".fs-tablbl").textContent);
      else x.removeAttribute("data-tip");
    });
  }
  narrow.addEventListener("change", tabTips);
  tabTips();

  // The tabs and the cards of each tab count the rainbow from its start.
  function paint() {
    paintBanner();
    tabs.forEach(function (x, i) { hue(x, i); });
    panes.forEach(function (p) {
      Array.prototype.forEach.call(p.querySelectorAll(".fs-card"), function (c, i) { hue(c, i); });
    });
  }
  paint();
  // The cards of the scripts after this one join the rainbow once they stand.
  document.addEventListener("DOMContentLoaded", paint);
  new MutationObserver(paint).observe(html, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("storage", function (e) { if (!e.key || /^tt\./.test(e.key)) paint(); });

  /* A give window opens with the appeal and the sentence naming who takes the
     payment, then its own content. */
  function giveWindow(o) {
    var build = o.build;
    o.build = function (body, win) {
      body.appendChild(el("p", "fs-win-text", t("give_appeal")));
      body.appendChild(el("p", "fs-win-text fs-win-sub", o.intro));
      return build(body, win);
    };
    UI.openWindow(o);
  }

  function openCoffee(opener) {
    giveWindow({
      cls: "fs-win-coffee", title: "Buy Me a Coffee", intro: t("coffee_intro"), opener: opener,
      build: function (body) {
        var frame = el("div", "fs-frame"), f = el("iframe");
        f.src = COFFEE_WIDGET;
        f.title = "Buy Me a Coffee";
        f.allow = "payment";
        frame.appendChild(f);
        body.appendChild(frame);
      }
    });
  }

  /* The house's horizontal selector: one option is picked, the arrow keys move
     the pick, and only the picked option is a tab stop. */
  function selector(label, items, pick) {
    var node = el("div", "fs-seg"), opts = [];
    node.setAttribute("role", "radiogroup");
    node.setAttribute("aria-label", label);
    items.forEach(function (it, i) {
      var b = button("fs-seg-opt", it[1]);
      b.setAttribute("role", "radio");
      b.addEventListener("click", function () { set(it[0]); pick(it[0]); });
      b.addEventListener("keydown", function (e) {
        var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        if (rtl && (e.key === "ArrowRight" || e.key === "ArrowLeft")) step = -step;
        var next = items[(i + step + items.length) % items.length];
        set(next[0]);
        pick(next[0]);
        opts[items.indexOf(next)].focus();
      });
      opts.push(b);
      node.appendChild(b);
    });
    function set(id) {
      var any = false;
      opts.forEach(function (b, i) {
        var on = items[i][0] === id;
        any = any || on;
        b.setAttribute("aria-checked", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
        hue(b, i);
      });
      if (!any) opts[0].tabIndex = 0;
    }
    return { node: node, set: set, first: function () { return opts[0]; } };
  }
  function group(label, control) {
    var g = el("div", "fs-group");
    g.appendChild(el("div", "fs-group-lbl", label));
    g.appendChild(control);
    return g;
  }
  function shake(node) {
    node.classList.remove("fs-shake");
    void node.offsetWidth;
    node.classList.add("fs-shake");
  }

  /* PayPal. A one-off donation and a recurring one need the SDK loaded with
     different parameters, so each gets its own namespace. Two things break it
     without a readable error: an element with id="paypal", which becomes
     window.paypal first, and a page-level open or close function shadowing the
     window.open its login popup needs. Only the PayPal wallet and the card
     button stay; the other funding sources repeat what the card covers. */
  var DISABLED_FUNDING = "sepa,paylater,venmo,bancontact,blik,eps,giropay,ideal,mybank,p24,sofort";
  var paypalLoads = {};
  function loadPaypal(recurring) {
    var ns = recurring ? "fsPaypalRecurring" : "fsPaypalOnce";
    if (paypalLoads[ns]) return paypalLoads[ns];
    var q = "client-id=" + encodeURIComponent(PAYPAL.clientId) + "&currency=" + PAYPAL.currency +
      "&intent=" + (recurring ? "subscription&vault=true" : "capture") + "&components=buttons&disable-funding=" + DISABLED_FUNDING;
    paypalLoads[ns] = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://www.paypal.com/sdk/js?" + q;
      s.setAttribute("data-namespace", ns);
      // A blocker can let the script load and still keep the SDK from running.
      s.onload = function () { if (window[ns]) resolve(window[ns]); else reject(new Error("paypal")); };
      s.onerror = function () { delete paypalLoads[ns]; s.remove(); reject(new Error("paypal")); };
      document.head.appendChild(s);
    });
    return paypalLoads[ns];
  }
  // A typed amount as PayPal's decimal string, or null below 1 or with more
  // than two decimals. A comma counts as the decimal mark.
  function parseAmount(text) {
    var v = String(text).replace(",", ".").trim();
    if (!/^\d+(\.\d{1,2})?$/.test(v) || Number(v) < 1) return null;
    return Number(v).toFixed(2).replace(/\.00$/, "");
  }

  function openPaypal(opener) {
    var freq = "once", preset = DEFAULT_AMOUNT, typed = "", buttons = null, run = 0;
    function amount() { return typed === "" ? preset : parseAmount(typed); }
    giveWindow({
      cls: "fs-win-paypal", title: "PayPal", intro: t("paypal_intro"), opener: opener,
      onClose: function () { run++; if (buttons) buttons.close().catch(function () {}); },
      build: function (body) {
        var often = selector(t("paypal_often"), [["once", t("paypal_once")], ["month", t("paypal_monthly")], ["year", t("paypal_yearly")]], function (id) {
          if (id === freq) return;
          freq = id;
          render();
        });
        often.set(freq);
        body.appendChild(group(t("paypal_often"), often.node));

        var sums = selector(t("paypal_amount"), AMOUNTS.map(function (a) { return [a, a + " €"]; }), function (id) {
          preset = id;
          typed = "";
          field.value = "";
          mark();
        });
        var field = el("input", "fs-amount");
        field.type = "text";
        field.inputMode = "decimal";
        field.autocomplete = "off";
        field.placeholder = t("paypal_other");
        field.setAttribute("aria-label", t("paypal_other"));
        // A valid typed amount takes the pick from the presets, so the window
        // never shows two amounts; clearing the field gives it back.
        field.addEventListener("input", function () {
          typed = field.value;
          if (parseAmount(typed)) preset = null;
          else if (typed === "") preset = preset || DEFAULT_AMOUNT;
          mark();
        });
        // Leaving the field shows the amount as it will be charged, hands a
        // preset's amount back to its preset, and shakes text that is no amount.
        field.addEventListener("blur", function () {
          if (typed === "") return;
          var v = parseAmount(typed);
          if (!v) { shake(field); return; }
          if (AMOUNTS.indexOf(v) >= 0) { preset = v; typed = ""; }
          else typed = v;
          field.value = typed;
          mark();
        });
        var col = el("div", "fs-amounts");
        col.appendChild(sums.node);
        col.appendChild(field);
        body.appendChild(group(t("paypal_amount"), col));
        function mark() {
          sums.set(preset);
          var ok = !!parseAmount(typed);
          field.classList.toggle("fs-amount-ok", ok);
          field.setAttribute("aria-invalid", typed !== "" && !ok ? "true" : "false");
        }
        mark();

        // PayPal draws its frames light, and inside a dark color-scheme the
        // browser paints them an opaque white strip, so the box declares light.
        var box = el("div", "fs-paypal"), state = el("p", "fs-pp-state");
        body.appendChild(box);
        body.appendChild(state);
        function say(cls, text) { state.className = "fs-pp-state" + (cls ? " " + cls : ""); state.textContent = text; }

        function render() {
          var mine = ++run;
          say("", t("paypal_loading"));
          if (buttons) { buttons.close().catch(function () {}); buttons = null; }
          box.textContent = "";
          loadPaypal(freq !== "once").then(function (pp) {
            if (mine !== run) return;
            var handlers = freq === "once" ? {
              createOrder: function (d, actions) {
                var money = { currency_code: PAYPAL.currency, value: amount() };
                return actions.order.create({
                  purchase_units: [{
                    description: "FireSquire",
                    amount: { currency_code: money.currency_code, value: money.value, breakdown: { item_total: money } },
                    // DONATION marks the payment as a gift in the donor's PayPal history.
                    items: [{ name: "FireSquire", quantity: "1", category: "DONATION", unit_amount: money }]
                  }]
                });
              },
              onApprove: function (d, actions) { return actions.order.capture().then(thanks); }
            } : {
              createSubscription: function (d, actions) {
                return actions.subscription.create({
                  plan_id: PAYPAL.plans[freq],
                  quantity: String(Math.max(1, Math.round(Number(amount()))))
                });
              },
              onApprove: thanks
            };
            buttons = pp.Buttons(Object.assign({
              style: { layout: "vertical", color: "blue", shape: "rect", borderRadius: 10, label: "donate", height: 40 },
              // A half-typed amount keeps the buttons from opening PayPal at all.
              onClick: function (d, actions) { return amount() ? actions.resolve() : actions.reject(); },
              onError: failed
            }, handlers));
            return buttons.render(box).then(function () { if (mine === run) say("", ""); });
          }).catch(failed);
          function thanks() { if (mine === run) say("fs-ok", t("paypal_thanks")); }
          function failed() { if (mine === run) say("fs-err", t("paypal_failed")); }
        }
        render();
        return often.first();
      }
    });
  }

  /* The crypto window. The code comes first, since it is what the window is
     opened for; the chain is switched right under the address it changes, and
     the coins wait below as tiles. */
  var qrLoad = null;
  function qrLib() {
    if (window.qrcode) return Promise.resolve(window.qrcode);
    if (!qrLoad) {
      qrLoad = new Promise(function (resolve, reject) {
        var s = document.createElement("script");
        s.src = "/plugins/firesquire/vendor/qrcode.js";
        s.onload = function () { if (window.qrcode) resolve(window.qrcode); else reject(new Error("qrcode")); };
        s.onerror = function () { qrLoad = null; s.remove(); reject(new Error("qrcode")); };
        document.head.appendChild(s);
      });
    }
    return qrLoad;
  }
  var SVG = "http://www.w3.org/2000/svg";
  // Black on white in every theme: an inverted code is outside the standard,
  // and the wallets a donor holds are the scanners that refuse one.
  function qrSvg(lib, text) {
    var qr = lib(0, "M");
    qr.addData(text);
    qr.make();
    var n = qr.getModuleCount(), quiet = 4, size = n + quiet * 2, d = "";
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) if (qr.isDark(y, x)) d += "M" + (x + quiet) + " " + (y + quiet) + "h1v1h-1z";
    }
    var svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 " + size + " " + size);
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", text);
    var bg = document.createElementNS(SVG, "rect"), path = document.createElementNS(SVG, "path");
    bg.setAttribute("width", size);
    bg.setAttribute("height", size);
    bg.setAttribute("fill", "#ffffff");
    path.setAttribute("d", d);
    path.setAttribute("fill", "#000000");
    svg.appendChild(bg);
    svg.appendChild(path);
    return svg;
  }
  function coinMark(id) {
    var m = COIN_MARK[id], svg = document.createElementNS(SVG, "svg"), path = document.createElementNS(SVG, "path");
    svg.setAttribute("viewBox", m[0]);
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    path.setAttribute("d", m[1]);
    path.setAttribute("fill", "var(--fs-mark-ink, currentColor)");
    svg.appendChild(path);
    return svg;
  }
  function copyText(text, host) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = el("textarea", "fs-copy-src");
      ta.value = text;
      ta.setAttribute("readonly", "");
      host.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) {}
      ta.remove();
      if (ok) resolve(); else reject(new Error("copy"));
    });
  }

  function openCrypto(opener) {
    var coin = COINS[0], net = coin.networks[0], copiedTimer = 0;
    giveWindow({
      cls: "fs-win-crypto", title: t("crypto_title"), intro: t("crypto_intro"), opener: opener,
      onClose: function () { clearTimeout(copiedTimer); },
      build: function (body, win) {
        var well = el("div", "fs-crypto");
        var plate = el("div", "fs-qr");
        var addr = el("p", "fs-addr");
        addr.dir = "ltr";
        var nets = el("div", "fs-nets");
        nets.setAttribute("role", "listbox");
        nets.setAttribute("aria-label", t("crypto_networks"));
        var note = el("p", "fs-note");
        var copy = UI.button("fs-win-btn fs-copy", "Copy", t("crypto_copy")), copyLabel = copy.querySelector(".fs-btn-l");
        [plate, addr, nets, note, copy].forEach(function (n) { well.appendChild(n); });
        var grid = el("div", "fs-coins");
        grid.setAttribute("role", "listbox");
        grid.setAttribute("aria-label", t("crypto_title"));
        var tiles = COINS.map(function (c, i) {
          var b = button("fs-coin");
          b.setAttribute("role", "option");
          b.setAttribute("aria-label", c.name + " (" + c.symbol + ")");
          b.title = c.name;
          b.style.setProperty("--fs-tile", c.tile[0]);
          b.style.setProperty("--fs-tile-ink", c.tile[1]);
          b.style.setProperty("--fs-coin", c.rest || c.tile[0]);
          var m = el("span", "fs-coin-mark");
          m.appendChild(coinMark(c.id));
          b.appendChild(m);
          b.appendChild(el("span", "fs-coin-tick", c.symbol));
          // Always the new coin's first network, never a chain carried over.
          b.addEventListener("click", function () { coin = c; net = c.networks[0]; show(); });
          grid.appendChild(b);
          return b;
        });
        body.appendChild(well);
        body.appendChild(grid);

        copy.addEventListener("click", function () {
          copyText(net.address, win).then(function () {
            copyLabel.textContent = t("crypto_copied");
            clearTimeout(copiedTimer);
            copiedTimer = setTimeout(function () { copyLabel.textContent = t("crypto_copy"); }, 1500);
          }, function () { shake(copy); });
        });

        function show() {
          clearTimeout(copiedTimer);
          copyLabel.textContent = t("crypto_copy");
          // The address is never shortened: it is read back by eye before sending.
          addr.textContent = net.address;
          var shownFor = net.address;
          qrLib().then(function (lib) {
            if (net.address !== shownFor) return;
            plate.textContent = "";
            plate.appendChild(qrSvg(lib, shownFor));
          }, function () { plate.hidden = true; });
          // Shown for a single network too, since it names the address's chain.
          nets.textContent = "";
          coin.networks.forEach(function (n, i) {
            var chip = button("fs-net", n.name);
            chip.setAttribute("role", "option");
            chip.setAttribute("aria-selected", n === net ? "true" : "false");
            hue(chip, i);
            chip.addEventListener("click", function () { net = n; show(); nets.children[i].focus(); });
            nets.appendChild(chip);
          });
          note.textContent = net.note ? t(net.note) : "";
          note.hidden = !net.note;
          tiles.forEach(function (b, i) {
            var on = COINS[i] === coin;
            b.setAttribute("aria-selected", on ? "true" : "false");
            hue(b, on ? i : null);
          });
        }
        show();
        return copy;
      }
    });
  }
})();
