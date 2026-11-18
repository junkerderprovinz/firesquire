# TollRoll's notification hub, for firesquire-check.sh. A TollRoll of the
# fortress that lists notify.hub in its status sends FireSquire's messages
# through its own channels, once FireSquire hands them over with the action
# notify.deliver. Only {"taken":true} counts as sent: anything else, and a
# TollRoll out of reach, leaves the message to the notify helper and the
# channels on the flash, as without a hub. Healthchecks pings stay here. The
# engine sources this file and brings FORTRESS, FORTRESS_DIR, NOTIFY, FS_STATE,
# FS_RUN and HERE.
# shellcheck shell=bash

# own_send sends the event to the channels of a list.
own_send() {
  local event="$1" channels="$2" lifted=""
  [ -x "$NOTIFY" ] && [ -s "$channels" ] || return 0
  # The helper sends a success only to channels that take everything, and the
  # way back is news on a channel for failures as well.
  if printf '%s' "$event" | php "$HERE/firesquire-hub.php" recovery; then
    lifted="$FS_RUN/lifted.$$.json"
    mkdir -p "$FS_RUN" && (umask 077 && php "$HERE/firesquire-hub.php" lift "$channels" > "$lifted") && channels="$lifted"
  fi
  own_split "$event" "$channels"
  [ -n "$lifted" ] && rm -f "$lifted"
  return 0
}

# own_split sends Unraid's own notification the link as a path, which its
# WebGUI opens, and every other channel the link made whole. A list that holds
# both is sent in two.
own_split() {
  local event="$1" channels="$2" part kind list
  list="$(php "$HERE/firesquire-hub.php" unraid "$channels")"
  if [ -z "$list" ]; then
    printf '%s' "$event" | php "$HERE/firesquire-hub.php" own whole | "$NOTIFY" send -channels "$channels" -source FireSquire >/dev/null 2>&1
    return 0
  fi
  if [ -z "$(php "$HERE/firesquire-hub.php" outside "$channels")" ]; then
    printf '%s' "$event" | php "$HERE/firesquire-hub.php" own | "$NOTIFY" send -channels "$channels" -source FireSquire >/dev/null 2>&1
    return 0
  fi
  mkdir -p "$FS_RUN" || return 0
  for kind in unraid outside; do
    part="$FS_RUN/$kind.$$.json"
    (umask 077 && php "$HERE/firesquire-hub.php" "$kind" "$channels" > "$part") || continue
    if [ "$kind" = unraid ]; then
      printf '%s' "$event" | php "$HERE/firesquire-hub.php" own | "$NOTIFY" send -channels "$part" -source FireSquire >/dev/null 2>&1
    else
      printf '%s' "$event" | php "$HERE/firesquire-hub.php" own whole | "$NOTIFY" send -channels "$part" -source FireSquire >/dev/null 2>&1
    fi
    rm -f "$part"
  done
}

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
      printf '%s' "$event" | php "$HERE/firesquire-hub.php" own whole | "$NOTIFY" send -channels "$channels" -source FireSquire >/dev/null 2>&1
      rm -f "$channels"
      return 0
    done
  fi
  own_send "$event" "$channels"
}
