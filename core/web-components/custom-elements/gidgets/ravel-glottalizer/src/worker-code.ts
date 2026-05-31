/**
 * Web Worker that runs the libpd WebAssembly module and processes audio blocks
 * forwarded from the AudioWorklet tap.
 *
 * Protocol (messages in from main thread):
 *   { type: 'init',  libpdJsUrl, wasmUrl, patchUrl, sampleRate }
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

// Throttle: emit params at most every ~50ms (~20 Hz) to avoid flooding the
// main thread — fast enough for real-time vocal control.
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

async function initLibPD({ libpdJsUrl, wasmUrl, patchUrl, sampleRate }) {
    try {
        // Dynamically import the Emscripten ES-module factory.
        // (Works in module-type workers created from a blob URL.)
        const { default: createLibPD } = await import(libpdJsUrl);

        Module = await createLibPD({
            // Tell Emscripten where the .wasm file lives.
            locateFile: (path) => path.endsWith('.wasm') ? wasmUrl : path,
        });

        // Fetch the Pd patch and write it into libpd's virtual filesystem.
        const patchRes = await fetch(patchUrl);
        if (!patchRes.ok) {
            throw new Error(\`Cannot fetch patch \${patchUrl}: HTTP \${patchRes.status}\`);
        }
        const patchBytes = new Uint8Array(await patchRes.arrayBuffer());

        // Write patch into libpd's virtual filesystem.
        // Use /tmp — always present in Emscripten's default FS mounts.
        // Avoid dir="/" because libpd constructs "//filename" (double-slash)
        // which Emscripten's FS path lookup does not normalise correctly.
        const patchName = patchUrl.split('/').pop() || 'patch.pd';
        const baseName = patchName.endsWith('.pd') ? patchName.slice(0, -3) : patchName;

        console.log('[glottalizer] patch fetched:', patchName, patchBytes.length, 'bytes');
        console.log('[glottalizer] FS root before write:', Module.FS.readdir('/'));

        try { Module.FS.mkdir('/tmp'); } catch (_) {}
        Module.FS.writeFile('/tmp/' + patchName, patchBytes);

        console.log('[glottalizer] FS /tmp after write:', Module.FS.readdir('/tmp'));

        const result = Module.ccall(
            'setup_patch', 'number',
            ['string', 'string', 'number'],
            ['/tmp/' + baseName, '', sampleRate]
        );

        if (result !== 0) {
            const reason = result === -1 ? 'libpd_init_audio failed'
                         : result === -2 ? 'patch file could not be opened'
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
    // Ensure length is a multiple of 64 (libpd block size)
    const n = Math.floor(buf.length / 64) * 64;
    if (n === 0) return;

    // Copy samples into WASM heap
    const ptr = Module._malloc(n * 4);
    Module.HEAPF32.set(buf.subarray(0, n), ptr >> 2);

    Module.ccall('process_audio', null, ['number', 'number'], [ptr, n]);

    Module._free(ptr);

    // Throttled param emit
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
