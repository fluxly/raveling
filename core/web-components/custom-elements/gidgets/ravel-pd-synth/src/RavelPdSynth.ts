import { RavelElement } from '../../../../common/RavelElement';

type SignalMapping = { channel: string; receiver: string };
type AudioStatus   = 'idle' | 'loading' | 'ready' | 'error';

/**
 * A headless audio component that runs a Pure Data patch inside an AudioWorklet
 * via an Emscripten-compiled WASM engine (libpd or similar).
 *
 * The element renders a small status LED. It is otherwise invisible and is
 * intended to be placed in the DOM as an audio service node.
 *
 * ### Attributes
 * | Attribute   | Type   | Default | Description                                       |
 * |-------------|--------|---------|---------------------------------------------------|
 * | `engine`    | string | `''`    | Path prefix for `worklet.js` + `engine.js`        |
 * | `patch-src` | string | `''`    | URL of the `.pd` patch file to load               |
 * | `signals`   | string | `''`    | Comma-separated `channel:receiver` pairs to route |
 *
 * ### Signals format
 * ```
 * signals="tempo:tempo-recv, volume:vol-recv"
 * ```
 * Each pair subscribes to a Raveling message channel and forwards incoming
 * `content` (as a float) to the named Pure Data receiver.
 *
 * ### Messaging received (per mapping)
 * `{ cmd: any, content: number }` on each configured channel → forwarded to PD.
 */
export class RavelPdSynth extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: inline-flex;
            align-items: center;
            box-sizing: border-box;
        }
        #container {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px 10px;
            background: rgba(0,0,0,0.3);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 4px;
            width: auto;
            height: auto;
        }
        #led {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #444;
            flex-shrink: 0;
            transition: background 0.25s, box-shadow 0.25s;
        }
        #led.loading { background: #FE6810; box-shadow: 0 0 6px #FE6810; }
        #led.ready   { background: #A7FF00; box-shadow: 0 0 6px #A7FF00; }
        #led.error   { background: #FF37A8; box-shadow: 0 0 6px #FF37A8; }
        #lbl {
            font-family: 'Silkscreen', monospace;
            font-size: 0.6rem;
            color: rgba(255,255,255,0.45);
            white-space: nowrap;
            user-select: none;
        }
    `;

    private static readonly componentHtml = `
        <div id="led" class="idle" role="status" aria-live="polite" aria-label="Audio status: idle"></div>
        <span id="lbl">pd-synth</span>
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'engine', 'patch-src', 'signals'];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _ledEl!: HTMLElement;
    private _lblEl!: HTMLElement;

    // ── State ─────────────────────────────────────────────────────────────────

    private _isReady          = false;
    private _engine           = '';
    private _patchSrc         = '';
    private _signalMappings:  SignalMapping[] = [];
    private _audioCtx:        AudioContext | null = null;
    private _workletNode:     AudioWorkletNode | null = null;
    private _audioInitialized = false;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelPdSynth.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelPdSynth.componentHtml;

        this._ledEl = this.container.querySelector<HTMLElement>('#led')!;
        this._lblEl = this.container.querySelector<HTMLElement>('#lbl')!;
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;

        this._updateLabel();
        this._bindSignals();

        document.addEventListener('pointerdown', this._initAudio, { once: true });
        document.addEventListener('click',       this._initAudio, { once: true });
    }

    protected teardown(): void {
        this._isReady = false;

        document.removeEventListener('pointerdown', this._initAudio);
        document.removeEventListener('click',       this._initAudio);

        this._unbindSignals();
        this._closeAudio();

        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (oldValue === newValue) return;

        switch (name) {
            case 'engine':
                this._engine = newValue ?? '';
                break;
            case 'patch-src':
                this._patchSrc = newValue ?? '';
                if (this._isReady) this._updateLabel();
                break;
            case 'signals':
                if (this._isReady) this._unbindSignals();
                this._signalMappings = this._parseSignals(newValue ?? '');
                if (this._isReady) this._bindSignals();
                break;
        }
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    private _initAudio = async (): Promise<void> => {
        if (this._audioInitialized || !this._engine || !this._patchSrc) return;
        this._audioInitialized = true;

        this._setStatus('loading');

        const base       = `sound-engines/${this._engine}`;
        const workletSrc = `${base}/worklet.js`;
        const engineSrc  = `${base}/engine.js`;

        try {
            this._audioCtx  = new AudioContext();
            await this._audioCtx.audioWorklet.addModule(workletSrc);

            this._workletNode = new AudioWorkletNode(
                this._audioCtx, 'pd-synth-processor',
                { outputChannelCount: [2] }
            );
            this._workletNode.connect(this._audioCtx.destination);

            this._workletNode.port.onmessage = (e: MessageEvent) => {
                if ((e.data as { type: string }).type === 'error') {
                    console.error('[ravel-pd-synth] worklet error:', (e.data as { msg: string }).msg);
                    this._setStatus('error');
                }
            };

            // Fetch engine factory source and PD patch in parallel.
            const [engineText, patchBuffer] = await Promise.all([
                fetch(engineSrc).then(r => r.text()),
                fetch(this._patchSrc).then(r => r.arrayBuffer()),
            ]);

            // Extract the factory's variable name before stripping the export line.
            // Emscripten defaults to 'Module'; EXPORT_NAME can override it.
            const exportMatch = engineText.match(/\bexport\s+default\s+([\w$]+)/);
            const exportName  = exportMatch?.[1] ?? 'Module';

            // Strip ES module syntax — the worklet evaluates this as classic JS via
            // new Function(). SINGLE_FILE=1 embeds the WASM as base64, so import.meta.url
            // is never actually used to locate an external file.
            const factorySrc = engineText
                .replace(/^\s*export\s+default\s+[\w$]+;?\s*$/m, '')
                .replace(/\bimport\.meta\.url\b/g, '""')
                .replace(/\bimport\.meta\b/g,      '{}');

            // AudioWorkletGlobalScope has no atob(). Decode embedded WASM base64 on the
            // main thread and pass raw bytes so the worklet can skip the base64 path.
            const b64Match = factorySrc.match(/data:application\/octet-stream;base64,([A-Za-z0-9+/=]+)/);
            let wasmBinary: ArrayBuffer | null = null;
            if (b64Match) {
                const b64str = atob(b64Match[1]);
                const bytes  = new Uint8Array(b64str.length);
                for (let i = 0; i < b64str.length; i++) bytes[i] = b64str.charCodeAt(i);
                wasmBinary = bytes.buffer;
            }

            const patchName = this._patchSrc.split('/').pop() ?? 'patch.pd';
            const transfers = [patchBuffer, ...(wasmBinary ? [wasmBinary] : [])];
            this._workletNode.port.postMessage(
                { type: 'init', factorySrc, exportName, patchName, patchData: patchBuffer, wasmBinary },
                transfers
            );

            this._setStatus('ready');
        } catch (err) {
            console.error('[ravel-pd-synth] audio init failed:', err);
            this._audioInitialized = false;
            this._setStatus('error');
        }
    };

    private _onSignal = (e: Event): void => {
        const { content } = (e as CustomEvent<{ cmd: string; content: unknown }>).detail;
        const mapping = this._signalMappings.find(m => m.channel === e.type);
        if (!mapping || !this._workletNode) return;

        this._workletNode.port.postMessage({
            type: 'send-float',
            recv: mapping.receiver,
            val:  Number(content),
        });
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    private _bindSignals(): void {
        for (const { channel } of this._signalMappings) {
            this.subscribe([channel]);
            this.addEventListener(channel, this._onSignal);
        }
    }

    private _unbindSignals(): void {
        for (const { channel } of this._signalMappings) {
            this.removeEventListener(channel, this._onSignal);
        }
        this.unsubscribe(this._signalMappings.map(m => m.channel));
    }

    private _closeAudio(): void {
        if (this._workletNode) {
            this._workletNode.disconnect();
            this._workletNode = null;
        }
        if (this._audioCtx) {
            void this._audioCtx.close();
            this._audioCtx = null;
        }
        this._audioInitialized = false;
    }

    private _setStatus(status: AudioStatus): void {
        if (!this._isReady) return;
        this._ledEl.className = status;
        this._ledEl.setAttribute('aria-label', `Audio status: ${status}`);
    }

    private _updateLabel(): void {
        if (!this._isReady) return;
        const patchName = this._patchSrc ? (this._patchSrc.split('/').pop() ?? '') : '';
        this._lblEl.textContent = patchName ? `pd · ${patchName}` : 'pd-synth';
    }

    private _parseSignals(value: string): SignalMapping[] {
        return value
            .split(',')
            .map(pair => pair.trim().split(':'))
            .filter(parts => parts.length === 2)
            .map(([channel, receiver]) => ({
                channel:  channel.trim(),
                receiver: receiver.trim(),
            }));
    }
}
