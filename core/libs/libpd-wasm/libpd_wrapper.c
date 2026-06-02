/*
 * libpd_wrapper.c
 * Emscripten-compiled C wrapper around libpd for the ravel-glottalizer component.
 *
 * The feral-vocaloid.pd patch should send floats to these named receivers:
 *
 *   out-frequency        Hz  (80 – 1100)   — glottal oscillator pitch
 *   out-tenseness        0–1               — vocal fold tension (0=breathy, 1=pressed)
 *   out-intensity        0–1               — glottal drive / breath pressure
 *   out-loudness         0–1               — output gain
 *   out-tongue-index     12–29             — tongue front–back position
 *   out-tongue-diameter  2.05–3.5          — tongue constriction openness
 *
 * In the patch use e.g.:  [f 0] -> [send out-frequency]
 *
 * Exported JS API (via ccall / cwrap):
 *   int  setup_patch(filename, dir, sample_rate)  -> 0=ok, <0=error
 *        filename must be WITHOUT the .pd extension — setup_patch appends it.
 *   void process_audio(float* samples, int n)
 *   float get_frequency / get_tenseness / get_intensity
 *         get_loudness / get_tongue_index / get_tongue_diameter
 *   int  is_initialized()
 */

#include "z_libpd.h"
#include <string.h>
#include <stdlib.h>
#include <fcntl.h>
#include <unistd.h>
#include <emscripten.h>

/* ── Parameter storage ──────────────────────────────────────────────────── */

static float g_frequency        = 140.0f;
static float g_tenseness        = 0.6f;
static float g_intensity        = 0.0f;
static float g_loudness         = 0.5f;
static float g_tongue_index     = 12.9f;
static float g_tongue_diameter  = 2.43f;

static int   g_initialized      = 0;
static void *g_patch            = NULL;

/* ── libpd message hook ─────────────────────────────────────────────────── */

static void float_hook(const char *recv, float val) {
    if      (!strcmp(recv, "out-frequency"))        g_frequency        = val;
    else if (!strcmp(recv, "out-tenseness"))        g_tenseness        = val;
    else if (!strcmp(recv, "out-intensity"))        g_intensity        = val;
    else if (!strcmp(recv, "out-loudness"))         g_loudness         = val;
    else if (!strcmp(recv, "out-tongue-index"))     g_tongue_index     = val;
    else if (!strcmp(recv, "out-tongue-diameter"))  g_tongue_diameter  = val;
}

/* ── Exported functions ─────────────────────────────────────────────────── */

/*
 * Initialize libpd, open the .pd patch from the virtual FS, start DSP.
 * Returns 0 on success, negative on failure:
 *  -1  libpd_init_audio failed
 *  -2  patch file could not be opened
 */
EMSCRIPTEN_KEEPALIVE int setup_patch(const char *filename, const char *dir, int sample_rate) {
    if (g_initialized && g_patch) {
        libpd_closefile(g_patch);
        g_patch = NULL;
        g_initialized = 0;
    }

    libpd_init();

    /* Set float hook (called synchronously inside libpd_process_float) */
    libpd_set_floathook(float_hook);

    /* Subscribe to all six named senders */
    libpd_bind("out-frequency");
    libpd_bind("out-tenseness");
    libpd_bind("out-intensity");
    libpd_bind("out-loudness");
    libpd_bind("out-tongue-index");
    libpd_bind("out-tongue-diameter");

    /* 1 audio input channel, 1 audio output channel (output is discarded) */
    if (libpd_init_audio(1, 1, sample_rate) != 0) {
        return -1;
    }

    /* Enable DSP — nessie/_empd example does this before openfile */
    libpd_start_message(1);
    libpd_add_float(1.0f);
    libpd_finish_message("pd", "dsp");

    /* libpd_openfile (glob_evalfile) needs the full filename with extension */
    char pd_filename[4096];
    snprintf(pd_filename, sizeof(pd_filename), "%s.pd", filename);
    g_patch = libpd_openfile(pd_filename, dir);
    if (!g_patch) {
        return -2;
    }

    g_initialized = 1;
    return 0;
}

/*
 * Feed n_samples mono float samples through libpd.
 * n_samples must be a multiple of libpd_blocksize() (64).
 * Call this whenever a new audio block arrives from the AudioWorklet tap.
 */
EMSCRIPTEN_KEEPALIVE void process_audio(const float *input_samples, int n_samples) {
    if (!g_initialized) return;

    int bs    = libpd_blocksize(); /* 64 */
    int ticks = n_samples / bs;
    if (ticks < 1) return;

    /* Output buffer: 1 channel * ticks * bs floats (discarded) */
    float *out = (float *)malloc((size_t)ticks * bs * sizeof(float));
    if (!out) return;

    libpd_process_float(ticks, input_samples, out);

    free(out);
}

/* ── Diagnostics ────────────────────────────────────────────────────────── */

/* Returns file size via fopen, or -1 on failure. */
EMSCRIPTEN_KEEPALIVE int test_file_read(const char *path) {
    FILE *f = fopen(path, "rb");
    if (!f) return -1;
    fseek(f, 0, SEEK_END);
    int size = (int)ftell(f);
    fclose(f);
    return size;
}

/* Returns 0 via POSIX open(), or -1 on failure. */
EMSCRIPTEN_KEEPALIVE int test_file_open(const char *path) {
    int fd = open(path, O_RDONLY);
    if (fd < 0) return -1;
    close(fd);
    return 0;
}

/* ── Parameter getters ──────────────────────────────────────────────────── */

EMSCRIPTEN_KEEPALIVE float get_frequency()       { return g_frequency; }
EMSCRIPTEN_KEEPALIVE float get_tenseness()       { return g_tenseness; }
EMSCRIPTEN_KEEPALIVE float get_intensity()       { return g_intensity; }
EMSCRIPTEN_KEEPALIVE float get_loudness()        { return g_loudness;  }
EMSCRIPTEN_KEEPALIVE float get_tongue_index()    { return g_tongue_index; }
EMSCRIPTEN_KEEPALIVE float get_tongue_diameter() { return g_tongue_diameter; }
EMSCRIPTEN_KEEPALIVE int   is_initialized()      { return g_initialized; }
