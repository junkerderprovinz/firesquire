# Disk health for firesquire-check.sh: ZFS pools, btrfs device counters and
# the SMART CRC count of every disk. Each finding names the disk with the port
# it hangs on, so it says which cable to look at. The engine sources this file
# and brings add(), have() and plural().
# shellcheck shell=bash

FS_BYPATH="${FS_BYPATH:-/dev/disk/by-path}"
FS_BYID="${FS_BYID:-/dev/disk/by-id}"
FS_STATE="${FS_STATE:-/boot/config/plugins/firesquire}"
FS_MOUNTS="${FS_MOUNTS:-/proc/mounts}"
FS_DISKS_INI="${FS_DISKS_INI:-/var/local/emhttp/disks.ini}"
FS_DISK_TROUBLE=0
CRC_SEEN=""
SMART_SEEN=""
SMART_ASLEEP=0

# links prints each link in dir with where it points.
links() {
  local l
  for l in "$1"/*; do
    [ -L "$l" ] && printf '%s %s\n' "${l##*/}" "$(readlink "$l")"
  done
}

# disk_of turns a partition, a path or a by-id name into the disk's kernel name.
disk_of() {
  local d="${1##*/}" t
  t="$(links "$FS_BYID" | awk -v n="$d" '$1 == n { print $2; exit }')"
  [ -n "$t" ] && d="${t##*/}"
  case "$d" in
    nvme*|mmcblk*) d="${d%p[0-9]*}" ;;
    sd*|hd*|vd*|xvd*) d="${d%%[0-9]*}" ;;
  esac
  printf '%s' "$d"
}

# disk_label names a disk with its by-path port, such as
# "sdc [pci-0000:00:17.0-ata-3]".
disk_label() {
  local d port
  d="$(disk_of "$1")"
  port="$(links "$FS_BYPATH" | awk -v d="$d" '$1 !~ /-part[0-9]+$/ { t = $2; sub(/.*\//, "", t); if (t == d) { print $1; exit } }')"
  if [ -n "$port" ]; then printf '%s [%s]' "$d" "$port"; else printf '%s' "$d"; fi
}

health_zfs() {
  have zpool || return 0
  local kind pool state dev r w c label pools=0 bad=0
  while IFS=$'\t' read -r kind pool state dev r w c; do
    if [ "$kind" = P ]; then
      pools=$((pools + 1))
      case "$state" in
        DEGRADED|FAULTED|UNAVAIL|SUSPENDED)
          bad=1
          add critical zfs fail zfs_degraded "$pool|$state" "ZFS pool $pool is $state. Fix it before rebooting." ;;
      esac
      continue
    fi
    bad=1
    label="$(disk_label "$dev")"
    if [ "$r$w$c" != 000 ]; then
      add critical zfs fail zfs_dev_errors "$pool|$label|$r|$w|$c" "ZFS pool $pool: $label has $r read, $w write and $c checksum errors."
    else
      add critical zfs fail zfs_dev_state "$pool|$label|$state" "ZFS pool $pool: $label is $state."
    fi
  done < <(zpool status 2>/dev/null | awk -v OFS='\t' '
    $1 == "pool:" { pool = $2; table = 0 }
    $1 == "state:" { print "P", pool, $2 }
    $1 == "NAME" && $2 == "STATE" { table = 1; next }
    table && NF == 0 { table = 0 }
    table && NF >= 5 && $1 != pool && $1 !~ /^(mirror|raidz[0-9]*|draid[^ ]*|spare|replacing)-[0-9]+$/ {
      if ($3 != "0" || $4 != "0" || $5 != "0" || $2 ~ /^(DEGRADED|FAULTED|UNAVAIL|REMOVED)$/)
        print "D", pool, $2, $1, $3, $4, $5
    }')
  [ "$bad" -eq 1 ] && FS_DISK_TROUBLE=1
  if [ "$pools" -gt 0 ] && [ "$bad" -eq 0 ]; then
    add critical zfs pass zfs_ok "$pools" "$pools ZFS $(plural "$pools" pool pools) online, no device errors."
  fi
}

health_btrfs() {
  have btrfs || return 0
  local src mp fs rest dev counts seen=" " filesystems=0 bad=0
  while read -r src mp fs rest; do
    [ "$fs" = btrfs ] || continue
    case "$seen" in *" $src "*) continue ;; esac
    seen="$seen$src "
    filesystems=$((filesystems + 1))
    while read -r dev counts; do
      bad=1
      add critical btrfs fail btrfs_dev_errors "$mp|$(disk_label "$dev")|$counts" "btrfs on $mp: $(disk_label "$dev") reports errors ($counts)."
    done < <(btrfs device stats "$mp" 2>/dev/null | awk '
      { split($1, a, "]."); d = substr(a[1], 2) }
      $2 + 0 > 0 { c[d] = c[d] (c[d] == "" ? "" : ", ") a[2] "=" $2 }
      END { for (d in c) print d, c[d] }' | sort)
  done < "$FS_MOUNTS"
  [ "$bad" -eq 1 ] && FS_DISK_TROUBLE=1
  if [ "$filesystems" -gt 0 ] && [ "$bad" -eq 0 ]; then
    add critical btrfs pass btrfs_ok "$filesystems" "$filesystems btrfs $(plural "$filesystems" filesystem filesystems) without device errors."
  fi
}

# crc_note records a disk's CRC count for crc_report, keyed by its serial,
# since the kernel names can change between boots.
crc_note() {
  CRC_SEEN="$CRC_SEEN$1 ${2:-$1} ${3:-0}"$'\n'
}

# smart_crc_note takes the serial and the CRC count from `smartctl -i -A`.
smart_crc_note() {
  local serial count
  serial="$(printf '%s\n' "$2" | awk -F': *' '/^Serial [Nn]umber/ { gsub(/[[:space:]]+/, "_", $2); print $2; exit }')"
  count="$(printf '%s\n' "$2" | awk '$2 == "UDMA_CRC_Error_Count" { v = $10 } END { print v + 0 }')"
  crc_note "$1" "$serial" "$count"
}

# crc_report warns about every count that rose since the last run, and about
# a count above zero on a disk it has not seen before. The counts live on the
# flash, which it writes only when one changed.
crc_report() {
  local file="$FS_STATE/crc.state" known kept="" next dev key val old
  known="$(cat "$file" 2>/dev/null)"
  while read -r dev key val; do
    [ -n "$dev" ] || continue
    old="$(printf '%s\n' "$known" | awk -v k="$key" '$1 == k { print $2; exit }')"
    if [ -z "$old" ] && [ "$val" -gt 0 ]; then
      FS_DISK_TROUBLE=1
      add warning crc warn crc_found "$(disk_label "$dev")|$val" "$(disk_label "$dev") has $val CRC $(plural "$val" error errors). That usually points to the cable or the port. FireSquire remembers the count and warns again if it rises."
    elif [ -n "$old" ] && [ "$val" -gt "$old" ]; then
      FS_DISK_TROUBLE=1
      add warning crc warn crc_rose "$(disk_label "$dev")|$old|$val" "The CRC errors on $(disk_label "$dev") rose from $old to $val since the last check. Check or replace the cable on this port."
    fi
    kept="$kept$key $val"$'\n'
  done <<< "$CRC_SEEN"
  next="$(printf '%s%s\n' "$kept" "$known" | awk 'NF == 2 && !seen[$1]++' | sort)"
  [ "$next" = "$(printf '%s\n' "$known" | awk 'NF == 2' | sort)" ] && return 0
  mkdir -p "$FS_STATE" && printf '%s\n' "$next" > "$file.tmp" && mv "$file.tmp" "$file"
}

# spun_down says Unraid spun the disk down, which reading its SMART would undo.
spun_down() {
  awk -v d="$1" '
    /^\[/ { dev = ""; down = "" }
    /^device=/ { v = $0; sub(/^device="?/, "", v); sub(/"?\r?$/, "", v); dev = v }
    /^spundown=/ { v = $0; sub(/^spundown="?/, "", v); sub(/"?\r?$/, "", v); down = v }
    dev == d && down == "1" { found = 1; exit }
    END { exit !found }' "$FS_DISKS_INI" 2>/dev/null
}

# smart_read prints the health, the identity and the attributes of a disk in
# one call, and fails for a disk in standby, which -n standby leaves asleep.
smart_read() {
  local out
  out="$(smartctl -n standby -H -i -A "$1" 2>/dev/null)"
  printf '%s\n' "$out"
  ! printf '%s\n' "$out" | grep -qE 'is in (STANDBY|SLEEP) mode'
}

# smart_failed reads the verdict of SMART alone: the self-assessment and an
# attribute failing now. The attribute table names its column WHEN_FAILED,
# which is no failure.
smart_failed() {
  printf '%s\n' "$1" | grep -qE 'self-assessment test result: FAILED|SMART Health Status: .*(FAIL|IMPENDING)|FAILING_NOW'
}

# smart_trend_note records the serial, the reallocated and pending sectors,
# the temperature and the power-on hours from `smartctl -i -A`, with "-" for
# what the disk does not tell, as NVMe drives keep no sector counts.
smart_trend_note() {
  local v
  v="$(printf '%s\n' "$2" | awk '
    /^Serial [Nn]umber/ { s = $0; sub(/^[^:]*: */, "", s); gsub(/[[:space:]]+/, "_", s) }
    $2 == "Reallocated_Sector_Ct" { re = $10 + 0 }
    $2 == "Current_Pending_Sector" { pe = $10 + 0 }
    $2 == "Power_On_Hours" { poh = $10 + 0 }
    $2 == "Temperature_Celsius" { tp = $10 + 0 }
    $2 == "Airflow_Temperature_Cel" && tp == "" { tp = $10 + 0 }
    /^Temperature:/ { tp = $2 + 0 }
    /^Power On Hours:/ { h = $4; gsub(/[^0-9]/, "", h); poh = h + 0 }
    END { if (s != "") print s, (re == "" ? "-" : re), (pe == "" ? "-" : pe), (tp == "" ? "-" : tp), (poh == "" ? "-" : poh) }')"
  [ -n "$v" ] && SMART_SEEN="$SMART_SEEN$1 $v"$'\n'
}

num() { case "$1" in ''|*[!0-9]*) return 1 ;; esac; }
rose() { num "$1" && num "$2" && [ "$1" -gt "$2" ]; }

# smart_trend_report holds every disk against what FireSquire last saw of it.
# A sector count that rose stays a warning for 30 days, the window of the
# Health tab's history. A temperature counts as risen 8 degrees over the
# disk's usual one, which follows slowly, so a hot afternoon does not become
# the norm. smart.state on the flash keeps one line per serial and is written
# only when a value changed.
smart_trend_report() {
  local file="$FS_STATE/smart.state" now="${FS_NOW:-$(date +%s)}" known kept="" next
  local dev serial re pe tp poh ore ope otp since kind from to label avg
  known="$(cat "$file" 2>/dev/null)"
  while read -r dev serial re pe tp poh; do
    [ -n "$dev" ] || continue
    read -r _ ore ope otp _ since kind from to <<< "$(printf '%s\n' "$known" | awk -v k="$serial" '$1 == k && NF == 9 { print; exit }')"
    since="${since:-0}"; kind="${kind:--}"; from="${from:--}"; to="${to:--}"
    if rose "$re" "$ore"; then since="$now"; kind=realloc; from="$ore"; to="$re"; fi
    if rose "$pe" "$ope"; then since="$now"; kind=pending; from="$ope"; to="$pe"; fi
    label="$(disk_label "$dev")"
    if [ "$since" -gt 0 ] && [ $((now - since)) -le $((30 * 86400)) ]; then
      local day; day="$(date -d "@$since" +%F)"
      if [ "$kind" = realloc ]; then
        add health smart_trend warn smart_realloc_rose "$label|$from|$to|$day" "The reallocated sectors on $label rose from $from to $to on $day. The disk is replacing worn spots, so keep an eye on it and have a backup ready."
      else
        add health smart_trend warn smart_pending_rose "$label|$from|$to|$day" "The pending sectors on $label rose from $from to $to on $day. Some spots could not be read, so make sure your backup is current."
      fi
    elif num "$tp" && num "$otp" && [ "$tp" -ge $((otp + 8)) ] && [ "$tp" -ge 40 ]; then
      add health smart_trend warn smart_temp_rose "$label|$tp|$otp" "$label runs at $tp °C, well above its usual $otp °C. Check the fans and the airflow."
    elif [ "$re" = - ] || [ "$pe" = - ]; then
      add health smart_trend pass smart_disk_short "$label|$tp|$poh" "$label: $tp °C, $poh $(plural "$poh" hour hours) powered on."
    else
      add health smart_trend pass smart_disk "$label|$tp|$re|$pe|$poh" "$label: $tp °C, $re reallocated and $pe pending sectors, $poh $(plural "$poh" hour hours) powered on."
    fi
    avg="${otp:--}"
    if num "$tp"; then if num "$otp"; then avg=$(( (otp * 3 + tp) / 4 )); else avg="$tp"; fi; fi
    kept="$kept$serial $re $pe $avg $poh $since $kind $from $to"$'\n'
  done <<< "$SMART_SEEN"
  if [ "$SMART_ASLEEP" -gt 0 ]; then
    add health smart_trend info smart_asleep "$SMART_ASLEEP" "$SMART_ASLEEP $(plural "$SMART_ASLEEP" 'disk was asleep and FireSquire left it' 'disks were asleep and FireSquire left them') alone."
  fi
  next="$(printf '%s%s\n' "$kept" "$known" | awk 'NF == 9 && !seen[$1]++' | sort)"
  [ "$next" = "$(printf '%s\n' "$known" | awk 'NF == 9' | sort)" ] && return 0
  mkdir -p "$FS_STATE" && printf '%s\n' "$next" > "$file.tmp" && mv "$file.tmp" "$file"
}

# health_hint points to a SMART history app once any disk check found
# something: a link when one runs here, a tip otherwise.
health_hint() {
  [ "$FS_DISK_TROUBLE" -eq 1 ] || return 0
  local name="" port=""
  if have docker; then
    name="$(docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null | awk 'tolower($0) ~ /scrutiny/ { print $1; exit }')"
  fi
  if [ -n "$name" ]; then
    port="$(docker port "$name" 8080/tcp 2>/dev/null | awk -F: 'NR == 1 { print $NF }')"
    add info scrutiny info scrutiny_link "" "A SMART history app runs on this server. Open it to see when the counts started to rise." ":${port:-8080}/web/dashboard"
  else
    add info scrutiny info scrutiny_tip "" "Tip: a SMART history app from Community Apps shows when a count started to rise."
  fi
}
