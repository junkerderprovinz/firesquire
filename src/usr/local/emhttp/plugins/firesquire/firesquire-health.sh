# Disk health for firesquire-check.sh: ZFS pools, btrfs device counters and
# the SMART CRC count of every disk. Each finding names the disk with the port
# it hangs on, so it says which cable to look at. The engine sources this file
# and brings add() and have().
# shellcheck shell=bash

FS_BYPATH="${FS_BYPATH:-/dev/disk/by-path}"
FS_BYID="${FS_BYID:-/dev/disk/by-id}"
FS_STATE="${FS_STATE:-/boot/config/plugins/firesquire}"
FS_MOUNTS="${FS_MOUNTS:-/proc/mounts}"
FS_DISK_TROUBLE=0
CRC_SEEN=""

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
    add critical zfs pass zfs_ok "$pools" "$pools ZFS pool(s) online, no device errors."
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
    add critical btrfs pass btrfs_ok "$filesystems" "$filesystems btrfs filesystem(s) without device errors."
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
      add warning crc warn crc_found "$(disk_label "$dev")|$val" "$(disk_label "$dev") has $val CRC errors. That usually points to the cable or the port. FireSquire remembers the count and warns again if it rises."
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

# health_hint points to Scrutiny for the history of the counts, once any disk
# check found something: a link when it runs here, a tip otherwise.
health_hint() {
  [ "$FS_DISK_TROUBLE" -eq 1 ] || return 0
  local name="" port=""
  if have docker; then
    name="$(docker ps --format '{{.Names}} {{.Image}}' 2>/dev/null | awk 'tolower($0) ~ /scrutiny/ { print $1; exit }')"
  fi
  if [ -n "$name" ]; then
    port="$(docker port "$name" 8080/tcp 2>/dev/null | awk -F: 'NR == 1 { print $NF }')"
    add info scrutiny info scrutiny_link "" "Scrutiny keeps the SMART history of your disks. Open it to see when the counts started to rise." ":${port:-8080}/web/dashboard"
  else
    add info scrutiny info scrutiny_tip "" "Tip: Scrutiny from Community Apps keeps a SMART history of your disks, so you can see when a count started to rise."
  fi
}
