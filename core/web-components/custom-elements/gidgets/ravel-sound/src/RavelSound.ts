import { RavelElement } from '../../../../common/RavelElement';

/**
 * A single-source audio player widget: load, play/pause, stop, loop.
 *
 * ### Attributes
 * | Attribute  | Type    | Default | Description                              |
 * |------------|---------|---------|------------------------------------------|
 * | `source`   | string  | `''`    | URL of the audio file to load            |
 * | `autoload` | boolean | false   | Fetch and decode on connect              |
 * | `loop`     | boolean | false   | Loop playback (toggled by UI or setLoop) |
 *
 * ### Events dispatched (bubbling, composed)
 * | Event   | detail                         | Trigger            |
 * |---------|--------------------------------|--------------------|
 * | `ended` | `{ source, element }`          | Audio playback end |
 */
export class RavelSound extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: inline-block;
            font-family: inherit;
            user-select: none;
            font-size: 12px;
        }
        .wrap {
            min-width: 500px;
            max-width: 500px;
            overflow: hidden;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 10px;
            border: 1px solid rgba(0,0,0,0.15);
            background: rgba(255,255,255,0.6);
            box-shadow: none;
            transition: box-shadow 0.1s ease;
        }
        .wrap.playing {
            box-shadow: inset 0 0 0 3px #00F0FF;
        }
        .wrap.error {
            box-shadow: inset 0 0 0 3px #FF37A8;
        }
        button {
            appearance: none;
            width: 100px;
            border: 1px solid rgba(0,0,0,0.2);
            background: white;
            border-radius: 8px;
            padding: 6px 10px;
            cursor: pointer;
            font: inherit;
            line-height: 1;
        }
        button[disabled] {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .meta {
            display: inline-flex;
            align-items: baseline;
            gap: 8px;
            margin-left: 6px;
            opacity: 0.85;
            overflow: hidden;
        }
        .name {
            max-width: 260px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .time {
            display: none;
            opacity: 0.3;
            white-space: nowrap;
        }
        :host([show-time]) .time {
            display: inline;
        }
        .dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: rgba(0,0,0,0.15);
            display: inline-block;
            flex-shrink: 0;
        }
        .dot.loading { background: #FE6810; }
        .dot.ready   { background: #A7FF00; }
        .dot.error   { background: #FF37A8; }
    `;

    private static readonly componentHtml = `
        <div class="wrap" part="wrap">
            <slot></slot>
            <button id="btnPlayPause" type="button" aria-label="Play" disabled>Play</button>
            <button id="btnStop"      type="button" aria-label="Stop" disabled>Stop</button>
            <button id="btnLoop"      type="button" aria-pressed="false" aria-label="Loop" disabled>Loop</button>
            <span class="meta">
                <span class="dot" id="dot"></span>
                <span class="name" id="name"></span>
                <span class="time" id="time"></span>
            </span>
        </div>
    `;

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'source', 'autoload', 'show-time'];
    }

    // Shadow DOM refs — only valid after initialize()
    private wrapEl!:       HTMLElement;
    private btnPlayPause!: HTMLButtonElement;
    private btnStop!:      HTMLButtonElement;
    private btnLoop!:      HTMLButtonElement;
    private nameEl!:       HTMLElement;
    private dotEl!:        HTMLElement;
    private timeEl!:       HTMLElement;

    // True between setup() and teardown() — DOM refs are live
    private _isReady = false;

    // Audio state
    private _audio:           HTMLAudioElement | null = null;
    private _objectUrl:       string | null           = null;
    private _loaded                                   = false;
    private _loadingPromise:  Promise<void> | null    = null;
    private _abortController: AbortController | null  = null;
    private _hasError                                 = false;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelSound.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelSound.componentHtml;

        this.wrapEl       = this.container.querySelector<HTMLElement>('.wrap')!;
        this.btnPlayPause = this.container.querySelector<HTMLButtonElement>('#btnPlayPause')!;
        this.btnStop      = this.container.querySelector<HTMLButtonElement>('#btnStop')!;
        this.btnLoop      = this.container.querySelector<HTMLButtonElement>('#btnLoop')!;
        this.nameEl       = this.container.querySelector<HTMLElement>('#name')!;
        this.dotEl        = this.container.querySelector<HTMLElement>('#dot')!;
        this.timeEl       = this.container.querySelector<HTMLElement>('#time')!;
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;

        this.btnPlayPause.addEventListener('click', this._onPlayPauseClick);
        this.btnStop.addEventListener('click',      this._onStopClick);
        this.btnLoop.addEventListener('click',      this._onLoopClick);

        this._syncName();
        this._syncUiState();

        if (this.hasAttribute('autoload')) this.load().catch(() => {});
    }

    protected teardown(): void {
        this._isReady = false;

        this.btnPlayPause.removeEventListener('click', this._onPlayPauseClick);
        this.btnStop.removeEventListener('click',      this._onStopClick);
        this.btnLoop.removeEventListener('click',      this._onLoopClick);

        this._abortFetch();
        this._detachAudioEvents();
        this._revokeObjectUrl();
        this._audio          = null;
        this._loaded         = false;
        this._loadingPromise = null;

        super.teardown();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);

        if (name === 'source' && oldValue !== newValue) {
            this._resetLoadedState();
            this._syncName();
            this._syncUiState();
            if (this.isConnected && this.hasAttribute('autoload')) this.load().catch(() => {});
        }

        if (name === 'autoload' && this.isConnected && this.hasAttribute('autoload')
                && !this._loaded && !this._loadingPromise) {
            this.load().catch(() => {});
        }

        if (name === 'show-time') this._syncTime();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    get source(): string { return this.getAttribute('source') ?? ''; }
    set source(v: string) {
        if (v == null) this.removeAttribute('source');
        else this.setAttribute('source', v);
    }

    async load(): Promise<void> {
        const url = this.source;
        if (!url) {
            this._setError('missing source');
            throw new Error('<ravel-sound> requires a "source" attribute.');
        }
        if (this._loaded && this._audio) return;
        if (this._loadingPromise) return this._loadingPromise;

        this._hasError = false;
        this._setDot('loading');
        this._abortFetch();
        this._abortController = new AbortController();

        this._loadingPromise = (async () => {
            let res: Response;
            try {
                res = await fetch(url, { signal: this._abortController!.signal, cache: 'no-cache' });
            } catch (err) {
                if ((err as Error)?.name === 'AbortError') throw err;
                this._setError('fetch failed');
                throw err;
            }

            if (!res.ok) {
                this._setError(`http ${res.status}`);
                throw new Error(`Failed to fetch audio (${res.status}): ${url}`);
            }

            const blob = await res.blob();
            this._revokeObjectUrl();
            this._objectUrl = URL.createObjectURL(blob);

            this._detachAudioEvents();
            this._audio         = new Audio(this._objectUrl);
            this._audio.preload = 'auto';
            this._audio.loop    = this._getLoop();
            this._attachAudioEvents();

            this._loaded = true;
            this._setDot('ready');
            this._syncUiState();
        })();

        try {
            await this._loadingPromise;
        } finally {
            this._loadingPromise = null;
        }
    }

    async play(): Promise<void> {
        await this.load();
        if (!this._audio) return;
        try {
            await this._audio.play();
        } catch (err) {
            this._setError('play blocked');
            throw err;
        }
    }

    pause(): void { this._audio?.pause(); }

    stop(): void {
        if (!this._audio) return;
        this._audio.pause();
        try { this._audio.currentTime = 0; } catch { /* streams may disallow seeking */ }
        this._syncUiState();
    }

    setLoop(isLooping: boolean): void {
        this._setLoop(isLooping);
        if (this._audio) this._audio.loop = isLooping;
        this._syncUiState();
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    private _onPlayPauseClick = (): void => {
        if (!this._audio || !this._loaded) { this.play().catch(() => {}); return; }
        if (this._audio.paused) this.play().catch(() => {});
        else this.pause();
    };

    private _onStopClick = (): void => { this.stop(); };

    private _onLoopClick = (): void => { this.setLoop(!this._getLoop()); };

    private _onAudioEnded = (): void => {
        this._applyBorder(false, false);
        this._syncUiState();
        this.dispatchEvent(new CustomEvent('ended', {
            bubbles:  true,
            composed: true,
            detail:   { source: this.getAttribute('source') ?? null, element: this },
        }));
    };

    private _onAudioPlay = (): void => {
        this._applyBorder(true, false);
        this._syncUiState();
    };

    private _onAudioPause = (): void => {
        this._applyBorder(false, false);
        this._syncUiState();
    };

    private _onMetadata = (): void => { this._syncTime(); };

    // ── Private helpers ───────────────────────────────────────────────────────

    private _attachAudioEvents(): void {
        if (!this._audio) return;
        this._audio.addEventListener('ended',           this._onAudioEnded);
        this._audio.addEventListener('play',            this._onAudioPlay);
        this._audio.addEventListener('pause',           this._onAudioPause);
        this._audio.addEventListener('loadedmetadata',  this._onMetadata);
    }

    private _detachAudioEvents(): void {
        if (!this._audio) return;
        this._audio.removeEventListener('ended',          this._onAudioEnded);
        this._audio.removeEventListener('play',           this._onAudioPlay);
        this._audio.removeEventListener('pause',          this._onAudioPause);
        this._audio.removeEventListener('loadedmetadata', this._onMetadata);
    }

    private _applyBorder(playing: boolean, error: boolean): void {
        if (!this._isReady) return;
        this.wrapEl.classList.toggle('playing', playing);
        this.wrapEl.classList.toggle('error',   error);
    }

    private _setDot(cls: 'loading' | 'ready' | 'error' | ''): void {
        if (!this._isReady) return;
        this.dotEl.classList.remove('loading', 'ready', 'error');
        if (cls) this.dotEl.classList.add(cls);
    }

    private _setError(text: string): void {
        this._hasError = true;
        this.setAttribute('aria-label', `ravel-sound error: ${text}`);
        this._setDot('error');
        this._applyBorder(false, true);
        this._syncUiState();
    }

    private _syncTime(): void {
        if (!this._isReady) return;
        const d = this._audio?.duration;
        this.timeEl.textContent = (d && isFinite(d)) ? `${Math.round(d)}` : '';
    }

    private _syncName(): void {
        if (!this._isReady) return;
        const src = this.source;
        if (!src) { this.nameEl.textContent = ''; return; }
        try {
            const u = new URL(src, window.location.href);
            this.nameEl.textContent = decodeURIComponent(u.pathname.split('/').pop() ?? u.href);
        } catch {
            this.nameEl.textContent = src;
        }
    }

    private _syncUiState(): void {
        if (!this._isReady) return;
        const hasSource  = !!this.source;
        const isLoading  = !!this._loadingPromise;
        const canControl = hasSource && (this._loaded || isLoading);
        const isPlaying  = !!(this._audio && !this._audio.paused);
        const looping    = this._getLoop();

        this.btnPlayPause.disabled = !hasSource  || this._hasError;
        this.btnStop.disabled      = !canControl || this._hasError;
        this.btnLoop.disabled      = !hasSource  || this._hasError;

        this.btnPlayPause.textContent = isPlaying ? 'Pause' : 'Play';
        this.btnPlayPause.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
        this.btnLoop.setAttribute('aria-pressed', looping ? 'true' : 'false');
        this.btnLoop.textContent = looping ? 'Loop: On' : 'Loop: Off';
    }

    private _resetLoadedState(): void {
        try { this._audio?.pause(); } catch { /* ignore */ }
        this._abortFetch();
        this._detachAudioEvents();
        this._audio          = null;
        this._loaded         = false;
        this._loadingPromise = null;
        this._hasError       = false;
        this._revokeObjectUrl();
        this._setDot('');
        this._applyBorder(false, false);
        this._syncTime();
    }

    private _abortFetch(): void {
        try { this._abortController?.abort(); } catch { /* ignore */ }
        this._abortController = null;
    }

    private _revokeObjectUrl(): void {
        try { if (this._objectUrl) URL.revokeObjectURL(this._objectUrl); } catch { /* ignore */ }
        this._objectUrl = null;
    }

    private _getLoop(): boolean { return this.hasAttribute('loop'); }
    private _setLoop(v: boolean): void {
        if (v) this.setAttribute('loop', '');
        else this.removeAttribute('loop');
    }
}
