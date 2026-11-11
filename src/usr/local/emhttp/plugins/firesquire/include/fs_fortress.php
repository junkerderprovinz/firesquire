<?php
/* FireSquire's place in a fortress, for the settings page: joining with the
 * phrase, the members and leaving. Every call to ParleyPort's fortress helper
 * goes through $run($args, $stdin), which returns its exit code, output and
 * error output. The phrase reaches the helper on its input and nowhere else;
 * the directory keeps only the keys fortress join derives from it. */

/* FireSquire asks BombVault when the flash was last backed up. */
const FS_FORTRESS_USES = 'backup.last';

/* How the house's apps write their names; a plugin joins under its id alone. */
const FS_FORTRESS_NAMES = array(
  'arrowloop' => 'ArrowLoop', 'bombvault' => 'BombVault', 'cannoncommander' => 'CannonCommander',
  'castleparcel' => 'CastleParcel', 'firesquire' => 'FireSquire', 'knightloader' => 'KnightLoader',
  'shiplog' => 'ShipLog', 'tollroll' => 'TollRoll', 'towertorch' => 'TowerTorch',
);

function fs_fortress_joined($dir) {
  return is_file("$dir/fortress.json");
}

/* The server's name as Unraid shows it, which the other apps see it under. */
function fs_fortress_device($ident) {
  $cfg = @parse_ini_file($ident);
  $name = is_array($cfg) ? trim((string) ($cfg['NAME'] ?? '')) : '';
  return $name !== '' ? $name : (string) gethostname();
}

/* The helper's reason without its "fortress: " prefix. */
function fs_fortress_reason($err) {
  $err = trim((string) $err);
  return $err === '' ? 'helper' : preg_replace('/^fortress: /', '', strtok($err, "\n"));
}

function fs_fortress_join($dir, $phrase, $device, $run) {
  if (fs_fortress_joined($dir)) return array('error' => 'member');
  // fortress join reads one line, and a pasted phrase may come in several.
  $words = trim(preg_replace('/\s+/', ' ', (string) $phrase));
  if ($words === '') return array('error' => 'phrase');
  list($code, , $err) = $run(array('join', '-dir', $dir, '-app', 'firesquire', '-name', $device, '-lan', '-uses', FS_FORTRESS_USES), $words . "\n");
  if ($code === 0) return array('ok' => true);
  $reason = fs_fortress_reason($err);
  return array('error' => strpos($reason, 'phrase: ') === 0 ? 'phrase' : $reason);
}

/* The other apps of the fortress: each instance with its device and whether
 * it is in reach. Phones and viewers carry no app, so they stay out. */
function fs_fortress_members($dir, $run) {
  list($code, $out, $err) = $run(array('members', '-dir', $dir, '-json', '-wait', '4s'), '');
  $list = $code === 0 ? json_decode($out, true) : null;
  if (!is_array($list)) return array('error' => fs_fortress_reason($err));
  $members = array();
  foreach ($list as $m) {
    if (($m['kind'] ?? '') !== 'instance') continue;
    $id = (string) ($m['app']['id'] ?? '');
    $name = (string) ($m['app']['name'] ?? '');
    if ($name === '' || $name === $id) $name = FS_FORTRESS_NAMES[$id] ?? $id;
    $members[] = array('app' => $name, 'device' => (string) ($m['device'] ?? ''), 'online' => !empty($m['online']));
  }
  return array('members' => $members);
}

/* Leaving forgets the membership. The others keep FireSquire as away until
 * somebody removes it, and the phrase brings it back. */
function fs_fortress_leave($dir) {
  if (!fs_fortress_joined($dir)) return array('error' => 'notMember');
  foreach (scandir($dir) as $f) {
    if ($f !== '.' && $f !== '..') @unlink("$dir/$f");
  }
  return @rmdir($dir) ? array('ok' => true) : array('error' => 'remove');
}
