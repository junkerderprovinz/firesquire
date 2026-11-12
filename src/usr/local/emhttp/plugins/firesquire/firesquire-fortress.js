/* The fortress card on FireSquire's settings page. Outside a fortress it has
 * one hidden field for the phrase, which joins on its own once it holds twelve
 * words and the typing pauses. Inside, it lists the other apps as connected or
 * not reachable, each with Remove, and offers a way out. The phrase goes to
 * the server once and is kept nowhere. */
(function () {
  var box = document.getElementById("fs-fortress");
  var UI = window.fireSquireUI;
  if (!box || !UI) return;
  var L = window.fireSquireI18n || {};
  var el = UI.el;
  var ENDPOINT = "/plugins/firesquire/include/FireSquireFortress.php";

  function t(k) { return L[k] == null ? k : String(L[k]); }
  function fill(s, args) { return args.reduce(function (m, a, i) { return m.split("{" + i + "}").join(a); }, s); }
  function json(r) { return r.json(); }
  // Unraid's webGUI never answers a multipart POST, so the body goes URL-encoded.
  function post(data) {
    var f = new URLSearchParams();
    f.append("csrf_token", window.csrf_token || "");
    Object.keys(data).forEach(function (k) { f.append(k, data[k]); });
    return fetch(ENDPOINT, { method: "POST", body: f, credentials: "same-origin" }).then(json);
  }

  var card = el("section", "fs-card"), h = el("h3", "fs-h"), title = el("span", null, t("f_card"));
  title.id = "fs-f-h";
  card.setAttribute("aria-labelledby", title.id);
  card.setAttribute("data-glim", "Card");
  card.setAttribute("data-glim-title", t("f_card"));
  h.appendChild(title);
  card.appendChild(h);
  card.appendChild(el("p", "fs-prose", t("f_lead")));
  var body = el("div", "fs-fort");
  card.appendChild(body);
  var msg = el("p", "fs-n-msg");
  msg.setAttribute("role", "status");
  card.appendChild(msg);
  box.appendChild(card);

  function tell(text, passing) {
    clearTimeout(msg.fade);
    msg.textContent = text;
    if (passing) msg.fade = setTimeout(function () { msg.textContent = ""; }, 2500);
  }
  function failed(r) { return fill(t("n_failed"), [(r && r.error) || "network"]); }
  function row(into, label, tip) {
    var r = el("div", "fs-row"), l = el("span", "fs-row-lbl", label), end = el("span", "fs-row-end");
    if (tip) l.appendChild(UI.info(tip));
    r.appendChild(l);
    r.appendChild(end);
    into.appendChild(r);
    return end;
  }

  // Every draw counts, so a member list that arrives after leaving is dropped.
  var drawn = 0;
  function draw(s) {
    drawn++;
    body.textContent = "";
    if (!s.helper) body.appendChild(el("p", "fs-prose", t("f_nohelper")));
    else if (s.joined) inside(s);
    else door();
  }

  function count(text) {
    var w = String(text).trim();
    return w ? w.split(/\s+/).length : 0;
  }
  var typing = null, joining = false;
  function door() {
    var input = el("input", "fs-in fs-phrase");
    input.type = "password";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = t("f_join_ph");
    input.setAttribute("aria-label", t("f_join"));
    input.addEventListener("input", function () {
      clearTimeout(typing);
      if (count(input.value) === 12) typing = setTimeout(function () { join(input); }, 800);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      clearTimeout(typing);
      join(input);
    });
    row(body, t("f_join"), t("f_join_info")).appendChild(input);
  }
  function join(input) {
    if (joining) return;
    if (!count(input.value)) { tell(t("f_err_phrase")); return; }
    joining = true;
    input.disabled = true;
    tell(t("f_joining"));
    post({ "do": "join", phrase: input.value }).then(function (r) {
      if (r.joined) {
        input.value = "";
        draw(r);
        tell(t("f_joined"), true);
        return;
      }
      input.disabled = false;
      tell(r.error === "phrase" ? t("f_err_phrase") : r.error === "member" ? t("f_err_member") : failed(r));
      if (r.error === "member") load();
    }, function () {
      input.disabled = false;
      tell(failed());
    }).then(function () { joining = false; });
  }

  function memberName(m) { return fill(t("f_member"), [m.app, m.device]); }
  function names(list) {
    return new Intl.ListFormat(window.fireSquireLang || "en", { type: "unit" }).format(list.map(memberName));
  }
  // FireSquire keeps no phrase, so changing it means opening an app that does.
  function changeAt(at) { window.open(at.address, "_blank", "noopener,noreferrer"); }

  // Until the phrase changes, the old one lets the removed back in, so a line
  // says who they are and where the phrase changes.
  var phraseAt = null;
  function reminder(note, removed) {
    note.textContent = "";
    note.hidden = !removed.length;
    if (!removed.length) return;
    note.appendChild(el("span", null, fill(t("f_removed_note"), [names(removed)])));
    if (!phraseAt) { note.appendChild(el("span", null, t("f_change_none"))); return; }
    var at = phraseAt, change = UI.button("fs-fort-change", "Key", t("f_change"));
    change.addEventListener("click", function () { changeAt(at); });
    note.appendChild(change);
  }

  function inside(s) {
    var leave = UI.button(null, "SignOut", t("f_leave"));
    leave.setAttribute("aria-haspopup", "dialog");
    leave.addEventListener("click", function () { ask(leave); });
    row(body, fill(t("f_in"), [s.device])).appendChild(leave);
    var note = el("p", "fs-prose fs-fort-removed"), removed = s.removed || [];
    note.setAttribute("role", "status");
    body.appendChild(note);
    reminder(note, removed);
    var list = el("div", "fs-fort-list"), mine = drawn;
    body.appendChild(list);
    // A quick answer never flashes the waiting line.
    var wait = setTimeout(function () { list.appendChild(el("p", "fs-prose fs-fort-wait", t("f_looking"))); }, 400);
    fetch(ENDPOINT + "?do=members", { credentials: "same-origin" }).then(json).then(function (r) {
      clearTimeout(wait);
      if (mine !== drawn) return;
      list.textContent = "";
      if (!r.members) { list.appendChild(el("p", "fs-prose", failed(r))); return; }
      phraseAt = r.phraseAt || null;
      reminder(note, removed);
      if (!r.members.length) list.appendChild(el("p", "fs-prose", t("f_none")));
      r.members.forEach(function (m) {
        var end = row(list, memberName(m));
        end.appendChild(el("span", "fs-state " + (m.online ? "fs-state-on" : "fs-state-off"), t(m.online ? "f_connected" : "f_unreachable")));
        var rm = UI.button("fs-fort-rm", "Trash", t("f_remove"));
        rm.setAttribute("aria-haspopup", "dialog");
        rm.addEventListener("click", function () { askRemove(rm, m); });
        end.appendChild(rm);
      });
    }, function () {
      clearTimeout(wait);
      if (mine !== drawn) return;
      list.textContent = "";
      list.appendChild(el("p", "fs-prose", failed()));
    });
  }

  // Remove asks first, naming app and device. Once the member is out, the
  // same window offers to change the phrase, since the old one lets it back in.
  function askRemove(opener, m) {
    var name = memberName(m);
    var win = UI.openWindow({
      cls: "fs-win-remove", title: fill(t("f_remove_title"), [name]), opener: opener,
      build: function (wbody, w, act) {
        wbody.appendChild(el("p", "fs-win-text", fill(t("f_remove_body"), [name])));
        wbody.appendChild(el("p", "fs-win-text fs-win-sub", t("f_remove_back")));
        var error = el("p", "fs-win-text");
        error.setAttribute("role", "alert");
        error.hidden = true;
        wbody.appendChild(error);
        function fail(text) {
          go.disabled = false;
          error.hidden = false;
          error.textContent = text;
        }
        var cancel = act.querySelector(".fs-win-btn"), words = cancel.querySelector(".fs-btn-l");
        words.textContent = t("g_cancel");
        var go = UI.button("fs-win-btn fs-key", "Trash", t("f_remove"));
        go.addEventListener("click", function () {
          go.disabled = true;
          post({ "do": "remove", id: m.id }).then(function (r) {
            if (!r.joined) { fail(r.error === "noMember" ? t("f_err_no_member") : failed(r)); return; }
            draw(r);
            offerChange(win, w, wbody, act, words, go, name);
          }, function () { fail(failed()); });
        });
        act.appendChild(go);
        return go;
      }
    });
  }
  function offerChange(win, w, wbody, act, later, go, name) {
    w.querySelector(".fs-win-title").textContent = t("f_removed_title");
    w.setAttribute("data-glim-title", t("f_removed_title"));
    wbody.textContent = "";
    wbody.appendChild(el("p", "fs-win-text", fill(t("f_removed_body"), [name])));
    later.textContent = t("f_later");
    go.remove();
    var at = phraseAt;
    if (!at) {
      wbody.appendChild(el("p", "fs-win-text fs-win-sub", t("f_change_none")));
      later.parentNode.focus();
      return;
    }
    wbody.appendChild(el("p", "fs-win-text fs-win-sub", fill(t("f_change_where"), [memberName(at)])));
    var change = UI.button("fs-win-btn fs-key", "Key", t("f_change"));
    change.addEventListener("click", function () { win.close(); changeAt(at); });
    act.appendChild(change);
    change.focus();
  }

  // Leaving asks first and says what ends; the phrase brings FireSquire back.
  function ask(opener) {
    var win = UI.openWindow({
      cls: "fs-win-leave", title: t("f_leave_title"), opener: opener,
      build: function (wbody, w, act) {
        wbody.appendChild(el("p", "fs-win-text", t("f_leave_body")));
        var cancel = act.querySelector(".fs-win-btn"), words = cancel && cancel.querySelector(".fs-btn-l");
        if (words) words.textContent = t("g_cancel");
        var go = UI.button("fs-win-btn fs-key", "SignOut", t("f_leave"));
        go.addEventListener("click", function () { win.close(); leave(); });
        act.appendChild(go);
        return cancel;
      }
    });
  }
  function leave() {
    post({ "do": "leave" }).then(function (r) {
      if (r.joined === false) {
        draw(r);
        tell(t("f_left"), true);
        return;
      }
      tell(r.error === "notMember" ? t("f_err_not_member") : failed(r));
      load();
    }, function () { tell(failed()); });
  }

  function load() {
    fetch(ENDPOINT, { credentials: "same-origin" }).then(json).then(draw, function () { tell(failed()); });
  }
  load();
})();
