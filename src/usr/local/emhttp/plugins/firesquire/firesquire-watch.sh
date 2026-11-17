# How the server stands between reboots, for firesquire-check.sh: the flash
# stick and Unraid's certificate. Read errors of the stick count before a
# reboot, since the server boots from it; the rest belongs to the Health tab.
# The engine sources this file and brings add(), have() and plural().
# shellcheck shell=bash

FS_SYSLOG="${FS_SYSLOG:-/var/log/syslog}"
FS_CERTS="${FS_CERTS:-/boot/config/ssl/certs}"

# flash_disk prints the kernel name of the stick behind /boot, such as sda.
flash_disk() {
  awk -v b="${FS_BOOT:-/boot}" '$2 == b { d = $1; sub(/^\/dev\//, "", d); sub(/[0-9]+$/, "", d); print d; exit }' "${FS_MOUNTS:-/proc/mounts}"
}

watch_flash_errors() {
  local d n=0 last
  d="$(flash_disk)"
  [ -n "$d" ] && [ -r "$FS_SYSLOG" ] || return 0
  # A boundary of its own around the name, since sda must not match sdab.
  read -r n last < <(awk -v d="$d" '
    $0 ~ ("(^|[^a-z])" d "[0-9]*([^a-z0-9]|$)") && /I\/O error|[Mm]edium [Ee]rror|FAT-fs/ { n++; l = $0 }
    END { print n + 0, substr(l, 1, 160) }' "$FS_SYSLOG")
  if [ "${n:-0}" -gt 0 ]; then
    last="${last//|/ }"
    add warning flash_errors warn flash_errors "$n|$last" "The flash drive has $n read error $(plural "$n" line lines) in the syslog since boot. Latest: $last. Unraid boots from this stick, so back it up before you reboot."
  else
    add warning flash_errors pass flash_errors_ok "" "No read errors of the flash drive in the syslog since boot."
  fi
}

# boot_version_kb is the room the current Unraid version takes on the flash.
boot_version_kb() {
  du -sk "${FS_BOOT:-/boot}"/bz* 2>/dev/null | awk '{ s += $1 } END { print s + 0 }'
}

gb() { awk -v k="$1" 'BEGIN { printf "%.1f", k / 1048576 }'; }

# watch_flash_space holds the free room against the size of the current
# version, which an update writes next to the copy it keeps of the old one.
watch_flash_space() {
  local avail need
  avail="$(df -Pk "${FS_BOOT:-/boot}" 2>/dev/null | awk 'NR == 2 { print $4 }')"
  [ -n "$avail" ] || return 0
  need="$(boot_version_kb)"
  [ "${need:-0}" -gt 0 ] || need=1048576
  if [ "$avail" -lt "$need" ]; then
    add health flash_space warn flash_space_low "$(gb "$avail")|$(gb "$need")" "Only $(gb "$avail") GB are free on the flash, and the next Unraid update needs about $(gb "$need") GB. Old diagnostics in /boot/logs are the first thing to clear."
  else
    add health flash_space pass flash_space_ok "$(gb "$avail")" "$(gb "$avail") GB free on the flash."
  fi
}

# watch_cert reads the end of the certificates Unraid serves its WebGUI with:
# its own one for the server's name, the one for myunraid.net and the one for
# Tailscale. Unraid renews them by itself, so an end in sight means the
# renewal failed. Certificates of an earlier server name stay out.
watch_cert() {
  local name use f end at days now="${FS_NOW:-$(date +%s)}"
  use="$(ini_get USE_SSL "$FS_VAR_INI")"
  [ "$use" = no ] && return 0
  name="$(ini_get NAME "$FS_VAR_INI")"
  for f in "${name}_unraid_bundle.pem" certificate_bundle.pem ts_bundle.pem; do
    [ -f "$FS_CERTS/$f" ] || continue
    end="$(openssl x509 -enddate -noout -in "$FS_CERTS/$f" 2>/dev/null | sed -n 's/^notAfter=//p')"
    at="$(date -d "$end" +%s 2>/dev/null)" || continue
    days=$(( (at - now) / 86400 ))
    end="$(date -d "@$at" +%F)"
    if [ "$at" -le "$now" ]; then
      add health cert fail cert_expired "$f|$end" "Unraid's certificate $f ran out on $end. Browsers warn about the WebGUI until it is renewed in Settings, Management Access."
    elif [ "$days" -lt 14 ]; then
      add health cert warn cert_soon "$f|$end|$days" "Unraid's certificate $f runs out on $end, in $days $(plural "$days" day days). Unraid renews it by itself, so the renewal may have failed: look at Settings, Management Access."
    else
      add health cert pass cert_ok "$f|$end" "Unraid's certificate $f is good until $end."
    fi
  done
}

FS_SYSNET="${FS_SYSNET:-/sys/class/net}"
FS_BONDING="${FS_BONDING:-/proc/net/bonding}"

# watch_network looks at every network port with a cable in it. A link below
# a gigabit or at half duplex usually means a worn cable or a port that fell
# back, and a bond with a member down has lost its spare.
watch_network() {
  local n name speed duplex any=0 found=0 b m
  if [ -z "$(ip route show default 2>/dev/null)" ]; then
    found=1
    add health net warn net_noroute "" "The server has no default route, so it cannot reach the internet for updates and notifications."
  fi
  for n in "$FS_SYSNET"/*; do
    [ -d "$n/device" ] || continue
    [ "$(cat "$n/operstate" 2>/dev/null)" = up ] || continue
    name="${n##*/}"
    speed="$(cat "$n/speed" 2>/dev/null)"
    duplex="$(cat "$n/duplex" 2>/dev/null)"
    case "$speed" in ''|-*|*[!0-9]*) continue ;; esac
    any=1
    if [ "$duplex" = half ]; then
      found=1
      add health net warn net_half "$name" "$name runs at half duplex, usually a worn cable or a port that fell back."
    elif [ "$speed" -lt 1000 ]; then
      found=1
      add health net warn net_slow "$name|$speed" "$name links at $speed Mb/s, usually a worn cable or a port that fell back."
    elif [ "$found" -eq 0 ]; then
      add health net pass net_ok "$name|$speed" "$name links at $speed Mb/s."
      found=2
    fi
  done
  for b in "$FS_BONDING"/*; do
    [ -f "$b" ] || continue
    for m in $(awk '/^Slave Interface:/ { s = $3 } /^MII Status: down/ && s != "" { print s; s = "" }' "$b"); do
      add health net warn net_bond "${b##*/}|$m" "${b##*/} has lost $m, so it runs without its spare link."
    done
  done
  return 0
}

# watch_vms names the VMs that stand paused, which Unraid does to a VM whose
# virtual disk ran full.
watch_vms() {
  libvirt_up || return 0
  local list n
  list="$(virsh list --state-paused --name 2>/dev/null | awk 'NF { printf "%s%s", (n++ ? ", " : ""), $0 }')"
  if [ -n "$list" ]; then
    n="$(virsh list --state-paused --name 2>/dev/null | grep -c .)"
    add health vm_state warn vm_paused "$list|$n" "$(plural "$n" 'This VM is' 'These VMs are') paused: $list. A full virtual disk is the usual cause."
  else
    add health vm_state pass vm_ok "" "No VM is paused."
  fi
}
