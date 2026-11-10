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
    $text = isset($L[$key]) && is_string($L[$key]) ? fs_fill($L[$key], $c['args'] ?? array()) : (string) ($c['message'] ?? '');
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
