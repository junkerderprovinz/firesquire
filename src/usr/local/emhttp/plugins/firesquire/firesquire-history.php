<?php
/* Reads the report of firesquire-check.sh on stdin after every full check and
 * keeps how the server stands: the last report with its lights in RAM for the
 * Health tab, the status in the fortress's format next to it, and the lights
 * of the last 30 days in health.history on the flash, written only when a
 * light changed. Prints the notification for areas that got worse, or
 * nothing. Arguments: Unraid's language, the server's name and FireSquire's
 * version. */
require __DIR__ . '/include/fs_health.php';

$state = getenv('FS_STATE') ?: '/boot/config/plugins/firesquire';
$run = getenv('FS_RUN') ?: '/var/local/firesquire';
$now = (int) (getenv('FS_NOW') ?: time());
list(, $lang, $server, $version) = array_pad($argv, 4, '');

$report = json_decode(stream_get_contents(STDIN), true);
if (!is_array($report)) exit(1);
$h = fs_health_areas($report);
$lights = fs_lights($h['areas']);

function fs_put($file, $text) {
  if (!is_dir(dirname($file)) && !@mkdir(dirname($file), 0700, true)) return;
  if (@file_put_contents("$file.tmp", $text) !== false) @rename("$file.tmp", $file);
}

$last = json_decode((string) @file_get_contents("$run/last.json"), true);
$historyFile = "$state/health.history";
$history = (string) @file_get_contents($historyFile);
$days = fs_history_parse($history);
$before = is_array($last['areas'] ?? null) ? fs_lights($last['areas']) : ($days ? end($days) : array());

$next = fs_history_add($history, date('Y-m-d', $now), $lights);
if ($next !== $history) fs_put($historyFile, $next);

fs_put("$run/last.json", json_encode(array('generated' => date('Y-m-d H:i:s', $now), 'verdict' => (string) ($report['verdict'] ?? ''),
  'areas' => $h['areas'], 'config' => $h['config']), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
$prev = json_decode((string) @file_get_contents("$run/status.json"), true);
$app = array('id' => 'firesquire', 'name' => 'FireSquire', 'version' => $version);
fs_put("$run/status.json", json_encode(fs_health_status($h['areas'], is_array($prev) ? $prev : array(), $now, $lang, $app, $server), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

$event = fs_health_event($h['areas'], $before, $lang, $server);
if ($event !== null) echo json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
