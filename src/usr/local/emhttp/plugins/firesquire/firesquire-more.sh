# What else stands in the way of a clean reboot, for firesquire-check.sh:
# shutdown time-outs, an unclean last shutdown, files open over SMB and NFS,
# the UPS and the age of the flash backup. The engine sources this file and
# brings add() and have().
# shellcheck shell=bash

FS_VAR_INI="${FS_VAR_INI:-/var/local/emhttp/var.ini}"
FS_DOCKER_CFG="${FS_DOCKER_CFG:-/boot/config/docker.cfg}"
FS_DOMAIN_CFG="${FS_DOMAIN_CFG:-/boot/config/domain.cfg}"
FS_NFSD="${FS_NFSD:-/proc/fs/nfsd/clients}"
FS_BOOT="${FS_BOOT:-/boot}"

# ini_get prints the value of key in an ini file, without its quotes.
ini_get() {
  sed -n "s/^$1=\"\{0,1\}\([^\"]*\)\"\{0,1\}\r\{0,1\}$/\1/p" "$2" 2>/dev/null | head -n1
}

libvirt_up() { pgrep -x libvirtd >/dev/null 2>&1; }

# more_timeouts holds Unraid's shutdown time-out against the time Docker and
# the VMs may take. Unraid stops every container with its own time-out, which
# overrides the one a container asks for.
more_timeouts() {
  local shutdown stop vm need=0 docker_up=0 slow="" name t
  shutdown="$(ini_get shutdownTimeout "$FS_VAR_INI")"; shutdown="${shutdown:-90}"
  stop="$(ini_get DOCKER_TIMEOUT "$FS_DOCKER_CFG")"; stop="${stop:-10}"
  vm="$(ini_get TIMEOUT "$FS_DOMAIN_CFG")"; vm="${vm:-60}"
  if have docker && docker info >/dev/null 2>&1; then
    docker_up=1
    need=$((need + stop))
    # shellcheck disable=SC2046
    while read -r name t; do
      case "$t" in ''|*[!0-9]*) continue ;; esac
      [ "$t" -gt "$stop" ] && slow="${slow:+$slow, }${name#/} (${t}s)"
    done < <(docker inspect -f '{{.Name}} {{.Config.StopTimeout}}' $(docker ps -q 2>/dev/null) 2>/dev/null)
  fi
  libvirt_up && need=$((need + vm))
  [ "$need" -gt 0 ] || return 0
  if [ -n "$slow" ]; then
    add warning timeouts warn timeouts_container "$slow|$stop" "These containers ask for more time to stop than Unraid gives them (${stop}s in Docker Settings): $slow"
  fi
  if [ "$need" -ge "$shutdown" ]; then
    add warning timeouts warn timeouts_short "$shutdown|$((docker_up * stop))|$((need - docker_up * stop))|$need" "Unraid waits ${shutdown}s for a clean shutdown, but containers ($((docker_up * stop))s) and VMs ($((need - docker_up * stop))s) can take ${need}s together. Raise the shutdown time-out in Disk Settings."
  elif [ -z "$slow" ]; then
    add warning timeouts pass timeouts_ok "$shutdown|$need" "Unraid's shutdown time-out of ${shutdown}s covers containers and VMs (${need}s)."
  fi
}

# more_unclean follows Unraid's own rule for "Unclean shutdown detected": the
# array stands, its superblock is not clean and a parity check is due.
more_unclean() {
  [ "$(ini_get mdState "$FS_VAR_INI")" = STOPPED ] || return 0
  [ "$(ini_get sbClean "$FS_VAR_INI")" != yes ] || return 0
  case "$(ini_get mdResyncAction "$FS_VAR_INI")" in check*) ;; *) return 0 ;; esac
  add warning unclean warn unclean "" "The last shutdown was not clean. The next array start runs a parity check."
}

share_finding() {
  local proto="$1" share="$2" machine="$3" open="$4" writing="$5"
  if [ "$writing" -gt 0 ]; then
    add warning shares warn share_writing "$proto|$share|$machine|$writing" "$machine is writing $writing file(s) to the share $share over $proto, maybe a copy."
  else
    add warning shares warn share_open "$proto|$share|$machine|$open" "$machine has $open file(s) open on the share $share over $proto."
  fi
}

# more_shares lists the files open over SMB (smbstatus) and NFSv4 (the
# kernel's client states), by share and machine.
more_shares() {
  local asked=0 found=0 share machine open writing dir addr
  if have smbstatus; then
    asked=1
    while read -r share machine open writing; do
      found=1
      share_finding SMB "$share" "$machine" "$open" "$writing"
    done < <({ echo @sessions; smbstatus -S 2>/dev/null; echo @locks; smbstatus -L 2>/dev/null; } | awk '
      $1 == "@sessions" { part = 1; next }
      $1 == "@locks" { part = 2; next }
      part == 1 && $1 != "IPC$" && $2 ~ /^[0-9]+$/ && !($2 in machine) { machine[$2] = $3 }
      part == 2 && $1 ~ /^[0-9]+$/ && $5 ~ /^(RDONLY|WRONLY|RDWR)$/ {
        n = split($7, p, "/"); key = $1 SUBSEP p[n]
        open[key]++; if ($5 != "RDONLY") writing[key]++
      }
      END {
        for (k in open) { split(k, a, SUBSEP); print a[2], (a[1] in machine ? machine[a[1]] : "?"), open[k], writing[k] + 0 }
      }' | sort)
  fi
  if [ -d "$FS_NFSD" ]; then
    asked=1
    for dir in "$FS_NFSD"/*/; do
      [ -f "$dir/states" ] || continue
      addr="$(sed -n 's/^address: "\{0,1\}\([^":]*\).*/\1/p' "$dir/info" 2>/dev/null | head -n1)"
      while read -r share open writing; do
        found=1
        share_finding NFS "$share" "${addr:-?}" "$open" "$writing"
      done < <(awk '
        /type: open/ && match($0, /filename: "[^"]*"/) {
          f = substr($0, RSTART + 11, RLENGTH - 12); n = split(f, p, "/")
          share = (p[2] == "mnt" && n > 4) ? p[4] : f
          open[share]++; if ($0 ~ /access: .w/) writing[share]++
        }
        END { for (s in open) print s, open[s], writing[s] + 0 }' "$dir/states" | sort)
    done
  fi
  if [ "$asked" -eq 1 ] && [ "$found" -eq 0 ]; then
    add warning shares pass shares_ok "" "No open files on SMB or NFS shares."
  fi
}

ups_up() { pgrep -x apcupsd >/dev/null 2>&1; }

# more_ups asks Unraid's UPS service, and only when it runs.
more_ups() {
  ups_up || return 0
  have apcaccess || return 0
  local out status charge left
  out="$(apcaccess status 2>/dev/null)" || return 0
  status="$(printf '%s\n' "$out" | awk -F' *: *' '$1 == "STATUS" { print $2; exit }')"
  charge="$(printf '%s\n' "$out" | awk -F' *: *' '$1 == "BCHARGE" { printf "%d", $2; exit }')"
  left="$(printf '%s\n' "$out" | awk -F' *: *' '$1 == "TIMELEFT" { printf "%d", $2; exit }')"
  if [[ "$status" == *LOWBATT* ]] || { [ -n "$charge" ] && [ "$charge" -lt 20 ]; }; then
    add warning ups warn ups_low "$charge|$left" "The UPS battery is almost empty: ${charge}% left, about $left minutes."
  elif [[ "$status" == *ONBATT* ]]; then
    add warning ups warn ups_battery "$charge|$left" "The UPS runs on battery: ${charge}% left, about $left minutes."
  else
    add warning ups pass ups_ok "$charge" "The UPS is on mains power, battery at ${charge}%."
  fi
}

joined() { [ -x "${FORTRESS:-}" ] && [ -f "${FORTRESS_DIR:-}/fortress.json" ]; }

# boot_git prints when Unraid Connect last backed up the flash, which it keeps
# as a git repository on the flash itself.
boot_git() {
  [ -d "$FS_BOOT/.git" ] && git -C "$FS_BOOT" log -1 --format=%ct 2>/dev/null
}

# more_flash finds the newest flash backup it can see: BombVault's in the
# fortress through backup.last, and Unraid Connect's.
more_flash() {
  local now="${FS_NOW:-$(date +%s)}" at="" source="" t answer days
  if joined; then
    answer="$("$FORTRESS" act -dir "$FORTRESS_DIR" -wait 5s bombvault backup.last '{"domain":"flash"}' 2>/dev/null)"
    t="$(printf '%s' "$answer" | sed -n 's/.*"at" *: *"\([^"]*\)".*/\1/p')"
    t="$( [ -n "$t" ] && date -d "$t" +%s 2>/dev/null)"
    if [ -n "$t" ]; then at="$t"; source=BombVault; fi
  fi
  t="$(boot_git)"
  if [ -n "$t" ] && { [ -z "$at" ] || [ "$t" -gt "$at" ]; }; then at="$t"; source="Unraid Connect"; fi
  if [ -z "$at" ]; then
    add info flash_backup info flash_backup_none "" "FireSquire knows of no flash backup. BombVault in your fortress or Unraid Connect can keep one."
    return 0
  fi
  days=$(( (now - at) / 86400 ))
  if [ "$days" -gt 7 ]; then
    add warning flash_backup warn flash_backup_old "$days|$source" "The last flash backup ($source) is $days days old. Back up the flash before rebooting."
  else
    add warning flash_backup pass flash_backup_ok "$days|$source" "The last flash backup ($source) is $days day(s) old."
  fi
}
