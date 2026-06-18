import { RavelElement } from '../../../../common/RavelElement';

const VISION_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const WASM_URL   = `${VISION_URL}/wasm`;
const MODEL_URL  = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// MediaPipe hand skeleton connections (pairs of landmark indices).
const HAND_CONNECTIONS: [number, number][] = [
    [0,1],[1,2],[2,3],[3,4],           // thumb
    [0,5],[5,6],[6,7],[7,8],           // index
    [0,9],[9,10],[10,11],[11,12],      // middle
    [0,13],[13,14],[14,15],[15,16],    // ring
    [0,17],[17,18],[18,19],[19,20],    // pinky
    [5,9],[9,13],[13,17],              // palm arch
];

const DEFAULT_LANDMARK = 8;   // index finger tip

// Target playfield size for arm coordinate mapping.
const PLAYFIELD_W = 640;
const PLAYFIELD_H = 360;

// Pinch gesture — distance normalised by wrist→middle-MCP span (camera-distance independent).
const PINCH_ENTER_DIST = 0.16;
const PINCH_EXIT_DIST  = 0.24;   // wider for hysteresis
const PINCH_FLASH_MS   = 200;

// Hand persistence: re-match a hand to its slot if it moved less than this.
const MAX_HAND_DRIFT = 0.45;

/**
 * Streams the camera, runs MediaPipe hand landmark detection, and draws a
 * skeleton overlay on a canvas. Optionally drives a `ravel-control-arm`
 * element via `arm-id` / `arm-id-right`, or broadcasts raw hand data on a
 * signal channel via `signal-out`.
 *
 * ### Attributes
 * | Attribute       | Type                    | Default  | Description                              |
 * |-----------------|-------------------------|----------|------------------------------------------|
 * | `autoplay`      | boolean                 | false    | Start tracking on connect                |
 * | `facing`        | `user \| environment`   | `user`   | Camera facing mode                       |
 * | `arm-id`        | string                  | `''`     | Element id to drive with left-hand data  |
 * | `arm-id-right`  | string                  | `''`     | Element id to drive with right-hand data |
 * | `signal-out`    | string                  | `''`     | Message channel for raw hand data        |
 * | `landmark`      | number                  | `8`      | MediaPipe landmark index to track        |
 *
 * ### Events dispatched (bubbling, composed)
 * | Event         | detail          | Trigger                     |
 * |---------------|-----------------|-----------------------------|
 * | `pinch-start` | `{ slot: 0|1 }` | Pinch gesture begins        |
 * | `pinch-end`   | `{ slot: 0|1 }` | Pinch gesture ends          |
 */
export class RavelHandTracker extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: inline-block;
            user-select: none;
        }
        .wrap {
            display: inline-grid;
            gap: 4px;
        }
        /* Toggle button */
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
            background: rgba(167,255,0,0.12);
            border-color: rgba(167,255,0,0.55);
            color: #A7FF00;
        }
        .btn-hand.loading {
            animation: rht-pulse 1s ease infinite;
        }
        .btn-hand.error {
            border-color: rgba(255,55,168,0.65);
            color: #FF37A8;
        }
        /* Tiny status dot in the lower-right corner of the button */
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
        .btn-hand.running::after { background: #A7FF00; }
        .btn-hand.loading::after { background: #FE6810; }
        .btn-hand.error::after   { background: #FF37A8; }
        @keyframes rht-pulse {
            0%, 100% { opacity: 0.6; }
            50%       { opacity: 1;   }
        }
        /* Camera preview — hidden until open */
        .stage {
            display: none;
            position: relative;
            width: 100%;
            aspect-ratio: 4 / 3;
            border: 1px solid rgba(255,255,255,0.12);
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
        /* Controls kept in DOM for programmatic use but never shown */
        .controls { display: none; }
    `;

    private static readonly componentHtml = `
        <div class="wrap">
            <button id="btnToggle" class="btn-hand" type="button" title="Toggle hand tracking" aria-label="Toggle hand tracking">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 11V8a2 2 0 0 0-4 0v3M14 11V6a2 2 0 0 0-4 0v5M10 11V5a2 2 0 0 0-4 0v8l-2-2a2 2 0 0 0-2.83 2.83L4 16.6A6 6 0 0 0 10 20h4a6 6 0 0 0 6-6v-3a2 2 0 0 0-4 0"/>
                </svg>
            </button>
            <div class="stage" id="stage">
                <video id="video" playsinline></video>
                <canvas id="canvas"></canvas>
            </div>
            <div class="controls">
                <button id="btnStart" type="button">Start</button>
                <button id="btnStop"  type="button" disabled>Stop</button>
                <span class="status">
                    <span class="dot" id="dot"></span>
                    <span id="statusText">idle</span>
                </span>
            </div>
        </div>
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes,
            'autoplay', 'facing', 'arm-id', 'arm-id-right', 'signal-out', 'landmark'];
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

    private _isReady = false;

    // ── Config ────────────────────────────────────────────────────────────────

    private _armId:         string = '';
    private _armIdRight:    string = '';
    private _signalOut:     string = '';
    private _landmarkIndex: number = DEFAULT_LANDMARK;

    // ── Toggle / camera state ─────────────────────────────────────────────────

    private _isOpen:    boolean = false;
    private _isRunning: boolean = false;

    // ── MediaPipe state ───────────────────────────────────────────────────────

    private _landmarker:     any             = null;
    private _stream:         MediaStream | null = null;
    private _raf:            number | null   = null;
    private _lastVideoTime:  number          = -1;

    // ── Pinch detection state (indexed by slot: 0=left, 1=right) ─────────────

    private _pinchState:      [boolean, boolean]                                       = [false, false];
    private _pinchFlashUntil: number                                                   = 0;
    private _slotHandPos:     [{ x: number; y: number } | null, { x: number; y: number } | null] = [null, null];
    private _slotMatch:       [number | null, number | null]                           = [null, null];

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelHandTracker.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelHandTracker.componentHtml;

        this._btnToggle    = this.container.querySelector<HTMLButtonElement>('#btnToggle')!;
        this._stageEl      = this.container.querySelector<HTMLElement>('#stage')!;
        this._btnStart     = this.container.querySelector<HTMLButtonElement>('#btnStart')!;
        this._btnStop      = this.container.querySelector<HTMLButtonElement>('#btnStop')!;
        this._dotEl        = this.container.querySelector<HTMLElement>('#dot')!;
        this._statusTextEl = this.container.querySelector<HTMLElement>('#statusText')!;
        this._videoEl      = this.container.querySelector<HTMLVideoElement>('#video')!;
        this._canvasEl     = this.container.querySelector<HTMLCanvasElement>('#canvas')!;
        this._ctx          = this._canvasEl.getContext('2d')!;
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
            case 'arm-id':       this._armId         = newValue ?? ''; break;
            case 'arm-id-right': this._armIdRight    = newValue ?? ''; break;
            case 'signal-out':   this._signalOut     = newValue ?? ''; break;
            case 'landmark':     this._landmarkIndex = parseInt(newValue ?? '') || DEFAULT_LANDMARK; break;
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    async open(): Promise<void> {
        if (this._isOpen) return;
        this._isOpen = true;
        this._stageEl.classList.add('open');
        this._syncUi();
        await this.start();
    }

    close(): void {
        if (!this._isOpen) return;
        this._isOpen = false;
        this._stageEl.classList.remove('open');
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
            this._syncUi();
            throw err;
        }
    }

    stop(): void {
        this._isRunning = false;
        if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }

        try { this._videoEl.pause(); } catch { /* ignore if not started */ }
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
            this._emitHandData(results);
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

        const slotOf = new Map<number, 0 | 1>();
        for (let slot = 0; slot <= 1; slot++) {
            const idx = this._slotMatch[slot];
            if (idx !== null) slotOf.set(idx, slot as 0 | 1);
        }

        for (let i = 0; i < allHands.length; i++) {
            this._drawSkeleton(allHands[i], w, h, slotOf.get(i) ?? 0);
        }
    }

    private _drawSkeleton(landmarks: any[], w: number, h: number, slot: 0 | 1 = 0): void {
        const px = (lm: any) => (this.facing === 'user' ? 1 - lm.x : lm.x) * w;
        const py = (lm: any) => lm.y * h;

        // Connections
        this._ctx.strokeStyle = 'rgba(0,240,255,0.8)';  // Fluoro Cyan
        this._ctx.lineWidth   = 2;
        for (const [a, b] of HAND_CONNECTIONS) {
            this._ctx.beginPath();
            this._ctx.moveTo(px(landmarks[a]), py(landmarks[a]));
            this._ctx.lineTo(px(landmarks[b]), py(landmarks[b]));
            this._ctx.stroke();
        }

        // Landmark dots
        this._ctx.fillStyle = 'rgba(254,104,16,0.9)';   // Fluoro Orange
        for (const lm of landmarks) {
            this._ctx.beginPath();
            this._ctx.arc(px(lm), py(lm), 3, 0, Math.PI * 2);
            this._ctx.fill();
        }

        // Pinch proximity line between thumb tip and index tip
        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
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
                    ? `rgba(167,255,0,${0.5 + proximity * 0.5})`    // Fluoro Lime when pinched
                    : `rgba(254,104,16,${proximity * 0.9})`;          // Fluoro Orange while closing
                this._ctx.strokeStyle = lineColor;
                this._ctx.lineWidth   = 2 + proximity * 2;
                this._ctx.beginPath();
                this._ctx.moveTo(px(thumbTip), py(thumbTip));
                this._ctx.lineTo(px(indexTip), py(indexTip));
                this._ctx.stroke();
            }
        }

        // Tracked landmark dot — flashes white on pinch start
        const tip = landmarks[this._landmarkIndex];
        if (tip) {
            const flashing  = Date.now() < this._pinchFlashUntil;
            const dotColor  = flashing                  ? '#FFFFFF'
                            : this._pinchState[slot]    ? '#A7FF00'   // Fluoro Lime
                            :                             '#FF37A8';   // Fluoro Pink
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

    // ── Hand-to-slot assignment ───────────────────────────────────────────────

    private _updateSlotMatch(allHands: any[][]): void {
        const matched: [number | null, number | null] = [null, null];
        const used = new Set<number>();

        // Pass 1: re-match by proximity to last known position
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

        // Pass 2: assign unmatched hands to empty slots, left→right order
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

        // Update last-known positions and release dropped slots
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

    // ── Output ────────────────────────────────────────────────────────────────

    private _emitHandData(results: any): void {
        const allHands: any[][] = results.landmarks ?? [];

        if (!allHands.length) {
            this._slotHandPos = [null, null];
            this._releaseArm(this._armId,      0);
            this._releaseArm(this._armIdRight, 1);
            return;
        }

        for (let slot = 0; slot <= 1; slot++) {
            const armId = slot === 0 ? this._armId : this._armIdRight;
            const idx   = this._slotMatch[slot];
            if (idx !== null) this._driveArm(armId, allHands[idx], slot as 0 | 1);
            else              this._releaseArm(armId, slot as 0 | 1);
        }

        if (this._signalOut && this._slotMatch[0] !== null) {
            const lm = allHands[this._slotMatch[0]][this._landmarkIndex];
            if (lm) {
                const nx = this.facing === 'user' ? 1 - lm.x : lm.x;
                this.broadcastMessage(this._signalOut, 'hand-data',
                    { x: nx, y: lm.y, landmarks: allHands[this._slotMatch[0]] });
            }
        }
    }

    // ── Arm driving ───────────────────────────────────────────────────────────

    private _driveArm(armId: string, landmarks: any[], slot: 0 | 1): void {
        if (!armId) return;
        const lm = landmarks[this._landmarkIndex];
        if (!lm) return;
        const nx = this.facing === 'user' ? 1 - lm.x : lm.x;
        this._updatePinchDetection(landmarks, armId, slot);
        this.sendMessage(armId, this._pinchState[slot] ? 'drag' : 'move', {
            x: nx * PLAYFIELD_W,
            y: lm.y * PLAYFIELD_H,
        });
    }

    private _releaseArm(armId: string, slot: 0 | 1): void {
        if (!armId || !this._pinchState[slot]) return;
        this._pinchState[slot] = false;
        this.sendMessage(armId, 'drag-end', null);
    }

    // ── Pinch detection ───────────────────────────────────────────────────────

    private _updatePinchDetection(landmarks: any[], armId: string, slot: 0 | 1): void {
        const thumbTip  = landmarks[4];
        const indexTip  = landmarks[8];
        const wrist     = landmarks[0];
        const middleMCP = landmarks[9];
        if (!thumbTip || !indexTip || !wrist || !middleMCP) return;

        const handSpan  = Math.hypot(middleMCP.x - wrist.x, middleMCP.y - wrist.y) || 1;
        const pinchDist = Math.hypot(indexTip.x - thumbTip.x, indexTip.y - thumbTip.y) / handSpan;

        const wasPinching       = this._pinchState[slot];
        const threshold         = wasPinching ? PINCH_EXIT_DIST : PINCH_ENTER_DIST;
        this._pinchState[slot]  = pinchDist < threshold;

        if (!wasPinching && this._pinchState[slot]) {
            this._pinchFlashUntil = Date.now() + PINCH_FLASH_MS;
            if (armId) this.sendMessage(armId, 'drag-start', null);
            this.dispatchEvent(new CustomEvent('pinch-start', {
                bubbles: true, composed: true, detail: { slot },
            }));
        } else if (wasPinching && !this._pinchState[slot]) {
            if (armId) this.sendMessage(armId, 'drag-end', null);
            this.dispatchEvent(new CustomEvent('pinch-end', {
                bubbles: true, composed: true, detail: { slot },
            }));
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
        this._dotEl.classList.remove('ready', 'running', 'loading', 'error');
        this._dotEl.classList.add(dotClass);
        this._btnToggle.classList.remove('ready', 'running', 'loading', 'error');
        this._btnToggle.classList.add(dotClass);
    }
}
