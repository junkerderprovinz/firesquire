# TollRoll's notification hub, for firesquire-check.sh. A TollRoll of the
# fortress that lists notify.hub in its status sends FireSquire's messages
# through its own channels, once FireSquire hands them over with the action
# notify.deliver. Only {"taken":true} counts as sent: anything else, and a
# TollRoll out of reach, leaves the message to the notify helper and the
# channels on the flash, as without a hub. Healthchecks pings stay here. The
# engine sources this file and brings FORTRESS, FORTRESS_DIR, NOTIFY, FS_STATE,
# FS_RUN and HERE.
# shellcheck shell=bash

# hub_send sends one event, through the first hub in the comma separated list
# that takes it, or through the channels on the flash.
hub_send() {
  local hubs="$1" event="$2" body hub out pings line
  local channels="$FS_STATE/notify.json"
  if [ -n "$hubs" ] && [ -x "$FORTRESS" ]; then
    body="$(printf '%s' "$event" | php "$HERE/firesquire-hub.php" body)"
    for hub in ${hubs//,/ }; do
      # The hub closes the level the check left before it hears the new one.
      while IFS= read -r line; do
        [ -n "$line" ] && "$FORTRESS" act -dir "$FORTRESS_DIR" -wait 8s "$hub" notify.deliver "$line" >/dev/null 2>&1
      done < <(printf '%s' "$event" | php "$HERE/firesquire-hub.php" resolve)
      out="$(timeout 20 "$FORTRESS" act -dir "$FORTRESS_DIR" -wait 8s "$hub" notify.deliver "$body" 2>/dev/null)" || continue
      case "$out" in *'"taken":true'*) ;; *) continue ;; esac
      pings="$(php "$HERE/firesquire-hub.php" pings "$channels")"
      [ -n "$pings" ] || return 0
      channels="$FS_RUN/pings.$$.json"
      mkdir -p "$FS_RUN" && (umask 077 && printf '%s\n' "$pings" > "$channels") || return 0
      printf '%s' "$event" | php "$HERE/firesquire-hub.php" own | "$NOTIFY" send -channels "$channels" -source FireSquire >/dev/null 2>&1
      rm -f "$channels"
      return 0
    done
  fi
  [ -x "$NOTIFY" ] && [ -s "$channels" ] || return 0
  printf '%s' "$event" | php "$HERE/firesquire-hub.php" own | "$NOTIFY" send -channels "$channels" -source FireSquire >/dev/null 2>&1
}
