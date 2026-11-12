<?php
/* The settings page's way into the fortress. A GET says whether FireSquire is
 * in one and whom it took out, and with do=members how the other apps are
 * doing. A POST joins with the phrase, takes another app out or leaves. The
 * phrase is handed to the fortress helper and dropped;
 * /boot/config/plugins/firesquire/fortress keeps only the keys. */
require_once __DIR__ . '/fs_fortress.php';
header('Content-Type: application/json');

$fsDir = '/boot/config/plugins/firesquire/fortress';
$fsHelper = dirname(__DIR__) . '/fortress';
$fsRemoved = '/boot/config/plugins/firesquire/fortress-removed.json';

$fsRun = function ($args, $stdin) use ($fsHelper) {
  $cmd = escapeshellarg($fsHelper);
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
};

function fs_state($dir, $helper, $removed) {
  return array('helper' => is_executable($helper), 'joined' => fs_fortress_joined($dir), 'device' => fs_fortress_device('/boot/config/ident.cfg'),
    'removed' => fs_fortress_names(fs_fortress_removed($dir, $removed)));
}

function fs_answer($code, $body) {
  http_response_code($code);
  echo json_encode($body);
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  if (($_GET['do'] ?? '') !== 'members') fs_answer(200, fs_state($fsDir, $fsHelper, $fsRemoved));
  if (!is_executable($fsHelper)) fs_answer(503, array('error' => 'helper'));
  if (!fs_fortress_joined($fsDir)) fs_answer(409, array('error' => 'notMember'));
  $r = fs_fortress_members($fsDir, $fsRun);
  fs_answer(isset($r['error']) ? 502 : 200, $r);
}

switch ($_POST['do'] ?? '') {
  case 'join':
    if (!is_executable($fsHelper)) fs_answer(503, array('error' => 'helper'));
    $r = fs_fortress_join($fsDir, (string) ($_POST['phrase'] ?? ''), fs_fortress_device('/boot/config/ident.cfg'), $fsRun);
    if (isset($r['error'])) fs_answer($r['error'] === 'member' ? 409 : ($r['error'] === 'phrase' ? 400 : 500), $r);
    fs_answer(200, fs_state($fsDir, $fsHelper, $fsRemoved));
  case 'remove':
    if (!is_executable($fsHelper)) fs_answer(503, array('error' => 'helper'));
    $r = fs_fortress_remove($fsDir, $fsRemoved, (string) ($_POST['id'] ?? ''), $fsRun);
    if (isset($r['error'])) fs_answer(array('notMember' => 409, 'invalid' => 400, 'noMember' => 404)[$r['error']] ?? 502, $r);
    fs_answer(200, fs_state($fsDir, $fsHelper, $fsRemoved));
  case 'leave':
    $r = fs_fortress_leave($fsDir);
    if (isset($r['error'])) fs_answer($r['error'] === 'notMember' ? 409 : 500, $r);
    fs_answer(200, fs_state($fsDir, $fsHelper, $fsRemoved));
}
fs_answer(400, array('error' => 'invalid'));
