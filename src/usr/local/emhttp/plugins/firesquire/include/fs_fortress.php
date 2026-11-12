<?php
/* FireSquire's place in a fortress, for the settings page: joining with the
 * phrase, the members, taking one out and leaving. Every call to ParleyPort's
 * fortress helper goes through $run($args, $stdin), which returns its exit
 * code, output and error output. The phrase reaches the helper on its input and nowhere else;
 * the directory keeps only the keys fortress join derives from it. */

/* FireSquire asks BombVault when the flash was last backed up. */
const FS_FORTRESS_USES = 'backup.last';
/* The other apps of the fortress show FireSquire with this logo. */
const FS_FORTRESS_ICON = '/usr/local/emhttp/plugins/firesquire/images/firesquire.svg';

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
  list($code, , $err) = $run(array('join', '-dir', $dir, '-app', 'firesquire', '-name', $device, '-lan', '-uses', FS_FORTRESS_USES, '-icon', FS_FORTRESS_ICON), $words . "\n");
  if ($code === 0) return array('ok' => true);
  $reason = fs_fortress_reason($err);
  return array('error' => strpos($reason, 'phrase: ') === 0 ? 'phrase' : $reason);
}

function fs_fortress_app_name($m) {
  $id = (string) ($m['app']['id'] ?? '');
  $name = (string) ($m['app']['name'] ?? '');
  return $name === '' || $name === $id ? FS_FORTRESS_NAMES[$id] ?? $id : $name;
}

/* The other apps of the fortress: each instance with its device and whether
 * it is in reach. Phones, viewers and an instance that never said which app
 * it runs carry no app, so they stay out. FireSquire keeps no phrase, so
 * keepers are the apps that do, where it is changed, those in reach first.
 * An app the fortress still knows from an earlier install is named once. */
function fs_fortress_members($dir, $run) {
  list($code, $out, $err) = $run(array('members', '-dir', $dir, '-json', '-wait', '4s'), '');
  $list = $code === 0 ? json_decode($out, true) : null;
  if (!is_array($list)) return array('error' => fs_fortress_reason($err));
  $members = array();
  $keepers = array();
  foreach ($list as $m) {
    if (($m['kind'] ?? '') !== 'instance' || (string) ($m['app']['id'] ?? '') === '') continue;
    $member = array('id' => (string) ($m['id'] ?? ''), 'app' => fs_fortress_app_name($m), 'device' => (string) ($m['device'] ?? ''), 'online' => !empty($m['online']));
    $members[] = $member;
    if (($m['deployment'] ?? '') !== 'plugin') $keepers[] = $member;
  }
  usort($keepers, function ($a, $b) { return $b['online'] <=> $a['online']; });
  $named = array();
  foreach ($keepers as $k) $named[$k['app'] . "\n" . $k['device']] = array('app' => $k['app'], 'device' => $k['device']);
  return array('members' => $members, 'keepers' => array_values($named));
}

function fs_fortress_group($dir) {
  $m = json_decode((string) @file_get_contents("$dir/fortress.json"), true);
  return is_array($m) ? (string) ($m['group'] ?? '') : '';
}

/* The apps FireSquire took out since the phrase last changed, which the old
 * phrase still lets back in. The file names the group of the phrase it was
 * kept under, so a phrase FireSquire followed or joined with clears it. */
function fs_fortress_removed($dir, $file) {
  $kept = json_decode((string) @file_get_contents($file), true);
  $group = fs_fortress_group($dir);
  if (!is_array($kept) || $group === '') return array();
  if (($kept['group'] ?? '') !== $group) {
    @unlink($file);
    return array();
  }
  return array_values(array_filter($kept['removed'] ?? array(), 'is_array'));
}

/* Takes the member id out of the fortress, here and at every member in
 * reach, and adds it to the removed. */
function fs_fortress_remove($dir, $file, $id, $run) {
  if (!fs_fortress_joined($dir)) return array('error' => 'notMember');
  if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/', $id)) return array('error' => 'invalid');
  list($code, $out, $err) = $run(array('remove', '-dir', $dir, '-wait', '4s', $id), '');
  $gone = $code === 0 ? json_decode($out, true) : null;
  if (!is_array($gone)) {
    $reason = fs_fortress_reason($err);
    return array('error' => strpos($reason, 'no member ') === 0 ? 'noMember' : $reason);
  }
  $list = array_values(array_filter(fs_fortress_removed($dir, $file), function ($r) use ($id) { return ($r['id'] ?? '') !== $id; }));
  $list[] = array('id' => $id, 'app' => fs_fortress_app_name($gone), 'device' => (string) ($gone['device'] ?? ''));
  $part = "$file.part";
  if (@file_put_contents($part, json_encode(array('group' => fs_fortress_group($dir), 'removed' => $list))) !== false) {
    @chmod($part, 0600);
    @rename($part, $file);
  }
  return array('ok' => true, 'removed' => fs_fortress_names($list));
}

/* The removed as the card shows them, without their ids. */
function fs_fortress_names($list) {
  return array_map(function ($r) { return array('app' => (string) ($r['app'] ?? ''), 'device' => (string) ($r['device'] ?? '')); }, $list);
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
