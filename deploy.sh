#!/usr/bin/env bash
set -euo pipefail

# Deploy script for the js13k game.
# Modelled on the shurmer-family deploy.sh (rsync + remote install pattern).
#
# Default: build + size-check the submission zip.
# With SERVER set: also rsync the playable static files to the remote.

SERVER="${SERVER:-}"
REMOTE_PROJECT="${REMOTE_PROJECT:-/opt/js13k-2026-orb-ruins}"
ODIN="${ODIN:-odin}"

RSYNC_EXCLUDES=(
    --exclude='.git'
    --exclude='.github/'
    --exclude='.idea/'
    --exclude='.zed/'
    --exclude='src/'
    --exclude='*.odin'
    --exclude='PLAN.md'
    --exclude='Makefile'
    --exclude='deploy.sh'
    --exclude='game.zip'
    --exclude='.gitignore'
)

usage() {
    echo "Usage: $0 [-build-only]"
    echo ""
    echo "  -build-only   Only compile + size-check (no rsync)"
    echo ""
    echo "  Without flags: build, size-check, then rsync if SERVER is set"
    echo "  SERVER=root@host bash deploy.sh"
    exit 1
}

build() {
    echo "→ Building WASM ..."
    if ! command -v "$ODIN" >/dev/null 2>&1; then
        echo "FAIL: odin not found in PATH (set ODIN=...)"
        exit 1
    fi
    "$ODIN" build src -target:js_wasm32 -out:game.wasm -o:size -no-entry-point
    echo "✓ game.wasm built"
}

size_check() {
    echo "→ Creating submission zip + size check ..."
    rm -f game.zip
    # odin.js must be present next to index.html for a playable package
    if [ ! -f odin.js ]; then
        echo "WARN: odin.js missing — copy from Odin core/sys/wasm/js/odin.js"
        # still zip what we have so the check can run
        zip -9 -j game.zip index.html game.js game.wasm 2>/dev/null || true
    else
        zip -9 -j game.zip index.html game.js game.wasm odin.js
    fi
    SIZE=$(stat -c%s game.zip 2>/dev/null || stat -f%z game.zip)
    echo "  game.zip = $SIZE bytes"
    if [ "$SIZE" -gt 13312 ]; then
        echo "FAIL: $SIZE > 13312"
        exit 1
    fi
    echo "✓ size OK (≤ 13312)"
}

sync() {
    if [ -z "$SERVER" ]; then
        echo "→ SERVER not set — skipping rsync"
        return 0
    fi
    echo "→ Syncing playable files to $SERVER:$REMOTE_PROJECT ..."
    ssh "$SERVER" "mkdir -p $REMOTE_PROJECT"
    rsync -az --delete \
        "${RSYNC_EXCLUDES[@]}" \
        ./ "$SERVER:$REMOTE_PROJECT/"
    echo "✓ Deploy complete"
}

# ── Parse args ────────────────────────────────────────────────────────────────

BUILD_ONLY=false

for arg in "$@"; do
    case "$arg" in
        -build-only|--build-only) BUILD_ONLY=true ;;
        -h|--help)                usage ;;
        *)                        echo "Unknown option: $arg"; usage ;;
    esac
done

# ── Run ───────────────────────────────────────────────────────────────────────

build
size_check

if [ "$BUILD_ONLY" = true ]; then
    exit 0
fi

sync
