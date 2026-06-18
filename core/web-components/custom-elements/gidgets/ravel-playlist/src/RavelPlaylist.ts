import { RavelElement } from '../../../../common/RavelElement';

interface RavelSoundEl extends HTMLElement {
    load(): Promise<void>;
    play(): Promise<void>;
    pause(): void;
    stop(): void;
    setLoop(v: boolean): void;
}

type DotClass = 'ready' | 'playing' | 'loading' | 'error' | '';

function isRavelSoundEl(el: Element): el is RavelSoundEl {
    return el.tagName.toLowerCase() === 'ravel-sound' &&
           typeof (el as RavelSoundEl).play === 'function';
}

/**
 * Transport controller for a sequence of <ravel-sound> elements in its slot.
 *
 * ### Attributes
 * | Attribute  | Type    | Default | Description                                   |
 * |------------|---------|---------|-----------------------------------------------|
 * | `loop`     | boolean | false   | Wrap around to first sample after the last    |
 * | `autoload` | boolean | false   | Load all slotted samples on connect           |
 *
 * ### Events
 * Delegates entirely to the slotted <ravel-sound> children.
 */
export class RavelPlaylist extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: inline-block;
            font-family: inherit;
            user-select: none;
        }
        #header {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .outer-wrap {
            display: inline-flex;
            justify-content: center;
            align-items: center;
            flex-direction: column;
            background: rgba(230, 226, 211, 0.6);
            margin: 4px;
            border: 5px solid rgba(0, 0, 0, .15);
        }
        .wrap {
            display: inline-flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            padding: 10px 0px;
            background: rgba(230, 226, 211, 0.8);
        }
        button {
            appearance: none;
            border: 1px solid rgba(230, 226, 211, 0.2);
            background: white;
            border-radius: 8px;
            padding: 6px 10px;
            cursor: pointer;
            font: inherit;
            line-height: 1;
            min-height: 44px;
        }
        button[disabled] {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .meta {
            display: inline-flex;
            align-items: baseline;
            gap: 10px;
            margin-left: 6px;
            opacity: 0.85;
            white-space: nowrap;
        }
        .name {
            max-width: 280px;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .status {
            font-size: 0.9em;
            opacity: 0.75;
        }
        .dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: rgba(0, 0, 0, 0.25);
            display: inline-block;
            margin-right: 6px;
            vertical-align: middle;
        }
        .dot.ready    { background: #A7FF00; }
        .dot.playing  { background: #00F0FF; }
        .dot.loading  { background: #FE6810; }
        .dot.error    { background: #FF37A8; }
    `;

    private static readonly componentHtml = `
        <div class="outer-wrap" part="wrap">
            <div id="header" class="wrap">
                <div id="buttonGroup">
                    <button id="btnPrev"      type="button" aria-label="Previous">Prev</button>
                    <button id="btnPlayPause" type="button" aria-label="Play">Play</button>
                    <button id="btnNext"      type="button" aria-label="Next">Next</button>
                    <button id="btnStop"      type="button" aria-label="Stop">Stop</button>
                    <button id="btnLoop"      type="button" aria-pressed="false" aria-label="Loop">Loop: Off</button>
                </div>
                <span class="meta">
                    <span class="name" id="name">(empty)</span>
                    <span class="status" id="status">
                        <span class="dot" id="dot"></span>
                        <span id="statusText">idle</span>
                    </span>
                </span>
            </div>
            <slot id="slot"></slot>
        </div>
    `;

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'loop', 'autoload'];
    }

    // Shadow DOM refs — only valid after initialize()
    private btnPrev!:      HTMLButtonElement;
    private btnPlayPause!: HTMLButtonElement;
    private btnNext!:      HTMLButtonElement;
    private btnStop!:      HTMLButtonElement;
    private btnLoop!:      HTMLButtonElement;
    private nameEl!:       HTMLElement;
    private dotEl!:        HTMLElement;
    private statusTextEl!: HTMLElement;
    private slotEl!:       HTMLSlotElement;

    // True between setup() and teardown() — DOM refs are live
    private _isReady = false;

    // Playback state
    private _samples:    RavelSoundEl[] = [];
    private _activeIndex               = -1;
    private _isPlaying                 = false;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelPlaylist.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelPlaylist.componentHtml;

        this.btnPrev      = this.container.querySelector<HTMLButtonElement>('#btnPrev')!;
        this.btnPlayPause = this.container.querySelector<HTMLButtonElement>('#btnPlayPause')!;
        this.btnNext      = this.container.querySelector<HTMLButtonElement>('#btnNext')!;
        this.btnStop      = this.container.querySelector<HTMLButtonElement>('#btnStop')!;
        this.btnLoop      = this.container.querySelector<HTMLButtonElement>('#btnLoop')!;
        this.nameEl       = this.container.querySelector<HTMLElement>('#name')!;
        this.dotEl        = this.container.querySelector<HTMLElement>('#dot')!;
        this.statusTextEl = this.container.querySelector<HTMLElement>('#statusText')!;
        this.slotEl       = this.container.querySelector<HTMLSlotElement>('#slot')!;
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;

        this.btnPrev.addEventListener('click',      this._onPrevClick);
        this.btnPlayPause.addEventListener('click', this._onPlayPauseClick);
        this.btnNext.addEventListener('click',      this._onNextClick);
        this.btnStop.addEventListener('click',      this._onStopClick);
        this.btnLoop.addEventListener('click',      this._onLoopClick);
        this.slotEl.addEventListener('slotchange',  this._onSlotChange);

        this._refreshSamplesFromSlot();
        this._syncUiState();

        if (this.hasAttribute('autoload')) this._autoloadAll().catch(() => {});
    }

    protected teardown(): void {
        this._isReady = false;

        this.btnPrev.removeEventListener('click',      this._onPrevClick);
        this.btnPlayPause.removeEventListener('click', this._onPlayPauseClick);
        this.btnNext.removeEventListener('click',      this._onNextClick);
        this.btnStop.removeEventListener('click',      this._onStopClick);
        this.btnLoop.removeEventListener('click',      this._onLoopClick);
        this.slotEl.removeEventListener('slotchange',  this._onSlotChange);

        this._detachEndedListeners();
        this._samples      = [];
        this._activeIndex  = -1;
        this._isPlaying    = false;

        super.teardown();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        // _isReady guards _syncUiState; these are no-ops until setup() runs
        if (name === 'loop') this._syncUiState();
        if (name === 'autoload' && this.isConnected && this.hasAttribute('autoload')) {
            this._autoloadAll().catch(() => {});
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    get loop(): boolean { return this.hasAttribute('loop'); }
    set loop(v: boolean) {
        if (v) this.setAttribute('loop', '');
        else this.removeAttribute('loop');
    }

    get autoload(): boolean { return this.hasAttribute('autoload'); }
    set autoload(v: boolean) {
        if (v) this.setAttribute('autoload', '');
        else this.removeAttribute('autoload');
    }

    get activeSample(): RavelSoundEl | null {
        if (this._activeIndex < 0 || this._activeIndex >= this._samples.length) return null;
        return this._samples[this._activeIndex];
    }

    async play(): Promise<void> {
        if (!this._samples.length) {
            this._setStatus('empty', 'error');
            this._syncUiState();
            return;
        }
        if (this._activeIndex < 0) this._setActiveIndex(0);
        const s = this.activeSample;
        if (!s) return;

        this._isPlaying = true;
        this._setStatus('loading', 'loading');
        this._syncUiState();
        s.setLoop(false);

        try {
            await s.play();
            // Playback may have been cancelled (stop/next/prev) while we were loading
            if (this._isPlaying && this.activeSample === s) {
                this._setStatus('playing', 'playing');
                this._syncUiState();
            }
        } catch {
            this._isPlaying = false;
            this._setStatus('error', 'error');
            this._syncUiState();
        }
    }

    pause(): void {
        const s = this.activeSample;
        if (!s) return;
        this._isPlaying = false;
        s.pause();
        this._setStatus('paused', 'ready');
        this._syncUiState();
    }

    stop(): void {
        const s = this.activeSample;
        if (s) s.stop();
        this._isPlaying = false;
        this._setActiveIndex(this._samples.length ? 0 : -1);
        this._setStatus('stopped', 'ready');
        this._syncUiState();
    }

    async next({ play = null }: { play?: boolean | null } = {}): Promise<void> {
        if (!this._samples.length) return;
        const s = this.activeSample;
        if (s) s.stop();

        const shouldPlay = play === null ? this._isPlaying : !!play;
        const nextIndex  = this._activeIndex < 0 ? 0 : this._activeIndex + 1;

        if (nextIndex < this._samples.length) {
            this._setActiveIndex(nextIndex);
        } else if (this.loop) {
            this._setActiveIndex(0);
        } else {
            this._setActiveIndex(this._samples.length - 1);
            this._isPlaying = false;
            this._setStatus('done', 'ready');
            this._syncUiState();
            return;
        }

        if (shouldPlay) await this.play();
        else this._syncUiState();
    }

    async previous({ play = null }: { play?: boolean | null } = {}): Promise<void> {
        if (!this._samples.length) return;
        const s = this.activeSample;
        if (s) s.stop();

        const shouldPlay = play === null ? this._isPlaying : !!play;
        const prevIndex  = this._activeIndex < 0 ? 0 : this._activeIndex - 1;

        if (prevIndex >= 0) {
            this._setActiveIndex(prevIndex);
        } else if (this.loop) {
            this._setActiveIndex(this._samples.length - 1);
        } else {
            this._setActiveIndex(0);
            this._syncUiState();
            return;
        }

        if (shouldPlay) await this.play();
        else this._syncUiState();
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    private _onPrevClick      = (): void => { this.previous().catch(() => {}); };
    private _onPlayPauseClick = (): void => { if (this._isPlaying) this.pause(); else this.play().catch(() => {}); };
    private _onNextClick      = (): void => { this.next().catch(() => {}); };
    private _onStopClick      = (): void => { this.stop(); };
    private _onLoopClick      = (): void => { this.loop = !this.loop; this._syncUiState(); };

    private _onSlotChange = (): void => {
        const wasPlaying = this._isPlaying;
        const prevActive = this.activeSample;

        this._refreshSamplesFromSlot();

        if (prevActive) {
            const idx = this._samples.indexOf(prevActive);
            this._activeIndex = idx >= 0 ? idx : (this._samples.length ? 0 : -1);
        } else {
            this._activeIndex = this._samples.length ? 0 : -1;
        }

        if (wasPlaying && !this.activeSample) {
            this._isPlaying = false;
            this._setStatus('empty', 'error');
        }
        this._syncUiState();
    };

    private _onAnyEnded = async (evt: Event): Promise<void> => {
        if (!this._isPlaying) return;
        if (evt.target !== this.activeSample) return;
        await this._advanceToNextAndPlay();
    };

    // ── Private helpers ───────────────────────────────────────────────────────

    private _refreshSamplesFromSlot(): void {
        this._detachEndedListeners();
        const assigned = this.slotEl.assignedElements({ flatten: true });
        // isRavelSoundEl checks tag name AND that the element is upgraded (has .play method)
        this._samples  = assigned.filter(isRavelSoundEl);
        if (this._samples.length && (this._activeIndex < 0 || this._activeIndex >= this._samples.length)) {
            this._activeIndex = 0;
        }
        if (!this._samples.length) this._activeIndex = -1;
        this._attachEndedListeners();
        this._syncName();
    }

    private _attachEndedListeners(): void {
        for (const s of this._samples) s.addEventListener('ended', this._onAnyEnded);
    }

    private _detachEndedListeners(): void {
        for (const s of this._samples) s.removeEventListener('ended', this._onAnyEnded);
    }

    private async _advanceToNextAndPlay(): Promise<void> {
        if (!this._samples.length) return;
        const nextIndex = this._activeIndex + 1;
        if (nextIndex < this._samples.length) {
            this._setActiveIndex(nextIndex);
        } else if (this.loop) {
            this._setActiveIndex(0);
        } else {
            this._isPlaying = false;
            this._setStatus('done', 'ready');
            this._syncUiState();
            return;
        }
        // play() handles its own errors
        await this.play().catch(() => {});
    }

    private _setActiveIndex(i: number): void {
        this._activeIndex = Math.max(-1, Math.min(i, this._samples.length - 1));
        this._syncName();
    }

    private _syncName(): void {
        if (!this._isReady) return;
        const s = this.activeSample;
        if (!s) { this.nameEl.textContent = '(empty)'; return; }
        const src = s.getAttribute('source') ?? '';
        if (!src) {
            this.nameEl.textContent = `${this._activeIndex + 1}/${this._samples.length}`;
            return;
        }
        try {
            const u  = new URL(src, window.location.href);
            const fn = decodeURIComponent(u.pathname.split('/').pop() ?? u.href);
            this.nameEl.textContent = `${this._activeIndex + 1}/${this._samples.length}: ${fn}`;
        } catch {
            this.nameEl.textContent = `${this._activeIndex + 1}/${this._samples.length}: ${src}`;
        }
    }

    private _syncUiState(): void {
        if (!this._isReady) return;
        const hasAny = this._samples.length > 0;
        this.btnPrev.disabled      = !hasAny;
        this.btnNext.disabled      = !hasAny;
        this.btnPlayPause.disabled = !hasAny;
        this.btnStop.disabled      = !hasAny;
        this.btnLoop.disabled      = !hasAny;
        this.btnPlayPause.textContent = this._isPlaying ? 'Pause' : 'Play';
        this.btnPlayPause.setAttribute('aria-label', this._isPlaying ? 'Pause' : 'Play');
        this.btnLoop.setAttribute('aria-pressed', this.loop ? 'true' : 'false');
        this.btnLoop.textContent = this.loop ? 'Loop' : 'NoLoop';
    }

    private _setStatus(text: string, dotClass: DotClass): void {
        if (!this._isReady) return;
        this.statusTextEl.textContent = text;
        this.dotEl.classList.remove('ready', 'playing', 'loading', 'error');
        if (dotClass) this.dotEl.classList.add(dotClass);
    }

    private async _autoloadAll(): Promise<void> {
        await Promise.all(this._samples.map(async (s) => {
            try { await s.load(); } catch { /* ignore individual failures */ }
        }));
    }
}
