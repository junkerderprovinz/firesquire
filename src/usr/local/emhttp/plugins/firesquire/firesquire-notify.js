/* The notification channels and the schedule on FireSquire's settings page.
 * Every channel carries the fields of its service in kit/notify's format.
 * Secrets come back from the server masked, and the server restores them when
 * they come back unchanged, so a token never reaches the browser. */
(function () {
  var box = document.getElementById("fs-notify");
  var UI = window.fireSquireUI;
  if (!box || !UI) return;
  var L = window.fireSquireI18n || {};
  var el = UI.el;
  var ENDPOINT = "/plugins/firesquire/include/FireSquireNotify.php";

  function t(k) { return L[k] == null ? k : String(L[k]); }
  function fill(s, args) { return args.reduce(function (m, a, i) { return m.split("{" + i + "}").join(a); }, s); }

  // The fields of each service: name, label, input type, then a placeholder
  // or the options of a select.
  var KINDS = {
    unraid: [],
    apprise: [["url", "n_f_url", "text", "http://192.168.1.10:8000/notify/firesquire"], ["urls", "n_f_urls", "lines", "tgram://bottoken/chatid"], ["tags", "n_f_tags", "text", "all"]],
    ntfy: [["url", "n_f_url", "text", "https://ntfy.sh/your-topic"], ["token", "n_f_token", "secret"]],
    gotify: [["url", "n_f_url", "text", "https://gotify.example.org"], ["token", "n_f_token", "secret"]],
    matrix: [["homeserver", "n_f_homeserver", "text", "https://matrix.org"], ["room", "n_f_room", "text", "!room:matrix.org"], ["token", "n_f_token", "secret"]],
    discord: [["url", "n_f_url", "text", "https://discord.com/api/webhooks/…"]],
    slack: [["url", "n_f_url", "text", "https://hooks.slack.com/services/…"]],
    smtp: [["host", "n_f_host", "text", "smtp.example.org"], ["port", "n_f_port", "number", "587"], ["tls", "n_f_tls", "select", ["starttls", "tls", "none"]],
      ["username", "n_f_username", "text"], ["password", "n_f_password", "secret"], ["from", "n_f_from", "text", "tower@example.org"], ["to", "n_f_to", "text", "you@example.org"]],
    webhook: [["url", "n_f_url", "text", "https://example.org/hook"], ["method", "n_f_method", "select", ["POST", "PUT", "GET"]],
      ["headers", "n_f_headers", "headers", "Authorization: Bearer …"], ["body", "n_f_body", "area", '{"title":"%%title%%","body":"%%body%%"}']],
    healthchecks: [["url", "n_f_url", "text", "https://hc-ping.com/…"]]
  };
  var NAMES = { unraid: "Unraid", apprise: "Apprise", ntfy: "ntfy", gotify: "Gotify", matrix: "Matrix", discord: "Discord",
    slack: "Slack", smtp: t("n_email"), webhook: "Webhook", healthchecks: "Healthchecks" };

  var seq = 0;
  function card(title) {
    var c = el("section", "fs-card"), h = el("h3", "fs-h"), s = el("span", null, title);
    s.id = "fs-n-h-" + (++seq);
    c.setAttribute("aria-labelledby", s.id);
    h.appendChild(s);
    c.appendChild(h);
    box.appendChild(c);
    return c;
  }
  function select(options, value) {
    var s = el("select", "fs-in");
    options.forEach(function (o) {
      var opt = el("option", null, o[1]);
      opt.value = o[0];
      s.appendChild(opt);
    });
    s.value = value;
    return s;
  }
  function labelled(text, input) {
    var l = el("label", null, text);
    input.id = "fs-n-in-" + (++seq);
    l.htmlFor = input.id;
    return [l, input];
  }

  function post(data) {
    var f = new FormData();
    f.append("csrf_token", window.csrf_token || "");
    Object.keys(data).forEach(function (k) { f.append(k, data[k]); });
    return fetch(ENDPOINT, { method: "POST", body: f, credentials: "same-origin" }).then(function (r) { return r.json(); });
  }

  // What the server keeps of a channel: its own settings block and nothing of
  // a service it was switched away from. FireSquire sends only what matters,
  // so every channel takes every message.
  function clean(c) {
    var out = { id: c.id, kind: c.kind, name: c.name || "", enabled: !!c.enabled };
    out.on = "always";
    ["attempts", "timeoutSeconds", "events"].forEach(function (k) { if (c[k] != null) out[k] = c[k]; });
    if (c.kind !== "unraid") out[c.kind] = c[c.kind] || {};
    return out;
  }

  function read(input, type) {
    var v = input.value;
    if (type === "number") return v === "" ? 0 : parseInt(v, 10) || 0;
    if (type === "lines") return v.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    if (type === "headers") {
      var h = {};
      v.split("\n").forEach(function (line) {
        var i = line.indexOf(":");
        if (i > 0) h[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      });
      return h;
    }
    return type === "area" ? v : v.trim();
  }

  function field(c, spec) {
    var block = c[c.kind] || (c[c.kind] = {});
    var name = spec[0], type = spec[2], v = block[name], input;
    if (type === "select") {
      input = select(spec[3].map(function (o) { return [o, o]; }), v || spec[3][0]);
      block[name] = input.value;
    } else if (type === "area" || type === "lines" || type === "headers") {
      input = el("textarea", "fs-in");
      input.value = type === "lines" ? (v || []).join("\n") :
        type === "headers" ? Object.keys(v || {}).map(function (k) { return k + ": " + v[k]; }).join("\n") : (v || "");
    } else {
      input = el("input", "fs-in");
      input.type = type === "secret" ? "password" : type === "number" ? "number" : "text";
      input.autocomplete = type === "secret" ? "new-password" : "off";
      input.value = v == null || v === 0 ? "" : v;
    }
    if (spec[3] && type !== "select") input.placeholder = spec[3];
    input.addEventListener(type === "select" ? "change" : "input", function () { block[name] = read(input, type); });
    return labelled(t(spec[1]), input);
  }

  var channels = [], list, saveMsg;

  function channelBox(c) {
    var b = el("div", "fs-ch"), head = el("div", "fs-ch-head");
    var kind = select(Object.keys(KINDS).map(function (k) { return [k, NAMES[k]]; }), c.kind);
    kind.setAttribute("aria-label", t("n_service"));
    kind.addEventListener("change", function () { c.kind = kind.value; draw(); });
    var name = el("input", "fs-in");
    name.type = "text";
    name.value = c.name || "";
    name.placeholder = t("n_name");
    name.setAttribute("aria-label", t("n_name"));
    name.addEventListener("input", function () { c.name = name.value; });
    var on = el("input");
    on.type = "checkbox";
    on.checked = !!c.enabled;
    on.addEventListener("change", function () { c.enabled = on.checked; });
    var onL = labelled(t("n_enabled"), on);
    head.appendChild(kind);
    head.appendChild(name);
    head.appendChild(onL[1]);
    head.appendChild(onL[0]);
    b.appendChild(head);

    var fields = el("div", "fs-ch-fields");
    KINDS[c.kind].forEach(function (spec) { field(c, spec).forEach(function (n) { fields.appendChild(n); }); });
    if (KINDS[c.kind].length) b.appendChild(fields);

    var act = el("div", "fs-ch-act"), res = el("span", "fs-n-msg");
    res.setAttribute("role", "status");
    var test = UI.button(null, "Forward", t("n_test"));
    test.addEventListener("click", function () {
      res.textContent = "…";
      post({ "do": "test", channel: JSON.stringify(clean(c)) }).then(function (r) {
        res.textContent = r.ok ? t("n_sent") : fill(t("n_failed"), [r.code || r.error || "?"]);
      }).catch(function () { res.textContent = fill(t("n_failed"), ["network"]); });
    });
    var remove = UI.button(null, "Close", t("n_remove"));
    remove.addEventListener("click", function () { channels.splice(channels.indexOf(c), 1); draw(); });
    act.appendChild(test);
    act.appendChild(remove);
    act.appendChild(res);
    b.appendChild(act);
    return b;
  }

  function draw() {
    list.textContent = "";
    if (!channels.length) list.appendChild(el("p", "fs-prose", t("n_none")));
    channels.forEach(function (c) { list.appendChild(channelBox(c)); });
  }

  // A problem names a field such as "ntfy.url"; the message names its label.
  function problem(p) {
    var c = channels[p.index] || {}, f = String(p.field || "").split(".").pop(), label = f;
    (KINDS[c.kind] || []).forEach(function (spec) { if (spec[0] === f) label = t(spec[1]); });
    return fill(t("n_problem"), [label, c.name || NAMES[c.kind] || p.channel]);
  }

  function save() {
    saveMsg.textContent = "…";
    post({ "do": "save", channels: JSON.stringify(channels.map(clean)) }).then(function (r) {
      if (r.channels) {
        channels = r.channels;
        draw();
        saveMsg.textContent = t("n_saved");
      } else if (r.problems && r.problems.length) {
        saveMsg.textContent = problem(r.problems[0]);
      } else {
        saveMsg.textContent = fill(t("n_failed"), [r.error || "?"]);
      }
    }).catch(function () { saveMsg.textContent = fill(t("n_failed"), ["network"]); });
  }

  var cN = card(t("n_card"));
  cN.appendChild(el("p", "fs-prose", t("n_lead")));
  var missing = el("p", "fs-prose", t("n_nohelper"));
  missing.hidden = true;
  cN.appendChild(missing);
  list = el("div", "fs-ch-list");
  cN.appendChild(list);
  var bar = el("div", "fs-ch-act");
  var add = UI.button(null, "Forward", t("n_add"));
  add.addEventListener("click", function () {
    channels.push({ id: "ch-" + Date.now().toString(36), kind: "unraid", enabled: true, on: "always" });
    draw();
  });
  var store = UI.button("fs-key", "Check", t("n_save"));
  store.addEventListener("click", save);
  saveMsg = el("span", "fs-n-msg");
  saveMsg.setAttribute("role", "status");
  bar.appendChild(add);
  bar.appendChild(store);
  bar.appendChild(saveMsg);
  cN.appendChild(bar);

  var cS = card(t("n_sched"));
  cS.appendChild(el("p", "fs-prose", t("n_sched_lead")));
  var sRow = el("div", "fs-ch-act");
  var every = select([["off", t("n_sched_off")], ["daily", t("n_sched_daily")], ["weekly", t("n_sched_weekly")]], "off");
  every.setAttribute("aria-label", t("n_sched"));
  var hours = [];
  for (var h = 0; h < 24; h++) hours.push([String(h), (h < 10 ? "0" : "") + h + ":30"]);
  var hour = select(hours, "4");
  var hourL = labelled(t("n_sched_hour"), hour);
  var sMsg = el("span", "fs-n-msg");
  sMsg.setAttribute("role", "status");
  var sSave = UI.button(null, "Check", t("n_save"));
  sSave.addEventListener("click", function () {
    sMsg.textContent = "…";
    post({ "do": "schedule", every: every.value, hour: hour.value }).then(function (s) {
      sMsg.textContent = s.every ? t("n_sched_saved") : fill(t("n_failed"), [s.error || "?"]);
    }).catch(function () { sMsg.textContent = fill(t("n_failed"), ["network"]); });
  });
  sRow.appendChild(every);
  sRow.appendChild(hourL[0]);
  sRow.appendChild(hour);
  sRow.appendChild(sSave);
  sRow.appendChild(sMsg);
  cS.appendChild(sRow);

  fetch(ENDPOINT, { credentials: "same-origin" }).then(function (r) { return r.json(); }).then(function (d) {
    channels = d.channels || [];
    missing.hidden = !!d.helper;
    if (d.schedule) {
      every.value = d.schedule.every;
      hour.value = String(d.schedule.hour);
    }
    draw();
  }).catch(draw);
})();
