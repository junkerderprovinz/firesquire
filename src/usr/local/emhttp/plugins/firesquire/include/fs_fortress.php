<?php
/* FireSquire's place in a fortress, for the settings page: joining with the
 * phrase, the members and their status, taking one out and leaving. Every
 * call to ParleyPort's fortress helper goes through $run($args, $stdin), which
 * returns its exit code, output and error output. The phrase reaches the helper on its input and nowhere else;
 * the directory keeps only the keys fortress join derives from it. */

/* FireSquire asks BombVault when the flash was last backed up. */
const FS_FORTRESS_USES = 'backup.last';
/* A member id as the helper prints it, which no flag can pass for. */
const FS_FORTRESS_ID = '/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/';
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

/* Another app took FireSquire out. The helper then forgets the membership
 * and leaves removed-here, which stays until FireSquire joins again. */
function fs_fortress_removed_here($dir) {
  return !fs_fortress_joined($dir) && is_file("$dir/removed-here");
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

/* Joining again with the new phrase keeps the member key, so the others know
 * FireSquire as before. */
function fs_fortress_join($dir, $phrase, $device, $run) {
  if (fs_fortress_joined($dir) && !fs_fortress_phrase_changed($dir)) return array('error' => 'member');
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

/* The other apps of the fortress as the fortress card draws them. Phones,
 * viewers and an instance that never said which app it runs carry no app, so
 * they stay out. The form tells the card which apps keep the phrase. */
function fs_fortress_members($dir, $run) {
  list($code, $out, $err) = $run(array('members', '-dir', $dir, '-json', '-wait', '4s'), '');
  $list = $code === 0 ? json_decode($out, true) : null;
  if (!is_array($list)) return array('error' => fs_fortress_reason($err));
  $members = array();
  foreach ($list as $m) {
    if (($m['kind'] ?? '') !== 'instance' || (string) ($m['app']['id'] ?? '') === '') continue;
    $online = !empty($m['online']);
    $members[] = array('id' => (string) ($m['id'] ?? ''), 'app' => (string) $m['app']['id'], 'name' => fs_fortress_app_name($m),
      'device' => (string) ($m['device'] ?? ''), 'form' => (string) ($m['deployment'] ?? ''),
      'version' => (string) ($m['app']['version'] ?? ''), 'icon' => (string) ($m['app']['icon'] ?? ''),
      'online' => $online, 'relay' => $online && empty($m['direct']), 'lastSeen' => (string) ($m['lastSeen'] ?? ''));
  }
  return array('members' => $members);
}

/* Everything the fortress card shows, in one answer. Listing the members can
 * find FireSquire taken out, so the membership is read after. */
function fs_fortress_state($dir, $file, $device, $run) {
  $members = array();
  if (fs_fortress_joined($dir)) $members = fs_fortress_members($dir, $run)['members'] ?? array();
  return array('joined' => fs_fortress_joined($dir), 'device' => $device, 'removedHere' => fs_fortress_removed_here($dir),
    'phraseChanged' => fs_fortress_phrase_changed($dir), 'members' => $members, 'removed' => fs_fortress_names(fs_fortress_removed($dir, $file)));
}

/* The status report of one member in reach, in the page's language. The
 * helper asks every instance in reach and reads no log. */
function fs_fortress_status($dir, $id, $lang, $run) {
  if (!fs_fortress_joined($dir)) return array('error' => 'notMember');
  if (!preg_match(FS_FORTRESS_ID, $id)) return array('error' => 'invalid');
  $args = array('status', '-dir', $dir, '-json', '-wait', '4s');
  if (preg_match('/^[a-z]{2}$/', $lang)) array_push($args, '-lang', $lang);
  list($code, $out, $err) = $run($args, '');
  $list = $code === 0 ? json_decode($out, true) : null;
  if (!is_array($list)) return array('error' => fs_fortress_reason($err));
  foreach ($list as $m) {
    if (($m['id'] ?? '') !== $id) continue;
    return is_array($m['report'] ?? null) ? array('report' => $m['report'], 'log' => array()) : array('error' => 'unanswered');
  }
  return array('error' => 'noMember');
}

function fs_fortress_group($dir) {
  $m = json_decode((string) @file_get_contents("$dir/fortress.json"), true);
  return is_array($m) ? (string) ($m['group'] ?? '') : '';
}

/* The fortress took a phrase FireSquire could not follow. An app that took
 * it answers on the old one as moved, and the helper keeps that in the book
 * under FireSquire's group; once it follows, the book starts over. */
function fs_fortress_phrase_changed($dir) {
  $group = fs_fortress_group($dir);
  $book = json_decode((string) @file_get_contents("$dir/state.json"), true)['fortress'] ?? null;
  if ($group === '' || !is_array($book) || ($book['group'] ?? '') !== $group) return false;
  foreach ($book['members'] ?? array() as $m) {
    if (!empty($m['moved'])) return true;
  }
  return false;
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
  if (!preg_match(FS_FORTRESS_ID, $id)) return array('error' => 'invalid');
  list($code, $out, $err) = $run(array('remove', '-dir', $dir, '-wait', '4s', $id), '');
  $gone = $code === 0 ? json_decode($out, true) : null;
  if (!is_array($gone)) {
    $reason = fs_fortress_reason($err);
    return array('error' => strpos($reason, 'no member ') === 0 ? 'noMember' : $reason);
  }
  $list = array_values(array_filter(fs_fortress_removed($dir, $file), function ($r) use ($id) { return ($r['id'] ?? '') !== $id; }));
  $list[] = array('id' => $id, 'app' => (string) ($gone['app']['id'] ?? ''), 'name' => fs_fortress_app_name($gone), 'device' => (string) ($gone['device'] ?? ''));
  $part = "$file.part";
  if (@file_put_contents($part, json_encode(array('group' => fs_fortress_group($dir), 'removed' => $list))) !== false) {
    @chmod($part, 0600);
    @rename($part, $file);
  }
  return array('ok' => true, 'removed' => fs_fortress_names($list));
}

/* The removed as the card shows them, without their ids. */
function fs_fortress_names($list) {
  return array_map(function ($r) { return array('app' => (string) ($r['app'] ?? ''), 'name' => (string) ($r['name'] ?? ''), 'device' => (string) ($r['device'] ?? '')); }, $list);
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
