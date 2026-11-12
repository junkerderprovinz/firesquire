/* WebGUI helper, loaded on every page by FireSquireButtons.page. Adds the entry
 * points on Main and the Dashboard, runs the check in its own window with a live
 * progress bar, and lends the settings page its windows and buttons through
 * window.fireSquireUI.
 *
 * Without TowerTorch everything follows Unraid's own look. With it, which puts
 * tt-popups-on on <html> on every page, firesquire.css gives the window, the
 * buttons and the report GlimStone's look from TowerTorch's tokens.
 *
 * Language: fs_i18n.php merges lang/en.json and lang/<code>.json for Unraid's
 * configured language and injects it as window.fireSquireI18n. The English
 * table below only answers when that injection is missing. */
(function(){

  /* English fallback, the source of lang/en.json. */
  var FS_EN = {
    title: 'FireSquire: Pre-Reboot Check',
    running: 'Running checks…',
    v_GO: 'All clear', v_CAUTION: 'Smouldering', 'v_NO-GO': 'The roof is on fire',
    tier_info: 'Info',
    err: 'Could not run the check engine.',
    err_hint: 'Try again in a moment. If it keeps failing, the syslog may say why.',
    tools_lead: 'FireSquire checks whether your server will come back up clean before you reboot, and gives one verdict (All clear / Smouldering / The roof is on fire) with the exact findings. It is advisory only: it reads the host and reports. On the flash it writes an empty test file, to check that /boot is writable, and deletes it right away. It also keeps the CRC error count of every disk there, so it can tell when one rises.',
    tools_intro: 'It looks for the reboot landmines that are detectable from the running system:',
    tools_li: [
      'Array started & clean: every device assignment OK (no disabled/invalid/missing disk)',
      'No parity/sync/rebuild/clear or mover in progress',
      'No container mounting a host runtime dir, no stuck docker.img/libvirt.img loop',
      'Flash writable, free space, recent crashes, running VMs, services, SMART health',
      'Apps in your fortress: work a reboot would cut short, such as a running backup or update',
      'ZFS pools and devices, btrfs device errors and rising CRC counts, each with the disk\'s port',
      'Shutdown time-outs, an unclean last shutdown, files open over SMB and NFS, the UPS and the age of the flash backup'
    ],
    tools_btn: 'Run pre-reboot check',
    tools_title: 'Pre-reboot check',
    tools_g_array: 'Array and disks',
    tools_g_ops: 'Running operations',
    tools_g_containers: 'Containers and images',
    tools_g_host: 'Flash, space and services',
    tools_g_fortress: 'Your fortress',
    tools_g_health: 'Disk health',
    tools_g_shutdown: 'Ready to shut down',
    tools_note: 'Advisory only, apart from a write test and the CRC counts on the flash',
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
    p_fortress: 'Asking the fortress…',
    p_pools: 'Checking ZFS and btrfs pools…',
    p_timeouts: 'Checking shutdown time-outs…',
    p_shares: 'Checking open files on shares…',
    p_ups: 'Checking the UPS…',
    p_flashbak: 'Checking the flash backup…',
    p_smart: 'Checking SMART health…',
    p_info: 'Collecting system info…',
    p_done: 'Done',
    array_ok: 'Array started and healthy; all device assignments OK.',
    array_bad_devices: { one: 'Array not clean, unhealthy data disk: {0}', other: 'Array not clean, unhealthy data disks: {0}' },
    array_counts: 'Array not clean: state={0}, disabled={1} invalid={2} missing={3}',
    array_not_started: 'Array is not started (state={0}).',
    array_parity_degraded: 'Parity disk disabled/missing: {0}. The array still boots, but parity protection is reduced.',
    array_op_running: 'Array operation in progress ({0}). Let it finish before rebooting.',
    array_op_ok: 'No parity/sync/rebuild/clear in progress.',
    array_unknown: 'mdcmd not found, cannot determine array state.',
    mover_running: 'Mover is running. Wait for it to finish before rebooting.',
    mover_ok: 'Mover is not running.',
    risky_mount_found: { one: 'A container mounts a host runtime dir (can break libvirt/docker on reboot):{0}', other: 'Containers mount a host runtime dir (can break libvirt/docker on reboot):{0}' },
    risky_mount_ok: 'No container mounts a host runtime directory (besides docker.sock).',
    risky_mount_skip: 'Docker not available, skipped container mount scan.',
    stuck_loop_found: 'Stuck image/loop state{0}.',
    stuck_loop_ok: 'docker.img / libvirt.img loop state looks clean.',
    stuck_loop_skip: 'losetup not found, skipped loop-device check.',
    flash_ok: 'Flash /boot is mounted and writable.',
    flash_ro: 'Flash /boot is mounted but NOT writable (possible FAT corruption). Config won’t persist.',
    flash_unmounted: 'Flash /boot is not mounted.',
    syslog_crashes: { one: '{0} crash/instability line in syslog since boot. Latest: {1}', other: '{0} crash/instability lines in syslog since boot. Latest: {1}' },
    syslog_ok: 'No crashes/OOM/segfaults in syslog since boot.',
    syslog_skip: 'syslog not readable, skipped crash scan.',
    io_errors: { one: '{0} disk/IO error line in syslog since boot. Latest: {1}', other: '{0} disk/IO error lines in syslog since boot. Latest: {1}' },
    io_ok: 'No disk/IO errors in syslog since boot.',
    space_full: '{0} is {1}% full (>={2}%).',
    space_ok: '{0} at {1}% used.',
    vms_running: { one: '{0} VM running. Shut it down gracefully before rebooting.', other: '{0} VMs running. Shut them down gracefully before rebooting.' },
    vms_ok: 'No VMs running.',
    svc_docker_ok: 'dockerd running.',
    svc_docker_down: 'Docker storage mounted but dockerd is not running.',
    svc_libvirt_ok: 'libvirtd running.',
    svc_libvirt_down: 'libvirt enabled but libvirtd is not running.',
    svc_emhttp_ok: 'emhttpd (WebGUI) running.',
    svc_emhttp_down: 'emhttpd (WebGUI) is not running.',
    binds_missing: { one: 'A container bind source is missing (won’t start cleanly after reboot):{0}', other: 'Container bind sources missing (won’t start cleanly after reboot):{0}' },
    binds_ok: 'All container bind sources under /mnt exist.',
    fortress_busy: '{0} on {1} is still busy with {2} ({3}). Let it finish before rebooting.',
    fortress_busy_open: '{0} on {1} is still busy with {2}. Let it finish before rebooting.',
    fortress_unanswered: '{0} on {1} did not answer.',
    fortress_ok: { one: '{0} app in your fortress answered. It is not busy with work a reboot would cut short.', other: '{0} apps in your fortress answered. None is busy with work a reboot would cut short.' },
    fortress_alone: 'No other app of your fortress is in reach right now.',
    fortress_skip: 'FireSquire could not reach the fortress and skipped its apps.',
    zfs_degraded: 'ZFS pool {0} is {1}. Fix it before rebooting.',
    zfs_dev_errors: 'ZFS pool {0}: {1} has {2} read, {3} write and {4} checksum errors.',
    zfs_dev_state: 'ZFS pool {0}: {1} is {2}.',
    zfs_ok: { one: '{0} ZFS pool online, no device errors.', other: '{0} ZFS pools online, no device errors.' },
    btrfs_dev_errors: 'btrfs on {0}: {1} reports errors ({2}).',
    btrfs_ok: { one: '{0} btrfs filesystem without device errors.', other: '{0} btrfs filesystems without device errors.' },
    crc_found: { one: '{0} has {1} CRC error. That usually points to the cable or the port. FireSquire remembers the count and warns again if it rises.', other: '{0} has {1} CRC errors. That usually points to the cable or the port. FireSquire remembers the count and warns again if it rises.' },
    crc_rose: 'The CRC errors on {0} rose from {1} to {2} since the last check. Check or replace the cable on this port.',
    scrutiny_link: 'Scrutiny keeps the SMART history of your disks. Open it to see when the counts started to rise.',
    scrutiny_tip: 'Tip: Scrutiny from Community Apps keeps a SMART history of your disks, so you can see when a count started to rise.',
    timeouts_ok: 'Unraid\'s shutdown time-out of {0}s covers containers and VMs ({1}s).',
    timeouts_short: 'Unraid waits {0}s for a clean shutdown, but containers ({1}s) and VMs ({2}s) can take {3}s together. Raise the shutdown time-out in Disk Settings.',
    timeouts_container: { one: 'This container asks for more time to stop than Unraid gives it ({1}s in Docker Settings): {0}', other: 'These containers ask for more time to stop than Unraid gives them ({1}s in Docker Settings): {0}' },
    unclean: 'The last shutdown was not clean. The next array start runs a parity check.',
    share_open: { one: '{2} has {3} file open on the share {1} over {0}.', other: '{2} has {3} files open on the share {1} over {0}.' },
    share_writing: { one: '{2} is writing {3} file to the share {1} over {0}, maybe a copy.', other: '{2} is writing {3} files to the share {1} over {0}, maybe a copy.' },
    shares_ok: 'No open files on SMB or NFS shares.',
    ups_ok: 'The UPS is on mains power, battery at {0}%.',
    ups_battery: { one: 'The UPS runs on battery: {0}% left, about {1} minute.', other: 'The UPS runs on battery: {0}% left, about {1} minutes.' },
    ups_low: { one: 'The UPS battery is almost empty: {0}% left, about {1} minute.', other: 'The UPS battery is almost empty: {0}% left, about {1} minutes.' },
    flash_backup_ok: { one: 'The last flash backup ({1}) is {0} day old.', other: 'The last flash backup ({1}) is {0} days old.' },
    flash_backup_old: { one: 'The last flash backup ({1}) is {0} day old. Back up the flash before rebooting.', other: 'The last flash backup ({1}) is {0} days old. Back up the flash before rebooting.' },
    flash_backup_none: 'FireSquire knows of no flash backup. BombVault in your fortress or Unraid Connect can keep one.',
    g_ask_reboot: 'Reboot anyway?',
    g_ask_shutdown: 'Shut down anyway?',
    g_reboot: 'Reboot anyway',
    g_shutdown: 'Shut down anyway',
    g_cancel: 'Cancel',
    smart_failing: 'SMART health FAILING on:{0}. Investigate before rebooting.',
    smart_ok: { one: 'SMART health PASSED on {0} disk.', other: 'SMART health PASSED on {0} disks.' },
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
  var REPORT_URL = '/plugins/firesquire/include/FireSquireReport.php';
  var STREAM_URL = '/plugins/firesquire/include/FireSquireStream.php';

  // A text that changes with a number holds one form per plural category of
  // the language, and COUNTED names the argument whose number picks the form.
  var COUNTED = { array_bad_devices: 1, risky_mount_found: 1, binds_missing: 1, timeouts_container: 2, syslog_crashes: 0, io_errors: 0, vms_running: 0, fortress_ok: 0, zfs_ok: 0, btrfs_ok: 0, crc_found: 1, smart_ok: 0, share_open: 3, share_writing: 3, ups_battery: 1, ups_low: 1, flash_backup_ok: 0, flash_backup_old: 0 };
  function plural(m, key, args){
    if (m == null || typeof m !== 'object' || Array.isArray(m)) return m;
    var n = Number((args || [])[COUNTED[key]]);
    var form = isNaN(n) ? 'other' : new Intl.PluralRules(FS_LANGCODE).select(n);
    return m[form] != null ? m[form] : m.other;
  }

  function fsT(key, args){
    var m = plural(FS_I18N[key] != null ? FS_I18N[key] : FS_EN[key], key, args);
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
  function themed(){ return html.classList.contains('tt-popups-on') && get('tt.theming', '1') !== '0'; }
  function hue(node, i){
    var C = window.TTTheme, c = '';
    if (i != null && themed() && get('tt.rainbow', '0') === '1' && C && C.rbColor) {
      c = C.rbColor(i, (getComputedStyle(html).getPropertyValue('--tt-accent') || '').trim() || '#FCC419');
    }
    if (c) {
      node.style.setProperty('--fs-hue', c);
      node.style.setProperty('--fs-hue-ink', C.idealText ? C.idealText(c) : '#161616');
    } else {
      node.style.removeProperty('--fs-hue');
      node.style.removeProperty('--fs-hue-ink');
    }
  }
  // Under the rainbow every button lights up in a colour of its own, counted in
  // the order the buttons stand in its window or on the page, so two side by
  // side never share one.
  function takeHue(e){
    var b = e.target.closest && e.target.closest('.fs-btn');
    if (!b) return;
    hue(b, Array.prototype.indexOf.call((b.closest('.fs-win') || document).querySelectorAll('.fs-btn'), b));
  }
  document.addEventListener('pointerover', takeHue);
  document.addEventListener('focusin', takeHue);
  // TowerTorch's label mode for the buttons it draws, which FireSquire's buttons follow.
  function labelMode(){
    var m = themed() ? html.getAttribute('data-tt-labels-buttons') : '';
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
  new MutationObserver(labelTips).observe(html, { attributes: true, attributeFilter: ['class', 'data-tt-labels-buttons'] });

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
     the end of the foot. A window opened with head: true keeps its title for
     screen readers alone in Unraid's look, until TowerTorch shows the notch.
     Escape, the scrim and Close shut it, the focus stays inside while it is
     open and goes back to what opened it. */
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
      case 'zfs_degraded':
      case 'zfs_dev_errors':
      case 'zfs_dev_state':
      case 'btrfs_dev_errors':
      case 'crc_found':
      case 'crc_rose':
        return '/Main';
      default:
        return null;   // svc_emhttp_down has no page (the WebGUI itself is down)
    }
  }

  // ":8081/web" is a port on this server; the app behind it speaks plain http.
  function ownLink(l){ return l.charAt(0) === ':' ? 'http://' + location.hostname + l : l; }

  var VCLASS = { GO: 'fs-v-go', CAUTION: 'fs-v-caution', 'NO-GO': 'fs-v-nogo' };
  var STATUS = { pass: 'Check', warn: 'Warning', fail: 'Close', info: 'Info' };
  // The newest syslog line a finding quotes reads as the log it came from.
  var QUOTES_LOG = { syslog_crashes: 1, io_errors: 1 };

  function message(x){
    var tpl = plural(FS_I18N[x.key] != null ? FS_I18N[x.key] : FS_EN[x.key], x.key, x.args);
    if (tpl == null) return esc(x.message || '');
    var out = esc(tpl), args = x.args || [];
    for (var i = 0; i < args.length; i++) {
      var a = esc(args[i]);
      if (QUOTES_LOG[x.key] && i === 1) a = '<code>' + a + '</code>';
      out = out.split('{' + i + '}').join(a);
    }
    return out;
  }

  function lampHTML(){
    return '<span class="fs-v-lamp" aria-hidden="true"><span class="fs-lamp-halo"></span><span class="fs-lamp-beam fs-lamp-back"></span>' +
      '<span class="fs-lamp-dome"></span><span class="fs-lamp-base"></span><span class="fs-lamp-beam fs-lamp-front"></span></span>';
  }

  function verdictHTML(data){
    var v = data.verdict, word = fsT('v_' + v) || v;
    return '<div class="fs-verdict ' + (VCLASS[v] || 'fs-v-unknown') + '">' + lampHTML() + '<div class="fs-v-word">' + esc(word) + '</div></div>';
  }


  // Every finding is a card of its own. A problem leads to the page that can
  // fix it, and a finding with a link of its own, such as a port on this
  // server, leads there.
  function rowHTML(x){
    var st = STATUS[x.status] ? x.status : 'info';
    var link = x.link ? ownLink(x.link) : (st === 'warn' || st === 'fail') ? fsLink(x.key) : null;
    var h = '<div class="fs-f fs-st-' + st + '"><span class="fs-f-ic" aria-hidden="true">' + glyph(STATUS[st]) + '</span>';
    h += '<div class="fs-f-text">' + message(x) + '</div>';
    if (link) h += '<span class="fs-f-act" data-goto="' + esc(link) + '"></span>';
    return h + '</div>';
  }

  // The cards stand by level, the worst first, each group under its name. The
  // verdict names its own level at the top, so that group needs no heading.
  var LEVELS = [['fail', 'v_NO-GO'], ['warn', 'v_CAUTION'], ['pass', 'v_GO'], ['info', 'tier_info']];
  function reportHTML(data){
    var checks = data.checks || [];
    var h = verdictHTML(data);
    LEVELS.forEach(function(l){
      var grp = checks.filter(function(x){ return (STATUS[x.status] ? x.status : 'info') === l[0]; });
      if (!grp.length) return;
      h += '<section class="fs-level fs-st-' + l[0] + '">' + (l[1] === 'v_' + data.verdict ? '' : '<h3 class="fs-level-h">' + esc(fsT(l[1])) + '</h3>');
      grp.forEach(function(x){ h += rowHTML(x); });
      h += '</section>';
    });
    return h;
  }

  // The parts a string cannot carry: the (i) and the buttons that lead away.
  function wireReport(body){
    Array.prototype.forEach.call(body.querySelectorAll('.fs-f-act'), function(n){
      var a = button('fs-f-go', 'Forward', fsT('goto'), 'a');
      a.href = n.getAttribute('data-goto');
      if (/^http/.test(n.getAttribute('data-goto'))) { a.target = '_blank'; a.rel = 'noopener'; }
      n.appendChild(a);
    });
  }

  function progressHTML(){
    return '<div class="fs-prog fs-v-unknown"><div class="fs-prog-lab"><span class="fs-prog-txt">' + esc(fsT('running')) + '</span><span class="fs-prog-pct fs-num"></span></div>' +
      '<div class="fs-prog-track"><div class="fs-prog-fill"></div></div></div>';
  }

  function errHTML(){
    return '<div class="fs-err fs-v-nogo"><div><p class="fs-err-text">' + esc(fsT('err')) +
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

  // The question after a CAUTION, a NO-GO or a check that could not run. The
  // findings stay in view, and closing the window keeps the server up.
  function ask(guard, act, close){
    var reboot = guard.cmd === 'reboot';
    Array.prototype.forEach.call(act.querySelectorAll('.fs-ask'), function(n){ n.remove(); });
    act.insertBefore(el('span', 'fs-win-ask fs-ask', fsT(reboot ? 'g_ask_reboot' : 'g_ask_shutdown')), act.firstChild);
    var go = button('fs-win-btn fs-key fs-ask', 'Forward', fsT(reboot ? 'g_reboot' : 'g_shutdown'));
    go.addEventListener('click', function(){ close(); guard.proceed(); });
    act.appendChild(go);
    var cancel = act.querySelector('.fs-win-btn .fs-btn-l');
    if (cancel) cancel.textContent = fsT('g_cancel');
  }

  // run opens the report. Under a guard it stands between a reboot or a
  // shutdown and the server: a GO lets it through at once.
  function run(e, guard){
    var opener = e && e.currentTarget && e.currentTarget.focus ? e.currentTarget : document.activeElement;
    var abort = null, retry = null, act = null;
    var win = openWindow({
      cls: 'fs-win-report' + (guard ? ' fs-win-guard' : ''), title: fsT('title'), head: true, opener: opener,
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
        if (guard) ask(guard, act, win.close);
      }
      function onResult(data){
        if (guard && data && data.verdict === 'GO') { finished = true; win.close(); guard.proceed(); return; }
        finish(reportHTML(data));
      }
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

  // Unraid sends every reboot and shutdown of the WebGUI as a form to Boot.php,
  // from Main, the Dashboard, the update banner and the boot pool alike, by
  // form.submit() or by a submit event. Catching that form catches every
  // button and leaves Unraid's files as they are.
  function bootCmd(form){
    if (!form || form.tagName !== 'FORM') return null;
    var url = new URL(form.getAttribute('action') || '', location.href);
    if (!/\/webGui\/include\/Boot\.php$/.test(url.pathname)) return null;
    var c = form.querySelectorAll('[name="cmd"]'), v = c.length ? c[c.length - 1].value : '';
    return v === 'reboot' || v === 'shutdown' ? v : null;
  }
  function installGuard(win, check){
    var proto = win.HTMLFormElement.prototype, submit = proto.submit;
    function hold(form){
      var cmd = bootCmd(form);
      if (!cmd) return false;
      check(cmd, function(){ submit.call(form); });
      return true;
    }
    proto.submit = function(){ if (!hold(this)) submit.call(this); };
    win.document.addEventListener('submit', function(e){
      if (hold(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);
  }
  installGuard(window, function(cmd, proceed){ run(null, { cmd: cmd, proceed: proceed }); });

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
