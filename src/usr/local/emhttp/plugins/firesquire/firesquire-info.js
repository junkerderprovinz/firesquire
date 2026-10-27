/* The Info cards under FireSquire's settings page, in GlimStone's order:
 * Version, Help and About. The give buttons open their windows inside the
 * page: Buy Me a Coffee's widget, PayPal's buttons under the house's own
 * controls, and the crypto window with an address and a QR code per network.
 * Nothing from a payment provider loads before its window opens. */
(function () {
  var root = document.getElementById("fs-info");
  if (!root) return;
  var html = document.documentElement;
  var L = window.fireSquireI18n || {};
  var MARK = (window.fireSquireMarks || {}).brand || {};
  var COIN_MARK = (window.fireSquireMarks || {}).coin || {};
  var lang = String(window.fireSquireLang || html.lang || "en").slice(0, 2).toLowerCase();
  var rtl = lang === "ar" || lang === "he";

  var REPO = "https://github.com/junkerderprovinz/firesquire";
  var FORUM = "https://forums.unraid.net/topic/199508-support-junkerderprovinz-firesquire/";
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
    { id: "xrp", symbol: "XRP", name: "XRP", tile: ["#23292f", "#ffffff"], networks: [{ id: "xrpl", name: "XRP Ledger", address: XRP, note: "crypto_notag" }] }
  ];

  function t(k) { return L[k] == null ? k : String(L[k]); }
  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function button(cls, text) { var b = el("button", cls, text); b.type = "button"; return b; }

  /* The colour engine, read from TowerTorch: the accent, and under the rainbow
     one position per card heading and per picked option. Without TowerTorch
     nothing is set and the cards keep Unraid's colours. */
  function themed() { return html.classList.contains("cc-tools-on") && get("cc.theming", "1") !== "0"; }
  function hue(node, i) {
    var C = window.CCTheme;
    var c = "";
    if (i != null && themed() && get("cc.rainbow", "0") === "1" && C && C.rbColor) {
      c = C.rbColor(i, (getComputedStyle(html).getPropertyValue("--cc-accent") || "").trim() || "#FCC419");
    }
    if (c) {
      node.style.setProperty("--fs-hue", c);
      node.style.setProperty("--fs-hue-ink", C.idealText ? C.idealText(c) : "#161616");
    } else {
      node.style.removeProperty("--fs-hue");
      node.style.removeProperty("--fs-hue-ink");
    }
  }
  // TowerTorch's label mode for the buttons it draws, which the coin tiles follow.
  function labelMode() {
    var m = themed() ? html.getAttribute("data-cc-labels-buttons") : "";
    return ["text", "textGlyph", "glyph", "reactive"].indexOf(m) < 0 ? "textGlyph" : m;
  }

  var seq = 0;
  function card(title) {
    var c = el("section", "fs-card"), h = el("h3", "fs-h"), s = el("span", null, title);
    s.id = "fs-h-" + (++seq);
    c.setAttribute("aria-labelledby", s.id);
    h.appendChild(s);
    c.appendChild(h);
    root.appendChild(c);
    return c;
  }
  function prose(c, text) { c.appendChild(el("p", "fs-prose", text)); }
  // A version links to its release page; a build without a release shows its name alone.
  function version(ver) {
    var v = String(ver || "").replace(/^v/, "");
    if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(v)) return el("span", "fs-ver", v || "?");
    var a = el("a", "button fs-ver", "v" + v);
    a.href = REPO + "/releases/tag/v" + v;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    return a;
  }
  // A button in the shape of the README's buttons. One with a window to open
  // keeps its address, so a middle click still reaches the hosted page.
  function rbtn(brand, name, href, open) {
    var unit = el("span", "fs-rbtn-unit fs-tile-" + brand), a = el("a", "fs-rbtn");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
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
    var row = el("div", "fs-rbtn-rows" + (cls ? " " + cls : ""));
    units.forEach(function (u) { row.appendChild(u); });
    c.appendChild(row);
  }

  if (rtl) root.dir = "rtl";
  var cVer = card(t("ver_title"));
  var vrow = el("div", "fs-row");
  vrow.appendChild(el("span", null, "FireSquire"));
  vrow.appendChild(version(root.getAttribute("data-fs-ver")));
  cVer.appendChild(vrow);

  var cHelp = card(t("help_title"));
  prose(cHelp, t("help_body"));
  rbtnRow(cHelp, "", [rbtn("github", "GitHub", REPO + "/issues"), rbtn("house", t("help_forum"), FORUM)]);

  var cAbout = card(t("about_title"));
  prose(cAbout, t("about_body"));
  prose(cAbout, t("about_coin"));
  // Hosted pages first, the wallet last.
  rbtnRow(cAbout, "fs-give", [
    rbtn("coffee", "Buy me a coffee", COFFEE_PAGE, openCoffee),
    rbtn("paypal", "PayPal", PAYPAL_PAGE, openPaypal),
    rbtn("bitcoin", t("give_crypto"), CRYPTO_PAGE, openCrypto)
  ]);

  function paint() {
    Array.prototype.forEach.call(root.querySelectorAll(".fs-card"), function (c, i) { hue(c, i); });
  }
  paint();
  new MutationObserver(paint).observe(html, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("storage", function (e) { if (!e.key || /^cc\./.test(e.key)) paint(); });

  /* A window: the title notched into its top edge, the appeal and the sentence
     naming who takes the payment, the window's own content, and Close at the
     end of the foot. Escape, the scrim and Close shut it, the focus stays
     inside while it is open and goes back to the button that opened it. */
  var FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), select, textarea, iframe, [tabindex]";
  var shown = null;
  function openWindow(o) {
    if (shown) shown.close();
    var scrim = el("div", "fs-scrim");
    var win = el("div", "fs-win " + o.cls);
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-modal", "true");
    win.setAttribute("data-fs-labels", labelMode());
    win.tabIndex = -1;
    if (rtl) win.dir = "rtl";
    var title = el("h2", "fs-win-title", o.title);
    title.id = "fs-win-title";
    win.setAttribute("aria-labelledby", title.id);
    hue(title, 0);
    var body = el("div", "fs-win-body");
    body.appendChild(el("p", "fs-win-text", t("give_appeal")));
    body.appendChild(el("p", "fs-win-text fs-win-sub", o.intro));
    var act = el("div", "fs-win-act"), close = button("fs-win-btn", t("give_close"));
    act.appendChild(close);
    win.appendChild(title);
    win.appendChild(body);
    win.appendChild(act);
    document.body.appendChild(scrim);
    document.body.appendChild(win);

    function focusables() {
      return Array.prototype.filter.call(win.querySelectorAll(FOCUSABLE), function (n) { return n.tabIndex >= 0 && n.getClientRects().length > 0; });
    }
    function onKey(e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); done(); return; }
      if (e.key !== "Tab") return;
      var f = focusables(), a = document.activeElement;
      if (!f.length) { e.preventDefault(); win.focus(); return; }
      var first = f[0], last = f[f.length - 1];
      if (!win.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && (a === first || a === win)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    }
    function done() {
      if (!shown || shown.win !== win) return;
      shown = null;
      document.removeEventListener("keydown", onKey, true);
      scrim.remove();
      win.remove();
      if (o.onClose) o.onClose();
      if (o.opener && document.contains(o.opener)) o.opener.focus();
    }
    scrim.addEventListener("click", done);
    close.addEventListener("click", done);
    document.addEventListener("keydown", onKey, true);
    shown = { win: win, close: done };
    var into = o.build(body, win);
    (into || win).focus();
  }

  function openCoffee(opener) {
    openWindow({
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
    openWindow({
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
    openWindow({
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
        var copy = button("fs-win-btn fs-copy", t("crypto_copy"));
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
            copy.textContent = t("crypto_copied");
            clearTimeout(copiedTimer);
            copiedTimer = setTimeout(function () { copy.textContent = t("crypto_copy"); }, 1500);
          }, function () { shake(copy); });
        });

        function show() {
          clearTimeout(copiedTimer);
          copy.textContent = t("crypto_copy");
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
