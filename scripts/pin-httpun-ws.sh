#!/usr/bin/env bash
# Pin httpun-ws 0.2.0 with the failed-write cleanup patch in this repository.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cache="${XDG_CACHE_HOME:-$HOME/.cache}/sim-map"
pin_dir="$cache/httpun-ws-0.2.0"

mkdir -p "$cache"

# [opam source] refuses to download a package that is currently pinned to the
# destination directory. Unpin first so this script stays re-runnable.
if opam pin list --short 2>/dev/null | grep -qx 'httpun-ws'; then
  opam unpin --yes httpun-ws >/dev/null
fi

rm -rf "$pin_dir"
opam source httpun-ws.0.2.0 --dir "$pin_dir" >/dev/null
patch -d "$pin_dir" -p1 < "$root/vendor/httpun-ws-wsd.patch"
opam pin add --yes httpun-ws "$pin_dir" >/dev/null
opam reinstall --yes httpun-ws >/dev/null
printf 'Pinned patched httpun-ws. Re-run dune build.\n'
