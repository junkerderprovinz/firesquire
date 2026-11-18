<?php
/* The JSON work of firesquire-hub.sh, one piece per call:
 *   hubs          the TollRolls of `fortress status -json` on stdin that take over
 *   body          the message for notify.deliver from FireSquire's event on stdin
 *   resolve       one message per line that closes a level the check left
 *   own [whole]   the event for the notify helper, without what is the hub's,
 *                 with its link made whole for channels outside the server
 *   pings FILE    the channels of FILE that are Healthchecks, or nothing
 *   unraid FILE   the channels of FILE that are Unraid's own notification
 *   outside FILE  the others
 *   recovery      exits 0 when the event on stdin is a way back
 *   lift FILE     the channels of FILE with "failures only" taking everything,
 *                 for a way back, which those channels want to hear too */
require_once __DIR__ . '/include/fs_fortress.php';
require_once __DIR__ . '/include/fs_notify.php';

$in = stream_get_contents(STDIN);
$event = json_decode($in, true);
$flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;

switch ($argv[1] ?? '') {
  case 'hubs':
    echo implode("\n", fs_fortress_hubs($in)), "\n";
    break;
  case 'body':
    if (!is_array($event)) exit(1);
    $body = array('kind' => (string) ($event['kind'] ?? ''), 'severity' => (string) ($event['severity'] ?? ''),
      'title' => (string) ($event['hub']['title'] ?? '') ?: (string) ($event['title'] ?? ''), 'body' => (string) ($event['body'] ?? ''),
      'key' => (string) ($event['key'] ?? ''));
    if (!empty($event['link'])) $body['link'] = (string) $event['link'];
    echo json_encode($body, $flags), "\n";
    break;
  case 'resolve':
    foreach ((array) ($event['hub']['resolve'] ?? array()) as $key) echo json_encode(array('key' => (string) $key, 'resolved' => true), $flags), "\n";
    break;
  case 'own':
    if (!is_array($event)) exit(1);
    unset($event['hub'], $event['recovery']);
    if (($argv[2] ?? '') === 'whole') $event = fs_absolute($event);
    echo json_encode($event, $flags), "\n";
    break;
  case 'pings':
  case 'unraid':
  case 'outside':
    $list = json_decode((string) @file_get_contents($argv[2] ?? ''), true);
    $want = $argv[1];
    $picked = array_values(array_filter(is_array($list) ? $list : array(), function ($c) use ($want) {
      $kind = is_array($c) ? ($c['kind'] ?? '') : '';
      return $want === 'pings' ? $kind === 'healthchecks' : ($want === 'unraid') === ($kind === 'unraid');
    }));
    if ($picked) echo json_encode($picked, $flags), "\n";
    break;
  case 'recovery':
    exit(is_array($event) && !empty($event['recovery']) ? 0 : 1);
  case 'lift':
    $list = json_decode((string) @file_get_contents($argv[2] ?? ''), true);
    if (!is_array($list)) exit(1);
    foreach ($list as &$c) if (is_array($c) && ($c['on'] ?? 'failure') === 'failure' && ($c['kind'] ?? '') !== 'healthchecks') $c['on'] = 'always';
    unset($c);
    echo json_encode($list, $flags), "\n";
    break;
  default:
    exit(2);
}
