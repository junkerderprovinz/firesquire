# Advice on the server's settings, for firesquire-check.sh: shares whose files
# sit where their settings do not want them, and plugins that are behind or
# not made for this Unraid. Every finding carries the tier config, so it never
# moves the reboot verdict. Only array disks Unraid reports awake are looked
# at. The engine sources this file after firesquire-more.sh and brings add()
# and plural().
# shellcheck shell=bash

FS_SHARES_INI="${FS_SHARES_INI:-/var/local/emhttp/shares.ini}"
FS_DISKS_INI="${FS_DISKS_INI:-/var/local/emhttp/disks.ini}"
FS_MNT="${FS_MNT:-/mnt}"
FS_POOLS="${FS_POOLS:-/boot/config/pools}"
FS_PLUGINS="${FS_PLUGINS:-/var/log/plugins}"
FS_PLUGINS_NEW="${FS_PLUGINS_NEW:-/tmp/plugins}"
FS_UNRAID_VERSION="${FS_UNRAID_VERSION:-/etc/unraid-version}"
CONFIG_FOUND=0

# shares prints each share as name, cache setting, pool and whether Unraid
# keeps it on its pool alone, with "-" for an empty value.
shares() {
  awk '
    function flush() { if (n != "") print n, (u == "" ? "-" : u), (p == "" ? "-" : p), (x == "" ? "-" : x) }
    function val(   v) { v = $0; sub(/^[^=]*="?/, "", v); sub(/"?\r?$/, "", v); return v }
    /^\[/ { flush(); n = ""; u = ""; p = ""; x = "" }
    /^name=/ { n = val() }
    /^useCache=/ { u = val() }
    /^cachePool=/ { p = val() }
    /^exclusive=/ { x = val() }
    END { flush() }' "$FS_SHARES_INI" 2>/dev/null
}

# awake_disks lists the array's data disks that are spinning.
awake_disks() {
  awk '
    function flush() { if (n != "" && t == "Data" && s != "1") print n }
    function val(   v) { v = $0; sub(/^[^=]*="?/, "", v); sub(/"?\r?$/, "", v); return v }
    /^\[/ { flush(); n = ""; t = ""; s = "" }
    /^name=/ { n = val() }
    /^type=/ { t = val() }
    /^spundown=/ { s = val() }
    END { flush() }' "$FS_DISKS_INI" 2>/dev/null
}

config_warn() { CONFIG_FOUND=1; add config "$@"; }

config_shares() {
  local name use pool excl on d paths path share
  while read -r name use pool excl; do
    if [ "$use" = only ] && [ "$excl" != yes ]; then
      on=""
      for d in $(awake_disks); do
        [ -d "$FS_MNT/$d/$name" ] && on="${on:+$on, }$d"
      done
      if [ -n "$on" ]; then
        config_warn share_place warn cfg_cache_only_array "$name|$on" "The share $name is set to live on its pool only, yet it has files on $on. The mover leaves them there, so move them by hand or set the share to move them to the pool."
      fi
    fi
    case "$use" in
      yes|only|prefer)
        if [ "$pool" != - ] && [ ! -f "$FS_POOLS/$pool.cfg" ]; then
          config_warn share_pool warn cfg_pool_missing "$name|$pool" "The share $name uses the pool $pool, which does not exist on this server. Pick one of your pools in the share's settings."
        fi ;;
    esac
  done < <(shares)

  # Containers and VMs run from these, and on the array they are slow and keep the disks awake.
  paths="$(ini_get DOCKER_APP_CONFIG_PATH "$FS_DOCKER_CFG")"
  if [ "$(ini_get DOCKER_ENABLED "$FS_DOCKER_CFG")" = yes ]; then paths="$paths $(ini_get DOCKER_IMAGE_FILE "$FS_DOCKER_CFG")"; fi
  if [ "$(ini_get SERVICE "$FS_DOMAIN_CFG")" = enable ]; then paths="$paths $(ini_get IMAGE_FILE "$FS_DOMAIN_CFG") $(ini_get DOMAINDIR "$FS_DOMAIN_CFG")"; fi
  local seen=" "
  for path in $paths; do
    case "$path" in /mnt/user/*) ;; *) continue ;; esac
    share="${path#/mnt/user/}"; share="${share%%/*}"
    case "$seen" in *" $share "*) continue ;; esac
    seen="$seen$share "
    use="$(shares | awk -v s="$share" '$1 == s { print $2; exit }')"
    case "$use" in
      no|yes)
        config_warn share_array warn cfg_on_array "$share|$path|$use" "The share $share holds $path, but its setting ($use) puts the files on the array, where containers and VMs run slowly and keep the disks awake. Keep it on a pool." ;;
    esac
  done
}

# plg reads an attribute of a plugin file the way Unraid's plugin manager does.
plg() { /usr/local/sbin/plugin "$1" "$2" 2>/dev/null; }

attr() {
  local v
  v="$(plg "$1" "$2")"
  case "$v" in plugin:*) ;; *) printf '%s' "$v" ;; esac
}

older() { [ "$1" != "$2" ] && [ "$(printf '%s\n%s\n' "$1" "$2" | sort -V | head -n1)" = "$1" ]; }

# config_plugins compares every plugin with the copy Unraid's own update
# check left in /tmp/plugins, newer by Unraid's rule of a plain string
# compare, and with the oldest and newest Unraid it says it runs on.
config_plugins() {
  local f name old new min max os behind="" nbehind=0 unfit="" nunfit=0
  os="$(sed -n 's/^version="\{0,1\}\([^"]*\)"\{0,1\}$/\1/p' "$FS_UNRAID_VERSION" 2>/dev/null | head -n1)"
  for f in "$FS_PLUGINS"/*.plg; do
    [ -f "$f" ] || continue
    name="${f##*/}"; name="${name%.plg}"
    [ "$name" = unRAIDServer ] && continue
    if [ -f "$FS_PLUGINS_NEW/$name.plg" ]; then
      old="$(attr version "$f")"; new="$(attr version "$FS_PLUGINS_NEW/$name.plg")"
      if [ -n "$new" ] && [[ "$new" > "$old" ]]; then behind="${behind:+$behind, }$name"; nbehind=$((nbehind + 1)); fi
    fi
    [ -n "$os" ] || continue
    min="$(attr min "$f")"; max="$(attr max "$f")"
    if { [ -n "$max" ] && older "$max" "$os"; } || { [ -n "$min" ] && older "$os" "$min"; }; then
      unfit="${unfit:+$unfit, }$name"; nunfit=$((nunfit + 1))
    fi
  done
  if [ -n "$behind" ]; then
    config_warn plugins warn cfg_plugin_update "$behind|$nbehind" "$(plural "$nbehind" 'An update waits for this plugin' 'Updates wait for these plugins'): $behind. Install $(plural "$nbehind" it them) on the Plugins tab."
  fi
  if [ -n "$unfit" ]; then
    config_warn plugins warn cfg_plugin_unfit "$unfit|$nunfit|$os" "$(plural "$nunfit" 'This plugin is' 'These plugins are') not made for Unraid $os: $unfit. Look for a newer version or a replacement."
  fi
}

config_done() {
  [ "$CONFIG_FOUND" -eq 0 ] && add config settings pass cfg_ok "" "Nothing in the settings FireSquire looks at needs a change."
  return 0
}
