# libpd-wasm — build guide

Compiles [libpd](https://github.com/libpd/libpd) to WebAssembly for use by the
`ravel-glottalizer` component.  Run this **once** (or after changing the C
wrapper), then iterate freely on the `.pd` patch without rebuilding.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| **Emscripten SDK** | ≥ 3.1 | https://emscripten.org/docs/getting_started/downloads.html |
| **CMake** | ≥ 3.15 | `brew install cmake` / `apt install cmake` |
| **git** | any | system package manager |

Activate emsdk before building:
```bash
source /path/to/emsdk/emsdk_env.sh
```

## Build

```bash
cd core/libs/libpd-wasm
bash build.sh
```

Outputs land in `public/libs/`:
```
public/libs/libpd-glottalizer.js    # Emscripten ES-module factory
public/libs/libpd-glottalizer.wasm  # WebAssembly binary
```

Vite serves these at `/libs/libpd-glottalizer.{js,wasm}` — the component
fetches them automatically.

## Pd patch convention

The `feral-vocaloid.pd` patch (placed in `core/libs/libpd-wasm/`) must send
floats on these named **send** objects so the C hook can read them:

| Pd send name            | Range       | Maps to                    |
|-------------------------|-------------|----------------------------|
| `out-frequency`         | 80 – 1100   | Glottal pitch (Hz)         |
| `out-tenseness`         | 0.0 – 1.0   | Vocal fold tension         |
| `out-intensity`         | 0.0 – 1.0   | Breath pressure            |
| `out-loudness`          | 0.0 – 1.0   | Output gain                |
| `out-tongue-index`      | 12.0 – 29.0 | Tongue front–back position |
| `out-tongue-diameter`   | 2.05 – 3.5  | Tongue constriction        |

In the patch, wire outputs like:
```
[your-analysis-output] -> [float 0] -> [s out-frequency]
```

## Available Pd objects

Built-in Pd objects plus `-DPD_EXTRA=ON` extras:

- `sigmund~` — pitch + sinusoidal analysis (F0 tracking)
- `bonk~` — onset detection
- All Pd vanilla DSP/control objects (`fft~`, `rfft~`, `env~`, `hip~`, etc.)

Third-party externals (zexy, cyclone, etc.) are **not** included.  To add one,
place its `.c` source in this directory, add it to the `emcc` invocation in
`build.sh`, and call `class_new()` from `setup_patch`.

## Rebuild triggers

Re-run `build.sh` only when you change `libpd_wrapper.c`.  Changing the `.pd`
patch does **not** require a rebuild — it is fetched at runtime from the Vite
dev server.
