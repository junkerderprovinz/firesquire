<?php
/* The settings page's way to the notification channels and the schedule. A
 * GET shows the channels with every secret masked, and the schedule. A POST
 * saves the channels, tries one, or sets the schedule. The channels live in
 * /boot/config/plugins/firesquire/notify.json in kit/notify's format, and
 * only ParleyPort's notify helper reads their secrets. */
require_once __DIR__ . '/fs_notify.php';
header('Content-Type: application/json');

$fsDir = '/boot/config/plugins/firesquire';
$fsChannels = "$fsDir/notify.json";
$fsCron = "$fsDir/firesquire.cron";
$fsHelper = dirname(__DIR__) . '/notify';
$fsLang = fs_ui_lang();

/* Runs the helper with $args and $stdin and returns its exit code and output. */
function fs_helper($helper, $args, $stdin) {
  $cmd = escapeshellarg($helper);
  foreach ($args as $a) $cmd .= ' ' . escapeshellarg($a);
  $p = proc_open($cmd, array(0 => array('pipe', 'r'), 1 => array('pipe', 'w'), 2 => array('pipe', 'w')), $pipes);
  if (!is_resource($p)) return array(1, '', 'the helper did not start');
  fwrite($pipes[0], $stdin);
  fclose($pipes[0]);
  $out = stream_get_contents($pipes[1]);
  $err = stream_get_contents($pipes[2]);
  fclose($pipes[1]);
  fclose($pipes[2]);
  return array(proc_close($p), trim($out), trim($err));
}

function fs_schedule($file) {
  if (preg_match('/^(\d+) (\d+) \* \* (\*|0) /m', (string) @file_get_contents($file), $m)) {
    return array('every' => $m[3] === '*' ? 'daily' : 'weekly', 'hour' => (int) $m[2], 'minute' => (int) $m[1]);
  }
  return array('every' => 'off', 'hour' => 4, 'minute' => 30);
}

function fs_answer($code, $body) {
  http_response_code($code);
  echo $body;
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  $list = '[]';
  if (is_executable($fsHelper)) {
    list($code, $out) = fs_helper($fsHelper, array('show', '-channels', $fsChannels), '');
    if ($code === 0 && $out !== '') $list = $out;
  }
  // The last check found a TollRoll that sends the messages.
  $hub = @filesize('/var/local/firesquire/hubs') > 0;
  fs_answer(200, '{"helper":' . (is_executable($fsHelper) ? 'true' : 'false') . ',"hub":' . ($hub ? 'true' : 'false') . ',"channels":' . $list . ',"schedule":' . json_encode(fs_schedule($fsCron)) . '}');
}

switch ($_POST['do'] ?? '') {
  case 'save':
  case 'test':
    if (!is_executable($fsHelper)) fs_answer(503, '{"error":"helper"}');
    if ($_POST['do'] === 'save') {
      $list = json_decode((string) ($_POST['channels'] ?? ''), true);
      if (!is_array($list)) fs_answer(400, '{"error":"invalid"}');
      list($code, $out, $err) = fs_helper($fsHelper, array('save', '-channels', $fsChannels), json_encode($list));
      if ($code === 0) fs_answer(200, '{"channels":' . $out . '}');
    } else {
      $channel = json_decode((string) ($_POST['channel'] ?? ''), true);
      if (!is_array($channel)) fs_answer(400, '{"error":"invalid"}');
      // Unraid's own notification opens the page by its path, any other channel needs it whole.
      $event = fs_test_event($fsLang);
      if (($channel['kind'] ?? '') !== 'unraid') $event = fs_absolute($event);
      $in = json_encode(array('channel' => $channel, 'event' => $event));
      // While the last check found TollRoll's hub, the test goes its way.
      $hubs = array_filter(array_map('trim', @file('/var/local/firesquire/hubs') ?: array()));
      $fortress = dirname(__DIR__) . '/fortress';
      if (!is_executable($fortress)) $hubs = array();
      $hubs = $hubs ? explode(',', implode(',', $hubs)) : array();
      $out = $err = '';
      $r = fs_test_send($hubs, function () use ($hubs, $fortress, $fsDir, $fsLang) {
        return fs_hub_test($hubs, "$fsDir/fortress", $fsLang, function ($args) use ($fortress) { return fs_helper($fortress, $args, ''); });
      }, function () use ($fsHelper, $fsChannels, $in, &$out, &$err) {
        list(, $out, $err) = fs_helper($fsHelper, array('test', '-channels', $fsChannels, '-source', 'FireSquire'), $in);
        return json_decode($out, true);
      });
      if (is_array($r)) fs_answer(200, json_encode($r));
      if ($out !== '') fs_answer(200, $out);
    }
    fs_answer($out !== '' ? 422 : 500, $out !== '' ? $out : json_encode(array('error' => $err)));
  case 'schedule':
    $every = (string) ($_POST['every'] ?? 'off');
    $line = fs_cron($every, $_POST['hour'] ?? '', $_POST['minute'] ?? 30);
    if ($line === '' && $every !== 'off') fs_answer(400, '{"error":"invalid"}');
    if ($line === '') {
      @unlink($fsCron);
    } else {
      @mkdir($fsDir, 0700, true);
      file_put_contents($fsCron, "# FireSquire runs its check on a schedule.\n" . $line);
    }
    exec('/usr/local/sbin/update_cron');
    fs_answer(200, json_encode(fs_schedule($fsCron)));
}
fs_answer(400, '{"error":"invalid"}');
