import { RavelElement } from '../../../../common/RavelElement';

const VISION_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const WASM_URL   = `${VISION_URL}/wasm`;
const MODEL_URL  = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const HAND_CONNECTIONS: [number, number][] = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20],
    [5,9],[9,13],[13,17],
];

const DEFAULT_LANDMARK = 8;
const PINCH_ENTER_DIST = 0.16;
const PINCH_EXIT_DIST  = 0.24;
const PINCH_FLASH_MS   = 200;
const MAX_HAND_DRIFT   = 0.45;

type MidiControl = { kind: 'cc'; cc: number } | { kind: 'pb' };
type MapKey = 'left-x' | 'left-y' | 'left-pinch' | 'right-x' | 'right-y' | 'right-pinch';
type HandSlot = 0 | 1;

interface FeatureMap {
    control:   MidiControl;
    invert:    boolean;
    lastVal:   number;
    barFillEl: HTMLElement | null;
    barValEl:  HTMLElement | null;
}

const MAP_KEYS: MapKey[] = ['left-x', 'left-y', 'left-pinch', 'right-x', 'right-y', 'right-pinch'];

const MAP_LABELS: Record<MapKey, string> = {
    'left-x':     'L.X',
    'left-y':     'L.Y',
    'left-pinch': 'L.PINCH',
    'right-x':    'R.X',
    'right-y':    'R.Y',
    'right-pinch':'R.PINCH',
};

function parseControl(raw: string): { control: MidiControl | null; invert: boolean } {
    if (!raw) return { control: null, invert: false };
    const invert = raw.startsWith('!');
    const s = (invert ? raw.slice(1) : raw).trim();
    if (s.startsWith('cc:')) {
        const n = parseInt(s.slice(3));
        if (!isNaN(n) && n >= 0 && n <= 127) return { control: { kind: 'cc', cc: n }, invert };
    }
    if (s === 'pitch-bend') return { control: { kind: 'pb' }, invert };
    return { control: null, invert };
}

/**
 * Camera-based hand gesture gadget that maps MediaPipe landmark features to
 * MIDI controls. Place a `<ravel-midi-broker>` on the page and point `broker`
 * at its label. Declare mappings with `map-{left|right}-{x|y|pinch}` attributes.
 *
 * ### Attributes
 * | Attribute         | Type                  | Default               | Description                              |
 * |-------------------|-----------------------|-----------------------|------------------------------------------|
 * | `autoplay`        | boolean               | false                 | Start tracking on connect                |
 * | `facing`          | `user\|environment`   | `user`                | Camera facing mode                       |
 * | `broker`          | string                | `'ravel-midi-broker'` | Pub/sub label of the MIDI broker         |
 * | `channel`         | number (0-15)         | `0`                   | MIDI channel                             |
 * | `landmark`        | number (0-20)         | `8`                   | Landmark tracked for X/Y (8=index tip)   |
 * | `map-left-x`      | string                | `''`                  | Left hand X → `cc:N` or `pitch-bend`    |
 * | `map-left-y`      | string                | `''`                  | Left hand Y → `cc:N` or `pitch-bend`    |
 * | `map-left-pinch`  | string                | `''`                  | Left pinch → `cc:N` or `pitch-bend`     |
 * | `map-right-x`     | string                | `''`                  | Right hand X → `cc:N` or `pitch-bend`   |
 * | `map-right-y`     | string                | `''`                  | Right hand Y → `cc:N` or `pitch-bend`   |
 * | `map-right-pinch` | string                | `''`                  | Right pinch → `cc:N` or `pitch-bend`    |
 *
 * Prefix the control value with `!` to invert the range, e.g. `map-right-y="!cc:11"`
 * maps hand-up (y=0) to CC value 127 instead of 0.
 *
 * ### Events dispatched (bubbling, composed)
 * | Event         | detail                        | Trigger              |
 * |---------------|-------------------------------|----------------------|
 * | `pinch-start` | `{ slot: 0|1, hand: string }` | Pinch gesture begins |
 * | `pinch-end`   | `{ slot: 0|1, hand: string }` | Pinch gesture ends   |
 */
export class RavelMidiGesture extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: inline-block;
            user-select: none;
            font-family: var(--ravel-font, 'Silkscreen', monospace);
        }
        .wrap {
            display: inline-grid;
            gap: 4px;
        }
        .btn-hand {
            appearance: none;
            background: rgba(255,255,255,0.08);
            border: 1px solid rgba(255,255,255,0.18);
            border-radius: 10px;
            padding: 0;
            cursor: pointer;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            color: rgba(255,255,255,0.7);
            transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
        }
        .btn-hand:hover {
            background: rgba(255,255,255,0.16);
            color: rgba(255,255,255,0.95);
        }
        .btn-hand.open {
            background: rgba(255,79,179,0.14);
            border-color: rgba(255,79,179,0.55);
            color: #FF4FB3;
        }
        .btn-hand.loading {
            animation: rmg-pulse 1s ease infinite;
        }
        .btn-hand.error {
            border-color: rgba(255,55,168,0.65);
            color: #FF37A8;
        }
        .btn-hand::after {
            content: '';
            position: absolute;
            bottom: 5px;
            right: 5px;
            width: 5px;
            height: 5px;
            border-radius: 50%;
            background: transparent;
            transition: background 200ms ease;
        }
        .btn-hand.running::after { background: #FF4FB3; }
        .btn-hand.loading::after { background: #FE6810; }
        .btn-hand.error::after   { background: #FF37A8; }
        @keyframes rmg-pulse {
            0%, 100% { opacity: 0.6; }
            50%       { opacity: 1;   }
        }
        .stage {
            display: none;
            position: relative;
            width: 100%;
            aspect-ratio: 4 / 3;
            border: 1px solid rgba(255,79,179,0.22);
            border-radius: 10px;
            overflow: hidden;
            background: #000;
        }
        .stage.open { display: block; }
        video {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        video.mirrored { transform: scaleX(-1); }
        canvas {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
        }
        .map-strip {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(0,0,0,0.75);
            backdrop-filter: blur(4px);
            padding: 5px 8px 6px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            pointer-events: none;
        }
        .map-strip:empty { display: none; }
        .map-row {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .map-label {
            font-size: 7px;
            letter-spacing: 0.06em;
            color: rgba(255,255,255,0.45);
            min-width: 86px;
            text-align: right;
            white-space: nowrap;
        }
        .map-bar {
            flex: 1;
            height: 3px;
            background: rgba(255,255,255,0.08);
            border-radius: 2px;
            overflow: hidden;
        }
        .map-fill {
            height: 100%;
            background: #A7FF00;
            border-radius: 2px;
            width: 0%;
        }
        .map-fill.pb { background: #00F0FF; }
        .map-val {
            font-size: 7px;
            letter-spacing: 0.04em;
            color: rgba(255,255,255,0.38);
            min-width: 32px;
            text-align: right;
            white-space: nowrap;
        }
        .controls { display: none; }
    `;

    private static readonly componentHtml = `
        <div class="wrap">
            <button id="btnToggle" class="btn-hand" type="button" title="Toggle MIDI gesture" aria-label="Toggle MIDI gesture" aria-pressed="false">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 11V8a2 2 0 0 0-4 0v3M14 11V6a2 2 0 0 0-4 0v5M10 11V5a2 2 0 0 0-4 0v8l-2-2a2 2 0 0 0-2.83 2.83L4 16.6A6 6 0 0 0 10 20h4a6 6 0 0 0 6-6v-3a2 2 0 0 0-4 0"/>
                </svg>
            </button>
            <div class="stage" id="stage" role="img" aria-label="Hand gesture camera feed">
                <video id="video" playsinline></video>
                <canvas id="canvas" aria-hidden="true"></canvas>
                <div class="map-strip" id="map-strip" aria-live="polite" aria-label="MIDI mapping values"></div>
            </div>
            <div class="controls">
                <button id="btnStart" type="button">Start</button>
                <button id="btnStop"  type="button" disabled>Stop</button>
                <span><span id="dot"></span><span id="statusText">idle</span></span>
            </div>
        </div>
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'autoplay', 'facing', 'broker', 'channel', 'landmark',
            'map-left-x', 'map-left-y', 'map-left-pinch',
            'map-right-x', 'map-right-y', 'map-right-pinch',
        ];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _btnToggle!:    HTMLButtonElement;
    private _stageEl!:      HTMLElement;
    private _btnStart!:     HTMLButtonElement;
    private _btnStop!:      HTMLButtonElement;
    private _dotEl!:        HTMLElement;
    private _statusTextEl!: HTMLElement;
    private _videoEl!:      HTMLVideoElement;
    private _canvasEl!:     HTMLCanvasElement;
    private _ctx!:          CanvasRenderingContext2D;
    private _mapStripEl!:   HTMLElement;

    private _isReady = false;

    // ── Config ────────────────────────────────────────────────────────────────

    private _broker        = 'ravel-midi-broker';
    private _midiChannel   = 0;
    private _landmarkIndex = DEFAULT_LANDMARK;

    // ── Mapping state ─────────────────────────────────────────────────────────

    private _mapAttr: Record<MapKey, string> = {
        'left-x': '', 'left-y': '', 'left-pinch': '',
        'right-x': '', 'right-y': '', 'right-pinch': '',
    };

    private _maps: Record<MapKey, FeatureMap | null> = {
        'left-x': null, 'left-y': null, 'left-pinch': null,
        'right-x': null, 'right-y': null, 'right-pinch': null,
    };

    // ── Toggle / camera state ─────────────────────────────────────────────────

    private _isOpen    = false;
    private _isRunning = false;

    // ── MediaPipe state ───────────────────────────────────────────────────────

    private _landmarker:    any                = null;
    private _stream:        MediaStream | null = null;
    private _raf:           number | null      = null;
    private _lastVideoTime: number             = -1;

    // ── Pinch + slot state ────────────────────────────────────────────────────

    private _pinchState:      [boolean, boolean] = [false, false];
    private _pinchFlashUntil: number             = 0;
    private _slotHandPos:     [{ x: number; y: number } | null, { x: number; y: number } | null] = [null, null];
    private _slotMatch:       [number | null, number | null] = [null, null];

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelMidiGesture.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelMidiGesture.componentHtml;

        this._btnToggle    = this.container.querySelector<HTMLButtonElement>('#btnToggle')!;
        this._stageEl      = this.container.querySelector<HTMLElement>('#stage')!;
        this._btnStart     = this.container.querySelector<HTMLButtonElement>('#btnStart')!;
        this._btnStop      = this.container.querySelector<HTMLButtonElement>('#btnStop')!;
        this._dotEl        = this.container.querySelector<HTMLElement>('#dot')!;
        this._statusTextEl = this.container.querySelector<HTMLElement>('#statusText')!;
        this._videoEl      = this.container.querySelector<HTMLVideoElement>('#video')!;
        this._canvasEl     = this.container.querySelector<HTMLCanvasElement>('#canvas')!;
        this._ctx          = this._canvasEl.getContext('2d')!;
        this._mapStripEl   = this.container.querySelector<HTMLElement>('#map-strip')!;

        this._rebuildMappings();
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;

        this._btnToggle.addEventListener('click', this._onToggle);
        this._btnStart.addEventListener('click',  this._onStart);
        this._btnStop.addEventListener('click',   this._onStop);

        this._syncUi();
        if (this.hasAttribute('autoplay')) this.open().catch(console.error);
    }

    protected teardown(): void {
        this._isReady = false;

        this._btnToggle.removeEventListener('click', this._onToggle);
        this._btnStart.removeEventListener('click',  this._onStart);
        this._btnStop.removeEventListener('click',   this._onStop);

        this.stop();
        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        switch (name) {
            case 'broker':
                this._broker = newValue ?? 'ravel-midi-broker';
                break;
            case 'channel':
                this._midiChannel = Math.max(0, Math.min(15, parseInt(newValue ?? '0') || 0));
                break;
            case 'landmark':
                this._landmarkIndex = parseInt(newValue ?? '') || DEFAULT_LANDMARK;
                break;
            case 'map-left-x':
            case 'map-left-y':
            case 'map-left-pinch':
            case 'map-right-x':
            case 'map-right-y':
            case 'map-right-pinch': {
                const key = name.slice(4) as MapKey; // strip 'map-'
                this._mapAttr[key] = newValue ?? '';
                this._rebuildMappings();
                break;
            }
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    async open(): Promise<void> {
        if (this._isOpen) return;
        this._isOpen = true;
        this._stageEl.classList.add('open');
        this._btnToggle.setAttribute('aria-pressed', 'true');
        this._syncUi();
        await this.start();
    }

    close(): void {
        if (!this._isOpen) return;
        this._isOpen = false;
        this._stageEl.classList.remove('open');
        this._btnToggle.setAttribute('aria-pressed', 'false');
        this.stop();
    }

    async start(): Promise<void> {
        if (this._isRunning) return;

        try {
            if (!this._landmarker) {
                this._setStatus('loading model…', 'loading');
                this._syncUi(true);

                const { HandLandmarker, FilesetResolver } = await import(/* @vite-ignore */ VISION_URL);
                const vision = await FilesetResolver.forVisionTasks(WASM_URL);
                this._landmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
                    runningMode: 'VIDEO',
                    numHands: 2,
                });
            }

            this._setStatus('starting camera…', 'loading');

            this._stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: this.facing, width: 640, height: 480 },
            });

            this._videoEl.srcObject = this._stream;
            this._videoEl.classList.toggle('mirrored', this.facing === 'user');

            await this._videoEl.play();

            this._isRunning    = true;
            this._lastVideoTime = -1;
            this._setStatus('running', 'running');
            this._syncUi();
            this._raf = requestAnimationFrame(this._detect);
        } catch (err) {
            this._setStatus(err instanceof Error ? err.message : 'error', 'error');
            this._isOpen = false;
            this._stageEl.classList.remove('open');
            this._btnToggle.setAttribute('aria-pressed', 'false');
            this._syncUi();
            throw err;
        }
    }

    stop(): void {
        this._isRunning = false;
        if (this._raf !== null) { cancelAnimationFrame(this._raf); this._raf = null; }

        try { this._videoEl.pause(); } catch { /* ignore */ }
        this._videoEl.srcObject = null;

        if (this._stream) {
            try { for (const t of this._stream.getTracks()) t.stop(); } catch { /* ignore */ }
            this._stream = null;
        }

        if (this._isReady) {
            const { width, height } = this._canvasEl;
            this._ctx.clearRect(0, 0, width, height);
            this._syncUi();
        }

        // Reset pinch state and last MIDI values
        this._pinchState      = [false, false];
        this._slotHandPos     = [null, null];
        this._slotMatch       = [null, null];
        for (const key of MAP_KEYS) {
            const m = this._maps[key];
            if (m) { m.lastVal = -1; }
        }
    }

    // ── Detection loop ────────────────────────────────────────────────────────

    private _detect = (): void => {
        if (!this._isRunning) return;

        this._resizeCanvas();

        if (this._videoEl.readyState >= 2 && this._videoEl.currentTime !== this._lastVideoTime) {
            this._lastVideoTime = this._videoEl.currentTime;
            const results = this._landmarker.detectForVideo(this._videoEl, Date.now());
            this._updateSlotMatch(results.landmarks ?? []);
            this._drawFrame(results);
            this._emitMidi(results);
        }

        this._raf = requestAnimationFrame(this._detect);
    };

    private _resizeCanvas(): void {
        const rect = this._canvasEl.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;
        const w = Math.max(1, Math.floor(rect.width  * dpr));
        const h = Math.max(1, Math.floor(rect.height * dpr));
        if (this._canvasEl.width !== w || this._canvasEl.height !== h) {
            this._canvasEl.width  = w;
            this._canvasEl.height = h;
        }
    }

    // ── Drawing ───────────────────────────────────────────────────────────────

    private _drawFrame(results: any): void {
        const allHands: any[][] = results.landmarks ?? [];
        const w = this._canvasEl.width;
        const h = this._canvasEl.height;
        this._ctx.clearRect(0, 0, w, h);

        const slotOf = new Map<number, HandSlot>();
        for (let slot = 0; slot <= 1; slot++) {
            const idx = this._slotMatch[slot];
            if (idx !== null) slotOf.set(idx, slot as HandSlot);
        }

        for (let i = 0; i < allHands.length; i++) {
            this._drawSkeleton(allHands[i], w, h, slotOf.get(i) ?? 0);
        }

        // MIDI label
        this._ctx.font = `${Math.max(10, h * 0.04)}px 'Silkscreen', monospace`;
        this._ctx.fillStyle = 'rgba(255,79,179,0.55)';
        this._ctx.textAlign = 'left';
        this._ctx.fillText('MIDI', 8, Math.max(14, h * 0.05));
    }

    private _drawSkeleton(landmarks: any[], w: number, h: number, slot: HandSlot): void {
        const px = (lm: any) => (this.facing === 'user' ? 1 - lm.x : lm.x) * w;
        const py = (lm: any) => lm.y * h;

        this._ctx.strokeStyle = 'rgba(0,240,255,0.8)';
        this._ctx.lineWidth   = 2;
        for (const [a, b] of HAND_CONNECTIONS) {
            this._ctx.beginPath();
            this._ctx.moveTo(px(landmarks[a]), py(landmarks[a]));
            this._ctx.lineTo(px(landmarks[b]), py(landmarks[b]));
            this._ctx.stroke();
        }

        this._ctx.fillStyle = 'rgba(254,104,16,0.9)';
        for (const lm of landmarks) {
            this._ctx.beginPath();
            this._ctx.arc(px(lm), py(lm), 3, 0, Math.PI * 2);
            this._ctx.fill();
        }

        // Pinch proximity line
        const thumbTip  = landmarks[4];
        const indexTip  = landmarks[8];
        if (thumbTip && indexTip) {
            const wrist     = landmarks[0];
            const middleMCP = landmarks[9];
            const handSpan  = Math.hypot(middleMCP.x - wrist.x, middleMCP.y - wrist.y) || 1;
            const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y) / handSpan;
            const proximity = 1 - Math.min(1, Math.max(0,
                (pinchDist - PINCH_ENTER_DIST) / (PINCH_EXIT_DIST - PINCH_ENTER_DIST)
            ));
            if (proximity > 0) {
                const lineColor = this._pinchState[slot]
                    ? `rgba(167,255,0,${0.5 + proximity * 0.5})`
                    : `rgba(254,104,16,${proximity * 0.9})`;
                this._ctx.strokeStyle = lineColor;
                this._ctx.lineWidth   = 2 + proximity * 2;
                this._ctx.beginPath();
                this._ctx.moveTo(px(thumbTip), py(thumbTip));
                this._ctx.lineTo(px(indexTip), py(indexTip));
                this._ctx.stroke();
            }
        }

        // Tracked landmark dot — color reflects MIDI mapping state
        const tip = landmarks[this._landmarkIndex];
        if (tip) {
            const hand      = slot === 0 ? 'left' : 'right';
            const hasMidi   = !!(this._maps[`${hand}-x` as MapKey] || this._maps[`${hand}-y` as MapKey] || this._maps[`${hand}-pinch` as MapKey]);
            const flashing  = Date.now() < this._pinchFlashUntil;
            const dotColor  = flashing                  ? '#FFFFFF'
                            : this._pinchState[slot]    ? '#A7FF00'
                            : hasMidi                   ? '#FF4FB3'
                            :                             '#FF37A8';
            const dotRadius = flashing ? 12 : 8;

            this._ctx.fillStyle = dotColor;
            this._ctx.beginPath();
            this._ctx.arc(px(tip), py(tip), dotRadius, 0, Math.PI * 2);
            this._ctx.fill();

            this._ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            this._ctx.lineWidth   = flashing ? 2.5 : 1.5;
            this._ctx.beginPath();
            this._ctx.arc(px(tip), py(tip), dotRadius, 0, Math.PI * 2);
            this._ctx.stroke();
        }
    }

    // ── Hand-to-slot assignment (left/right in screen space) ──────────────────

    private _updateSlotMatch(allHands: any[][]): void {
        const matched: [number | null, number | null] = [null, null];
        const used = new Set<number>();

        for (let slot = 0; slot <= 1; slot++) {
            const last = this._slotHandPos[slot];
            if (!last) continue;
            let bestDist = MAX_HAND_DRIFT;
            let bestIdx  = -1;
            for (let h = 0; h < allHands.length; h++) {
                if (used.has(h)) continue;
                const lm = allHands[h][this._landmarkIndex];
                if (!lm) continue;
                const nx   = this.facing === 'user' ? 1 - lm.x : lm.x;
                const dist = Math.hypot(nx - last.x, lm.y - last.y);
                if (dist < bestDist) { bestDist = dist; bestIdx = h; }
            }
            if (bestIdx >= 0) { matched[slot] = bestIdx; used.add(bestIdx); }
        }

        const unmatched = allHands
            .map((lms, i) => ({ lms, i }))
            .filter(({ i }) => !used.has(i))
            .sort((a, b) => {
                const lmA = a.lms[this._landmarkIndex];
                const lmB = b.lms[this._landmarkIndex];
                const nxA = lmA ? (this.facing === 'user' ? 1 - lmA.x : lmA.x) : 0.5;
                const nxB = lmB ? (this.facing === 'user' ? 1 - lmB.x : lmB.x) : 0.5;
                return nxA - nxB;
            });

        for (const { i } of unmatched) {
            for (let slot = 0; slot <= 1; slot++) {
                if (matched[slot] === null) { matched[slot] = i; break; }
            }
        }

        for (let slot = 0; slot <= 1; slot++) {
            const idx = matched[slot];
            if (idx !== null) {
                const lm = allHands[idx][this._landmarkIndex];
                if (lm) {
                    const nx = this.facing === 'user' ? 1 - lm.x : lm.x;
                    this._slotHandPos[slot] = { x: nx, y: lm.y };
                }
            } else {
                this._slotHandPos[slot] = null;
            }
        }

        this._slotMatch = matched;
    }

    // ── MIDI output ───────────────────────────────────────────────────────────

    private _emitMidi(results: any): void {
        const allHands: any[][] = results.landmarks ?? [];

        if (!allHands.length) {
            this._slotHandPos = [null, null];
            return;
        }

        for (let slot = 0; slot <= 1; slot++) {
            const hand = slot === 0 ? 'left' : 'right';
            const idx  = this._slotMatch[slot];
            if (idx === null) continue;

            const landmarks = allHands[idx];

            const lm = landmarks[this._landmarkIndex];
            if (lm) {
                const nx = this.facing === 'user' ? 1 - lm.x : lm.x;
                this._applyMapping(`${hand}-x` as MapKey, nx);
                this._applyMapping(`${hand}-y` as MapKey, lm.y);
            }

            const pinchVal = this._computePinch(landmarks, slot as HandSlot);
            this._applyMapping(`${hand}-pinch` as MapKey, pinchVal);
        }
    }

    private _computePinch(landmarks: any[], slot: HandSlot): number {
        const thumbTip  = landmarks[4];
        const indexTip  = landmarks[8];
        const wrist     = landmarks[0];
        const middleMCP = landmarks[9];
        if (!thumbTip || !indexTip || !wrist || !middleMCP) return 0;

        const handSpan  = Math.hypot(middleMCP.x - wrist.x, middleMCP.y - wrist.y) || 1;
        const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y) / handSpan;

        const continuous = 1 - Math.min(1, Math.max(0,
            (pinchDist - PINCH_ENTER_DIST) / (PINCH_EXIT_DIST - PINCH_ENTER_DIST)
        ));

        const wasPinching = this._pinchState[slot];
        const threshold   = wasPinching ? PINCH_EXIT_DIST : PINCH_ENTER_DIST;
        const nowPinching = pinchDist < threshold;

        if (!wasPinching && nowPinching) {
            this._pinchState[slot]  = true;
            this._pinchFlashUntil   = Date.now() + PINCH_FLASH_MS;
            const hand = slot === 0 ? 'left' : 'right';
            this.dispatchEvent(new CustomEvent('pinch-start', {
                bubbles: true, composed: true, detail: { slot, hand },
            }));
        } else if (wasPinching && !nowPinching) {
            this._pinchState[slot] = false;
            const hand = slot === 0 ? 'left' : 'right';
            this.dispatchEvent(new CustomEvent('pinch-end', {
                bubbles: true, composed: true, detail: { slot, hand },
            }));
        }

        return continuous;
    }

    private _applyMapping(key: MapKey, rawValue: number): void {
        const map = this._maps[key];
        if (!map) return;

        const v = map.invert ? 1 - rawValue : rawValue;

        if (map.control.kind === 'cc') {
            const midiVal = Math.round(v * 127);
            if (midiVal === map.lastVal) return;
            map.lastVal = midiVal;
            this.sendMessage(this._broker, 'send', {
                type: 'cc',
                channel: this._midiChannel,
                controller: map.control.cc,
                value: midiVal,
            });
            if (map.barFillEl) map.barFillEl.style.width = `${v * 100}%`;
            if (map.barValEl)  map.barValEl.textContent  = String(midiVal);
        } else {
            const midiVal = Math.round(v * 16383) - 8192;
            if (midiVal === map.lastVal) return;
            map.lastVal = midiVal;
            this.sendMessage(this._broker, 'send', {
                type: 'pitch-bend',
                channel: this._midiChannel,
                value: midiVal,
            });
            if (map.barFillEl) map.barFillEl.style.width = `${v * 100}%`;
            if (map.barValEl)  map.barValEl.textContent  = String(midiVal);
        }
    }

    // ── Mappings ──────────────────────────────────────────────────────────────

    private _rebuildMappings(): void {
        for (const key of MAP_KEYS) {
            const { control, invert } = parseControl(this._mapAttr[key]);
            const prev    = this._maps[key];
            const lastVal = (prev?.control?.kind === control?.kind) ? prev!.lastVal : -1;
            this._maps[key] = control ? { control, invert, lastVal, barFillEl: null, barValEl: null } : null;
        }

        if (!this._mapStripEl) return;

        this._mapStripEl.innerHTML = '';
        for (const key of MAP_KEYS) {
            const map = this._maps[key];
            if (!map) continue;
            const ctrlLabel = map.control.kind === 'cc' ? `CC:${map.control.cc}` : 'PB';
            const invMark   = map.invert ? ' !' : '  ';
            const row = document.createElement('div');
            row.className = 'map-row';
            row.innerHTML = `
                <span class="map-label">${MAP_LABELS[key]}${invMark}→ ${ctrlLabel}</span>
                <div class="map-bar"><div class="map-fill${map.control.kind === 'pb' ? ' pb' : ''}"></div></div>
                <span class="map-val">--</span>
            `;
            map.barFillEl = row.querySelector<HTMLElement>('.map-fill');
            map.barValEl  = row.querySelector<HTMLElement>('.map-val');
            this._mapStripEl.appendChild(row);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    get facing(): 'user' | 'environment' {
        const v = this.getAttribute('facing') ?? 'user';
        return v === 'environment' ? 'environment' : 'user';
    }

    private _onToggle = (): void => {
        if (this._isOpen) this.close();
        else              this.open().catch(console.error);
    };

    private _onStart = (): void => { this.start().catch(console.error); };
    private _onStop  = (): void => { this.stop(); };

    private _syncUi(loading = false): void {
        if (!this._isReady) return;
        this._btnStart.disabled = this._isRunning || loading;
        this._btnStop.disabled  = !this._isRunning;
        this._btnToggle.classList.toggle('open',    this._isOpen);
        this._btnToggle.classList.toggle('loading', loading);
        this._btnToggle.classList.toggle('running', this._isRunning);
    }

    private _setStatus(text: string, dotClass: 'ready' | 'running' | 'loading' | 'error'): void {
        if (!this._isReady) return;
        this._statusTextEl.textContent = text;
        this._dotEl.className = dotClass;
        this._btnToggle.classList.remove('ready', 'running', 'loading', 'error');
        this._btnToggle.classList.add(dotClass);
    }
}
