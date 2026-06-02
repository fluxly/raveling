/**
 * Web Worker that runs the libpd WebAssembly module and processes audio blocks
 * forwarded from the AudioWorklet tap.
 *
 * Patches are loaded via --preload-file in build.sh, which generates a
 * .data file fetched at module init time — same approach as the working
 * _empd/patches/nessie example.
 *
 * Protocol (messages in from main thread):
 *   { type: 'init',  libpdJsUrl, wasmUrl, dataUrl, sampleRate }
 *   { type: 'audio', buf: Float32Array }   — transferred ownership
 *
 * Protocol (messages out to main thread):
 *   { type: 'ready' }
 *   { type: 'params', params: { frequency, tenseness, intensity, loudness, tongue: {index, diameter} } }
 *   { type: 'error',  message: string }
 */
export const WORKER_CODE = `
let Module = null;
let ready = false;

let lastEmitTime = 0;
const EMIT_INTERVAL_MS = 50;

self.onmessage = async (e) => {
    const { type } = e.data;
    if (type === 'init') {
        await initLibPD(e.data);
    } else if (type === 'audio' && ready) {
        processBlock(e.data.buf);
    }
};

async function initLibPD({ libpdJsUrl, wasmUrl, dataUrl, sampleRate }) {
    try {
        const { default: createLibPD } = await import(libpdJsUrl);

        Module = await createLibPD({
            // Tell Emscripten where to fetch the .wasm and .data files.
            locateFile: (path) => {
                if (path.endsWith('.wasm')) return wasmUrl;
                if (path.endsWith('.data')) return dataUrl;
                return path;
            },
        });

        // Sanity-check: the .data preload puts ravel-glottalizer.pd at the root.
        const probe = (p) => Module.ccall('test_file_read', 'number', ['string'], [p]);
        console.log('[glottalizer] preload probe  ravel-glottalizer.pd:', probe('ravel-glottalizer.pd'));

        // Matches the nessie/_empd pattern: bare filename + "." as dir.
        // --preload-file src@name places each file at name in the FS root,
        // and libpd_openfile("name", ".") finds it as ./name.pd.
        const result = Module.ccall(
            'setup_patch', 'number',
            ['string', 'string', 'number'],
            ['ravel-glottalizer', '.', sampleRate]
        );

        if (result !== 0) {
            const reason = result === -1 ? 'libpd_init_audio failed'
                         : result === -2 ? 'patch not found in WASM — rebuild with ravel-glottalizer.pd present'
                         : 'unknown error ' + result;
            throw new Error('libpd setup_patch: ' + reason);
        }

        ready = true;
        self.postMessage({ type: 'ready' });

    } catch (err) {
        self.postMessage({ type: 'error', message: err.message });
    }
}

function processBlock(buf /* Float32Array, transferred */) {
    const n = Math.floor(buf.length / 64) * 64;
    if (n === 0) return;

    const ptr = Module._malloc(n * 4);
    Module.HEAPF32.set(buf.subarray(0, n), ptr >> 2);
    Module.ccall('process_audio', null, ['number', 'number'], [ptr, n]);
    Module._free(ptr);

    const now = Date.now();
    if (now - lastEmitTime < EMIT_INTERVAL_MS) return;
    lastEmitTime = now;

    self.postMessage({
        type: 'params',
        params: {
            frequency: Module.ccall('get_frequency',       'number', [], []),
            tenseness: Module.ccall('get_tenseness',       'number', [], []),
            intensity: Module.ccall('get_intensity',       'number', [], []),
            loudness:  Module.ccall('get_loudness',        'number', [], []),
            tongue: {
                index:    Module.ccall('get_tongue_index',    'number', [], []),
                diameter: Module.ccall('get_tongue_diameter', 'number', [], []),
            },
        },
    });
}
`;
