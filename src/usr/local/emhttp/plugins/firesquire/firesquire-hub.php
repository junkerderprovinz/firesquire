<?php
/* The JSON work of firesquire-hub.sh, one piece per call:
 *   hubs          the TollRolls of `fortress status -json` on stdin that take over
 *   body          the message for notify.deliver from FireSquire's event on stdin
 *   resolve       one message per line that closes a level the check left
 *   own           the event for the notify helper, without what is the hub's
 *   pings FILE    the channels of FILE that are Healthchecks, or nothing */
require_once __DIR__ . '/include/fs_fortress.php';

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
    unset($event['hub']);
    echo json_encode($event, $flags), "\n";
    break;
  case 'pings':
    $list = json_decode((string) @file_get_contents($argv[2] ?? ''), true);
    $pings = array_values(array_filter(is_array($list) ? $list : array(), function ($c) { return is_array($c) && ($c['kind'] ?? '') === 'healthchecks'; }));
    if ($pings) echo json_encode($pings, $flags), "\n";
    break;
  default:
    exit(2);
}
