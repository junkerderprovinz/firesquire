<?php
/* What FireSquire sends and when: the event for a finished check, the test
 * message and the cron line of the schedule. Used by firesquire-notify.php on
 * the command line and by FireSquireNotify.php for the settings page; no
 * output of its own. */

const FS_ENGINE = '/usr/local/emhttp/plugins/firesquire/firesquire-check.sh';

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

/* The event for a finished check, or null when there is nothing to tell: a
 * CAUTION or NO-GO goes out on every run, a GO only after one of them. */
function fs_event($report, $last, $lang, $server) {
  $verdict = is_array($report) ? (string) ($report['verdict'] ?? '') : '';
  $L = fs_texts($lang);
  switch ($verdict) {
    case 'NO-GO':
      $kind = 'check.nogo'; $severity = 'failure'; break;
    case 'CAUTION':
      $kind = 'check.caution'; $severity = 'warning'; break;
    case 'GO':
      if ($last !== 'NO-GO' && $last !== 'CAUTION') return null;
      return array('kind' => 'check.go', 'severity' => 'success', 'ping' => 'success',
        'title' => fs_fill($L['n_title_go'] ?? '', array($server, $L['v_GO'] ?? 'GO')), 'body' => (string) ($L['n_body_go'] ?? ''));
    default:
      return null;
  }
  $lines = array();
  foreach ((array) ($report['checks'] ?? array()) as $c) {
    $status = $c['status'] ?? '';
    if ($status !== 'fail' && $status !== 'warn') continue;
    $key = (string) ($c['key'] ?? '');
    $tpl = fs_text($L, $key, (array) ($c['args'] ?? array()), $lang);
    $text = $tpl !== null ? fs_fill($tpl, $c['args'] ?? array()) : (string) ($c['message'] ?? '');
    $lines[] = '• ' . $text;
  }
  return array('kind' => $kind, 'severity' => $severity, 'ping' => 'fail',
    'title' => fs_fill($L['n_title'] ?? '', array($server, $L['v_' . $verdict] ?? $verdict)), 'body' => implode("\n", $lines));
}

function fs_test_event($lang) {
  $L = fs_texts($lang);
  return array('kind' => 'check.test', 'severity' => 'info',
    'title' => (string) ($L['n_test_title'] ?? ''), 'body' => (string) ($L['n_test_body'] ?? ''));
}

/* The cron line that runs the check daily or on Sundays at half past $hour,
 * or "" for no schedule. */
function fs_cron($every, $hour) {
  if (!is_numeric($hour) || (int) $hour != $hour || $hour < 0 || $hour > 23) return '';
  $days = array('daily' => '*', 'weekly' => '0');
  if (!isset($days[$every])) return '';
  return sprintf("30 %d * * %s /bin/bash %s --json >/dev/null 2>&1\n", $hour, $days[$every], FS_ENGINE);
}
