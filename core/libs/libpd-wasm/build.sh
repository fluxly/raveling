#!/usr/bin/env bash
# =============================================================================
# build.sh — Compile libpd to WebAssembly for ravel-glottalizer
#
# Prerequisites:
#   - Emscripten SDK ≥ 3.1  (https://emscripten.org/docs/getting_started/downloads.html)
#     Activate it first:   source /path/to/emsdk/emsdk_env.sh
#   - CMake ≥ 3.15
#   - git
#   - The feral-vocaloid patch must be in:
#       core/libs/libpd-wasm/feral-vocaloid.pd
#
# Usage:
#   cd core/libs/libpd-wasm
#   bash build.sh
#
# Outputs (served by Vite from public/):
#   public/libs/libpd-glottalizer.js    — Emscripten ES-module loader
#   public/libs/libpd-glottalizer.wasm  — WebAssembly binary
# =============================================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/_build"
LIBPD_DIR="$BUILD_DIR/libpd"
LIBPD_BUILD="$BUILD_DIR/libpd-wasm-build"
OUT_DIR="$REPO_ROOT/public/libs"

# ── Pre-flight checks ──────────────────────────────────────────────────────
echo "=== ravel-glottalizer: libpd → WASM build ==="

if ! command -v emcc &>/dev/null; then
  echo ""
  echo "  ERROR: emcc not found."
  echo "  Install Emscripten SDK and run:  source /path/to/emsdk/emsdk_env.sh"
  echo "  Docs: https://emscripten.org/docs/getting_started/downloads.html"
  exit 1
fi

if ! command -v cmake &>/dev/null; then
  echo "ERROR: cmake not found. Install CMake ≥ 3.15."
  exit 1
fi

EMCC_VER=$(emcc --version | head -1)
echo "  emcc:  $EMCC_VER"
echo "  cmake: $(cmake --version | head -1)"
echo ""

# ── Clone / update libpd ───────────────────────────────────────────────────
mkdir -p "$BUILD_DIR"

if [ ! -d "$LIBPD_DIR/.git" ]; then
  echo ">>> Cloning libpd..."
  git clone --depth 1 --recurse-submodules \
    https://github.com/libpd/libpd.git "$LIBPD_DIR"
else
  echo ">>> Updating libpd..."
  git -C "$LIBPD_DIR" pull --rebase
  git -C "$LIBPD_DIR" submodule update --init --recursive
fi

# ── Configure libpd with Emscripten ───────────────────────────────────────
echo ""
echo ">>> Configuring libpd (emcmake cmake)..."
mkdir -p "$LIBPD_BUILD"
cd "$LIBPD_BUILD"

emcmake cmake "$LIBPD_DIR" \
  -DCMAKE_BUILD_TYPE=MinSizeRel \
  -DPD_UTILS=OFF        \
  -DPD_EXTRA=ON         \
  -DPD_LOCALE=OFF       \
  -DLIBPD_SETLOCALE=OFF \
  -DPD_MULTI=OFF        \
  -DCMAKE_C_FLAGS="-fPIC -DUSEAPI_DUMMY=1"

# ── Build libpd static library ─────────────────────────────────────────────
echo ""
echo ">>> Building libpd_static..."
NPROC=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo 4)
emmake make -j"$NPROC" libpd_static

# Find the static lib
LIBPD_A=$(find "$LIBPD_BUILD" -name "*.a" | head -1)
if [ -z "$LIBPD_A" ]; then
  echo "ERROR: Could not find libpd static library after build."
  exit 1
fi
echo "  Found: $LIBPD_A"

# ── Link the final WASM module ─────────────────────────────────────────────
echo ""
echo ">>> Linking WASM module..."
mkdir -p "$OUT_DIR"

emcc \
  "$SCRIPT_DIR/libpd_wrapper.c" \
  "$LIBPD_A" \
  -I"$LIBPD_DIR/libpd_wrapper" \
  -I"$LIBPD_DIR/pure-data/src"  \
  \
  -s WASM=1                     \
  -s MODULARIZE=1               \
  -s EXPORT_NAME=createLibPD    \
  -s EXPORT_ES6=1               \
  -s ENVIRONMENT='worker'       \
  \
  -s EXPORTED_FUNCTIONS='[
    "_setup_patch",
    "_process_audio",
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
  -O2                           \
  -o "$OUT_DIR/libpd-glottalizer.js"

echo ""
echo "=== Build complete ==="
echo "  $OUT_DIR/libpd-glottalizer.js"
echo "  $OUT_DIR/libpd-glottalizer.wasm"
echo ""
echo "The component will serve these from /libs/ via Vite's public/ directory."
echo "Drop core/libs/libpd-wasm/feral-vocaloid.pd in place and open the sandbox."
