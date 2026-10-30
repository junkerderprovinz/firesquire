/* WebGUI helper, loaded on every page by FireSquireButtons.page. Adds the entry
 * points on Main and the Dashboard, runs the check in its own window with a live
 * progress bar, and lends the settings page its windows and buttons through
 * window.fireSquireUI.
 *
 * Without TowerTorch everything follows Unraid's own look. With it, which puts
 * cc-popups-on on <html> on every page, firesquire.css gives the window, the
 * buttons and the report GlimStone's look from TowerTorch's tokens.
 *
 * Language: fs_i18n.php merges lang/en.json and lang/<code>.json for Unraid's
 * configured language and injects it as window.fireSquireI18n. The English
 * table below only answers when that injection is missing. */
(function(){

  /* English fallback, the source of lang/en.json. */
  var FS_EN = {
    title: 'FireSquire: Pre-Reboot Check',
    hc: 'pre-reboot health check',
    running: 'Running checks…',
    subtitle: 'Advisory only · nothing was changed',
    v_GO: 'GO', v_CAUTION: 'CAUTION', 'v_NO-GO': 'NO-GO',
    tier_critical: 'Critical', tier_warning: 'Caution', tier_info: 'Info',
    err: 'Could not run the check engine.',
    err_hint: 'Try again in a moment. If it keeps failing, the syslog may say why.',
    foot: 'FireSquire reads the current state and predicts the common reboot landmines (pinned mounts, stuck loops, unclean array, in-flight operations, a crash-looping box). It is an early warning, not a guarantee. Genuine hardware, BIOS or timing failures during boot cannot be seen from a running system.',
    tools_lead: 'FireSquire checks whether your server will come back up clean before you reboot, and gives one verdict (GO / CAUTION / NO-GO) with the exact findings. It is advisory only: it reads the host and reports, it never changes anything.',
    tools_intro: 'It looks for the reboot landmines that are detectable from the running system:',
    tools_li: [
      'Array started & clean: every device assignment OK (no disabled/invalid/missing disk)',
      'No parity/sync/rebuild/clear or mover in progress',
      'No container mounting a host runtime dir, no stuck docker.img/libvirt.img loop',
      'Flash writable, free space, recent crashes, running VMs, services, SMART health'
    ],
    tools_btn: 'Run pre-reboot check',
    tools_title: 'Pre-reboot check',
    tools_g_array: 'Array and disks',
    tools_g_ops: 'Running operations',
    tools_g_containers: 'Containers and images',
    tools_g_host: 'Flash, space and services',
    tools_note: 'Advisory only, it never changes anything',
    goto: 'Go to the source',
    retry: 'Check again',
    rel_notes: 'Release notes',
    give_close: 'Close',
    p_array: 'Checking array & disks…',
    p_mover: 'Checking mover…',
    p_mounts: 'Checking container mounts…',
    p_loops: 'Checking image loops…',
    p_flash: 'Checking flash drive…',
    p_crashes: 'Scanning syslog…',
    p_space: 'Checking free space…',
    p_vms: 'Checking VMs…',
    p_services: 'Checking core services…',
    p_binds: 'Checking container binds…',
    p_smart: 'Checking SMART health…',
    p_info: 'Collecting system info…',
    p_done: 'Done',
    array_ok: 'Array started and healthy; all device assignments OK.',
    array_bad_devices: 'Array not clean, unhealthy data disk(s): {0}',
    array_counts: 'Array not clean: state={0}, disabled={1} invalid={2} missing={3}',
    array_not_started: 'Array is not started (state={0}).',
    array_parity_degraded: 'Parity disk disabled/missing: {0}. The array still boots, but parity protection is reduced.',
    array_op_running: 'Array operation in progress ({0}). Let it finish before rebooting.',
    array_op_ok: 'No parity/sync/rebuild/clear in progress.',
    array_unknown: 'mdcmd not found, cannot determine array state.',
    mover_running: 'Mover is running. Wait for it to finish before rebooting.',
    mover_ok: 'Mover is not running.',
    risky_mount_found: 'Container(s) mount a host runtime dir (can break libvirt/docker on reboot):{0}',
    risky_mount_ok: 'No container mounts a host runtime directory (besides docker.sock).',
    risky_mount_skip: 'Docker not available, skipped container mount scan.',
    stuck_loop_found: 'Stuck image/loop state{0}.',
    stuck_loop_ok: 'docker.img / libvirt.img loop state looks clean.',
    stuck_loop_skip: 'losetup not found, skipped loop-device check.',
    flash_ok: 'Flash /boot is mounted and writable.',
    flash_ro: 'Flash /boot is mounted but NOT writable (possible FAT corruption). Config won’t persist.',
    flash_unmounted: 'Flash /boot is not mounted.',
    syslog_crashes: '{0} crash/instability line(s) in syslog since boot. Latest: {1}',
    syslog_ok: 'No crashes/OOM/segfaults in syslog since boot.',
    syslog_skip: 'syslog not readable, skipped crash scan.',
    io_errors: '{0} disk/IO error line(s) in syslog since boot. Latest: {1}',
    io_ok: 'No disk/IO errors in syslog since boot.',
    space_full: '{0} is {1}% full (>={2}%).',
    space_ok: '{0} at {1}% used.',
    vms_running: '{0} VM(s) running. Shut them down gracefully before rebooting.',
    vms_ok: 'No VMs running.',
    svc_docker_ok: 'dockerd running.',
    svc_docker_down: 'Docker storage mounted but dockerd is not running.',
    svc_libvirt_ok: 'libvirtd running.',
    svc_libvirt_down: 'libvirt enabled but libvirtd is not running.',
    svc_emhttp_ok: 'emhttpd (WebGUI) running.',
    svc_emhttp_down: 'emhttpd (WebGUI) is not running.',
    binds_missing: 'Container bind source(s) missing (won’t start cleanly after reboot):{0}',
    binds_ok: 'All container bind sources under /mnt exist.',
    smart_failing: 'SMART health FAILING on:{0}. Investigate before rebooting.',
    smart_ok: 'SMART health PASSED on {0} disk(s).',
    smart_none: 'No disks found for SMART check.',
    smart_skip: 'smartctl not found, skipped SMART check.',
    smart_attr: 'SMART attribute warnings:{0}',
    info_uptime: 'Uptime: {0}', info_kernel: 'Kernel: {0}', info_unraid: 'Unraid version: {0}'
  };

  var FS_I18N = (window.fireSquireI18n && typeof window.fireSquireI18n === 'object') ? window.fireSquireI18n : {};
  var FS_LANGCODE = String(window.fireSquireLang || (document.documentElement.getAttribute('lang') || 'en')).slice(0, 2).toLowerCase();
  var FS_RTL = ['ar', 'he', 'fa', 'ur'].indexOf(FS_LANGCODE) >= 0;
  var html = document.documentElement;
  var GLYPHS = window.fireSquireGlyphs || {};
  var LOGO = '/plugins/firesquire/images/firesquire.png';
  var REPORT_URL = '/plugins/firesquire/include/FireSquireReport.php';
  var STREAM_URL = '/plugins/firesquire/include/FireSquireStream.php';

  function fsT(key, args){
    var m = FS_I18N[key];
    if (m == null) m = FS_EN[key];
    if (m == null) return null;
    if (typeof m === 'string' && args && args.length) {
      for (var i = 0; i < args.length; i++) m = m.split('{' + i + '}').join(args[i]);
    }
    return m;
  }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"]/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];
    });
  }
  function get(k, d){ try { var v = localStorage.getItem(k); return v == null ? d : v; } catch(e){ return d; } }
  function el(tag, cls, text){
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* TowerTorch's colour engine: the accent, and under the rainbow one position
     per heading and per picked option. Without TowerTorch nothing is set and
     the page keeps Unraid's colours. */
  function themed(){ return html.classList.contains('cc-popups-on') && get('cc.theming', '1') !== '0'; }
  function hue(node, i){
    var C = window.CCTheme, c = '';
    if (i != null && themed() && get('cc.rainbow', '0') === '1' && C && C.rbColor) {
      c = C.rbColor(i, (getComputedStyle(html).getPropertyValue('--cc-accent') || '').trim() || '#FCC419');
    }
    if (c) {
      node.style.setProperty('--fs-hue', c);
      node.style.setProperty('--fs-hue-ink', C.idealText ? C.idealText(c) : '#161616');
    } else {
      node.style.removeProperty('--fs-hue');
      node.style.removeProperty('--fs-hue-ink');
    }
  }
  // TowerTorch's label mode for the buttons it draws, which FireSquire's buttons follow.
  function labelMode(){
    var m = themed() ? html.getAttribute('data-cc-labels-buttons') : '';
    return ['text', 'textGlyph', 'glyph', 'reactive'].indexOf(m) < 0 ? 'textGlyph' : m;
  }
  function glyph(name){
    var g = GLYPHS[name];
    return g ? '<svg viewBox="' + g[0] + '" fill="currentColor" aria-hidden="true" focusable="false">' + g[1] + '</svg>' : '';
  }

  /* A button wears its glyph and its words as two spans; the label mode decides
     how much of them shows. The words stay in the accessible name in every mode,
     and where only the glyph shows they become the button's bubble. */
  function button(cls, name, label, tag){
    var b = el(tag || 'button', 'fs-btn' + (cls ? ' ' + cls : ''));
    if (b.tagName === 'BUTTON') b.type = 'button';
    var g = el('span', 'fs-btn-g'), l = el('span', 'fs-btn-l', label);
    g.innerHTML = glyph(name);
    b.appendChild(g);
    b.appendChild(l);
    labelTip(b);
    return b;
  }
  function labelTip(b){
    var l = b.querySelector('.fs-btn-l');
    if (labelMode() === 'glyph') { b.setAttribute('data-tip', l.textContent); b.fsTip = true; }
    else if (b.fsTip) { b.removeAttribute('data-tip'); b.fsTip = false; }
  }
  function labelTips(){ Array.prototype.forEach.call(document.querySelectorAll('.fs-btn'), labelTip); }
  new MutationObserver(labelTips).observe(html, { attributes: true, attributeFilter: ['class', 'data-cc-labels-buttons'] });

  // The (i) of GlimStone's info bubble: the letter i set in a ring.
  var INFO_SVG = '<svg viewBox="0 0 16 16" width="15" height="15" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="4.6" r="0.9" fill="currentColor"/><path d="M8 7v4.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
  function info(tip){
    var s = el('span', 'fs-info');
    s.innerHTML = INFO_SVG;
    s.tabIndex = 0;
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', tip);
    s.setAttribute('data-tip', tip);
    return s;
  }

  /* A window: the title notched into its top edge, the content, and Close at
     the end of the foot. A window opened with head: true shows Unraid's own
     title bar with the logo and a close cross instead, until TowerTorch gives
     it GlimStone's notch and foot. Escape, the scrim and Close shut it, the
     focus stays inside while it is open and goes back to what opened it. */
  var FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, iframe, [tabindex]';
  var shown = null;
  function openWindow(o){
    if (shown) shown.close();
    var scrim = el('div', 'fs-scrim');
    var win = el('div', 'fs-win ' + (o.cls || '') + (o.head ? ' fs-win-headed' : ''));
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-modal', 'true');
    win.setAttribute('data-fs-labels', labelMode());
    win.tabIndex = -1;
    if (FS_RTL) win.dir = 'rtl';
    var title = el('h2', 'fs-win-title');
    title.id = 'fs-win-title';
    title.textContent = o.title;
    win.setAttribute('aria-labelledby', title.id);
    hue(title, 0);
    win.appendChild(title);
    if (o.head) {
      var head = el('div', 'fs-win-head'), name = el('span', 'fs-win-name'), logo = el('img', 'fs-win-logo');
      logo.src = LOGO; logo.alt = '';
      name.appendChild(logo);
      name.appendChild(el('span', null, o.title));
      var x = el('button', 'fs-win-x', '×');
      x.type = 'button';
      x.setAttribute('aria-label', fsT('give_close'));
      x.addEventListener('click', done);
      head.appendChild(name);
      head.appendChild(x);
      win.appendChild(head);
    }
    var body = el('div', 'fs-win-body');
    var act = el('div', 'fs-win-act'), close = button('fs-win-btn', 'Close', fsT('give_close'));
    act.appendChild(close);
    win.appendChild(body);
    win.appendChild(act);
    document.body.appendChild(scrim);
    document.body.appendChild(win);

    function focusables(){
      return Array.prototype.filter.call(win.querySelectorAll(FOCUSABLE), function(n){ return n.tabIndex >= 0 && n.getClientRects().length > 0; });
    }
    function onKey(e){
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(); return; }
      if (e.key !== 'Tab') return;
      var f = focusables(), a = document.activeElement;
      if (!f.length) { e.preventDefault(); win.focus(); return; }
      var first = f[0], last = f[f.length - 1];
      if (!win.contains(a)) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
      else if (e.shiftKey && (a === first || a === win)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && a === last) { e.preventDefault(); first.focus(); }
    }
    function done(){
      if (!shown || shown.win !== win) return;
      shown = null;
      document.removeEventListener('keydown', onKey, true);
      scrim.remove();
      win.remove();
      if (o.onClose) o.onClose();
      if (o.opener && document.contains(o.opener)) o.opener.focus();
    }
    scrim.addEventListener('click', done);
    close.addEventListener('click', done);
    document.addEventListener('keydown', onKey, true);
    shown = { win: win, close: done };
    var into = o.build(body, win, act);
    (into || win).focus();
    return shown;
  }

  window.fireSquireUI = {
    t: fsT, el: el, rtl: FS_RTL, themed: themed, hue: hue, labelMode: labelMode, glyph: glyph,
    button: button, info: info, openWindow: openWindow
  };

  // Clickable findings lead to the relevant Unraid page. Unraid has no URL param
  // to jump to a specific syslog line, so syslog/IO findings land on the full
  // syslog viewer (/Tools/Syslog).
  function fsLink(key){
    switch (key) {
      case 'syslog_crashes':
      case 'io_errors':
        return '/Tools/Syslog';
      case 'vms_running':
        return '/VMs';
      case 'svc_docker_down':
        return '/Settings/DockerSettings';
      case 'svc_libvirt_down':
        return '/Settings/VMSettings';
      case 'risky_mount_found':
      case 'binds_missing':
      case 'stuck_loop_found':
        return '/Docker';
      case 'array_not_started':
      case 'array_bad_devices':
      case 'array_counts':
      case 'array_op_running':
      case 'array_parity_degraded':
      case 'mover_running':
      case 'flash_ro':
      case 'flash_unmounted':
      case 'space_full':
      case 'smart_failing':
      case 'smart_attr':
        return '/Main';
      default:
        return null;   // svc_emhttp_down has no page (the WebGUI itself is down)
    }
  }

  var VCLASS = { GO: 'fs-v-go', CAUTION: 'fs-v-caution', 'NO-GO': 'fs-v-nogo' };
  var STATUS = { pass: ['Check', '✓'], warn: ['Warning', '!'], fail: ['Close', '✗'], info: ['Info', 'i'] };
  // The newest syslog line a finding quotes reads as the log it came from.
  var QUOTES_LOG = { syslog_crashes: 1, io_errors: 1 };

  function message(x){
    var tpl = FS_I18N[x.key] != null ? FS_I18N[x.key] : FS_EN[x.key];
    if (tpl == null) return esc(x.message || '');
    var out = esc(tpl), args = x.args || [];
    for (var i = 0; i < args.length; i++) {
      var a = esc(args[i]);
      if (QUOTES_LOG[x.key] && i === 1) a = '<code>' + a + '</code>';
      out = out.split('{' + i + '}').join(a);
    }
    return out;
  }

  // FireSquire's logo heads the verdict, drawn from .github/assets/firesquire.svg with its
  // diamond frame in currentColor, so the frame takes the verdict's colour: neutral while
  // the check runs, the state's colour once it has answered.
  var LOGO_SVG = '<svg viewBox="0 0 859.33 859.33" aria-hidden="true" focusable="false">' +
    '<path d="M431.25,686.99c-27.9-28.89-49.08-70.38-56.65-110.09-13.4-70.28,9.23-101.79,39.84-159.3,35.07-65.89,45.66-98.57,30.24-174.85-4.32-21.36-11.44-42.19-15.07-63.68,50.31,46.01,84.31,116.04,70.04,185.35-10.66,51.79-37.27,81.72-62.99,124.5-36.56,60.8-23.14,133.23-5.4,198.08Z" fill="#f9cc12"/><path d="M438.81,187.93c37.2,45.66,59.34,105.7,47.49,165.16-10.55,52.96-37.1,83.52-62.73,127.23-33.54,57.19-24.69,124.56-9.12,186.69,5.25,7.14,10.87,13.85,16.8,19.98-17.74-64.85-31.15-137.27,5.4-198.08,25.72-42.78,52.33-72.72,62.99-124.5,13.38-64.99-15.68-130.62-60.83-176.48Z" fill="#f39200"/><path d="M504.5,677.87c-32.39-33.86-46.73-87.93-35.29-133.62,9.98-39.83,44.34-70,60.85-107.64,18.31-41.75,9.83-75.82,8.87-119.21-.04-1.6-1.12-3,1.33-2.79,39.03,36.31,59.49,91.6,42.36,143.85-12.98,39.6-35.9,56.25-57.93,87.49-26.51,37.6-24.13,88.07-20.2,131.91Z" fill="#f39200"/><path d="M544.4,318.61c27.04,36.3,39.02,83.55,24.89,128.52-12.85,40.91-35.73,58.06-57.66,90.29-23.9,35.13-24.07,81.25-20.87,123.33,4.13,6.12,8.72,11.87,13.75,17.12-3.93-43.84-6.31-94.31,20.2-131.91,22.03-31.24,44.95-47.89,57.93-87.49,16.51-50.37-1.92-103.57-38.23-139.86Z" fill="#e8651c"/><path d="M339.35,567.91l-6.93-5.26c-30.24-32.83-47.23-77.26-41.21-122.28,6.22-46.46,45.66-83.54,55.2-130.94,7.27-36.1-3.22-71.03-6.94-106.75,27.91,20.78,49.65,52.11,57.09,86.42,8.39,38.67-3.89,75.09-23.63,107.95-9.88,16.44-24.34,31.87-31.76,49.29-16.01,37.6-8.96,82.66-1.83,121.57Z" fill="#fff57c"/><path d="M396.57,289.1c-6.16-28.38-22.11-54.72-43.24-74.74,14.3,17.92,24.91,39.08,29.71,61.46,8.48,39.57-3.72,76.81-23.4,110.38-9.84,16.8-24.27,32.55-31.65,50.35-15.06,36.32-9.49,79.5-2.75,117.74,2.31,2.85,4.7,5.64,7.19,8.35l6.93,5.26c-7.12-38.91-14.18-83.97,1.83-121.57,7.42-17.42,21.88-32.85,31.76-49.29,19.74-32.86,32.03-69.28,23.63-107.95Z" fill="#f9cc12"/>' +
    '<path class="fs-lf-lit" d="M799.83,401.51L457.8,59.49c-7.76-7.75-17.94-11.63-28.13-11.63v38.15l343.64,343.63-343.64,343.64v38.17c10.19,0,20.37-3.88,28.15-11.63l342.04-342.04c15.49-15.52,15.48-40.76-.03-56.28Z"/><path class="fs-lf" d="M842.33,388.6L470.7,16.97c-11.32-11.32-26.17-16.97-41.03-16.97v47.86c10.19,0,20.37,3.88,28.13,11.63l342.03,342.02c15.5,15.52,15.51,40.76.03,56.28l-342.04,342.04c-7.78,7.75-17.96,11.63-28.15,11.63v47.87c15.5,0,30.07-6.04,41.03-17.01l371.63-371.63c10.97-10.97,17.01-25.54,17.01-41.05s-6.04-30.09-17.01-41.05Z"/><path class="fs-lf" d="M429.67,86.02v-38.15c-10.19,0-20.39,3.88-28.15,11.64L59.5,401.51c-15.51,15.52-15.52,40.77,0,56.3l342.03,342.02c7.75,7.75,17.93,11.62,28.13,11.62h0v-38.17l-.02.02L86,429.65,429.65,86l.02.02Z"/><path class="fs-lf-lit" d="M401.52,59.5c7.76-7.76,17.96-11.64,28.15-11.64V0c-14.88,0-29.74,5.65-41.07,16.98L16.97,388.6c-22.63,22.63-22.63,59.47,0,82.1l371.63,371.63c10.97,10.97,25.55,17.01,41.05,17.01h.02v-47.87h0c-10.19,0-20.37-3.87-28.13-11.62L59.5,457.82c-15.52-15.54-15.51-40.78,0-56.3L401.52,59.5Z"/></svg>';
  function logoHTML(){ return '<span class="fs-v-logo">' + LOGO_SVG + '</span>'; }

  function verdictHTML(data){
    var v = data.verdict, word = fsT('v_' + v) || v;
    var tip = fsT('subtitle') + '. ' + fsT('foot');
    var h = '<div class="fs-verdict ' + (VCLASS[v] || 'fs-v-unknown') + '">';
    h += logoHTML() + '<div class="fs-v-word">' + esc(word) + '</div>';
    h += '<div class="fs-v-meta"><div class="fs-v-name">FireSquire: ' + esc(fsT('hc')) + '<span class="fs-v-info" data-info="' + esc(tip) + '"></span></div>';
    h += '<div class="fs-v-sub"><span class="fs-v-adv">' + esc(fsT('subtitle')) + (data.generated ? ' · ' : '') + '</span>' + (data.generated ? '<span class="fs-num">' + esc(data.generated) + '</span>' : '') + '</div></div></div>';
    return h;
  }

  function rowHTML(x, gs){
    var st = STATUS[x.status] ? x.status : 'info';
    var msg = message(x);
    // Only problem findings (warn/fail) lead to the page that can fix them.
    var link = (st === 'warn' || st === 'fail') ? fsLink(x.key) : null;
    var text = link && !gs
      ? '<a class="fs-f-link" href="' + esc(link) + '" title="' + esc(fsT('goto')) + '">' + msg + ' <span aria-hidden="true">&#8599;</span></a>'
      : msg;
    var h = '<div class="fs-f fs-st-' + st + '"><span class="fs-f-ic" aria-hidden="true"><span class="fs-f-g">' + glyph(STATUS[st][0]) + '</span><span class="fs-f-ch">' + STATUS[st][1] + '</span></span>';
    h += '<div class="fs-f-text">' + text + '</div>';
    if (link && gs) h += '<span class="fs-f-act" data-goto="' + esc(link) + '"></span>';
    return h + '</div>';
  }

  function reportHTML(data){
    var gs = themed(), checks = data.checks || [];
    var h = verdictHTML(data);
    [['critical', 'tier_critical'], ['warning', 'tier_warning'], ['info', 'tier_info']].forEach(function(tt){
      var grp = checks.filter(function(x){ return (x.tier || '') === tt[0]; });
      if (!grp.length) return;
      h += '<section class="fs-tier"><h3 class="fs-tier-h">' + esc(fsT(tt[1])) + '</h3>';
      grp.forEach(function(x){ h += rowHTML(x, gs); });
      h += '</section>';
    });
    return h + '<p class="fs-foot">' + esc(fsT('foot')) + '</p>';
  }

  // The parts a string cannot carry: the (i) and the buttons that lead away.
  function wireReport(body){
    Array.prototype.forEach.call(body.querySelectorAll('.fs-v-info'), function(n){ n.replaceWith(info(n.getAttribute('data-info'))); });
    Array.prototype.forEach.call(body.querySelectorAll('.fs-f-act'), function(n){
      var a = button('fs-f-go', 'Forward', fsT('goto'), 'a');
      a.href = n.getAttribute('data-goto');
      n.appendChild(a);
    });
  }

  function progressHTML(){
    return '<div class="fs-prog fs-v-unknown"><div class="fs-prog-lab">' + logoHTML() + '<span class="fs-prog-txt">' + esc(fsT('running')) + '</span><span class="fs-prog-pct fs-num"></span></div>' +
      '<div class="fs-prog-track"><div class="fs-prog-fill"></div></div></div>';
  }

  function errHTML(){
    return '<div class="fs-err fs-v-nogo">' + logoHTML() + '<div><p class="fs-err-text">' + esc(fsT('err')) +
      '</p><p class="fs-err-hint">' + esc(fsT('err_hint')) + '</p></div></div>';
  }

  // Stream the engine's progress markers, driving the bar, then hand the final
  // JSON to onResult. On any streaming failure, call onFail (which falls back to
  // the plain blocking request), so the report always appears.
  function streamRun(signal, setBar, onResult, onFail){
    var got = false;
    fetch(STREAM_URL, {headers: {'Accept': 'text/event-stream'}, credentials: 'same-origin', signal: signal}).then(function(resp){
      if (!resp.ok || !resp.body || !resp.body.getReader) throw new Error('no stream');
      var reader = resp.body.getReader(), dec = new TextDecoder(), buf = '';
      function pump(){
        return reader.read().then(function(r){
          if (r.value) buf += dec.decode(r.value, {stream: true});
          var nl;
          while ((nl = buf.indexOf('\n')) >= 0) {
            var line = buf.slice(0, nl).replace(/\r$/, ''); buf = buf.slice(nl + 1);
            if (line.indexOf('@@FSP ') === 0) {
              var p = line.slice(6).split(' ');
              setBar(parseFloat(p[0]) || 0, p[1] || '');
            } else if (line.charAt(0) === '{') {
              try { var d = JSON.parse(line); got = true; onResult(d); } catch(e){}
            }
          }
          if (r.done) { if (!got) onFail(); return; }
          return pump();
        });
      }
      return pump();
    }).catch(function(){ if (!got && !signal.aborted) onFail(); });
  }

  function run(e){
    var opener = e && e.currentTarget && e.currentTarget.focus ? e.currentTarget : document.activeElement;
    var abort = null, retry = null, act = null;
    openWindow({
      cls: 'fs-win-report', title: fsT('title'), head: true, opener: opener,
      onClose: function(){ if (abort) abort.abort(); },
      build: function(body, win, foot){ act = foot; start(body); }
    });

    function start(body){
      if (abort) abort.abort();
      var ctl = new AbortController();
      abort = ctl;
      if (retry) { retry.remove(); retry = null; }
      body.innerHTML = progressHTML();
      var fill = body.querySelector('.fs-prog-fill');
      var txt = body.querySelector('.fs-prog-txt');
      var pctEl = body.querySelector('.fs-prog-pct');
      var finished = false;

      function setBar(pct, key){
        if (ctl !== abort) return;
        fill.classList.remove('fs-indet');
        pct = Math.max(0, Math.min(100, pct));
        fill.style.width = pct + '%';
        var lab = key && fsT(key);
        if (lab) txt.textContent = lab;
        pctEl.textContent = Math.round(pct) + '%';
      }
      function indeterminate(){
        fill.classList.add('fs-indet');
        fill.style.width = '';
        pctEl.textContent = '';
        txt.textContent = fsT('running');
      }
      function finish(markup){
        if (finished || ctl !== abort) return;
        finished = true;
        body.innerHTML = markup;
        wireReport(body);
        retry = button('fs-win-btn', 'Retry', fsT('retry'));
        retry.addEventListener('click', function(){ start(body); });
        act.appendChild(retry);
      }
      function onResult(data){ finish(reportHTML(data)); }
      function onErr(){ finish(errHTML()); }
      function fallback(){
        if (finished || ctl !== abort) return;
        indeterminate();
        $.getJSON(REPORT_URL, onResult).fail(onErr);
      }

      if (window.fetch && window.ReadableStream && window.TextDecoder) {
        streamRun(ctl.signal, setBar, onResult, fallback);
      } else {
        fallback();
      }
    }
  }
  window.firesquireRun = run;

  $(function(){
    // Dashboard: the check's icon in the server tile's control row, next to Reboot.
    // Unraid's flame without TowerTorch, GlimStone's check glyph with it.
    try {
      var dashReboot = $('.tile-ctrl [onclick^="Reboot("]').first();
      if (dashReboot.length && !$('#ss-dash-icon').length) {
        var icon = $('<span id="ss-dash-icon" class="fa fa-fw fa-fire hand" role="button" tabindex="0" title="FireSquire"></span>');
        icon.html('<span class="fs-dash-g">' + glyph('Check') + '</span>');
        icon.on('click', run);
        icon.on('keydown', function(e){ if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); run(e); } });
        dashReboot.before(icon);
      }
    } catch(e) {}

    // Main tab: FireSquire's button next to Reboot. The script runs on every
    // page, so only look for Reboot where our Main section exists.
    try {
      var reboot = $('input[type=button], button, a').filter(function(){
        var v  = ($(this).val() || $(this).text() || '').trim().toLowerCase();
        var oc = ($(this).attr('onclick') || '').toLowerCase();
        return v === 'neu starten' || v === 'reboot'
            || oc.indexOf('reboot(') > -1 || oc.indexOf("'reboot'") > -1 || oc.indexOf('"reboot"') > -1;
      }).first();
      if (reboot.length && document.getElementById('ss-frag') && !$('#ss-reboot-btn').length) {
        var b = button('fs-main-btn', 'Check', 'FireSquire');
        b.id = 'ss-reboot-btn';
        b.addEventListener('click', run);
        reboot.after(b);
      }
    } catch(e) {}

    // Main tab: remove our own (otherwise empty) page section
    try {
      var frag = document.getElementById('ss-frag');
      if (frag) {
        var p = frag.previousElementSibling, hops = 0;
        while (p && hops < 3) {
          var prev = p.previousElementSibling, txt = (p.textContent || '').trim();
          if (/firesquire/i.test(txt) && txt.length < 40 && !p.querySelector('input,button,select,textarea,a[onclick]')) p.remove();
          p = prev; hops++;
        }
        frag.remove();
      }
    } catch(e) {}
  });
})();
