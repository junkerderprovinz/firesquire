/* The Health tab: how the server stands, area by area. Every full check, the
 * scheduled ones and the one before a reboot alike, leaves its lights behind,
 * and FireSquireHealth.php hands them over with the last 30 days. The advice
 * on the settings stands in a card of its own, without a light, so it never
 * drowns them. The windows and buttons come from firesquire.js. */
(function () {
  var root = document.getElementById("fs-health");
  var UI = window.fireSquireUI;
  if (!root || !UI) return;
  var URL = "/plugins/firesquire/include/FireSquireHealth.php";
  var AREAS = ["disks", "array", "docker", "vms", "flash", "network", "system", "fortress"];
  var STATUS = { fail: "red", warn: "yellow", pass: "green", info: "grey" };
  var el = UI.el;
  function t(k, args) { var s = UI.t(k, args); return s == null ? k : s; }

  function card(title, cls) {
    var c = el("section", "fs-card" + (cls ? " " + cls : "")), h = el("h3", "fs-h");
    h.appendChild(el("span", null, title));
    c.setAttribute("data-glim", "Card");
    c.setAttribute("data-glim-title", title);
    c.appendChild(h);
    return c;
  }
  function finding(f) {
    var li = el("li", "fs-finding fs-light-" + (STATUS[f.status] || "grey"));
    li.textContent = UI.t(f.key, f.args) || f.message || "";
    return li;
  }
  function days(history, area) {
    var strip = el("span", "fs-days");
    strip.setAttribute("role", "img");
    strip.setAttribute("aria-label", t("h_days"));
    history.forEach(function (d) {
      var l = (d.lights && d.lights[area]) || "grey", day = el("span", "fs-day fs-light-" + l);
      day.setAttribute("title", t("h_day", [d.date, t("h_light_" + l)]));
      strip.appendChild(day);
    });
    return strip;
  }

  var run = null;
  function draw(state) {
    root.textContent = "";
    var c = card(t("h_title"), "fs-card-health");
    c.appendChild(el("p", "fs-prose", t("h_lead")));
    var head = el("div", "fs-row");
    var last = state && state.last;
    head.appendChild(el("span", "fs-health-when", !state ? t("h_failed") : last ? t("h_checked", [last.generated]) : t("h_never")));
    run = UI.button("fs-health-run", "Check", t("h_check"));
    run.addEventListener("click", function () { load(true); });
    head.appendChild(run);
    c.appendChild(head);
    root.appendChild(c);
    if (!last) return;

    var list = el("ul", "fs-areas");
    AREAS.forEach(function (name) {
      var a = last.areas[name] || { light: "grey", findings: [] };
      var li = el("li", "fs-area fs-light-" + a.light), more = el("details", "fs-area-more"), sum = el("summary", "fs-area-sum");
      sum.appendChild(el("span", "fs-dot"));
      sum.appendChild(el("span", "fs-area-name", t("h_area_" + name)));
      sum.appendChild(el("span", "fs-area-word", t("h_light_" + a.light)));
      sum.appendChild(days(state.history || [], name));
      more.appendChild(sum);
      var found = el("ul", "fs-findings");
      a.findings.forEach(function (f) { found.appendChild(finding(f)); });
      more.appendChild(found);
      li.appendChild(more);
      list.appendChild(li);
    });
    c.appendChild(list);

    var cfg = card(t("h_config"), "fs-card-config");
    cfg.appendChild(el("p", "fs-prose", t("h_config_lead")));
    var advice = el("ul", "fs-findings");
    (last.config || []).forEach(function (f) { advice.appendChild(finding(f)); });
    cfg.appendChild(advice);
    root.appendChild(cfg);
  }

  // A check takes a while for the SMART reads, so the button says it is busy.
  function load(fresh) {
    if (run) {
      run.disabled = true;
      run.querySelector(".fs-btn-l").textContent = t("h_checking");
    }
    fetch(URL + (fresh ? "?run=1" : ""), { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        var ok = s && typeof s === "object" && Array.isArray(s.history);
        draw(ok ? s : null);
        if (ok && !s.last && !fresh) load(true);
      }, function () { draw(null); });
  }
  load(false);
})();
