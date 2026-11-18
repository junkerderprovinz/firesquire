# What holds the array right now, for firesquire-check.sh --stop: processes
# with files open in it, mounts inside it, VMs without their guest agent and
# the containers Unraid stops first. The engine sources this file after
# firesquire-more.sh and brings add(), have() and plural().
# shellcheck shell=bash

FS_POOLS="${FS_POOLS:-/boot/config/pools}"
FS_MDCMD="${FS_MDCMD:-/usr/local/sbin/mdcmd}"
FS_PLUGINS_DIR="${FS_PLUGINS_DIR:-/usr/local/emhttp/plugins}"

# array_root prints the mount of the array or of a pool a path lies in, such
# as /mnt/user or /mnt/cache, and fails for anything else under /mnt.
array_root() {
  local r="${1#/mnt/}"
  [ "$r" != "$1" ] || return 1
  r="${r%%/*}"
  case "$r" in user|user0|disk[0-9]*) printf '/mnt/%s' "$r"; return 0 ;; esac
  [ -n "$r" ] && [ -f "$FS_POOLS/$r.cfg" ] && { printf '/mnt/%s' "$r"; return 0; }
  return 1
}

# proc_links prints the pid and the path of every working directory and open
# file under /mnt. The links in /proc name them without touching a disk.
proc_links() {
  find /proc/[0-9]*/cwd /proc/[0-9]*/fd -maxdepth 1 -lname '/mnt/*' -printf '%p %l\n' 2>/dev/null |
    sed -E 's#^/proc/([0-9]+)/[^ ]* #\1 #'
}
# proc_name is the program's name from its command line: the kernel's comm
# stops at 15 characters, and smbd writes the client's address into it.
proc_name() {
  local a
  a="$(tr '\0' '\n' < "/proc/$1/cmdline" 2>/dev/null | head -n1)"
  a="${a##*/}"
  printf '%s' "${a:-$(cat "/proc/$1/comm" 2>/dev/null)}"
}
proc_exe() { readlink "/proc/$1/exe" 2>/dev/null; }
in_container() { grep -qE 'docker|containerd' "/proc/$1/cgroup" 2>/dev/null; }

# unraid_stops says Unraid ends the process itself before it unmounts: the
# VMs with their file service, the file sharing, its own syslog server, and
# a plugin's daemon when the plugin has a script for the stop.
unraid_stops() {
  case "$2" in qemu*|virtiofsd|smbd*|nfsd|shfs|rsyslogd) return 0 ;; esac
  local exe plugin e
  exe="$(proc_exe "$1")"
  case "$exe" in "$FS_PLUGINS_DIR"/*) ;; *) return 1 ;; esac
  plugin="${exe#"$FS_PLUGINS_DIR"/}"; plugin="${plugin%%/*}"
  for e in stopping_svcs stopping stopping_array unmounting_disks; do
    [ -e "$FS_PLUGINS_DIR/$plugin/event/$e" ] && return 0
  done
  return 1
}

# stop_open_files names the processes Unraid would wait for in vain, one line
# per program with its pids and places. What Unraid stops before it unmounts,
# the containers among it, stays out.
stop_open_files() {
  local pid p name place seen=" " n=0 list="" g
  local -A pids places
  local order=()
  while read -r pid p; do
    array_root "$p" >/dev/null || continue
    [ "$pid" = "$$" ] && continue
    in_container "$pid" && continue
    name="$(proc_name "$pid")"
    [ -n "$name" ] || continue
    unraid_stops "$pid" "$name" && continue
    place="$(printf '%s' "$p" | cut -d/ -f1-4)"
    if [ -z "${pids[$name]+x}" ]; then order+=("$name"); pids[$name]=""; places[$name]=" "; fi
    case "$seen" in *" $pid "*) ;; *) seen="$seen$pid "; n=$((n + 1)); pids[$name]="${pids[$name]:+${pids[$name]}, }$pid" ;; esac
    case "${places[$name]}" in *" $place "*) ;; *) places[$name]="${places[$name]}$place " ;; esac
  done < <(proc_links)
  for g in "${order[@]}"; do
    place="${places[$g]# }"
    list="${list:+$list, }$g (${pids[$g]}) in ${place% }"
  done
  if [ -n "$list" ]; then
    add critical stop_files fail stop_open_files "$list|$n" "$(plural "$n" 'This process keeps' 'These processes keep') files open in the array, so it cannot unmount: $list. Close $(plural "$n" it them) first."
  else
    add critical stop_files pass stop_open_ok "" "No process outside containers and VMs has files open in the array."
  fi
}

# shown_list keeps the first five entries of a list joined by ", ", and an
# ellipsis for the rest, so a long list does not fill the window.
shown_list() {
  awk -v RS=', ' 'NR <= 5 { printf "%s%s", (NR > 1 ? ", " : ""), $0 } NR == 6 { printf ", …" }' <<< "$1" | tr -d '\n'
}

# stop_mounts names what is mounted inside the array or a pool, such as a
# mounted snapshot, a mount on a share or an image mounted from a disk. The
# datasets of a ZFS pool are the pool's own, and the layers and shared memory
# of Docker's containers go with Docker, which Unraid stops first, as it
# detaches docker.img and libvirt.img itself.
stop_mounts() {
  local src mp fs rest root f held="" n=0 loops="" nl=0
  while read -r src mp fs rest; do
    mp="$(printf '%b' "$mp")"
    root="$(array_root "$mp")" || continue
    [ "$mp" = "$root" ] && continue
    if [ "$fs" = zfs ] && [[ "$src" != *@* ]]; then continue; fi
    case "$fs" in overlay|nsfs) continue ;; esac
    case "$mp" in */docker/*) continue ;; esac
    held="${held:+$held, }$mp"
    n=$((n + 1))
  done < "$FS_MOUNTS"
  held="$(shown_list "$held")"
  while IFS= read -r f; do
    array_root "$f" >/dev/null || continue
    case "${f##*/}" in docker.img|libvirt.img) continue ;; esac
    loops="${loops:+$loops, }$f"
    nl=$((nl + 1))
  done < <(losetup -a 2>/dev/null | sed -n 's/.*(\(.*\))$/\1/p')
  if [ -n "$held" ]; then
    add critical stop_mounts fail stop_mounts "$held|$n" "$(plural "$n" 'This is mounted' 'These are mounted') inside the array and keep it from unmounting: $held. Unmount $(plural "$n" it them) first."
  fi
  if [ -n "$loops" ]; then
    add critical stop_mounts fail stop_loops "$loops|$nl" "$(plural "$nl" 'This image file is' 'These image files are') attached from the array and keep it from unmounting: $loops. Detach $(plural "$nl" it them) first."
  fi
  if [ -z "$held$loops" ]; then
    add critical stop_mounts pass stop_mounts_ok "" "Nothing is mounted inside the array."
  fi
}

# stop_vm_agents names the running VMs without a connected guest agent. Unraid
# asks every VM to shut down and forces it off after the VMs' time-out, and a
# VM without its agent is the one that may not listen.
stop_vm_agents() {
  libvirt_up || return 0
  local vm vmt list="" n=0
  vmt="$(ini_get TIMEOUT "$FS_DOMAIN_CFG")"; vmt="${vmt:-60}"
  while IFS= read -r vm; do
    [ -n "$vm" ] || continue
    virsh dumpxml "$vm" 2>/dev/null | grep -q "name='org.qemu.guest_agent.0' state='connected'" && continue
    list="${list:+$list, }$vm"
    n=$((n + 1))
  done < <(virsh list --state-running --name 2>/dev/null)
  [ -n "$list" ] || return 0
  add warning stop_vm warn stop_vm_agent "$list|$n|$vmt" "$(plural "$n" 'This VM runs' 'These VMs run') without a connected guest agent: $list. Without it a VM may ignore the request to shut down, and Unraid forces it off after ${vmt} s."
}

# stop_containers says how many containers Unraid stops before the array.
stop_containers() {
  have docker && docker info >/dev/null 2>&1 || return 0
  local n stop
  n="$(docker ps -q 2>/dev/null | grep -c .)"
  [ "$n" -gt 0 ] || return 0
  stop="$(ini_get DOCKER_TIMEOUT "$FS_DOCKER_CFG")"; stop="${stop:-10}"
  add info stop_containers info stop_containers "$n|$stop" "$n $(plural "$n" 'container runs. Unraid stops it before the array, within' 'containers run. Unraid stops them before the array, each within') ${stop} s."
}

# stop_ops names the work a stop would cut short: a parity check, a sync or a
# rebuild, and the mover.
stop_ops() {
  local action
  if [ -x "$FS_MDCMD" ] && [ "$("$FS_MDCMD" status 2>/dev/null | sed -n 's/^mdResync=//p' | tr -d '\r')" != 0 ]; then
    action="$("$FS_MDCMD" status 2>/dev/null | sed -n 's/^mdResyncAction=//p' | tr -d '\r')"
    add critical stop_op fail stop_op_running "${action:-sync}" "A parity operation is running (${action:-sync}). Stopping the array cancels it."
  fi
  if pgrep -f '/usr/local/sbin/mover' >/dev/null 2>&1; then
    add critical stop_op fail stop_mover "" "The mover is running. Stopping the array cuts it short."
  fi
}
