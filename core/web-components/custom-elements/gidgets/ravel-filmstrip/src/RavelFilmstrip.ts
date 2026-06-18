import { RavelElement } from '../../../../common/RavelElement';

/**
 * A frame-by-frame image player with transport controls and a per-frame soundtrack.
 * Slot `<img>` elements — they are hidden and used as frame sources.
 *
 * ### Attributes
 * | Attribute | Type    | Default | Description                  |
 * |-----------|---------|---------|------------------------------|
 * | `fps`     | number  | `6`     | Frames per second            |
 * | `loop`    | boolean | `false` | Loop playback at end         |
 *
 * ### Events
 * Dispatches `play-sound` CustomEvent (bubbles, composed) on the element when a frame
 * with soundtrack tokens is displayed:
 * `detail: { token: string, frameIndex: number }`
 *
 * ### Public API
 * `play()`, `pause()`, `stop()`, `next()`, `previous()`
 * `addSoundToCurrentFrame(token: string)`, `clearSoundInCurrentFrame()`
 * `currentFrameIndex`, `frameCount`
 */
export class RavelFilmstrip extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: inline-block;
            user-select: none;
        }

        .wrap {
            display: grid;
            gap: 8px;
            font-family: 'Silkscreen', monospace;
        }

        /* ── Controls bar ─────────────────────────────────── */
        .controls {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
        }

        button {
            appearance: none;
            background: transparent;
            border: 1px solid rgba(255,255,255,0.22);
            border-radius: 4px;
            padding: 6px 12px;
            cursor: pointer;
            font-family: 'Silkscreen', monospace;
            font-size: 0.7rem;
            color: rgba(255,255,255,0.75);
            line-height: 1;
            transition: color 100ms, border-color 100ms;
        }

        button:hover:not([disabled]) {
            color: #ffffff;
            border-color: rgba(255,255,255,0.5);
        }

        button[disabled] {
            opacity: 0.3;
            cursor: not-allowed;
        }

        button#btnPlayPause {
            border-color: rgba(0,240,255,0.4);
            color: #00F0FF;
        }
        button#btnPlayPause:hover:not([disabled]) {
            border-color: #00F0FF;
        }

        .status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.65rem;
            color: rgba(255,255,255,0.45);
            padding-left: 4px;
        }

        .dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: rgba(255,255,255,0.2);
            flex-shrink: 0;
        }
        .dot.ready   { background: #A7FF00; box-shadow: 0 0 4px #A7FF00; }
        .dot.playing { background: #00F0FF; box-shadow: 0 0 4px #00F0FF; }
        .dot.error   { background: #FF37A8; box-shadow: 0 0 4px #FF37A8; }

        /* ── Stage ─────────────────────────────────────────── */
        .stage {
            position: relative;
            width: 100%;
            aspect-ratio: 16 / 9;
            background: #000000;
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 4px;
            overflow: hidden;
            display: grid;
            place-items: center;
        }

        img#frame {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        /* ── Overlay HUD ───────────────────────────────────── */
        .overlay {
            position: absolute;
            inset: 0;
            pointer-events: none;
            display: flex;
            align-items: flex-end;
            justify-content: space-between;
            padding: 8px 10px;
            gap: 8px;
        }

        .hud {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 4px 10px;
            border-radius: 999px;
            background: rgba(0,0,0,0.62);
            border: 1px solid rgba(255,255,255,0.1);
            backdrop-filter: blur(6px);
            font-family: 'Quantico', monospace;
            font-size: 0.72rem;
            color: rgba(255,255,255,0.7);
            max-width: 60%;
        }

        .sounds {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            overflow: hidden;
            white-space: nowrap;
            max-width: 200px;
        }

        .sound { font-size: 15px; line-height: 1; }

        /* Slotted imgs are data-only — hide from layout */
        ::slotted(img) {
            display: none !important;
        }
    `;

    private static readonly componentHtml = `
        <div class="wrap" part="wrap">
            <div class="controls" part="controls">
                <button id="btnPrev"      type="button" aria-label="Previous frame">Prev</button>
                <button id="btnPlayPause" type="button" aria-label="Play">Play</button>
                <button id="btnNext"      type="button" aria-label="Next frame">Next</button>
                <button id="btnStop"      type="button" aria-label="Stop">Stop</button>
                <span class="status" id="status" part="status" aria-live="polite">
                    <span class="dot" id="dot"></span>
                    <span id="statusText">ready</span>
                </span>
            </div>

            <div class="stage" part="stage" role="img" aria-label="Filmstrip frame display">
                <img id="frame" alt="filmstrip frame" />
                <div class="overlay" part="overlay" aria-hidden="true">
                    <div class="hud" part="hud-left">
                        <span id="counter">0/0</span>
                        <span class="sounds" id="sounds"></span>
                    </div>
                    <div class="hud" part="hud-right">
                        <span id="fpsText">6</span>&#8239;fps
                    </div>
                </div>
            </div>

            <slot id="slot"></slot>
        </div>
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'fps', 'loop'];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _btnPrev!:      HTMLButtonElement;
    private _btnPlayPause!: HTMLButtonElement;
    private _btnNext!:      HTMLButtonElement;
    private _btnStop!:      HTMLButtonElement;
    private _dotEl!:        HTMLElement;
    private _statusTextEl!: HTMLElement;
    private _frameEl!:      HTMLImageElement;
    private _counterEl!:    HTMLElement;
    private _soundsEl!:     HTMLElement;
    private _fpsTextEl!:    HTMLElement;
    private _slotEl!:       HTMLSlotElement;

    private _isReady  = false;
    private _imgs:      HTMLImageElement[] = [];
    private _current  = 0;
    private _isPlaying = false;
    private _timer:    ReturnType<typeof setInterval> | null = null;

    /** Per-frame soundtrack. Each entry is an array of string tokens (e.g. emoji). */
    soundtrack: string[][] = [];

    // ── Getters / setters ─────────────────────────────────────────────────────

    get fps(): number {
        const v = Number(this.getAttribute('fps'));
        return Number.isFinite(v) && v > 0 ? v : 6;
    }
    set fps(v: number) {
        this.setAttribute('fps', String(v));
    }

    get loop(): boolean {
        return this.hasAttribute('loop');
    }
    set loop(v: boolean) {
        if (v) this.setAttribute('loop', ''); else this.removeAttribute('loop');
    }

    // ── Getters ───────────────────────────────────────────────────────────────

    get currentFrameIndex(): number { return this._current; }
    get frameCount():        number { return this._imgs.length; }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelFilmstrip.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelFilmstrip.componentHtml;

        this._btnPrev      = this.container.querySelector<HTMLButtonElement>('#btnPrev')!;
        this._btnPlayPause = this.container.querySelector<HTMLButtonElement>('#btnPlayPause')!;
        this._btnNext      = this.container.querySelector<HTMLButtonElement>('#btnNext')!;
        this._btnStop      = this.container.querySelector<HTMLButtonElement>('#btnStop')!;
        this._dotEl        = this.container.querySelector<HTMLElement>('#dot')!;
        this._statusTextEl = this.container.querySelector<HTMLElement>('#statusText')!;
        this._frameEl      = this.container.querySelector<HTMLImageElement>('#frame')!;
        this._counterEl    = this.container.querySelector<HTMLElement>('#counter')!;
        this._soundsEl     = this.container.querySelector<HTMLElement>('#sounds')!;
        this._fpsTextEl    = this.container.querySelector<HTMLElement>('#fpsText')!;
        this._slotEl       = this.container.querySelector<HTMLSlotElement>('slot')!;
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;

        this._btnPrev.addEventListener('click',      this._onPrev);
        this._btnPlayPause.addEventListener('click', this._onPlayPause);
        this._btnNext.addEventListener('click',      this._onNext);
        this._btnStop.addEventListener('click',      this._onStop);
        this._slotEl.addEventListener('slotchange',  this._onSlotChange);

        this._refreshFromSlot();
        this._renderFrame();
        this._syncUi();
    }

    protected teardown(): void {
        this._isReady = false;

        this._btnPrev.removeEventListener('click',      this._onPrev);
        this._btnPlayPause.removeEventListener('click', this._onPlayPause);
        this._btnNext.removeEventListener('click',      this._onNext);
        this._btnStop.removeEventListener('click',      this._onStop);
        this._slotEl.removeEventListener('slotchange',  this._onSlotChange);

        this.stop();
        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (oldValue === newValue) return;
        if (!this._isReady) return;

        if (name === 'fps') {
            this._syncFpsText();
            if (this._isPlaying) this._startTimer();
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    play(): void {
        if (!this._imgs.length) {
            this._setStatus('no frames', 'error');
            this._syncUi();
            return;
        }
        this._isPlaying = true;
        this._setStatus('playing', 'playing');
        this._syncUi();
        this._renderFrame({ triggerSounds: true });
        this._startTimer();
    }

    pause(): void {
        this._isPlaying = false;
        this._stopTimer();
        this._setStatus('paused', 'ready');
        this._syncUi();
    }

    stop(): void {
        this._isPlaying = false;
        this._stopTimer();
        this._current = 0;
        if (!this._isReady) return;
        this._setStatus('ready', this._imgs.length ? 'ready' : 'error');
        this._renderFrame();
        this._syncUi();
    }

    next({ triggerSounds = true } = {}): void {
        if (!this._imgs.length) return;

        if (this._current < this._imgs.length - 1) {
            this._current++;
            this._renderFrame({ triggerSounds });
            return;
        }

        if (this.loop) {
            this._current = 0;
            this._renderFrame({ triggerSounds });
        } else if (this._isPlaying) {
            this.pause();
            this._setStatus('done', 'ready');
        }
    }

    previous({ triggerSounds = true } = {}): void {
        if (!this._imgs.length) return;
        this._current = Math.max(0, this._current - 1);
        this._renderFrame({ triggerSounds });
    }

    addSoundToCurrentFrame(token: string): void {
        if (!token) return;
        this._ensureSoundtrackLength();
        const cell = this.soundtrack[this._current] ?? [];
        cell.push(String(token));
        this.soundtrack[this._current] = cell;
        this._renderSoundtrackCell();
    }

    clearSoundInCurrentFrame(): void {
        this._ensureSoundtrackLength();
        this.soundtrack[this._current] = [];
        this._renderSoundtrackCell();
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    private _onPrev = (): void => this.previous();
    private _onNext = (): void => this.next();
    private _onStop = (): void => this.stop();

    private _onPlayPause = (): void => {
        if (this._isPlaying) this.pause(); else this.play();
    };

    private _onSlotChange = (): void => {
        const wasPlaying = this._isPlaying;
        this.pause();
        this._refreshFromSlot();
        if (this._imgs.length === 0) this._current = 0;
        else this._current = Math.min(this._current, this._imgs.length - 1);
        this._renderFrame();
        this._syncUi();
        if (wasPlaying) this.play();
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    private _refreshFromSlot(): void {
        const assigned = this._slotEl.assignedElements({ flatten: true });
        this._imgs = assigned.filter(
            (el): el is HTMLImageElement => el.tagName.toLowerCase() === 'img'
        );
        this._ensureSoundtrackLength();
        this._syncFpsText();
        this._setStatus(
            this._imgs.length ? 'ready' : 'no frames',
            this._imgs.length ? 'ready' : 'error'
        );
    }

    private _ensureSoundtrackLength(): void {
        const n = this._imgs.length;
        if (!Array.isArray(this.soundtrack)) this.soundtrack = [];
        while (this.soundtrack.length < n) this.soundtrack.push([]);
        if (this.soundtrack.length > n) this.soundtrack.length = n;
    }

    private _startTimer(): void {
        this._stopTimer();
        const ms = Math.max(1, Math.round(1000 / this.fps));
        this._timer = setInterval(() => {
            if (this._isPlaying) this.next({ triggerSounds: true });
        }, ms);
    }

    private _stopTimer(): void {
        if (this._timer !== null) {
            clearInterval(this._timer);
            this._timer = null;
        }
    }

    private _renderFrame({ triggerSounds = false } = {}): void {
        if (!this._isReady) return;
        this._ensureSoundtrackLength();

        if (!this._imgs.length) {
            this._frameEl.removeAttribute('src');
            this._counterEl.textContent = '0/0';
            this._renderSoundtrackCell();
            return;
        }

        const img = this._imgs[this._current];
        const src = img.currentSrc || img.getAttribute('src') || '';
        const alt = img.getAttribute('alt') || `Frame ${this._current + 1}`;

        if (src) this._frameEl.src = src;
        this._frameEl.alt = alt;
        this._counterEl.textContent = `${this._current + 1}/${this._imgs.length}`;

        this._renderSoundtrackCell();
        if (triggerSounds) this._triggerSoundsForCurrentFrame();
    }

    private _renderSoundtrackCell(): void {
        if (!this._isReady) return;
        const cell = this.soundtrack[this._current] ?? [];
        this._soundsEl.innerHTML = '';
        for (const tok of cell) {
            const span = document.createElement('span');
            span.className = 'sound';
            span.textContent = tok;
            this._soundsEl.appendChild(span);
        }
    }

    private _triggerSoundsForCurrentFrame(): void {
        const cell = this.soundtrack[this._current] ?? [];
        for (const tok of cell) {
            this.dispatchEvent(new CustomEvent('play-sound', {
                bubbles: true,
                composed: true,
                detail: { token: tok, frameIndex: this._current },
            }));
        }
    }

    private _syncUi(): void {
        if (!this._isReady) return;
        const has = this._imgs.length > 0;
        this._btnPrev.disabled     = !has;
        this._btnNext.disabled     = !has;
        this._btnStop.disabled     = !has;
        this._btnPlayPause.disabled = !has;
        this._btnPlayPause.textContent = this._isPlaying ? 'Pause' : 'Play';
        this._btnPlayPause.setAttribute('aria-label', this._isPlaying ? 'Pause playback' : 'Play filmstrip');
    }

    private _syncFpsText(): void {
        if (!this._isReady) return;
        this._fpsTextEl.textContent = String(this.fps);
    }

    private _setStatus(text: string, dotClass: 'ready' | 'playing' | 'error'): void {
        if (!this._isReady) return;
        this._statusTextEl.textContent = text;
        this._dotEl.classList.remove('ready', 'playing', 'error');
        this._dotEl.classList.add(dotClass);
    }
}
