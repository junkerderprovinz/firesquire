<?php
/* What FireSquire sends and when: the event for a finished check, the test
 * message and the cron line of the schedule. Used by firesquire-notify.php on
 * the command line and by FireSquireNotify.php for the settings page; no
 * output of its own. */

const FS_ENGINE = '/usr/local/emhttp/plugins/firesquire/firesquire-check.sh';

/* The language Unraid shows: the session's, and where a request has none,
 * the one set in Unraid's display settings. */
function fs_ui_lang() {
  $lang = (string) ($_SESSION['locale'] ?? '');
  if ($lang === '') {
    $cfg = @parse_ini_file(getenv('FS_DYNAMIX_CFG') ?: '/boot/config/plugins/dynamix/dynamix.cfg');
    $lang = (string) ($cfg['locale'] ?? '');
  }
  $lang = strtolower(substr($lang, 0, 2));
  return preg_match('/^[a-z]{2}$/', $lang) ? $lang : 'en';
}

/* The texts in $lang over English, so a missing key reads in English. */
function fs_texts($lang) {
  $dir = dirname(__DIR__) . '/lang';
  $all = json_decode((string) @file_get_contents("$dir/en.json"), true);
  if (!is_array($all)) $all = array();
  $lang = strtolower(substr((string) $lang, 0, 2));
  if (preg_match('/^[a-z]{2}$/', $lang) && $lang !== 'en' && is_file("$dir/$lang.json")) {
    $tr = json_decode((string) @file_get_contents("$dir/$lang.json"), true);
    if (is_array($tr)) $all = array_merge($all, $tr);
  }
  return $all;
}

/* A text that changes with a number holds one form per plural category, and
 * FS_COUNTED names the argument whose number picks it, as in firesquire.js. */
const FS_COUNTED = array(
  'array_bad_devices' => 1, 'risky_mount_found' => 1, 'binds_missing' => 1, 'timeouts_container' => 2,
  'syslog_crashes' => 0, 'io_errors' => 0, 'vms_running' => 0, 'fortress_ok' => 0, 'zfs_ok' => 0,
  'btrfs_ok' => 0, 'crc_found' => 1, 'smart_ok' => 0, 'share_open' => 3, 'share_writing' => 3,
  'ups_battery' => 1, 'ups_low' => 1, 'flash_backup_ok' => 0, 'flash_backup_old' => 0,
  'smart_asleep' => 0, 'smart_disk' => 4, 'smart_disk_short' => 2, 'flash_errors' => 0, 'cert_soon' => 2, 'cfg_plugin_update' => 1, 'cfg_plugin_unfit' => 1, 'vm_paused' => 1, 'stop_open_files' => 1, 'stop_mounts' => 1,
  'stop_loops' => 1, 'stop_vm_agent' => 1, 'stop_containers' => 0, 'fortress_ok_stop' => 0,
);

/* The CLDR plural category of a whole number in a language. */
function fs_plural_category($lang, $n) {
  $n = abs((int) $n);
  $n10 = $n % 10;
  $n100 = $n % 100;
  switch (strtolower(substr((string) $lang, 0, 2))) {
    case 'ja': case 'ko': case 'th': case 'vi': case 'zh':
      return 'other';
    case 'fr': case 'pt':
      return $n <= 1 ? 'one' : 'other';
    case 'cs':
      return $n === 1 ? 'one' : ($n >= 2 && $n <= 4 ? 'few' : 'other');
    case 'he':
      return $n === 1 ? 'one' : ($n === 2 ? 'two' : 'other');
    case 'ro':
      return $n === 1 ? 'one' : ($n === 0 || ($n100 >= 1 && $n100 <= 19) ? 'few' : 'other');
    case 'pl':
      if ($n === 1) return 'one';
      return $n10 >= 2 && $n10 <= 4 && ($n100 < 12 || $n100 > 14) ? 'few' : 'many';
    case 'ru': case 'uk':
      if ($n10 === 1 && $n100 !== 11) return 'one';
      return $n10 >= 2 && $n10 <= 4 && ($n100 < 12 || $n100 > 14) ? 'few' : 'many';
    case 'ar':
      if ($n <= 2) return array('zero', 'one', 'two')[$n];
      return $n100 >= 3 && $n100 <= 10 ? 'few' : ($n100 >= 11 ? 'many' : 'other');
  }
  return $n === 1 ? 'one' : 'other';
}

/* The text for $key in the form its count asks for. */
function fs_text($L, $key, $args, $lang) {
  $t = $L[$key] ?? null;
  if (!is_array($t)) return is_string($t) ? $t : null;
  $n = $args[FS_COUNTED[$key] ?? -1] ?? null;
  $form = is_numeric($n) ? fs_plural_category($lang, $n) : 'other';
  return (string) ($t[$form] ?? $t['other'] ?? '');
}

function fs_fill($text, $args) {
  foreach (array_values((array) $args) as $i => $a) $text = str_replace('{' . $i . '}', (string) $a, $text);
  return $text;
}

/* Messages lead to FireSquire's settings by the page's path. Unraid's own
 * notification and TollRoll take it as it is, since an address of the server
 * would not open from every machine or behind a proxy. */
const FS_SETTINGS_PATH = '/Settings/FireSquireTools';

function fs_linked($event) {
  $event['link'] = FS_SETTINGS_PATH;
  return $event;
}

/* The event for a channel outside the server, its link made whole with the
 * address Unraid gives itself, or without a link when that is not known. */
function fs_absolute($event) {
  $link = (string) ($event['link'] ?? '');
  if ($link === '' || $link[0] !== '/') return $event;
  $ini = @parse_ini_file(getenv('FS_NGINX_INI') ?: '/var/local/emhttp/nginx.ini');
  $base = rtrim((string) ($ini['NGINX_DEFAULTURL'] ?? ''), '/');
  if (preg_match('#^https?://[^/\s]+$#', $base)) $event['link'] = $base . $link;
  else unset($event['link']);
  return $event;
}

/* The event for a finished check, or null when there is nothing to tell: a
 * CAUTION or NO-GO goes out on every run, a GO only after one of them. Its key
 * names the level, so TollRoll's hub tells a level once and the way back to GO
 * closes it; "hub" holds the title for the hub, which puts FireSquire's name
 * in front by itself, and the key of a level the check left. */
function fs_event($report, $last, $lang, $server) {
  $verdict = is_array($report) ? (string) ($report['verdict'] ?? '') : '';
  $L = fs_texts($lang);
  $keyOf = array('NO-GO' => 'firesquire.check.nogo', 'CAUTION' => 'firesquire.check.caution');
  switch ($verdict) {
    case 'NO-GO':
      $kind = 'check.nogo'; $severity = 'failure'; break;
    case 'CAUTION':
      $kind = 'check.caution'; $severity = 'warning'; break;
    case 'GO':
      if ($last !== 'NO-GO' && $last !== 'CAUTION') return null;
      $go = array($server, $L['v_GO'] ?? 'GO');
      // The way back is news on a channel that only takes failures as well.
      return fs_linked(array('kind' => 'check.go', 'severity' => 'success', 'ping' => 'success', 'key' => $keyOf[$last], 'recovery' => true,
        'title' => fs_fill($L['n_title_go'] ?? '', $go), 'body' => (string) ($L['n_body_go'] ?? ''),
        'hub' => array('title' => fs_fill($L['n_hub_title_go'] ?? '', $go), 'resolve' => array())));
    default:
      return null;
  }
  $lines = array();
  foreach ((array) ($report['checks'] ?? array()) as $c) {
    $status = $c['status'] ?? '';
    if ($status !== 'fail' && $status !== 'warn') continue;
    if (in_array($c['tier'] ?? '', array('health', 'config'), true)) continue;
    $key = (string) ($c['key'] ?? '');
    $tpl = fs_text($L, $key, (array) ($c['args'] ?? array()), $lang);
    $text = $tpl !== null ? fs_fill($tpl, $c['args'] ?? array()) : (string) ($c['message'] ?? '');
    $lines[] = '• ' . $text;
  }
  $words = array($server, $L['v_' . $verdict] ?? $verdict);
  $left = isset($keyOf[$last]) && $last !== $verdict ? array($keyOf[$last]) : array();
  return fs_linked(array('kind' => $kind, 'severity' => $severity, 'ping' => 'fail', 'key' => $keyOf[$verdict],
    'title' => fs_fill($L['n_title'] ?? '', $words), 'body' => implode("\n", $lines),
    'hub' => array('title' => fs_fill($L['n_hub_title'] ?? '', $words), 'resolve' => $left)));
}

/* Hands the test message to the first of the hubs that takes it, through
 * $run($args), which runs the fortress helper and returns its exit code and
 * output. A key of its own every time, since the hub tells a key once. */
function fs_hub_test($hubs, $dir, $lang, $run) {
  $L = fs_texts($lang);
  $body = json_encode(array('kind' => 'check.test', 'severity' => 'info', 'title' => (string) ($L['n_hub_test_title'] ?? ''),
    'body' => (string) ($L['n_test_body'] ?? ''), 'key' => 'firesquire.test.' . time(), 'link' => FS_SETTINGS_PATH), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  foreach ($hubs as $hub) {
    list($code, $out) = $run(array('act', '-dir', $dir, '-wait', '8s', (string) $hub, 'notify.deliver', $body));
    $answer = json_decode((string) $out, true);
    if ($code === 0 && is_array($answer) && ($answer['taken'] ?? false) === true) return true;
  }
  return false;
}

/* The test of a channel takes the way a real message would: through
 * TollRoll's hub while one takes over, and to the channel only when none
 * takes it. "hub" in the answer says which way it went. */
function fs_test_send($hubs, $tryHub, $tryChannel) {
  if ($hubs && $tryHub()) return array('ok' => true, 'hub' => true);
  $r = $tryChannel();
  if (!is_array($r)) return $r;
  if ($hubs) $r['hub'] = false;
  return $r;
}

function fs_test_event($lang) {
  $L = fs_texts($lang);
  return fs_linked(array('kind' => 'check.test', 'severity' => 'info',
    'title' => (string) ($L['n_test_title'] ?? ''), 'body' => (string) ($L['n_test_body'] ?? '')));
}

/* The cron line that runs the check daily or on Sundays at half past $hour,
 * or "" for no schedule. */
function fs_cron($every, $hour, $minute = 30) {
  foreach (array(array($hour, 23), array($minute, 59)) as $v) {
    if (!is_numeric($v[0]) || (int) $v[0] != $v[0] || $v[0] < 0 || $v[0] > $v[1]) return '';
  }
  $days = array('daily' => '*', 'weekly' => '0');
  if (!isset($days[$every])) return '';
  return sprintf("%d %d * * %s /bin/bash %s --json >/dev/null 2>&1\n", $minute, $hour, $days[$every], FS_ENGINE);
}
