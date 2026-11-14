#!/bin/bash
# Cron runs this every 15 minutes, so FireSquire follows a phrase change while
# nobody opens its page and the old phrase still answers. Every helper command
# takes the new keys from an app that moved, and where none hands them over,
# that app stays in the book as moved and the Fortress card asks for the words.

HERE="$(cd "$(dirname "$0")" && pwd)"
FORTRESS="${FIRESQUIRE_FORTRESS:-$HERE/fortress}"
FORTRESS_DIR="${FIRESQUIRE_FORTRESS_DIR:-/boot/config/plugins/firesquire/fortress}"

if [ ! -x "$FORTRESS" ] || [ ! -f "$FORTRESS_DIR/fortress.json" ]; then exit 0; fi
"$FORTRESS" members -dir "$FORTRESS_DIR" -wait 8s >/dev/null 2>&1
exit 0
