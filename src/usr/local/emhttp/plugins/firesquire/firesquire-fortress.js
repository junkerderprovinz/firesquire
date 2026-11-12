/* FireSquire's side of GlimStone's fortress card: every step goes to
 * include/FireSquireFortress.php, which runs ParleyPort's fortress helper and
 * answers the state after it. The card does the drawing and the texts. */
(function () {
  var box = document.getElementById("fs-fortress");
  var Card = window.GlimFortressCard;
  if (!box || !Card) return;
  var ENDPOINT = "/plugins/firesquire/include/FireSquireFortress.php";
  var lang = window.fireSquireLang || "en";

  // A refusal comes as { error }, which the card reads as its code.
  function answer(r) {
    return r.json().then(function (body) {
      if (body.error) throw { code: body.error };
      return body;
    });
  }
  function get(query) {
    return fetch(ENDPOINT + (query || ""), { credentials: "same-origin" }).then(answer);
  }
  // Unraid's webGUI never answers a multipart POST, so the body goes URL-encoded.
  function post(data) {
    var f = new URLSearchParams();
    f.append("csrf_token", window.csrf_token || "");
    Object.keys(data).forEach(function (k) { f.append(k, data[k]); });
    return fetch(ENDPOINT, { method: "POST", body: f, credentials: "same-origin" }).then(answer);
  }

  function when(at) {
    return new Date(at).toLocaleString(lang, { dateStyle: "medium", timeStyle: "short" });
  }

  Card.mount(box, {
    load: function () {
      return get().then(function (s) { return s.helper ? s : null; });
    },
    join: function (words) { return post({ "do": "join", phrase: words.join(" ") }); },
    leave: function () { return post({ "do": "leave" }); },
    remove: function (id) { return post({ "do": "remove", id: id }); },
    status: function (id) {
      return get("?do=status&id=" + encodeURIComponent(id) + "&lang=" + encodeURIComponent(lang)).then(function (r) {
        var next = (r.report.next || []).map(function (n) { return Object.assign({}, n, { at: when(n.at) }); });
        return { report: Object.assign({}, r.report, { next: next }), log: r.log || [] };
      });
    }
  }, { lang: lang, app: { id: "firesquire", name: "FireSquire" } });
})();
