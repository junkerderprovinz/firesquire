<?php
/* Reads `fortress status -json` on stdin and prints one finding per line for
 * firesquire-check.sh: tier, status, key, args and the English message,
 * separated by the unit separator, with the args joined by "|". Only work a
 * reboot would cut short counts; what an app needs from you is TollRoll's. */
$members = json_decode(stream_get_contents(STDIN), true);
if (!is_array($members)) exit(1);

function flat($s) { return trim(preg_replace('/[\s\x1f|]+/u', ' ', (string) $s)); }

function finding($tier, $status, $key, $args, $msg) {
  echo implode("\x1f", [$tier, $status, $key, implode('|', array_map('flat', $args)), flat($msg)]), "\n";
}

/* An app that offers no status refuses with not_found. It has nothing to say
 * about a reboot, so it gets no line, unlike one that offers a status and
 * does not answer. */
function offers_status($m) {
  return !preg_match('/refused with "not_found" \(404\)/', (string) ($m['error'] ?? ''));
}

$busy = 0;
$answered = 0;
$unanswered = 0;
foreach ($members as $m) {
  $app = flat(($m['report']['app']['name'] ?? '') ?: (($m['app']['name'] ?? '') ?: ($m['app']['id'] ?? '')));
  $device = flat($m['device'] ?? '');
  if (!isset($m['report']) || !is_array($m['report'])) {
    if (offers_status($m)) {
      $unanswered++;
      finding('info', 'info', 'fortress_unanswered', [$app, $device], "$app on $device did not answer.");
    }
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
}
if ($answered === 0 && $unanswered === 0) {
  finding('info', 'info', 'fortress_alone', [], 'No other app of your fortress is in reach right now.');
} elseif ($answered > 0 && $busy === 0) {
  finding('critical', 'pass', 'fortress_ok', [(string) $answered], "$answered app(s) in your fortress answered. None is busy with work a reboot would cut short.");
}
