#!/usr/bin/env bash
# =============================================================================
# build.sh — Compile libpd + feral-vocaloid patch to WebAssembly
#
# Uses the pre-built libpd.a from _empd/libpd/build/libs/ and follows the
# same --preload-file approach as the working nessie/_empd example patches.
#
# Prerequisites:
#   - Emscripten SDK activated:  source /path/to/emsdk/emsdk_env.sh
#   - _empd/libpd/build/libs/libpd.a  (pre-built by the _empd project)
#   - .pd patch files in core/libs/libpd-wasm/
#
# Usage:
#   bash core/libs/libpd-wasm/build.sh
#
# Outputs (served by Vite from public/libs/):
#   public/libs/libpd-glottalizer.js    — Emscripten ES-module loader
#   public/libs/libpd-glottalizer.wasm  — WebAssembly binary
#   public/libs/libpd-glottalizer.data  — Preloaded patch filesystem image
# =============================================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
EMPD_DIR="$REPO_ROOT/_empd"
LIBPD_DIR="$EMPD_DIR/libpd"
LIBPD_A="$LIBPD_DIR/build/libs/libpd.a"
OUT_DIR="$REPO_ROOT/public/libs"

echo "=== ravel-glottalizer: libpd → WASM build ==="

# ── Pre-flight: emcc ───────────────────────────────────────────────────────
if ! command -v emcc &>/dev/null; then
  echo "  ERROR: emcc not found."
  echo "  Activate emsdk first:  source /path/to/emsdk/emsdk_env.sh"
  exit 1
fi
echo "  emcc:  $(emcc --version | head -1)"

# ── Pre-flight: libpd.a ───────────────────────────────────────────────────
if [ ! -f "$LIBPD_A" ]; then
  echo ""
  echo "  libpd.a not found at $LIBPD_A"
  echo "  Building it from _empd/libpd..."
  mkdir -p "$LIBPD_DIR/build"
  cd "$LIBPD_DIR/build"
  emcmake cmake .. -DPD_UTILS:BOOL=OFF -DCMAKE_BUILD_TYPE=Release
  emmake make
  cd "$SCRIPT_DIR"
  LIBPD_A=$(find "$LIBPD_DIR/build" -name "*.a" | head -1)
  [ -z "$LIBPD_A" ] && { echo "ERROR: libpd build failed"; exit 1; }
fi
echo "  libpd: $LIBPD_A"

# ── Pre-flight: .pd files ─────────────────────────────────────────────────
PD_FILES=()
for f in "$SCRIPT_DIR"/*.pd; do
  [ -f "$f" ] && PD_FILES+=("$f")
done

if [ ${#PD_FILES[@]} -eq 0 ]; then
  echo "  ERROR: No .pd files found in $SCRIPT_DIR"
  exit 1
fi
if [ ! -f "$SCRIPT_DIR/ravel-glottalizer.pd" ]; then
  echo "  ERROR: ravel-glottalizer.pd missing from $SCRIPT_DIR"
  exit 1
fi

echo "  patches: ${#PD_FILES[@]} file(s)"
for f in "${PD_FILES[@]}"; do echo "    $(basename "$f")  ($(wc -c < "$f" | tr -d ' ') bytes)"; done
echo ""

# ── Preload flags ─────────────────────────────────────────────────────────
# Mirrors the nessie/_empd Makefile exactly: cd to the patch directory so
# --preload-file uses bare filenames (no @ path needed). Emscripten then
# places each file at its basename in the virtual FS root, and
# libpd_openfile("feral-vocaloid", ".") finds it as ./feral-vocaloid.pd.
cd "$SCRIPT_DIR"
PRELOAD_FLAGS=()
for f in "${PD_FILES[@]}"; do
  PRELOAD_FLAGS+=("--preload-file" "$(basename "$f")")
done
echo "  Preload flags: ${PRELOAD_FLAGS[*]}"

# ── Link ──────────────────────────────────────────────────────────────────
echo ">>> Linking WASM module..."
mkdir -p "$OUT_DIR"

emcc \
  "$SCRIPT_DIR/libpd_wrapper.c" \
  "$LIBPD_A" \
  -I"$LIBPD_DIR/pure-data/src"  \
  -I"$LIBPD_DIR/libpd_wrapper"  \
  -lm \
  \
  -s WASM=1                     \
  -s MODULARIZE=1               \
  -s EXPORT_NAME=createLibPD    \
  -s EXPORT_ES6=1               \
  -s ENVIRONMENT='worker'       \
  \
  "${PRELOAD_FLAGS[@]}"         \
  \
  -s EXPORTED_FUNCTIONS='[
    "_setup_patch",
    "_process_audio",
    "_test_file_read",
    "_test_file_open",
    "_get_frequency",
    "_get_tenseness",
    "_get_intensity",
    "_get_loudness",
    "_get_tongue_index",
    "_get_tongue_diameter",
    "_is_initialized",
    "_malloc",
    "_free"
  ]' \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","FS","HEAPF32","HEAP8"]' \
  -s ALLOW_MEMORY_GROWTH=1      \
  -s INITIAL_MEMORY=33554432    \
  -s MAXIMUM_MEMORY=268435456   \
  -s STACK_SIZE=5242880         \
  -s FILESYSTEM=1               \
  -s ASSERTIONS=1               \
  -O2                           \
  -o "$OUT_DIR/libpd-glottalizer.js"

echo ""
echo "=== Build complete ==="
echo "  $OUT_DIR/libpd-glottalizer.js"
echo "  $OUT_DIR/libpd-glottalizer.wasm"
echo "  $OUT_DIR/libpd-glottalizer.data  ← patch files"
