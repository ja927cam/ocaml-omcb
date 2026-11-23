#!/usr/bin/env bash
# Pin httpun-ws 0.2.0 with the failed-write cleanup patch in this repository.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache="${XDG_CACHE_HOME:-$HOME/.cache}/sim-map"
pin_dir="$cache/httpun-ws-0.2.0"

mkdir -p "$cache"
rm -rf "$pin_dir"
opam source httpun-ws.0.2.0 --dir "$pin_dir"
if ! grep -q "websocket write failed" "$pin_dir/lib/wsd.ml"; then
  patch -d "$pin_dir" -p1 < "$root/vendor/httpun-ws-wsd.patch"
fi
opam pin add --yes httpun-ws "$pin_dir"
opam reinstall --yes httpun-ws
printf 'Pinned patched httpun-ws. Re-run dune build.\n'
