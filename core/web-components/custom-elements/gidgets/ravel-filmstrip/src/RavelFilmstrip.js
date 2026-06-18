import { RavelElement } from '../../../base/ravel-element/src/RavelElement.js';
import globalStyles from '../../../../common/global-styles.js';

/**
 * <ravel-filmstrip>
 *
 * Slots: <img> elements (any number)
 * Controls: Prev, Play/Pause, Next, Stop
 * Playback: shows frames in sequence at fps (default 10)
 *
 * Soundtrack:
 * - this.soundtrack is an array of arrays, one per frame.
 * - Each frame holds an array of "sound tokens" (color ball emojis, e.g. "🔴", "🔵").
 * - When a frame is displayed, it dispatches a bubbling composed "play-sound" CustomEvent
 *   for each token in that frame: detail: { token, frameIndex }.
 *
 * Public methods:
 * - addSoundToCurrentFrame(token) : adds token to soundtrack[currentFrame] and updates UI
 * - play(), pause(), stop(), next(), previous()
 *
 * Attributes:
 * - fps="10"
 * - loop (optional): loops filmstrip when playing
 */
export class RavelFilmstrip extends RavelElement {
  static get localStyles() {
    return `
      <style>
        :host {
          display: inline-block;
          font-family: inherit;
          user-select: none;
        }

        .wrap {
          display: grid;
          gap: 8px;
          max-width: 680px;
        }

        .controls {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        button {
          appearance: none;
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

        .stage {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 9;
          border: 1px solid rgba(0,0,0,0.15);
          border-radius: 12px;
          overflow: hidden;
          background: rgba(0,0,0,0.06);
          display: grid;
          place-items: center;
        }

        img#frame {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: rgba(255,255,255,0.55);
        }

        .overlay {
          position: absolute;
          inset: 0;
          pointer-events: none;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          padding: 10px;
          gap: 10px;
        }

        .hud {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.78);
          border: 1px solid rgba(0,0,0,0.12);
          opacity: 0.9;
          max-width: 100%;
        }

        .counter {
          font-size: 0.95em;
          white-space: nowrap;
        }

        .sounds {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 1.2em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 440px;
        }

        .sound {
          font-size: 18px;
          line-height: 1;
        }

        .status {
          font-size: 0.9em;
          opacity: 0.75;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: rgba(0,0,0,0.25);
          display: inline-block;
        }

        .dot.ready { background: rgba(0,180,80,0.9); }
        .dot.playing { background: rgba(60,120,255,0.95); }
        .dot.error { background: rgba(220,50,50,0.95); }

        /* Keep the slotted imgs from displaying; we use them as a source list */
        ::slotted(img) {
          display: none !important;
        }
      </style>
    `;
  }

  static get html() {
    return `
      <div class="wrap" part="wrap">
        <div class="controls" part="controls">
          <button id="btnPrev" type="button" aria-label="Previous">Prev</button>
          <button id="btnPlayPause" type="button" aria-label="Play">Play</button>
          <button id="btnNext" type="button" aria-label="Next">Next</button>
          <button id="btnStop" type="button" aria-label="Stop">Stop</button>

          <span class="status" id="status" part="status">
            <span class="dot" id="dot"></span>
            <span id="statusText">ready</span>
          </span>
        </div>

        <div class="stage" part="stage">
          <img id="frame" alt="filmstrip frame" />
          <div class="overlay" part="overlay">
            <div class="hud" part="hud-left">
              <span class="counter" id="counter">0/0</span>
              <span class="sounds" id="sounds"></span>
            </div>
            <div id="fps" class="hud" part="hud-right">
              <span>fps:</span> <span id="fpsText">10</span>
            </div>
          </div>
        </div>

        <slot id="slot"></slot>
      </div>
    `;
  }

  static get observedAttributes() {
    return [...super.baseObservedAttributes, 'fps', 'loop'];
  }

  constructor() {
    super();
    const template = document.createElement('template');
    template.innerHTML = globalStyles + this.constructor.localStyles + this.constructor.html;
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.initialize();
  }

  connectedCallback() {
    this.setup();
  }

  disconnectedCallback() {
    this.teardown();
  }

  initialize() {
    // UI
    this.btnPrev = this.shadowRoot.querySelector('#btnPrev');
    this.btnPlayPause = this.shadowRoot.querySelector('#btnPlayPause');
    this.btnNext = this.shadowRoot.querySelector('#btnNext');
    this.btnStop = this.shadowRoot.querySelector('#btnStop');

    this.dotEl = this.shadowRoot.querySelector('#dot');
    this.statusTextEl = this.shadowRoot.querySelector('#statusText');

    this.frameEl = this.shadowRoot.querySelector('#frame');
    this.counterEl = this.shadowRoot.querySelector('#counter');
    this.soundsEl = this.shadowRoot.querySelector('#sounds');
    this.fpsTextEl = this.shadowRoot.querySelector('#fpsText');

    this.slotEl = this.shadowRoot.querySelector('#slot');

    // State
    this._imgs = [];
    this._current = 0;
    this._isPlaying = false;
    this._timer = null;

    // Soundtrack: array per frame (public)
    this.soundtrack = [];

    // binds
    this._onPrev = this._onPrev.bind(this);
    this._onPlayPause = this._onPlayPause.bind(this);
    this._onNext = this._onNext.bind(this);
    this._onStop = this._onStop.bind(this);
    this._onSlotChange = this._onSlotChange.bind(this);
  }

  setup = () => {
    this.observedMessages = ['message'];
    // this.subscribe(this.observedMessages);

    this.btnPrev.addEventListener('click', this._onPrev);
    this.btnPlayPause.addEventListener('click', this._onPlayPause);
    this.btnNext.addEventListener('click', this._onNext);
    this.btnStop.addEventListener('click', this._onStop);

    this.fps = 6;
    this.slotEl.addEventListener('slotchange', this._onSlotChange);

    this._refreshFromSlot();
    this._renderFrame();
    this._syncUi();
  };

  teardown = () => {
    // this.unsubscribe(this.observedMessages);

    this.btnPrev.removeEventListener('click', this._onPrev);
    this.btnPlayPause.removeEventListener('click', this._onPlayPause);
    this.btnNext.removeEventListener('click', this._onNext);
    this.btnStop.removeEventListener('click', this._onStop);

    this.slotEl.removeEventListener('slotchange', this._onSlotChange);

    this.stop();
  };

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);

    if (name === 'fps' && oldValue !== newValue) {
      this._syncFpsText();
      if (this._isPlaying) {
        // restart timer with new fps
        this._startTimer();
      }
    }
    if (name === 'loop') {
      // no-op; affects behavior on end
    }
  }

  // ---- Attributes ----

  get fps() {
    const v = Number(this.getAttribute('fps'));
    return Number.isFinite(v) && v > 0 ? v : 6;
  }
  set fps(v) {
    if (v == null) this.removeAttribute('fps');
    else this.setAttribute('fps', String(v));
  }

  get loop() {
    return this.hasAttribute('loop');
  }
  set loop(v) {
    if (v) this.setAttribute('loop', '');
    else this.removeAttribute('loop');
  }

  // ---- Public API ----

  get currentFrameIndex() {
    return this._current;
  }

  get frameCount() {
    return this._imgs.length;
  }

  /**
   * Add a sound token (emoji) to the current frame's soundtrack cell.
   * Example: filmstrip.addSoundToCurrentFrame("🔴")
   */
  addSoundToCurrentFrame(token) {
    if (!token) return;
    this._ensureSoundtrackLength();

    const cell = this.soundtrack[this._current] || [];
    cell.push(String(token));
    this.soundtrack[this._current] = cell;

    this._renderSoundtrackCell();
  }

  clearSoundInCurrentFrame() {
    this._ensureSoundtrackLength();
    this.soundtrack[this._current] = [];

    this._renderSoundtrackCell();
  }

  play() {
    if (!this._imgs.length) {
      this._setStatus('no frames', 'error');
      this._syncUi();
      return;
    }

    this._isPlaying = true;
    this._setStatus('playing', 'playing');
    this._syncUi();

    // Always (re)render current frame when hitting play, and trigger any sounds on it.
    this._renderFrame({ triggerSounds: true });

    this._startTimer();
  }

  pause() {
    this._isPlaying = false;
    this._stopTimer();
    this._setStatus('ready', 'ready');
    this._syncUi();
  }

  stop() {
    this._isPlaying = false;
    this._stopTimer();
    this._current = 0;
    this._setStatus('ready', this._imgs.length ? 'ready' : 'error');
    this._renderFrame();
    this._syncUi();
  }

  next({ triggerSounds = true } = {}) {
    if (!this._imgs.length) return;

    if (this._current < this._imgs.length - 1) {
      this._current++;
      this._renderFrame({ triggerSounds });
      return;
    }

    // end
    if (this.loop) {
      this._current = 0;
      this._renderFrame({ triggerSounds });
    } else if (this._isPlaying) {
      this.pause();
      this._setStatus('done', 'ready');
    }
  }

  previous({ triggerSounds = true } = {}) {
    if (!this._imgs.length) return;
    this._current = Math.max(0, this._current - 1);
    this._renderFrame({ triggerSounds });
  }

  // ---- Internals ----

  _onPrev() {
    this.previous().catch?.(() => {});
  }

  _onPlayPause() {
    if (this._isPlaying) this.pause();
    else this.play();
  }

  _onNext() {
    this.next().catch?.(() => {});
  }

  _onStop() {
    this.stop();
  }

  _onSlotChange() {
    const wasPlaying = this._isPlaying;
    this.pause();
    this._refreshFromSlot();

    // keep current in range
    if (this._imgs.length === 0) this._current = 0;
    else this._current = Math.min(this._current, this._imgs.length - 1);

    this._renderFrame();
    this._syncUi();

    if (wasPlaying) this.play();
  }

  _refreshFromSlot() {
    const assigned = this.slotEl.assignedElements({ flatten: true });
    this._imgs = assigned.filter((el) => el && el.tagName && el.tagName.toLowerCase() === 'img');

    this._ensureSoundtrackLength();
    this._syncFpsText();
    this._setStatus(this._imgs.length ? 'ready' : 'no frames', this._imgs.length ? 'ready' : 'error');
  }

  _ensureSoundtrackLength() {
    const n = this._imgs.length;
    if (!Array.isArray(this.soundtrack)) this.soundtrack = [];

    // Grow
    while (this.soundtrack.length < n) this.soundtrack.push([]);

    // Shrink (keep soundtrack aligned)
    if (this.soundtrack.length > n) this.soundtrack.length = n;
  }

  _startTimer() {
    this._stopTimer();
    const intervalMs = Math.max(1, Math.round(1000 / this.fps));

    this._timer = setInterval(() => {
      if (!this._isPlaying) return;
      this.next({ triggerSounds: true });
    }, intervalMs);
  }

  _stopTimer() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  _renderFrame({ triggerSounds = false } = {}) {
    this._ensureSoundtrackLength();

    if (!this._imgs.length) {
      this.frameEl.removeAttribute('src');
      this.counterEl.textContent = '0/0';
      this._renderSoundtrackCell();
      return;
    }

    const img = this._imgs[this._current];

    // Prefer currentSrc if available (handles srcset), else src attribute
    const src = img.currentSrc || img.getAttribute('src') || '';
    const alt = img.getAttribute('alt') || `Frame ${this._current + 1}`;

    if (src) this.frameEl.src = src;
    this.frameEl.alt = alt;

    this.counterEl.textContent = `${this._current + 1}/${this._imgs.length}`;

    this._renderSoundtrackCell();

    if (triggerSounds) this._triggerSoundsForCurrentFrame();
  }

  _renderSoundtrackCell() {
    const cell = (this.soundtrack && this.soundtrack[this._current]) ? this.soundtrack[this._current] : [];
    this.soundsEl.innerHTML = '';

    if (!cell || cell.length === 0) return;

    // Render each token
    for (const tok of cell) {
      const span = document.createElement('span');
      span.className = 'sound';
      span.textContent = tok;
      this.soundsEl.appendChild(span);
    }
  }

  _triggerSoundsForCurrentFrame() {
    const cell = (this.soundtrack && this.soundtrack[this._current]) ? this.soundtrack[this._current] : [];
    if (!cell || cell.length === 0) return;

    for (const tok of cell) {
      // Dispatch a DOM event (good default; works even if your Ravel bus isn't enabled here)
      this.dispatchEvent(
        new CustomEvent('play-sound', {
          bubbles: true,
          composed: true,
          detail: {
            token: tok,
            frameIndex: this._current
          }
        })
      );

      // ALSO: If you use RavelElement's message bus (subscribe/publish), you can uncomment:
      // this.sendMessage?.('play-sound', { token: tok, frameIndex: this._current });
      // or this.publish?.('play-sound', { token: tok, frameIndex: this._current });
    }
  }

  _syncUi() {
    const hasFrames = this._imgs.length > 0;

    this.btnPrev.disabled = !hasFrames;
    this.btnNext.disabled = !hasFrames;
    this.btnStop.disabled = !hasFrames;

    this.btnPlayPause.disabled = !hasFrames;
    this.btnPlayPause.textContent = this._isPlaying ? 'Pause' : 'Play';
    this.btnPlayPause.setAttribute('aria-label', this._isPlaying ? 'Pause' : 'Play');
  }

  _syncFpsText() {
    if (this.fpsTextEl) this.fpsTextEl.textContent = String(this.fps);
  }

  _setStatus(text, dotClass /* ready|playing|error */) {
    if (this.statusTextEl) this.statusTextEl.textContent = text;
    if (this.dotEl) {
      this.dotEl.classList.remove('ready', 'playing', 'error');
      if (dotClass) this.dotEl.classList.add(dotClass);
    }
  }
}
