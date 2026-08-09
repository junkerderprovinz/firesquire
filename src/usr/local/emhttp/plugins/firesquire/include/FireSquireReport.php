<?php
/* FireSquire -- runs the engine and returns its JSON. The WebGUI (firesquire.js)
 * localises and renders it. Fixed engine path, no user input. */
header('Content-Type: application/json');
$ENGINE = '/usr/local/emhttp/plugins/firesquire/firesquire-check.sh';
$raw = shell_exec('bash ' . escapeshellarg($ENGINE) . ' --json 2>/dev/null');
if (!is_string($raw) || trim($raw) === '') {
  echo '{"verdict":"UNKNOWN","worst":0,"checks":[]}';
} else {
  echo $raw;
}
