/* GlimStone's time picker for a page without a framework ("The time picker"
 * in the design language): a field-styled button that shows HH:MM and opens a
 * popover with an hour and a minute column, so a time is picked and never
 * typed. The browser's own time input brings a widget no theme can reach.
 *
 * enhance(button, opts) turns a <button> into the field. It keeps a value in
 * HH:MM and fires change on the button whenever a pick changes it, the way an
 * input would, so the page reads and listens to it like any other field.
 * opts.label names the field, opts.step the minutes between two rows (5).
 * styles/time-field.css draws it, and both files serve every plugin as they are. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GlimTimeField = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // GlimStone's IconSchedules, the clock of the house.
  var CLOCK = '<svg viewBox="0 0 14 14" fill="currentColor" aria-hidden="true" focusable="false"><path fill-rule="evenodd" d="M7 14c3.866 0 7 -3.134 7 -7 0 -3.86599 -3.134 -7 -7 -7 -3.86599 0 -7 3.13401 -7 7 0 3.866 3.13401 7 7 7Zm0.625 -9.5c0 -0.34518 -0.27982 -0.625 -0.625 -0.625s-0.625 0.27982 -0.625 0.625V7c0 0.14621 0.05126 0.28779 0.14486 0.40012l2.5 2.99998c0.22098 0.2652 0.61508 0.301 0.88026 0.08 0.26518 -0.2209 0.30098 -0.61504 0.08002 -0.88022L7.625 6.77372V4.5Z" clip-rule="evenodd"/></svg>';

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function format(hour, minute) {
    return pad(hour) + ':' + pad(minute);
  }

  // A value it cannot read stands as midnight, so the field stays usable.
  function parse(value) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(value == null ? '' : value).trim());
    if (!m) return { hour: 0, minute: 0 };
    return { hour: Math.min(23, parseInt(m[1], 10)), minute: Math.min(59, parseInt(m[2], 10)) };
  }

  function minutes(step) {
    var out = [];
    for (var m = 0; m < 60; m += step) out.push(m);
    return out;
  }

  // The offered minute nearest to n, so a stored 22:07 still marks a row.
  function nearest(options, n) {
    return options.reduce(function (best, o) { return Math.abs(o - n) < Math.abs(best - n) ? o : best; }, options[0]);
  }

  // Where a key moves within a column of count rows from row at, or null.
  function step(key, at, count) {
    if (key === 'ArrowDown') return Math.min(at + 1, count - 1);
    if (key === 'ArrowUp') return Math.max(at - 1, 0);
    if (key === 'Home') return 0;
    if (key === 'End') return count - 1;
    return null;
  }

  var current = null;

  function enhance(button, opts) {
    opts = opts || {};
    var doc = button.ownerDocument;
    var label = opts.label || '', mins = minutes(opts.step || 5), value = '00:00';
    button.classList.add('glim-tf-field');
    var text = doc.createElement('span');
    var glyph = doc.createElement('span');
    glyph.className = 'glim-tf-g';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.innerHTML = CLOCK;
    text.className = 'glim-tf-v';
    button.textContent = '';
    button.appendChild(glyph);
    button.appendChild(text);
    button.setAttribute('dir', 'ltr');
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');

    function shown() {
      var t = parse(value);
      return { hour: t.hour, minute: nearest(mins, t.minute) };
    }
    function paint() {
      text.textContent = value;
      button.setAttribute('aria-label', label + ': ' + value);
    }
    Object.defineProperty(button, 'value', {
      configurable: true,
      get: function () { return value; },
      set: function (v) { var t = parse(v); value = format(t.hour, t.minute); paint(); }
    });
    paint();

    function pick(hour, minute) {
      var next = format(hour, minute);
      if (next === value) return;
      value = next;
      paint();
      button.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function open() {
      if (current) current.close();
      var pop = doc.createElement('div');
      pop.className = 'glim-tf';
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-label', label);
      pop.setAttribute('dir', 'ltr');
      var cols = [];

      function column(items, isHour) {
        var ul = doc.createElement('ul');
        ul.className = 'glim-tf-col';
        ul.setAttribute('role', 'listbox');
        ul.setAttribute('aria-label', label);
        items.forEach(function (n) {
          var li = doc.createElement('li');
          var b = doc.createElement('button');
          b.type = 'button';
          b.className = 'glim-tf-opt';
          b.setAttribute('role', 'option');
          b.textContent = pad(n);
          b.addEventListener('click', function () {
            var s = shown();
            if (isHour) pick(n, s.minute);
            else { pick(s.hour, n); close(true); return; }
            mark();
          });
          li.appendChild(b);
          ul.appendChild(li);
        });
        cols.push({ ul: ul, items: items, isHour: isHour });
        return ul;
      }

      function options(col) {
        return Array.prototype.slice.call(col.ul.querySelectorAll('.glim-tf-opt'));
      }
      function chosen(col) {
        var s = shown();
        return col.items.indexOf(col.isHour ? s.hour : s.minute);
      }
      function mark() {
        cols.forEach(function (col) {
          var at = chosen(col);
          options(col).forEach(function (b, i) {
            b.setAttribute('aria-selected', String(i === at));
            b.tabIndex = i === at ? 0 : -1;
          });
        });
      }

      pop.appendChild(column(Array.apply(null, Array(24)).map(function (_, i) { return i; }), true));
      var colon = doc.createElement('span');
      colon.className = 'glim-tf-colon';
      colon.setAttribute('aria-hidden', 'true');
      colon.textContent = ':';
      pop.appendChild(colon);
      pop.appendChild(column(mins, false));
      mark();
      doc.body.appendChild(pop);

      // Below the field and centred on it, kept 8px inside the viewport, and
      // above it where below would clip.
      var r = button.getBoundingClientRect(), vw = doc.documentElement.clientWidth, vh = doc.documentElement.clientHeight;
      var w = pop.offsetWidth, ht = pop.offsetHeight, cx = r.left + r.width / 2;
      pop.style.left = Math.max(8 + w / 2, Math.min(vw - 8 - w / 2, cx)) + 'px';
      pop.style.top = (r.bottom + 6 + ht > vh && r.top - 6 - ht >= 0 ? r.top - 6 - ht : r.bottom + 6) + 'px';
      cols.forEach(function (col) {
        var b = options(col)[chosen(col)];
        if (b && b.scrollIntoView) b.scrollIntoView({ block: 'center' });
      });

      pop.addEventListener('keydown', function (e) {
        var ci = -1;
        cols.forEach(function (col, i) { if (col.ul.contains(e.target)) ci = i; });
        if (ci < 0) return;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          var other = cols[e.key === 'ArrowLeft' ? 0 : 1];
          options(other)[chosen(other)].focus();
          return;
        }
        var col = cols[ci], to = step(e.key, chosen(col), col.items.length);
        if (to === null) return;
        e.preventDefault();
        var s = shown();
        if (col.isHour) pick(col.items[to], s.minute);
        else pick(s.hour, col.items[to]);
        mark();
        var b = options(col)[to];
        b.focus();
        if (b.scrollIntoView) b.scrollIntoView({ block: 'nearest' });
      });

      function away(e) {
        if (!pop.contains(e.target) && e.target !== button && !button.contains(e.target)) close(false);
      }
      function key(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
      }
      // The columns scroll themselves, so only a scroll outside closes it.
      function scrolled(e) {
        if (!pop.contains(e.target)) close(false);
      }
      function close(refocus) {
        if (!pop.parentNode) return;
        pop.parentNode.removeChild(pop);
        doc.removeEventListener('pointerdown', away, true);
        doc.removeEventListener('keydown', key, true);
        doc.defaultView.removeEventListener('scroll', scrolled, true);
        doc.defaultView.removeEventListener('resize', closeNow);
        button.setAttribute('aria-expanded', 'false');
        current = null;
        if (refocus) button.focus();
      }
      function closeNow() { close(false); }
      doc.addEventListener('pointerdown', away, true);
      doc.addEventListener('keydown', key, true);
      doc.defaultView.addEventListener('scroll', scrolled, true);
      doc.defaultView.addEventListener('resize', closeNow);
      button.setAttribute('aria-expanded', 'true');
      current = { close: close };
      options(cols[0])[chosen(cols[0])].focus();
    }

    button.addEventListener('click', function () {
      if (button.getAttribute('aria-expanded') === 'true' && current) current.close(true);
      else open();
    });
    return button;
  }

  return { enhance: enhance, parse: parse, format: format, minutes: minutes, nearest: nearest, step: step };
});
