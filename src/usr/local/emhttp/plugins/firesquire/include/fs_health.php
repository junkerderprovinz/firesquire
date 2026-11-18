<?php
/* How the server stands, from the engine's report: a light per area, the
 * history of the last 30 days, the status FireSquire reports to its fortress
 * and the notification when an area gets worse. Used by firesquire-history.php
 * after every check and by FireSquireHealth.php for the Health tab; no output
 * of its own. */
require_once __DIR__ . '/fs_notify.php';

const FS_AREAS = array('disks', 'array', 'docker', 'vms', 'flash', 'network', 'system', 'fortress');

/* The area of every finding by its id. A finding without one counts for the
 * reboot alone, such as the info lines. */
const FS_AREA_OF = array(
  'smart' => 'disks', 'smart_attr' => 'disks', 'smart_trend' => 'disks', 'crc' => 'disks', 'iodisk' => 'disks', 'scrutiny' => 'disks',
  'array_state' => 'array', 'array_parity' => 'array', 'array_op' => 'array', 'zfs' => 'array', 'btrfs' => 'array',
  'space_cache' => 'array', 'unclean' => 'array', 'last_shutdown' => 'array',
  'risky_mount' => 'docker', 'stuck_loop' => 'docker', 'binds' => 'docker', 'space_docker' => 'docker', 'timeouts' => 'docker',
  'vm_state' => 'vms',
  'flash' => 'flash', 'flash_probe' => 'flash', 'flash_backup' => 'flash', 'flash_errors' => 'flash', 'flash_space' => 'flash',
  'net' => 'network', 'cert' => 'network',
  'syslog' => 'system', 'space_rootfs' => 'system', 'space_varlog' => 'system', 'svc_docker' => 'system', 'svc_libvirt' => 'system', 'svc_emhttp' => 'system',
  'fortress' => 'fortress',
);

/* What only matters while it lasts: running work and open files stand in a
 * reboot's way, but say nothing about how the server stands. */
const FS_PASSING = array('array_op_running', 'mover_running', 'vms_running', 'fortress_busy', 'fortress_busy_open');

/* An app of the fortress that offers a status and does not answer is worth a
 * look on the Health tab, though it is only a note before a reboot. */
const FS_HEALTH_STATUS = array('fortress_unanswered' => 'warn', 'fortress_skip' => 'warn');

const FS_RANK = array('grey' => 0, 'green' => 1, 'yellow' => 2, 'red' => 3);

function fs_light_of($status) {
  return array('fail' => 'red', 'warn' => 'yellow')[$status] ?? 'green';
}

function fs_worse($a, $b) {
  return (FS_RANK[$a] ?? 0) >= (FS_RANK[$b] ?? 0) ? $a : $b;
}

/* The areas with their light and findings, worst first, and the advice on
 * the settings apart from them. A finding twice in the report shows once. */
function fs_health_areas($report) {
  $areas = array();
  foreach (FS_AREAS as $a) $areas[$a] = array('light' => 'grey', 'findings' => array());
  $config = array();
  $seen = array();
  foreach ((array) ($report['checks'] ?? array()) as $c) {
    $key = (string) ($c['key'] ?? '');
    $id = (string) ($c['id'] ?? '');
    $sig = $key . "\x1f" . implode("\x1f", (array) ($c['args'] ?? array()));
    if (isset($seen[$sig])) continue;
    $seen[$sig] = true;
    if (($c['tier'] ?? '') === 'config') { $config[] = $c; continue; }
    $area = FS_AREA_OF[$id] ?? null;
    if ($area === null || in_array($key, FS_PASSING, true)) continue;
    if (isset(FS_HEALTH_STATUS[$key])) $c['status'] = FS_HEALTH_STATUS[$key];
    $areas[$area]['findings'][] = $c;
    $areas[$area]['light'] = fs_worse($areas[$area]['light'], fs_light_of($c['status'] ?? ''));
  }
  $order = array('fail' => 0, 'warn' => 1, 'pass' => 2, 'info' => 3);
  foreach ($areas as &$a) {
    usort($a['findings'], function ($x, $y) use ($order) { return ($order[$x['status'] ?? 'info'] ?? 3) - ($order[$y['status'] ?? 'info'] ?? 3); });
  }
  unset($a);
  return array('areas' => $areas, 'config' => $config);
}

function fs_lights($areas) {
  return array_map(function ($a) { return $a['light']; }, $areas);
}

/* The history as one line per day, "2026-11-17 disks:green array:yellow ...",
 * read into date => lights. */
function fs_history_parse($text) {
  $days = array();
  foreach (preg_split('/\r?\n/', (string) $text) as $line) {
    $parts = preg_split('/\s+/', trim($line));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $parts[0] ?? '')) continue;
    $lights = array();
    foreach (array_slice($parts, 1) as $p) {
      list($k, $v) = array_pad(explode(':', $p, 2), 2, '');
      if (in_array($k, FS_AREAS, true) && isset(FS_RANK[$v])) $lights[$k] = $v;
    }
    $days[$parts[0]] = $lights;
  }
  ksort($days);
  return $days;
}

/* The history with today's lights in, each area at the worst it was that
 * day, and the days older than 30 out. */
function fs_history_add($text, $date, $lights) {
  $days = fs_history_parse($text);
  $today = $days[$date] ?? array();
  foreach ($lights as $k => $v) $today[$k] = isset($today[$k]) ? fs_worse($today[$k], $v) : $v;
  $days[$date] = $today;
  $first = date('Y-m-d', strtotime("$date -29 days"));
  $out = '';
  foreach ($days as $d => $l) {
    if ($d < $first || $d > $date) continue;
    $out .= $d;
    foreach (FS_AREAS as $a) if (isset($l[$a])) $out .= " $a:{$l[$a]}";
    $out .= "\n";
  }
  return $out;
}

/* The text of a finding in the language of the texts $L. */
function fs_finding_text($L, $c, $lang) {
  $tpl = fs_text($L, (string) ($c['key'] ?? ''), (array) ($c['args'] ?? array()), $lang);
  return $tpl !== null ? fs_fill($tpl, $c['args'] ?? array()) : (string) ($c['message'] ?? '');
}

/* FireSquire's status in the fortress's report format, contract 1: the worst
 * light is the state, and every area that is not green is a need, kept with
 * the time it turned so from the status before. */
function fs_health_status($areas, $prev, $now, $lang, $app, $device) {
  $L = fs_texts($lang);
  $since = array();
  foreach ((array) ($prev['needsYou'] ?? array()) as $n) $since[$n['id'] ?? ''] = $n['since'] ?? null;
  $needs = array();
  $worst = 'grey';
  foreach ($areas as $name => $a) {
    $worst = fs_worse($worst, $a['light']);
    if ($a['light'] !== 'yellow' && $a['light'] !== 'red') continue;
    $first = null;
    foreach ($a['findings'] as $c) if (in_array($c['status'] ?? '', array('warn', 'fail'), true)) { $first = $c; break; }
    $id = "health.$name";
    $needs[] = array('id' => $id, 'severity' => $a['light'] === 'red' ? 'error' : 'warn', 'code' => $id,
      'text' => ($L["h_area_$name"] ?? $name) . ': ' . ($first ? fs_finding_text($L, $first, $lang) : ''),
      'since' => $since[$id] ?? gmdate('Y-m-d\TH:i:s\Z', $now), 'link' => '/Settings/FireSquireTools');
  }
  $state = array('grey' => 'off', 'green' => 'ok', 'yellow' => 'warning', 'red' => 'failed')[$worst];
  // The tile shows FireSquire with its logo, as the report format carries it.
  $svg = (string) @file_get_contents(dirname(__DIR__) . '/images/firesquire.svg');
  if ($svg !== '' && strlen($svg) <= 16384) $app['icon'] = 'data:image/svg+xml;base64,' . base64_encode($svg);
  return array('contract' => 1, 'app' => $app, 'instance' => array('id' => $device, 'name' => $device),
    'state' => $state, 'counts' => array('needsYou' => count($needs), 'work' => 0), 'needsYou' => $needs, 'work' => array(),
    'next' => array(), 'capabilities' => array('health'), 'sampledAt' => gmdate('Y-m-d\TH:i:s\Z', $now));
}

/* The notification for the areas that got worse since the check before, or
 * null when none did. A first check after a restart compares with the
 * history's last day. Its key names the areas, for TollRoll's hub. */
function fs_health_event($areas, $before, $lang, $server) {
  $L = fs_texts($lang);
  $worse = array();
  $ids = array();
  $lines = array();
  foreach ($areas as $name => $a) {
    if ((FS_RANK[$a['light']] ?? 0) < 2 || (FS_RANK[$a['light']] ?? 0) <= (FS_RANK[$before[$name] ?? 'green'] ?? 1)) continue;
    $worse[] = $L["h_area_$name"] ?? $name;
    $ids[] = $name;
    foreach ($a['findings'] as $c) {
      if (in_array($c['status'] ?? '', array('warn', 'fail'), true)) $lines[] = '• ' . fs_finding_text($L, $c, $lang);
    }
  }
  if (!$worse) return null;
  $red = false;
  foreach ($areas as $a) $red = $red || $a['light'] === 'red';
  $words = array($server, implode(', ', $worse));
  return fs_linked(array('kind' => 'health.worse', 'severity' => $red ? 'failure' : 'warning', 'key' => 'firesquire.health.' . implode('.', $ids),
    'title' => fs_fill($L['n_health_title'] ?? '', $words), 'body' => implode("\n", $lines),
    'hub' => array('title' => fs_fill($L['n_hub_health'] ?? '', $words), 'resolve' => array())));
}
