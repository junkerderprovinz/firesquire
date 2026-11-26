/* The notification channels and the schedule on FireSquire's settings page.
 * The channels are the house's notification card (scripts/notify-card.js),
 * the same file as in the other plugins, fed by an adapter over
 * FireSquireNotify.php: the channels in kit/notify's format, saved through
 * the notify helper. Secrets come back from the server masked, and the server
 * restores them when they come back unchanged, so a token never reaches the
 * browser. */
(function () {
  var box = document.getElementById("fs-notify");
  var UI = window.fireSquireUI;
  if (!box || !UI) return;
  var L = window.fireSquireI18n || {};
  var el = UI.el;
  var ENDPOINT = "/plugins/firesquire/include/FireSquireNotify.php";
  // FireSquire sends its own Healthchecks pings, so the card offers that service too.
  var KINDS = ["unraid", "discord", "slack", "ntfy", "gotify", "matrix", "apprise", "smtp", "webhook", "healthchecks"];

  function t(k) { return L[k] == null ? k : String(L[k]); }
  function fill(s, args) { return args.reduce(function (m, a, i) { return m.split("{" + i + "}").join(a); }, s); }

  var seq = 0;
  function card(title) {
    var c = el("section", "fs-card"), h = el("h3", "fs-h"), s = el("span", null, title);
    s.id = "fs-n-h-" + (++seq);
    c.setAttribute("aria-labelledby", s.id);
    c.setAttribute("data-glim", "Card");
    c.setAttribute("data-glim-title", title);
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

  // Unraid's webGUI never answers a multipart POST, so the body goes URL-encoded.
  function post(data) {
    var f = new URLSearchParams();
    f.append("csrf_token", window.csrf_token || "");
    Object.keys(data).forEach(function (k) { f.append(k, data[k]); });
    return fetch(ENDPOINT, { method: "POST", body: f, credentials: "same-origin" }).then(function (r) { return r.json(); });
  }
  function load() {
    return fetch(ENDPOINT, { credentials: "same-origin" }).then(function (r) { return r.json(); });
  }

  // A message under a card: a confirmation that goes away by itself, or a
  // failure that stays until the next save works.
  function tell(msg, text, passing) {
    clearTimeout(msg.fade);
    msg.textContent = text;
    if (passing) msg.fade = setTimeout(function () { msg.textContent = ""; }, 2500);
  }

  var cN = card(t("n_card"));
  cN.appendChild(el("p", "fs-prose", t("n_lead")));
  var missing = el("p", "fs-prose", t("n_nohelper"));
  missing.hidden = true;
  cN.appendChild(missing);
  var hub = el("p", "fs-prose fs-n-hub", t("n_hub_on"));
  hub.hidden = true;
  cN.appendChild(hub);
  var place = el("div", "fs-n-channels");
  cN.appendChild(place);
  var saveMsg = el("span", "fs-n-msg");
  saveMsg.setAttribute("role", "status");
  cN.appendChild(saveMsg);

  var first = load();
  first.then(function (d) {
    missing.hidden = !!d.helper;
    hub.hidden = d.hub !== true;
  }).catch(function () {});

  // The card's strings, with the word for a test that went well chosen by the
  // way the test took: through TollRoll's hub, or to the channel because the
  // hub did not take it.
  var strings = Object.assign({}, L), testOk = strings.nc_test_ok;
  if (window.GlimNotifyCard) {
    window.GlimNotifyCard.mount(place, {
      load: function () {
        return first.then(function (d) {
          if (!d || !Array.isArray(d.channels)) throw { code: (d && d.error) || "engine" };
          return d.channels;
        });
      },
      save: function (list) {
        return post({ "do": "save", channels: JSON.stringify(list) }).then(function (r) {
          if (!r.channels) throw { code: r.problems && r.problems.length ? "invalid" : r.error || "engine", problems: r.problems };
          return r.channels;
        });
      },
      test: function (channel) {
        return post({ "do": "test", channel: JSON.stringify(channel) }).then(function (r) {
          strings.nc_test_ok = r.hub === true ? t("n_sent_hub") : r.hub === false ? testOk + ". " + t("n_hub_skipped") : testOk;
          return { ok: r.hub === true || !!r.ok, code: r.code || r.error };
        });
      }
    }, {
      t: strings, lang: window.fireSquireLang || "en", kinds: KINDS, marks: window.GlimNotifyMarks,
      classes: { button: "fs-btn" },
      saved: function (ok, text) { tell(saveMsg, text, ok); }
    });
  }

  // A check finished elsewhere on the page may have found TollRoll's hub.
  document.addEventListener("firesquire:checked", function () {
    load().then(function (d) { hub.hidden = d.hub !== true; }).catch(function () {});
  });

  // The schedule's controls stand at the end of their row, as every row's do.
  var cS = card(t("n_sched"));
  cS.appendChild(el("p", "fs-prose", t("n_sched_lead")));
  var sRow = el("div", "fs-row"), sEnd = el("span", "fs-row-end");
  var every = select([["off", t("n_sched_off")], ["daily", t("n_sched_daily")], ["weekly", t("n_sched_weekly")]], "off");
  every.setAttribute("aria-label", t("n_sched"));
  var at = el("button", "fs-n-at");
  at.type = "button";
  var atL = labelled(t("n_sched_hour"), at);
  window.GlimTimeField.enhance(at, { label: t("n_sched_hour") });
  at.value = "04:30";
  var sMsg = el("span", "fs-n-msg");
  sMsg.setAttribute("role", "status");
  function schedule() {
    var when = window.GlimTimeField.parse(at.value);
    post({ "do": "schedule", every: every.value, hour: when.hour, minute: when.minute }).then(function (s) {
      if (s.every) tell(sMsg, t("n_sched_saved"), true);
      else tell(sMsg, fill(t("n_failed"), [s.error || "?"]));
    }).catch(function () { tell(sMsg, fill(t("n_failed"), ["network"])); });
  }
  every.addEventListener("change", schedule);
  at.addEventListener("change", schedule);
  sEnd.appendChild(every);
  sEnd.appendChild(atL[0]);
  sEnd.appendChild(at);
  sRow.appendChild(sMsg);
  sRow.appendChild(sEnd);
  cS.appendChild(sRow);

  first.then(function (d) {
    if (d.schedule) {
      every.value = d.schedule.every;
      at.value = window.GlimTimeField.format(d.schedule.hour, d.schedule.minute == null ? 30 : d.schedule.minute);
    }
  }).catch(function () {});
})();
