<?php
/* Reads the report of firesquire-check.sh on stdin and prints the event to
 * send, or nothing. Arguments: the last verdict, Unraid's language and the
 * server's name. */
require __DIR__ . '/include/fs_notify.php';

$event = fs_event(json_decode(stream_get_contents(STDIN), true), $argv[1] ?? '', $argv[2] ?? '', $argv[3] ?? '');
if ($event !== null) echo json_encode($event, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
