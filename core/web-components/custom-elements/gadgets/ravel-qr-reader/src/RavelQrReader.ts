import { RavelElement } from '../../../../common/RavelElement';

/**
 * Streams the camera into a canvas, uses Html5Qrcode (loaded globally via CDN)
 * to scan for QR codes, and dispatches a `qr-detected` CustomEvent on match.
 *
 * Html5Qrcode requires a light-DOM element with an id — the component appends
 * an off-screen `<div>` to `document.body` while scanning and removes it on stop.
 *
 * ### Attributes
 * | Attribute | Type                      | Default       | Description                          |
 * |-----------|---------------------------|---------------|--------------------------------------|
 * | `autoplay`| boolean                   | false         | Start scanning on connect            |
 * | `facing`  | `environment \| user`     | `environment` | Camera facing mode                   |
 * | `fps`     | number                    | 10            | Scan rate (frames per second)        |
 * | `qrbox`   | `auto \| min \| <number>` | `auto`        | Scanner box size                     |
 *
 * ### Events dispatched (bubbling, composed)
 * | Event         | detail          | Trigger                              |
 * |---------------|-----------------|--------------------------------------|
 * | `qr-detected` | `{ text: string }` | QR code successfully decoded      |
 */
export class RavelQrReader extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: inline-block;
            font-family: inherit;
            user-select: none;
        }
        .wrap {
            display: grid;
            gap: 10px;
            max-width: 520px;
        }
        .controls {
            display: inline-flex;
            gap: 8px;
            align-items: center;
        }
        /* Buttons */
        button {
            appearance: none;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.18);
            border-radius: 8px;
            padding: 6px 14px;
            cursor: pointer;
            font: inherit;
            font-size: 0.85em;
            line-height: 1;
            color: rgba(255,255,255,0.8);
            transition: background 120ms, border-color 120ms, color 120ms;
        }
        button:hover {
            background: rgba(255,255,255,0.14);
            color: #ffffff;
        }
        button[disabled] {
            opacity: 0.35;
            cursor: not-allowed;
        }
        /* Camera stage */
        .stage {
            position: relative;
            width: 100%;
            aspect-ratio: 4 / 3;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 12px;
            overflow: hidden;
            background: #000;
        }
        canvas {
            width: 100%;
            height: 100%;
            display: block;
        }
        /* Hidden video element — html5-qrcode drives the stream */
        video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            opacity: 0;
            pointer-events: none;
        }
        /* Overlay — QR scan animation + emoji flash */
        .overlay {
            position: absolute;
            inset: 0;
            pointer-events: none;
            display: grid;
            place-items: center;
        }
        .emoji {
            font-size: 64px;
            filter: drop-shadow(0 2px 8px rgba(0,0,0,0.6));
            opacity: 0;
            transform: scale(0.9);
            transition: opacity 120ms ease, transform 120ms ease;
        }
        .emoji.show {
            opacity: 1;
            transform: scale(1);
        }
        .hint {
            position: absolute;
            left: 10px;
            bottom: 10px;
            font-size: 11px;
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(0,0,0,0.55);
            border: 1px solid rgba(255,255,255,0.15);
            color: rgba(255,255,255,0.65);
        }
        /* Scan-line animation while active */
        .scanline {
            position: absolute;
            left: 10%;
            right: 10%;
            height: 2px;
            background: linear-gradient(90deg, transparent, #00F0FF, transparent);
            opacity: 0;
            pointer-events: none;
        }
        .stage.scanning .scanline {
            opacity: 0.7;
            animation: rqr-scan 1.8s ease-in-out infinite;
        }
        @keyframes rqr-scan {
            0%   { top: 10%; }
            50%  { top: 85%; }
            100% { top: 10%; }
        }
        /* Result display */
        .result {
            font-size: 0.85em;
            font-family: 'Quantico', monospace;
            padding: 8px 12px;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 8px;
            background: rgba(255,255,255,0.05);
            min-height: 1.4em;
            word-break: break-all;
            color: rgba(255,255,255,0.75);
        }
        .result:empty::before {
            content: '—';
            color: rgba(255,255,255,0.25);
        }
        /* Status row */
        .status {
            font-size: 0.85em;
            color: rgba(255,255,255,0.5);
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: rgba(255,255,255,0.2);
            flex-shrink: 0;
            transition: background 200ms;
        }
        .dot.ready    { background: #A7FF00; }
        .dot.scanning { background: #00F0FF; animation: rqr-dot-pulse 1s ease infinite; }
        .dot.loading  { background: #FE6810; animation: rqr-dot-pulse 1s ease infinite; }
        .dot.error    { background: #FF37A8; }
        @keyframes rqr-dot-pulse {
            0%, 100% { opacity: 0.5; }
            50%       { opacity: 1.0; }
        }
    `;

    private static readonly componentHtml = `
        <div class="wrap">
            <div class="controls">
                <button id="btnStart" type="button">Start</button>
                <button id="btnStop"  type="button" disabled>Stop</button>
                <span class="status">
                    <span class="dot" id="dot"></span>
                    <span id="statusText">idle</span>
                </span>
            </div>
            <div class="stage" id="stage">
                <video id="video" playsinline></video>
                <canvas id="canvas"></canvas>
                <div class="overlay">
                    <div class="emoji" id="emoji" aria-hidden="true">✅</div>
                    <div class="hint">Point camera at a QR code</div>
                </div>
                <div class="scanline" aria-hidden="true"></div>
            </div>
            <div class="result" id="result" aria-live="polite" aria-label="Decoded QR text"></div>
        </div>
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'autoplay', 'facing', 'fps', 'qrbox'];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _btnStart!:     HTMLButtonElement;
    private _btnStop!:      HTMLButtonElement;
    private _dotEl!:        HTMLElement;
    private _statusTextEl!: HTMLElement;
    private _stageEl!:      HTMLElement;
    private _videoEl!:      HTMLVideoElement;
    private _canvasEl!:     HTMLCanvasElement;
    private _ctx!:          CanvasRenderingContext2D;
    private _emojiEl!:      HTMLElement;
    private _resultEl!:     HTMLElement;

    private _isReady = false;

    // ── Scanner state ─────────────────────────────────────────────────────────

    private _html5:        any                                     = null;
    private _regionId:     string | null                           = null;
    private _regionEl:     HTMLElement | null                      = null;
    private _cameraId:     string | null                           = null;
    private _stream:       MediaStream | null                      = null;
    private _raf:          number | null                           = null;
    private _isScanning:   boolean                                 = false;
    private _lastDecoded:  string | null                           = null;
    private _emojiTimeout: ReturnType<typeof setTimeout> | null    = null;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelQrReader.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelQrReader.componentHtml;

        this._btnStart     = this.container.querySelector<HTMLButtonElement>('#btnStart')!;
        this._btnStop      = this.container.querySelector<HTMLButtonElement>('#btnStop')!;
        this._dotEl        = this.container.querySelector<HTMLElement>('#dot')!;
        this._statusTextEl = this.container.querySelector<HTMLElement>('#statusText')!;
        this._stageEl      = this.container.querySelector<HTMLElement>('#stage')!;
        this._videoEl      = this.container.querySelector<HTMLVideoElement>('#video')!;
        this._canvasEl     = this.container.querySelector<HTMLCanvasElement>('#canvas')!;
        this._ctx          = this._canvasEl.getContext('2d', { alpha: false })!;
        this._emojiEl      = this.container.querySelector<HTMLElement>('#emoji')!;
        this._resultEl     = this.container.querySelector<HTMLElement>('#result')!;
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;

        this._btnStart.addEventListener('click', this._onStart);
        this._btnStop.addEventListener('click',  this._onStop);

        this._setStatus('ready', 'ready');
        this._syncUi();
        if (this.hasAttribute('autoplay')) this.start().catch(() => {});
    }

    protected teardown(): void {
        this._isReady = false;

        this._btnStart.removeEventListener('click', this._onStart);
        this._btnStop.removeEventListener('click',  this._onStop);

        this.stop().catch(() => {});
        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        // Config changes (facing, fps, qrbox) take effect on next start.
    }

    // ── Attribute accessors ───────────────────────────────────────────────────

    get facing(): 'environment' | 'user' {
        const v = (this.getAttribute('facing') ?? 'environment').toLowerCase();
        return v === 'user' ? 'user' : 'environment';
    }

    get fps(): number {
        const v = Number(this.getAttribute('fps'));
        return Number.isFinite(v) && v > 0 ? v : 10;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    async start(): Promise<void> {
        if (this._isScanning) return;

        const Html5Qrcode = (window as any).Html5Qrcode;
        if (!Html5Qrcode) {
            this._setStatus('Html5Qrcode missing', 'error');
            throw new Error('Html5Qrcode not found. Include the html5-qrcode script before this element.');
        }

        // html5-qrcode requires a real document element with an id (not shadow DOM).
        if (!this._regionId) {
            this._regionId = `rqr-region-${Math.random().toString(16).slice(2)}`;
            this._regionEl = document.createElement('div');
            this._regionEl.id = this._regionId;
            Object.assign(this._regionEl.style, {
                position: 'fixed', left: '-10000px', top: '0',
                width: '320px', height: '240px',
                opacity: '0', pointerEvents: 'none', overflow: 'hidden',
            });
            document.body.appendChild(this._regionEl);
        }

        this._setStatus('starting camera…', 'loading');
        this._syncUi();

        const devices = await Html5Qrcode.getCameras().catch((err: unknown) => {
            this._setStatus('camera list failed', 'error');
            throw err;
        });

        if (!devices?.length) {
            this._setStatus('no cameras found', 'error');
            throw new Error('No cameras found.');
        }

        const preferred = this.facing === 'environment'
            ? devices.find((d: any) => /back|rear|environment/i.test(d.label))
            : devices.find((d: any) => /front|user|face/i.test(d.label));
        this._cameraId = (preferred ?? devices[0]).id;

        this._html5 = new Html5Qrcode(this._regionId);

        const config: Record<string, unknown> = { fps: this.fps };
        const qrbox = this._getQrboxConfig();
        if (qrbox) config['qrbox'] = qrbox;

        await this._html5.start(
            { deviceId: { exact: this._cameraId } },
            config,
            (text: string) => this._onDecoded(text),
            () => {} // per-frame decode errors are too noisy to surface
        );

        const vid: HTMLVideoElement =
            this._regionEl!.querySelector('video') ??
            this._regionEl!.getElementsByTagName('video')[0];

        if (!vid) {
            this._setStatus('video init failed', 'error');
            throw new Error('html5-qrcode video element not found.');
        }

        this._stream = (vid as any).srcObject as MediaStream | null;
        if (this._stream) {
            this._videoEl.srcObject = this._stream;
            try { await this._videoEl.play(); } catch { /* html5-qrcode already owns it */ }
        }

        this._isScanning = true;
        this._stageEl.classList.add('scanning');
        this._setStatus('scanning', 'scanning');
        this._syncUi();
        this._startDrawLoop();
    }

    async stop(): Promise<void> {
        this._stopDrawLoop();

        if (this._emojiTimeout) { clearTimeout(this._emojiTimeout); this._emojiTimeout = null; }
        this._hideEmoji();

        if (this._html5) {
            try { await this._html5.stop(); }  catch { /* may already be stopped */ }
            try { await this._html5.clear(); } catch {}
            this._html5 = null;
        }

        try { this._videoEl.pause(); } catch {}
        this._videoEl.srcObject = null;

        if (this._stream) {
            try { for (const t of this._stream.getTracks()) t.stop(); } catch {}
            this._stream = null;
        }

        if (this._regionEl?.parentNode) {
            this._regionEl.parentNode.removeChild(this._regionEl);
        }
        this._regionEl  = null;
        this._regionId  = null;
        this._cameraId  = null;
        this._isScanning = false;

        if (this._isReady) {
            this._stageEl.classList.remove('scanning');
            this._setStatus('ready', 'ready');
            this._syncUi();
        }
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private _onStart = (): void => { this.start().catch(() => {}); };
    private _onStop  = (): void => { this.stop().catch(() => {}); };

    private _onDecoded(text: string): void {
        if (text === this._lastDecoded) return;
        this._lastDecoded = text;
        this._resultEl.textContent = text;
        this._showEmoji();
        this.dispatchEvent(new CustomEvent('qr-detected', {
            bubbles: true, composed: true, detail: { text },
        }));
    }

    private _getQrboxConfig(): { width: number; height: number } | undefined {
        const v = (this.getAttribute('qrbox') ?? 'auto').toLowerCase();
        if (v === 'auto') return undefined;

        const rect   = this._canvasEl.getBoundingClientRect();
        const minDim = Math.max(1, Math.floor(Math.min(rect.width, rect.height)));

        if (v === 'min') {
            const size = Math.floor(minDim * 0.6);
            return { width: size, height: size };
        }
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) return { width: Math.floor(n), height: Math.floor(n) };
        return undefined;
    }

    private _startDrawLoop(): void {
        this._stopDrawLoop();

        const resize = (): void => {
            const rect = this._canvasEl.getBoundingClientRect();
            const dpr  = window.devicePixelRatio || 1;
            const w = Math.max(1, Math.floor(rect.width  * dpr));
            const h = Math.max(1, Math.floor(rect.height * dpr));
            if (this._canvasEl.width !== w || this._canvasEl.height !== h) {
                this._canvasEl.width  = w;
                this._canvasEl.height = h;
            }
        };

        const loop = (): void => {
            if (!this._isScanning) return;
            resize();
            if (this._videoEl.readyState >= 2) {
                try { this._ctx.drawImage(this._videoEl, 0, 0, this._canvasEl.width, this._canvasEl.height); }
                catch { /* ignore occasional draw failures */ }
            }
            this._raf = requestAnimationFrame(loop);
        };

        this._raf = requestAnimationFrame(loop);
    }

    private _stopDrawLoop(): void {
        if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    }

    private _showEmoji(): void {
        this._emojiEl.classList.add('show');
        if (this._emojiTimeout) clearTimeout(this._emojiTimeout);
        this._emojiTimeout = setTimeout(() => this._hideEmoji(), 900);
    }

    private _hideEmoji(): void {
        this._emojiEl.classList.remove('show');
    }

    private _syncUi(): void {
        if (!this._isReady) return;
        this._btnStart.disabled = this._isScanning;
        this._btnStop.disabled  = !this._isScanning;
    }

    private _setStatus(text: string, dotClass: 'ready' | 'scanning' | 'loading' | 'error'): void {
        if (!this._isReady) return;
        this._statusTextEl.textContent = text;
        this._dotEl.classList.remove('ready', 'scanning', 'loading', 'error');
        this._dotEl.classList.add(dotClass);
    }
}
