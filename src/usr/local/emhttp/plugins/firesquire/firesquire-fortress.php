<?php
/* Reads `fortress status -json` on stdin and prints one finding per line for
 * firesquire-check.sh: tier, status, key, args and the English message,
 * separated by the unit separator, with the args joined by "|". */
$members = json_decode(stream_get_contents(STDIN), true);
if (!is_array($members)) exit(1);

function flat($s) { return trim(preg_replace('/[\s\x1f|]+/u', ' ', (string) $s)); }

function finding($tier, $status, $key, $args, $msg) {
  echo implode("\x1f", [$tier, $status, $key, implode('|', array_map('flat', $args)), flat($msg)]), "\n";
}

if (!$members) {
  finding('info', 'info', 'fortress_alone', [], 'No other app of your fortress is in reach right now.');
  exit(0);
}

$busy = 0;
$answered = 0;
foreach ($members as $m) {
  $app = flat(($m['report']['app']['name'] ?? '') ?: (($m['app']['name'] ?? '') ?: ($m['app']['id'] ?? '')));
  $device = flat($m['device'] ?? '');
  if (!isset($m['report']) || !is_array($m['report'])) {
    finding('info', 'info', 'fortress_unanswered', [$app, $device], "$app on $device did not answer.");
    continue;
  }
  $answered++;
  foreach ($m['report']['work'] ?? [] as $w) {
    if (empty($w['blocksRestart'])) continue;
    $busy++;
    $title = flat($w['title'] ?? '');
    if (isset($w['progress']) && is_numeric($w['progress'])) {
      $pct = round($w['progress'] * 100) . '%';
      finding('critical', 'fail', 'fortress_busy', [$app, $device, $title, $pct], "$app on $device is still busy with $title ($pct). Let it finish before rebooting.");
    } else {
      finding('critical', 'fail', 'fortress_busy_open', [$app, $device, $title], "$app on $device is still busy with $title. Let it finish before rebooting.");
    }
  }
  foreach ($m['report']['needsYou'] ?? [] as $n) {
    if (($n['severity'] ?? '') !== 'error') continue;
    $text = flat($n['text'] ?? '');
    finding('warning', 'warn', 'fortress_needs', [$app, $device, $text], "$app on $device needs you: $text");
  }
}
if ($busy === 0) {
  finding('critical', 'pass', 'fortress_ok', [(string) $answered], "$answered app(s) in your fortress answered. None is busy with work a reboot would cut short.");
}
