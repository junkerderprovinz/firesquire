<?php
/* Reads the report of firesquire-check.sh on stdin after every full check and
 * keeps how the server stands: the last report with its lights in RAM for the
 * Health tab, the lights of the last 30 days in health.history on the flash,
 * written only when a light changed, and FireSquire's status in the
 * fortress's report format in /var/local/fortress, where TollRoll reads the
 * plugins of this server: firesquire.json in Unraid's language and one
 * firesquire.<lang>.json per language. Prints the notification for areas that
 * got worse, or nothing.
 *
 * With --refresh it writes the status again from the last check alone, which
 * cron does every hour, so TollRoll knows FireSquire is still there between
 * checks. Arguments: Unraid's language, the server's name and FireSquire's
 * version, each found on the server when left out. */
require __DIR__ . '/include/fs_health.php';

$state = getenv('FS_STATE') ?: '/boot/config/plugins/firesquire';
$run = getenv('FS_RUN') ?: '/var/local/firesquire';
$out = getenv('FS_FORTRESS_OUT') ?: '/var/local/fortress';
$now = (int) (getenv('FS_NOW') ?: time());
$refresh = ($argv[1] ?? '') === '--refresh';
$args = $refresh ? array() : array_slice($argv, 1);
$cfg = @parse_ini_file('/boot/config/plugins/dynamix/dynamix.cfg');
$lang = (string) ($args[0] ?? substr((string) ($cfg['locale'] ?? ''), 0, 2));
$server = (string) ($args[1] ?? gethostname());
$version = (string) ($args[2] ?? (preg_match('/<!ENTITY\s+version\s+"([^"]+)"/', (string) @file_get_contents('/var/log/plugins/firesquire.plg'), $m) ? $m[1] : ''));

function fs_put($file, $text) {
  if (!is_dir(dirname($file)) && !@mkdir(dirname($file), 0755, true)) return;
  if (@file_put_contents("$file.part", $text) !== false) @rename("$file.part", $file);
}

/* The status in every language, the plain file in Unraid's. A need keeps the
 * time it began from the status before. */
function fs_put_status($out, $areas, $since, $lang, $app, $server) {
  $prev = json_decode((string) @file_get_contents("$out/firesquire.json"), true);
  $prev = is_array($prev) ? $prev : array();
  $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
  foreach (glob(__DIR__ . '/lang/*.json') as $f) {
    $code = basename($f, '.json');
    fs_put("$out/firesquire.$code.json", json_encode(fs_health_status($areas, $prev, $since, $code, $app, $server), $flags));
  }
  fs_put("$out/firesquire.json", json_encode(fs_health_status($areas, $prev, $since, $lang ?: 'en', $app, $server), $flags));
}

$app = array('id' => 'firesquire', 'name' => 'FireSquire', 'version' => $version);
$last = json_decode((string) @file_get_contents("$run/last.json"), true);

if ($refresh) {
  if (!is_array($last['areas'] ?? null)) exit(0);
  fs_put_status($out, $last['areas'], (int) ($last['at'] ?? $now), $lang, $app, $server);
  exit(0);
}

$report = json_decode(stream_get_contents(STDIN), true);
if (!is_array($report)) exit(1);
$h = fs_health_areas($report);
$lights = fs_lights($h['areas']);

$historyFile = "$state/health.history";
$history = (string) @file_get_contents($historyFile);
$days = fs_history_parse($history);
$before = is_array($last['areas'] ?? null) ? fs_lights($last['areas']) : ($days ? end($days) : array());

$next = fs_history_add($history, date('Y-m-d', $now), $lights);
if ($next !== $history) fs_put($historyFile, $next);

fs_put("$run/last.json", json_encode(array('generated' => date('Y-m-d H:i:s', $now), 'at' => $now, 'verdict' => (string) ($report['verdict'] ?? ''),
  'areas' => $h['areas'], 'config' => $h['config']), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
fs_put_status($out, $h['areas'], $now, $lang, $app, $server);

$event = fs_health_event($h['areas'], $before, $lang, $server);
if ($event !== null) echo json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
