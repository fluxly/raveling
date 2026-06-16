import { RavelElement } from '../../../../common/RavelElement';
import { WORKER_CODE }       from './worker-code';
import { TAP_WORKLET_CODE }  from './tap-worklet-code';

/**
 * Runs the ravel-glottalizer Pure Data patch via libpd (WebAssembly) on a live
 * audio input and broadcasts the extracted vocal parameters as RavelMessages.
 * Pair with `ravel-pink-trombone` for live voice-driven synthesis.
 *
 * ### Attributes
 * | Attribute       | Type    | Default                                         | Description                         |
 * |-----------------|---------|--------------------------------------------------|-------------------------------------|
 * | `w`             | number  | `320`                                            | Width in px                         |
 * | `h`             | number  | `200`                                            | Height in px                        |
 * | `active`        | boolean | —                                                | Start audio capture when present    |
 * | `source`        | string  | `'mic'`                                          | `'mic'` or `'file'`                 |
 * | `patch-url`     | string  | `/core/libs/libpd-wasm/ravel-glottalizer.pd`     | URL of the Pd patch to load         |
 * | `libpd-js`      | string  | `/libs/libpd-glottalizer.js`                     | URL of Emscripten JS loader         |
 * | `libpd-wasm`    | string  | `/libs/libpd-glottalizer.wasm`                   | URL of WASM binary                  |
 * | `broadcast-to`  | string  | `'ravel-pink-trombone'`                          | Channel to forward `params` messages|
 *
 * ### Messages received (on `'ravel-glottalizer'` channel)
 * | cmd     | content          | Effect                      |
 * |---------|------------------|-----------------------------|
 * | `start` | —                | Begin mic capture + analysis |
 * | `stop`  | —                | Stop capture                 |
 *
 * ### Messages broadcast (on `'ravel-glottalizer'` channel)
 * | cmd      | content                                                               | Trigger             |
 * |----------|-----------------------------------------------------------------------|---------------------|
 * | `params` | `{ frequency, tenseness, intensity, loudness, tongue:{index,diameter} }` | Each analysis tick |
 * | `ready`  | `{ sampleRate, patchUrl }`                                            | libpd loaded        |
 * | `error`  | `{ message }`                                                         | Init failure        |
 */
export class RavelGlottalizer extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: inline-block;
            box-sizing: border-box;
        }
        #container {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            background: #090912;
            border: 1px solid #20203a;
            border-radius: 6px;
            overflow: hidden;
            font-family: 'Quantico', monospace, sans-serif;
        }
        /* ── Title bar ──────────────────────────── */
        #title-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px 4px;
            border-bottom: 1px solid #18182e;
            flex-shrink: 0;
        }
        #status-dot {
            width: 7px; height: 7px;
            border-radius: 50%;
            background: #252545;
            flex-shrink: 0;
            transition: background 0.3s ease, box-shadow 0.3s ease;
        }
        #status-dot.active  { background: #ff6644; box-shadow: 0 0 5px #ff664488; }
        #status-dot.ready   { background: #44aaff; box-shadow: 0 0 4px #44aaff66; }
        #status-dot.error   { background: #ff3333; }
        #status-text {
            font-size: 10px;
            color: #444460;
            text-transform: uppercase;
            letter-spacing: 1.2px;
            flex: 1;
        }
        #status-text.active { color: #cc8855; }
        #status-text.ready  { color: #5599cc; }
        #status-text.error  { color: #cc3333; }
        /* ── Source selector ─────────────────────── */
        #source-row {
            display: flex;
            gap: 4px;
            padding: 4px 10px;
            border-bottom: 1px solid #18182e;
            flex-shrink: 0;
        }
        .src-btn {
            flex: 1;
            background: transparent;
            border: 1px solid #1c1c30;
            border-radius: 3px;
            color: #333355;
            font-size: 10px;
            padding: 3px 0;
            cursor: pointer;
            font-family: inherit;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            transition: color 0.15s, border-color 0.15s;
        }
        .src-btn:hover { color: #555588; border-color: #2a2a44; }
        .src-btn.selected { border-color: #334488; color: #6677bb; background: #0e0e22; }
        /* ── File row ────────────────────────────── */
        #file-row {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            border-bottom: 1px solid #18182e;
            flex-shrink: 0;
        }
        #file-pick-btn {
            background: transparent;
            border: 1px solid #1c1c30;
            border-radius: 3px;
            color: #445566;
            font-size: 10px;
            padding: 2px 8px;
            cursor: pointer;
            font-family: inherit;
            flex-shrink: 0;
            transition: color 0.15s, border-color 0.15s;
        }
        #file-pick-btn:hover { border-color: #334488; color: #6688aa; }
        #file-name {
            font-size: 10px;
            color: #334455;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
        }
        /* ── Level meter ─────────────────────────── */
        #level-bar-wrap {
            padding: 4px 10px 2px;
            flex-shrink: 0;
        }
        #level-bar-bg {
            height: 4px;
            background: #12121e;
            border-radius: 2px;
            overflow: hidden;
        }
        #level-bar {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #336655, #66bb88);
            border-radius: 2px;
            transition: width 0.04s linear;
        }
        /* ── Params grid ─────────────────────────── */
        #params-grid {
            flex: 1;
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: repeat(3, 1fr);
            gap: 1px;
            background: #14142a;
            min-height: 0;
            padding: 6px 8px;
            box-sizing: border-box;
        }
        .param-cell {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            padding: 4px 5px 3px;
            gap: 2px;
            background: #090912;
        }
        .param-label {
            font-size: 9px;
            color: #333355;
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }
        .param-bar-bg {
            height: 3px;
            background: #141428;
            border-radius: 1px;
            overflow: hidden;
        }
        .param-bar {
            height: 100%;
            width: 0%;
            border-radius: 1px;
            transition: width 0.06s ease;
        }
        .param-value {
            font-size: 9px;
            color: #2a2a48;
            font-variant-numeric: tabular-nums;
            transition: color 0.3s ease;
        }
        .param-value.live { color: #667799; }
        /* ── Bottom bar ──────────────────────────── */
        #bottom-bar {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            background: #060610;
            border-top: 1px solid #14142a;
            flex-shrink: 0;
        }
        #patch-label {
            font-size: 9px;
            color: #2a2a40;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
        }
    `;

    // Param bar colors
    private static readonly PARAM_COLORS = [
        '#4488cc', '#cc6644', '#44aa77', '#aa44cc', '#ccaa33', '#44aaaa',
    ];

    // ── DOM refs ────────────────────────────────────────────────────────────

    private _statusDot!: HTMLElement;
    private _statusText!: HTMLElement;
    private _levelBar!: HTMLElement;
    private _paramCells!: { bar: HTMLElement; value: HTMLElement }[];
    private _patchLabel!: HTMLElement;
    private _srcBtns!: NodeListOf<HTMLButtonElement>;
    private _fileRow!: HTMLElement;
    private _fileInput!: HTMLInputElement;
    private _fileNameLabel!: HTMLElement;

    // ── Audio + workers ─────────────────────────────────────────────────────

    private _ctx: AudioContext | null = null;
    private _tapNode: AudioWorkletNode | null = null;
    private _stream: MediaStream | null = null;
    private _sourceNode: AudioNode | null = null;
    private _fileSource: AudioBufferSourceNode | null = null;
    private _worker: Worker | null = null;
    private _workerReady = false;
    private _workerUrl: string | null = null;

    // ── State ───────────────────────────────────────────────────────────────

    private _w = 320;
    private _h = 200;
    private _active = false;
    private _initPromise: Promise<void> | null = null;
    private _status: 'idle' | 'loading' | 'ready' | 'active' | 'error' = 'idle';
    private _source: 'mic' | 'file' = 'mic';
    private _fileBuffer: AudioBuffer | null = null;
    private _fileName = '';

    private _patchUrl   = '/core/libs/libpd-wasm/ravel-glottalizer.pd';
    private _libpdJs    = '/libs/libpd-glottalizer.js';
    private _libpdWasm  = '/libs/libpd-glottalizer.wasm';
    private _libpdData  = '/libs/libpd-glottalizer.data';
    private _broadcastTo = 'ravel-pink-trombone';

    // Current params (for display)
    private _params = {
        frequency: 0, tenseness: 0, intensity: 0,
        loudness: 0, tongue: { index: 12, diameter: 2.05 },
    };

    // ── Lifecycle ───────────────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'w', 'h', 'active',
            'patch-url', 'libpd-js', 'libpd-wasm', 'broadcast-to',
            'source',
        ];
    }

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelGlottalizer.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = this._buildHtml();

        this._statusDot  = this.container.querySelector<HTMLElement>('#status-dot')!;
        this._statusText = this.container.querySelector<HTMLElement>('#status-text')!;
        this._levelBar   = this.container.querySelector<HTMLElement>('#level-bar')!;
        this._patchLabel = this.container.querySelector<HTMLElement>('#patch-label')!;
        this._srcBtns    = this.container.querySelectorAll<HTMLButtonElement>('.src-btn');
        this._fileRow    = this.container.querySelector<HTMLElement>('#file-row')!;
        this._fileInput  = this.container.querySelector<HTMLInputElement>('#file-input')!;
        this._fileNameLabel = this.container.querySelector<HTMLElement>('#file-name')!;

        // Collect per-param bar + value refs
        this._paramCells = Array.from(
            this.container.querySelectorAll<HTMLElement>('.param-cell')
        ).map(cell => ({
            bar:   cell.querySelector<HTMLElement>('.param-bar')!,
            value: cell.querySelector<HTMLElement>('.param-value')!,
        }));

        // Color the bars
        this._paramCells.forEach((cell, i) => {
            cell.bar.style.background = RavelGlottalizer.PARAM_COLORS[i];
        });
    }

    protected setup(): void {
        super.setup();
        this._applySize();
        this._updateStatus('idle');
        this._patchLabel.textContent = this._patchUrl.split('/').pop() ?? '';
        window.addEventListener('ravel-glottalizer', this._handleMessage as EventListener);

        this._srcBtns.forEach(btn => {
            btn.addEventListener('click', () =>
                this._setSource(btn.dataset.src as 'mic' | 'file'));
        });
        this.container.querySelector('#file-pick-btn')!
            .addEventListener('click', () => this._fileInput.click());
        this._fileInput.addEventListener('change', () => {
            const file = this._fileInput.files?.[0];
            if (file) this._loadFile(file);
        });
        this._updateSourceUI();
    }

    protected teardown(): void {
        window.removeEventListener('ravel-glottalizer', this._handleMessage as EventListener);
        this._stopAll();
        super.teardown();
    }

    // ── HTML template ───────────────────────────────────────────────────────

    private _buildHtml(): string {
        const PARAMS = [
            { label: 'Frequency', unit: ' Hz' },
            { label: 'Tenseness', unit: '' },
            { label: 'Intensity', unit: '' },
            { label: 'Loudness',  unit: '' },
            { label: 'Tongue ·',  unit: ' idx' },
            { label: 'Tongue ⌀',  unit: '' },
        ];
        const cells = PARAMS.map(p => `
            <div class="param-cell">
                <div class="param-label">${p.label}</div>
                <div class="param-bar-bg"><div class="param-bar"></div></div>
                <div class="param-value">—</div>
            </div>`).join('');

        return `
            <div id="title-bar">
                <div id="status-dot"></div>
                <span id="status-text">Idle</span>
            </div>
            <div id="source-row">
                <button class="src-btn selected" data-src="mic">Mic</button>
                <button class="src-btn" data-src="file">File</button>
            </div>
            <div id="file-row" hidden>
                <button id="file-pick-btn">Choose…</button>
                <span id="file-name">No file</span>
                <input type="file" id="file-input" accept="audio/*" hidden>
            </div>
            <div id="level-bar-wrap">
                <div id="level-bar-bg"><div id="level-bar"></div></div>
            </div>
            <div id="params-grid">${cells}</div>
            <div id="bottom-bar">
                <span id="patch-label">—</span>
            </div>
        `;
    }

    // ── Size ────────────────────────────────────────────────────────────────

    private _applySize(): void {
        this.style.width  = `${this._w}px`;
        this.style.height = `${this._h}px`;
    }

    // ── Status ──────────────────────────────────────────────────────────────

    private _updateStatus(s: 'idle' | 'loading' | 'ready' | 'active' | 'error', detail = '') {
        this._status = s;
        const labels: Record<typeof s, string> = {
            idle:    'Idle',
            loading: 'Loading…',
            ready:   'Ready',
            active:  'Active',
            error:   detail || 'Error',
        };
        this._statusText.textContent = labels[s];
        ['idle','loading','ready','active','error'].forEach(c =>
            this._statusDot.classList.toggle(c, c === s));
        ['active','ready','error'].forEach(c =>
            this._statusText.classList.toggle(c, c === s));
    }

    // ── Source switching ─────────────────────────────────────────────────────

    private _setSource(s: 'mic' | 'file'): void {
        if (s === this._source) return;
        const wasActive = this._active;
        if (wasActive) this._stopAll();
        this._source = s;
        this._updateSourceUI();
        if (wasActive && (s === 'mic' || this._fileBuffer)) {
            this._setActive(true);
        }
    }

    private _updateSourceUI(): void {
        this._srcBtns.forEach(btn =>
            btn.classList.toggle('selected', btn.dataset.src === this._source));
        this._fileRow.hidden = this._source !== 'file';
    }

    // ── File loading ─────────────────────────────────────────────────────────

    private async _loadFile(file: File): Promise<void> {
        this._fileNameLabel.textContent = file.name;
        this._fileName = file.name;
        try {
            const arrayBuffer = await file.arrayBuffer();
            const tmpCtx = new AudioContext();
            this._fileBuffer = await tmpCtx.decodeAudioData(arrayBuffer);
            await tmpCtx.close();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this._fileNameLabel.textContent = `Error: ${msg}`;
            this._fileBuffer = null;
        }
    }

    // ── Audio init ──────────────────────────────────────────────────────────

    private _initAll(): Promise<void> {
        if (this._initPromise) return this._initPromise;
        this._initPromise = this._doInit();
        return this._initPromise;
    }

    private async _doInit(): Promise<void> {
        this._updateStatus('loading');
        try {
            // ── AudioContext + tap worklet ───────────────────────────────
            this._ctx = new AudioContext();

            const tapBlob = new Blob([TAP_WORKLET_CODE], { type: 'application/javascript' });
            const tapUrl  = URL.createObjectURL(tapBlob);
            await this._ctx.audioWorklet.addModule(tapUrl);
            URL.revokeObjectURL(tapUrl);

            this._tapNode = new AudioWorkletNode(this._ctx, 'glottalizer-tap', {
                numberOfInputs:  1,
                numberOfOutputs: 0,
            });

            // Route tap audio → worker
            this._tapNode.port.onmessage = (e) => {
                if (e.data.type === 'audio' && this._worker) {
                    this._worker.postMessage(e.data, [e.data.buf.buffer]);
                }
            };

            // ── Audio source ─────────────────────────────────────────────
            if (this._source === 'mic') {
                this._stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        sampleRate: this._ctx.sampleRate,
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                    },
                    video: false,
                });
                this._sourceNode = this._ctx.createMediaStreamSource(this._stream);
            } else {
                const src = this._ctx.createBufferSource();
                src.buffer = this._fileBuffer!;
                src.loop = true;
                src.start();
                this._fileSource  = src;
                this._sourceNode  = src;
            }

            this._sourceNode.connect(this._tapNode);

            // ── Level meter ──────────────────────────────────────────────
            const analyser = this._ctx.createAnalyser();
            analyser.fftSize = 256;
            this._sourceNode.connect(analyser);
            const timeDomain = new Float32Array(analyser.fftSize);
            const updateLevel = () => {
                if (!this._active) return;
                requestAnimationFrame(updateLevel);
                analyser.getFloatTimeDomainData(timeDomain);
                let rms = 0;
                for (let i = 0; i < timeDomain.length; i++) rms += timeDomain[i] ** 2;
                rms = Math.sqrt(rms / timeDomain.length);
                const pct = Math.min(100, rms * 600);
                if (this._levelBar) this._levelBar.style.width = `${pct}%`;
            };
            updateLevel();

            // ── libpd Worker ─────────────────────────────────────────────
            const workerBlob = new Blob([WORKER_CODE], { type: 'application/javascript' });
            this._workerUrl  = URL.createObjectURL(workerBlob);
            this._worker     = new Worker(this._workerUrl, { type: 'module' });

            this._worker.onmessage = (e) => this._onWorkerMessage(e.data);

            // Blob URL module workers need fully-qualified URLs
            const abs = (p: string) => new URL(p, location.href).href;
            this._worker.postMessage({
                type:       'init',
                libpdJsUrl: abs(this._libpdJs),
                wasmUrl:    abs(this._libpdWasm),
                dataUrl:    abs(this._libpdData),
                sampleRate: this._ctx.sampleRate,
            });

        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this._updateStatus('error', msg);
            this._initPromise = null;
            this.broadcastMessage('ravel-glottalizer', 'error', { message: msg });
            console.error('[ravel-glottalizer]', err);
        }
    }

    private _stopAll(): void {
        this._active = false;

        if (this._stream) {
            this._stream.getTracks().forEach(t => t.stop());
            this._stream = null;
        }
        if (this._fileSource) {
            try { this._fileSource.stop(); } catch {}
            this._fileSource.disconnect();
            this._fileSource = null;
        }
        if (this._sourceNode) { this._sourceNode.disconnect(); this._sourceNode = null; }
        if (this._tapNode)    { this._tapNode.disconnect();    this._tapNode    = null; }
        if (this._ctx)        { this._ctx.close();             this._ctx        = null; }
        if (this._worker)     { this._worker.terminate();      this._worker     = null; }
        if (this._workerUrl)  { URL.revokeObjectURL(this._workerUrl); this._workerUrl = null; }

        this._workerReady = false;
        this._initPromise = null;
        this._updateStatus('idle');
        if (this._levelBar) this._levelBar.style.width = '0%';
    }

    // ── Worker messages ─────────────────────────────────────────────────────

    private _onWorkerMessage(data: Record<string, unknown>): void {
        switch (data.type) {
            case 'ready':
                this._workerReady = true;
                this._updateStatus('active');
                this.broadcastMessage('ravel-glottalizer', 'ready', {
                    sampleRate: this._ctx?.sampleRate,
                    patchUrl:   this._patchUrl,
                });
                break;

            case 'params': {
                const p = data.params as typeof this._params;
                this._params = p;
                this._renderParams(p);

                // Forward to broadcast-to channel
                if (this._broadcastTo) {
                    window.dispatchEvent(new CustomEvent(this._broadcastTo, {
                        detail: { cmd: 'params', content: p },
                    }));
                }

                // Also emit on our own channel for monitoring
                this.broadcastMessage('ravel-glottalizer', 'params', p);
                break;
            }

            case 'error': {
                const msg = data.message as string;
                this._updateStatus('error', msg);
                this.broadcastMessage('ravel-glottalizer', 'error', { message: msg });
                console.error('[ravel-glottalizer] worker error:', msg);
                break;
            }
        }
    }

    // ── Param display ───────────────────────────────────────────────────────

    private _renderParams(p: typeof this._params): void {
        const vals = [
            (p.frequency - 80) / (1100 - 80),
            p.tenseness,
            p.intensity,
            p.loudness,
            (p.tongue.index - 12) / (29 - 12),
            (p.tongue.diameter - 2.05) / (3.5 - 2.05),
        ];
        const labels = [
            `${Math.round(p.frequency)} Hz`,
            p.tenseness.toFixed(2),
            p.intensity.toFixed(2),
            p.loudness.toFixed(2),
            p.tongue.index.toFixed(1),
            p.tongue.diameter.toFixed(2),
        ];

        this._paramCells.forEach((cell, i) => {
            const pct = Math.max(0, Math.min(100, vals[i] * 100));
            cell.bar.style.width   = `${pct}%`;
            cell.value.textContent = labels[i];
            cell.value.classList.toggle('live', true);
        });
    }

    // ── Activation ──────────────────────────────────────────────────────────

    private _setActive(on: boolean): void {
        this._active = on;
        if (on) {
            if (this._source === 'file' && !this._fileBuffer) {
                this._updateStatus('error', 'No file loaded');
                return;
            }
            this._initAll().then(() => {
                if (this._ctx?.state === 'suspended') this._ctx.resume();
            });
        } else {
            this._stopAll();
        }
    }

    // ── Message handler ──────────────────────────────────────────────────────

    private _handleMessage = (e: CustomEvent): void => {
        const { cmd } = (e as CustomEvent<{ cmd: string }>).detail ?? {};
        if (cmd === 'start') this._setActive(true);
        if (cmd === 'stop')  this._setActive(false);
    };

    // ── Attributes ───────────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        switch (name) {
            case 'w':
                this._w = Number(newValue) || 320;
                if (this.container) this._applySize();
                break;
            case 'h':
                this._h = Number(newValue) || 200;
                if (this.container) this._applySize();
                break;
            case 'active':
                this._setActive(newValue !== null);
                break;
            case 'source':
                if (newValue === 'mic' || newValue === 'file') this._setSource(newValue);
                break;
            case 'patch-url':
                if (newValue) this._patchUrl = newValue;
                if (this._patchLabel) this._patchLabel.textContent = this._patchUrl.split('/').pop() ?? '';
                break;
            case 'libpd-js':
                if (newValue) this._libpdJs = newValue;
                break;
            case 'libpd-wasm':
                if (newValue) this._libpdWasm = newValue;
                break;
            case 'broadcast-to':
                this._broadcastTo = newValue ?? 'ravel-pink-trombone';
                break;
        }
    }
}
