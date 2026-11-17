<?php
/* The Health tab's way to how the server stands: the last full check with its
 * lights and the lights of the last 30 days, a day without a check left
 * empty. With run=1 it runs the check first. Fixed engine path, no other
 * input. */
require_once __DIR__ . '/fs_health.php';
header('Content-Type: application/json');

if (($_GET['run'] ?? '') === '1') shell_exec('bash ' . escapeshellarg(FS_ENGINE) . ' --json >/dev/null 2>&1');

$last = json_decode((string) @file_get_contents('/var/local/firesquire/last.json'), true);
$days = fs_history_parse((string) @file_get_contents('/boot/config/plugins/firesquire/health.history'));
$history = array();
for ($i = 29; $i >= 0; $i--) {
  $d = date('Y-m-d', strtotime("-$i days"));
  $history[] = array('date' => $d, 'lights' => (object) ($days[$d] ?? array()));
}
echo json_encode(array('last' => is_array($last) ? $last : null, 'history' => $history), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
