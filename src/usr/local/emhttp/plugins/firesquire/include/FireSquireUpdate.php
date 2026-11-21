<?php
/* Where FireSquire's updates stand, asked of Unraid's own plugin manager, so
 * the Version card and the Plugins tab never disagree. A GET reads the
 * installed plugin file and the newest one Unraid's last check left in
 * /tmp/plugins; a POST runs that check first, as "Check for updates" on the
 * Plugins tab does. */
header('Content-Type: application/json');
header('Cache-Control: no-store');

$fsTool = '/usr/local/emhttp/plugins/dynamix.plugin.manager/scripts/plugin';
$fsPlg = 'firesquire.plg';
$fsLatest = "/tmp/plugins/$fsPlg";

function fs_plg_version($tool, $file) {
  if (!is_file($file)) return null;
  $out = array();
  exec(escapeshellarg($tool) . ' version ' . escapeshellarg($file) . ' 2>/dev/null', $out, $rc);
  $v = $rc === 0 && $out ? trim(end($out)) : '';
  return $v === '' ? null : $v;
}

$fsMethod = $_SERVER['REQUEST_METHOD'];
if ($fsMethod !== 'GET' && $fsMethod !== 'POST') {
  http_response_code(405);
  echo json_encode(array('error' => 'not allowed'));
  exit;
}
if ($fsMethod === 'POST') {
  $out = array();
  exec('timeout 60 ' . escapeshellarg($fsTool) . ' check ' . escapeshellarg($fsPlg) . ' 2>&1', $out, $rc);
  if ($rc !== 0) {
    $why = '';
    foreach ($out as $line) if (strpos($line, 'plugin: ') === 0 && strpos($line, 'checking:') === false) $why = substr($line, 8);
    http_response_code(502);
    echo json_encode(array('error' => $why !== '' ? $why : 'check failed'));
    exit;
  }
  clearstatcache();
}

echo json_encode(array(
  'installed' => fs_plg_version($fsTool, "/var/log/plugins/$fsPlg"),
  'latest' => fs_plg_version($fsTool, $fsLatest),
  'checkedAt' => is_file($fsLatest) ? filemtime($fsLatest) : null,
));
