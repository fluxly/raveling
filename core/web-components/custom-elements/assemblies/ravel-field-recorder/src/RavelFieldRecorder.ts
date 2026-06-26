import { RavelElement } from '../../../../common/RavelElement';

const ANIMALS: readonly string[] = [
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯',
    '🦁','🐮','🐷','🐵','🐔','🐧','🐦','🐤','🦄','🐣',
    '🦆','🦅','🦉','🦇','🐺','🐗','🐴','🐝','🐛','🦋',
    '🐌','🐞','🐢','🐍','🦎','🐙','🦑','🐬','🐳','🦁',
];

interface RecordingSlot {
    emoji: string;
    blob:  Blob | null;
    url:   string | null;
}

type TransportState = 'idle' | 'recording' | 'playing';

const SIZE_MAP: Record<string, number> = { sm: 32, md: 48, lg: 80 };

// ravel-button base colors for each transport action
const BTN_PLAY_IDLE    = '#1a2e1a';
const BTN_PLAY_ACTIVE  = '#005500';
const BTN_REC_IDLE     = '#2e1a1a';
const BTN_REC_ACTIVE   = '#CC0000';

/**
 * Sound sample icon with a built-in recording/playback widget.
 * Click the face emoji to open the recorder panel. The transport
 * uses `<ravel-button>` elements for play (▶️), stop (⏹️), and
 * record (🔴). Each slot holds one audio recording; the active
 * slot's emoji becomes the component's visible face.
 *
 * ### Attributes
 * | Attribute  | Type         | Default                  | Description                      |
 * |------------|--------------|--------------------------|----------------------------------|
 * | `slots`    | number       | `20`                     | Number of recording slots (1–40) |
 * | `selected` | number       | `0`                      | Active slot index                |
 * | `channel`  | string       | `'ravel-field-recorder'` | Broadcast channel name           |
 * | `size`     | `sm\|md\|lg` | `md`                     | Face emoji size                  |
 *
 * ### Broadcasts (window CustomEvent on `channel`)
 * | cmd             | content                           | Trigger             |
 * |-----------------|-----------------------------------|---------------------|
 * | `select`        | `{ slot, emoji }`                 | Slot selected       |
 * | `play`          | `{ slot, emoji }`                 | Playback started    |
 * | `stop`          | `{ slot }`                        | Playback ended      |
 * | `record-start`  | `{ slot }`                        | Recording started   |
 * | `record-stop`   | `{ slot, emoji, hasAudio: true }` | Recording saved     |
 * | `record-cancel` | `{ slot }`                        | Recording cancelled |
 *
 * ### DOM events (bubbling, composed)
 * | Event    | detail            | Trigger       |
 * |----------|-------------------|---------------|
 * | `select` | `{ slot, emoji }` | Slot selected |
 */
export class RavelFieldRecorder extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: inline-block;
            --recorder-accent: #FF4FB3;
        }

        /* ── Face ────────────────────────────────────── */

        #face {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            position: relative;
            background: none;
            border: none;
            padding: 4px;
            border-radius: 8px;
            cursor: pointer;
            line-height: 1;
            transition: filter 0.15s ease, transform 0.1s ease;
        }
        #face:focus-visible {
            outline: 2px solid var(--ravel-focus, #00F0FF);
            outline-offset: 2px;
        }
        #face:hover  { filter: brightness(1.2); transform: scale(1.06); }
        #face:active { transform: scale(0.93); }
        #face-emoji  { font-size: var(--face-size, 48px); pointer-events: none; user-select: none; }

        #face-dot {
            position: absolute;
            bottom: 3px; right: 3px;
            width: 8px; height: 8px;
            border-radius: 50%;
            background: var(--recorder-accent);
            box-shadow: 0 0 4px var(--recorder-accent);
            display: none;
        }
        #face-dot.visible { display: block; }

        /* ── Backdrop ────────────────────────────────── */

        #backdrop {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.72);
            z-index: 9998;
        }
        #backdrop[hidden] { display: none; }

        /* ── Dialog ──────────────────────────────────── */

        #dialog {
            position: fixed;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            z-index: 9999;
            width: 380px;
            height: 90vh;
            display: flex;
            flex-direction: column;
            background: #0e0e12;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 10px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04);
            overflow: hidden;
            font-family: var(--ravel-font, 'Silkscreen', monospace);
        }
        #dialog[hidden] { display: none; }

        /* ── Dialog header ───────────────────────────── */

        #dialog-header {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 16px 16px 12px;
            border-bottom: 1px solid rgba(255,255,255,0.07);
            flex-shrink: 0;
        }
        #dialog-icon { font-size: 72px; line-height: 1; flex-shrink: 0; }
        #dialog-name {
            font-size: 13px;
            letter-spacing: 0.10em;
            color: rgba(255,255,255,0.35);
            text-transform: uppercase;
            flex: 1;
        }
        #btn-close {
            background: none;
            border: none;
            color: rgba(255,255,255,0.40);
            cursor: pointer;
            font-size: 1rem;
            padding: 6px 8px;
            border-radius: 4px;
            line-height: 1;
            transition: color 0.1s, background 0.1s;
            font-family: inherit;
            flex-shrink: 0;
        }
        #btn-close:hover { color: #fff; background: rgba(255,255,255,0.10); }
        #btn-close:focus-visible {
            outline: 2px solid var(--ravel-focus, #00F0FF);
            outline-offset: 1px;
        }

        /* ── Transport ───────────────────────────────── */

        #transport {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            padding: 20px 16px 8px;
            flex-shrink: 0;
        }

        /* Wrapper for each ravel-button — handles disabled + active states */
        .t-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            transition: opacity 0.15s;
        }
        .t-wrap.t-disabled {
            opacity: 0.28;
            pointer-events: none;
        }
        .t-label {
            font-size: 11px;
            color: rgba(255,255,255,0.28);
            letter-spacing: 0.10em;
            text-transform: uppercase;
        }

        /* ── Status ──────────────────────────────────── */

        #status {
            text-align: center;
            font-size: 13px;
            letter-spacing: 0.12em;
            color: rgba(255,255,255,0.25);
            padding: 10px 16px 12px;
            min-height: 32px;
            flex-shrink: 0;
            text-transform: uppercase;
        }
        #status.recording { color: #ff5555; }
        #status.playing   { color: #a7ff00; }

        /* ── Slots ───────────────────────────────────── */

        #slots-header {
            font-size: 11px;
            letter-spacing: 0.14em;
            color: rgba(255,255,255,0.18);
            text-transform: uppercase;
            padding: 10px 14px 6px;
            flex-shrink: 0;
            border-top: 1px solid rgba(255,255,255,0.06);
        }
        #slots {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 4px;
            padding: 0 12px 14px;
            overflow-y: auto;
            flex: 1;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.10) transparent;
        }
        #slots::-webkit-scrollbar { width: 4px; }
        #slots::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.10);
            border-radius: 2px;
        }
        .slot-btn {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
            background: rgba(255,255,255,0.04);
            border: 1px solid transparent;
            border-radius: 6px;
            padding: 4px;
            cursor: pointer;
            transition: background 0.1s, border-color 0.1s, box-shadow 0.1s;
            aspect-ratio: 1 / 1;
        }
        .slot-btn:hover {
            background: rgba(255,255,255,0.08);
            border-color: rgba(255,255,255,0.12);
        }
        .slot-btn:focus-visible {
            outline: 2px solid var(--ravel-focus, #00F0FF);
            outline-offset: -1px;
        }
        .slot-btn[aria-checked="true"] {
            background: rgba(255,79,179,0.14);
            border-color: rgba(255,79,179,0.50);
            box-shadow: 0 0 8px rgba(255,79,179,0.20);
        }
        .slot-emoji { font-size: 28px; line-height: 1; pointer-events: none; user-select: none; }
        .slot-dot {
            width: 4px; height: 4px;
            border-radius: 50%;
            background: var(--recorder-accent);
            box-shadow: 0 0 3px var(--recorder-accent);
            visibility: hidden;
        }
        .slot-btn.has-recording .slot-dot { visibility: visible; }
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'slots', 'selected', 'channel', 'size',
        ];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _faceEl!:       HTMLButtonElement;
    private _faceEmojiEl!:  HTMLSpanElement;
    private _faceDotEl!:    HTMLSpanElement;
    private _backdropEl!:   HTMLElement;
    private _dialogEl!:     HTMLElement;
    private _dialogIconEl!: HTMLElement;
    private _dialogNameEl!: HTMLElement;
    private _btnClose!:     HTMLButtonElement;
    private _transportEl!:  HTMLElement;
    private _wrapPlay!:     HTMLElement;
    private _wrapRecord!:   HTMLElement;
    private _rbPlay!:       HTMLElement;   // ravel-button element
    private _rbRecord!:     HTMLElement;   // ravel-button element
    private _statusEl!:     HTMLElement;
    private _slotsEl!:      HTMLElement;
    private _audioEl!:      HTMLAudioElement;

    // ── Config ────────────────────────────────────────────────────────────────

    private _slotCount = 20;
    private _selected  = 0;
    private _channel   = 'ravel-field-recorder';
    private _sizePx    = 48;

    // ── State ─────────────────────────────────────────────────────────────────

    private _slots:     RecordingSlot[] = [];
    private _transport: TransportState = 'idle';

    private _stream:   MediaStream | null = null;
    private _recorder: MediaRecorder | null = null;
    private _chunks:   Blob[] = [];

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelFieldRecorder.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this._buildSlots();

        this.container.innerHTML = `
            <button id="face" type="button" aria-haspopup="dialog" aria-expanded="false">
                <span id="face-emoji"></span>
                <span id="face-dot" aria-hidden="true"></span>
            </button>

            <div id="backdrop" hidden aria-hidden="true"></div>

            <div id="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-name" hidden tabindex="-1">
                <div id="dialog-header">
                    <span id="dialog-icon" aria-hidden="true"></span>
                    <span id="dialog-name"></span>
                    <button id="btn-close" type="button" aria-label="Close recorder">✕</button>
                </div>

                <div id="transport" role="group" aria-label="Transport controls">
                    <div class="t-wrap" data-action="play">
                        <ravel-button id="rb-play"
                            label="▶️"
                            color="${BTN_PLAY_IDLE}"
                            w="88" h="66"
                            border-width="2"
                            shadow-size="3"
                            aria-label="Play recording">
                        </ravel-button>
                        <span class="t-label">PLAY</span>
                    </div>
<div class="t-wrap" data-action="record">
                        <ravel-button id="rb-record"
                            label="🔴"
                            color="${BTN_REC_IDLE}"
                            w="88" h="66"
                            border-width="2"
                            shadow-size="3"
                            aria-label="Record">
                        </ravel-button>
                        <span class="t-label">RECORD</span>
                    </div>
                </div>

                <div id="status" aria-live="polite" aria-atomic="true">READY</div>
                <div id="slots-header" aria-hidden="true">RECORDING SLOTS</div>
                <div id="slots" role="radiogroup" aria-label="Recording slots"></div>
            </div>

            <audio id="audio" aria-hidden="true"></audio>
        `;

        this._faceEl       = this.container.querySelector<HTMLButtonElement>('#face')!;
        this._faceEmojiEl  = this.container.querySelector<HTMLSpanElement>('#face-emoji')!;
        this._faceDotEl    = this.container.querySelector<HTMLSpanElement>('#face-dot')!;
        this._backdropEl   = this.container.querySelector<HTMLElement>('#backdrop')!;
        this._dialogEl     = this.container.querySelector<HTMLElement>('#dialog')!;
        this._dialogIconEl = this.container.querySelector<HTMLElement>('#dialog-icon')!;
        this._dialogNameEl = this.container.querySelector<HTMLElement>('#dialog-name')!;
        this._btnClose     = this.container.querySelector<HTMLButtonElement>('#btn-close')!;
        this._transportEl  = this.container.querySelector<HTMLElement>('#transport')!;
        this._wrapPlay     = this.container.querySelector<HTMLElement>('[data-action="play"]')!;
        this._wrapRecord   = this.container.querySelector<HTMLElement>('[data-action="record"]')!;
        this._rbPlay       = this.container.querySelector<HTMLElement>('#rb-play')!;
        this._rbRecord     = this.container.querySelector<HTMLElement>('#rb-record')!;
        this._statusEl     = this.container.querySelector<HTMLElement>('#status')!;
        this._slotsEl      = this.container.querySelector<HTMLElement>('#slots')!;
        this._audioEl      = this.container.querySelector<HTMLAudioElement>('#audio')!;

        this._applySize();
        this._renderSlotGrid();
        this._syncSelected();
    }

    protected setup(): void {
        super.setup();
        this._faceEl.addEventListener('click',       this._onFaceClick);
        this._backdropEl.addEventListener('click',   this._onBackdropClick);
        this._btnClose.addEventListener('click',     this._onClose);
        this._transportEl.addEventListener('click',  this._onTransportClick);
        this._dialogEl.addEventListener('keydown',   this._onDialogKeyDown);
        this._audioEl.addEventListener('ended',      this._onAudioEnded);
    }

    protected teardown(): void {
        this._stopPlayback();
        this._cancelRecording();

        for (const slot of this._slots) {
            if (slot.url) { URL.revokeObjectURL(slot.url); slot.url = null; }
        }

        this._faceEl.removeEventListener('click',      this._onFaceClick);
        this._backdropEl.removeEventListener('click',  this._onBackdropClick);
        this._btnClose.removeEventListener('click',    this._onClose);
        this._transportEl.removeEventListener('click', this._onTransportClick);
        this._dialogEl.removeEventListener('keydown',  this._onDialogKeyDown);
        this._audioEl.removeEventListener('ended',     this._onAudioEnded);

        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        switch (name) {
            case 'slots': {
                const n = Math.max(1, Math.min(40, parseInt(newValue ?? '20') || 20));
                if (n !== this._slotCount) {
                    this._slotCount = n;
                    this._buildSlots();
                    if (this._slotsEl) this._renderSlotGrid();
                    if (this._selected >= this._slotCount) {
                        this._selected = 0;
                        this._syncSelected();
                    }
                }
                break;
            }
            case 'selected': {
                const idx = Math.max(0, Math.min(this._slotCount - 1, parseInt(newValue ?? '0') || 0));
                if (idx !== this._selected) {
                    const prev = this._selected;
                    this._selected = idx;
                    this._slotsEl?.querySelector<HTMLElement>(`[data-idx="${prev}"]`)
                        ?.setAttribute('aria-checked', 'false');
                    this._slotsEl?.querySelector<HTMLElement>(`[data-idx="${idx}"]`)
                        ?.setAttribute('aria-checked', 'true');
                    this._syncSelected();
                }
                break;
            }
            case 'channel':
                this._channel = newValue ?? 'ravel-field-recorder';
                break;
            case 'size':
                this._sizePx = SIZE_MAP[newValue ?? 'md'] ?? 48;
                if (this._faceEl) this._applySize();
                break;
        }
    }

    // ── Slot construction ─────────────────────────────────────────────────────

    private _buildSlots(): void {
        const prev = this._slots;
        this._slots = Array.from({ length: this._slotCount }, (_, i) => ({
            emoji: ANIMALS[i % ANIMALS.length],
            blob:  prev[i]?.blob  ?? null,
            url:   prev[i]?.url   ?? null,
        }));
    }

    // ── Slot grid ─────────────────────────────────────────────────────────────

    private _renderSlotGrid(): void {
        this._slotsEl.innerHTML = '';
        for (let i = 0; i < this._slotCount; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'slot-btn';
            btn.setAttribute('role', 'radio');
            btn.setAttribute('aria-checked', String(i === this._selected));
            btn.setAttribute('aria-label', `Slot ${i + 1}: ${this._slots[i].emoji}`);
            btn.dataset.idx = String(i);
            if (this._slots[i].blob) btn.classList.add('has-recording');
            btn.innerHTML = `
                <span class="slot-emoji" aria-hidden="true">${this._slots[i].emoji}</span>
                <span class="slot-dot" aria-hidden="true"></span>
            `;
            btn.addEventListener('click', () => this._selectSlot(i));
            this._slotsEl.appendChild(btn);
        }
    }

    private _updateSlotEl(idx: number): void {
        const btn = this._slotsEl.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
        if (!btn) return;
        btn.setAttribute('aria-label', `Slot ${idx + 1}: ${this._slots[idx].emoji}`);
        btn.querySelector<HTMLElement>('.slot-emoji')!.textContent = this._slots[idx].emoji;
        btn.classList.toggle('has-recording', !!this._slots[idx].blob);
    }

    // ── Selection ─────────────────────────────────────────────────────────────

    private _selectSlot(idx: number): void {
        const prev = this._selected;
        this._selected = idx;

        this._slotsEl.querySelector<HTMLElement>(`[data-idx="${prev}"]`)
            ?.setAttribute('aria-checked', 'false');
        const next = this._slotsEl.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
        next?.setAttribute('aria-checked', 'true');
        next?.scrollIntoView({ block: 'nearest' });

        this._syncSelected();

        const detail = { slot: idx, emoji: this._slots[idx].emoji };
        this.broadcastMessage(this._channel, 'select', detail);
        this.dispatchEvent(new CustomEvent('select', { bubbles: true, composed: true, detail }));
    }

    private _syncSelected(): void {
        if (!this._faceEl) return;
        const slot = this._slots[this._selected];
        this._faceEmojiEl.textContent = slot.emoji;
        this._faceEl.setAttribute('aria-label',
            `Open recorder — ${slot.emoji} slot ${this._selected + 1}`);
        this._faceDotEl.classList.toggle('visible', !!slot.blob);

        if (this._dialogIconEl) this._dialogIconEl.textContent = slot.emoji;
        if (this._dialogNameEl) this._dialogNameEl.textContent = `SLOT ${this._selected + 1}`;

        this._updateTransportButtons();
    }

    // ── Transport event delegation ────────────────────────────────────────────

    private _onTransportClick = (e: Event): void => {
        const wrap = (e.target as Element).closest<HTMLElement>('[data-action]');
        if (!wrap || wrap.classList.contains('t-disabled')) return;
        switch (wrap.dataset.action) {
            case 'play':   this._onPlay();        break;
            case 'record': void this._onRecord(); break;
        }
    };

    private _onPlay(): void {
        if (this._transport === 'playing') {
            this._stopPlayback();
            this._setStatus('READY', '');
            return;
        }
        const slot = this._slots[this._selected];
        if (!slot.url) { this._setStatus('NO RECORDING', ''); return; }
        if (this._transport === 'recording') this._cancelRecording();
        this._play(slot.url);
    }

    private async _onRecord(): Promise<void> {
        if (this._transport === 'recording') {
            this._stopRecording();
        } else {
            if (this._transport === 'playing') this._stopPlayback();
            await this._startRecording();
        }
    }

    // ── Playback (via <audio>) ────────────────────────────────────────────────

    private _play(url: string): void {
        this._audioEl.loop = true;
        this._audioEl.src = url;
        this._audioEl.currentTime = 0;
        this._audioEl.play().then(() => {
            this._transport = 'playing';
            this._setStatus('PLAYING…', 'playing');
            this._rbPlay.setAttribute('color', BTN_PLAY_ACTIVE);
            this._rbPlay.setAttribute('label', '⏹️');
            this._wrapPlay.querySelector<HTMLElement>('.t-label')!.textContent = 'STOP';
            this._updateTransportButtons();
            this.broadcastMessage(this._channel, 'play', {
                slot: this._selected,
                emoji: this._slots[this._selected].emoji,
            });
        }).catch(err => {
            console.warn('[ravel-field-recorder] play failed', err);
            this._setStatus('ERROR', '');
        });
    }

    private _stopPlayback(): void {
        if (!this._audioEl.paused) {
            this._audioEl.pause();
            this._audioEl.currentTime = 0;
        }
        if (this._transport === 'playing') {
            this._transport = 'idle';
            this._rbPlay?.setAttribute('color', BTN_PLAY_IDLE);
            this._rbPlay?.setAttribute('label', '▶️');
            const pl = this._wrapPlay?.querySelector<HTMLElement>('.t-label');
            if (pl) pl.textContent = 'PLAY';
            this._updateTransportButtons();
            this.broadcastMessage(this._channel, 'stop', { slot: this._selected });
        }
    }

    private _onAudioEnded = (): void => {
        this._transport = 'idle';
        this._rbPlay.setAttribute('color', BTN_PLAY_IDLE);
        this._rbPlay.setAttribute('label', '▶️');
        this._wrapPlay.querySelector<HTMLElement>('.t-label')!.textContent = 'PLAY';
        this._setStatus('READY', '');
        this._updateTransportButtons();
        this.broadcastMessage(this._channel, 'stop', { slot: this._selected });
    };

    // ── Recording ─────────────────────────────────────────────────────────────

    private async _startRecording(): Promise<void> {
        try {
            this._stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch {
            this._setStatus('MIC DENIED', '');
            return;
        }

        this._chunks = [];
        this._recorder = new MediaRecorder(this._stream);
        this._recorder.ondataavailable = (e) => {
            if (e.data.size > 0) this._chunks.push(e.data);
        };
        this._recorder.onstop = () => this._onRecordingComplete();
        this._recorder.start();

        this._transport = 'recording';
        this._setStatus('RECORDING…', 'recording');
        this._rbRecord.setAttribute('color', BTN_REC_ACTIVE);
        this._rbRecord.setAttribute('label', '⏹️');
        this._wrapRecord.querySelector<HTMLElement>('.t-label')!.textContent = 'STOP';
        this._updateTransportButtons();
        this.broadcastMessage(this._channel, 'record-start', { slot: this._selected });
    }

    private _stopRecording(): void {
        if (this._recorder?.state !== 'inactive') this._recorder?.stop();
        if (this._stream) {
            this._stream.getTracks().forEach(t => t.stop());
            this._stream = null;
        }
    }

    private _onRecordingComplete(): void {
        this._recorder = null;
        this._rbRecord.setAttribute('color', BTN_REC_IDLE);
        this._rbRecord.setAttribute('label', '🔴');
        this._wrapRecord.querySelector<HTMLElement>('.t-label')!.textContent = 'RECORD';

        if (this._chunks.length === 0) {
            this._transport = 'idle';
            this._setStatus('READY', '');
            this._updateTransportButtons();
            this.broadcastMessage(this._channel, 'record-cancel', { slot: this._selected });
            return;
        }

        const blob = new Blob(this._chunks, { type: 'audio/webm' });
        this._chunks = [];

        const slot = this._slots[this._selected];
        if (slot.url) URL.revokeObjectURL(slot.url);
        slot.blob = blob;
        slot.url  = URL.createObjectURL(blob);

        this._transport = 'idle';
        this._setStatus('SAVED ✓', '');
        this._updateSlotEl(this._selected);
        this._syncSelected();
        this._updateTransportButtons();

        this.broadcastMessage(this._channel, 'record-stop', {
            slot: this._selected, emoji: slot.emoji, hasAudio: true,
        });
    }

    private _cancelRecording(): void {
        if (this._recorder && this._recorder.state !== 'inactive') {
            this._recorder.ondataavailable = null;
            this._recorder.onstop = null;
            try { this._recorder.stop(); } catch { /* ignore */ }
            this._recorder = null;
        }
        if (this._stream) {
            this._stream.getTracks().forEach(t => t.stop());
            this._stream = null;
        }
        if (this._transport === 'recording') {
            this._transport = 'idle';
            this._rbRecord?.setAttribute('color', BTN_REC_IDLE);
            this._rbRecord?.setAttribute('label', '🔴');
            const rl = this._wrapRecord?.querySelector<HTMLElement>('.t-label');
            if (rl) rl.textContent = 'RECORD';
        }
    }

    // ── Dialog open / close ───────────────────────────────────────────────────

    private _onFaceClick     = (): void => { this._open(); };
    private _onBackdropClick = (): void => { this._close(); };
    private _onClose         = (): void => { this._close(); };

    private _open(): void {
        this._backdropEl.hidden = false;
        this._dialogEl.hidden   = false;
        this._backdropEl.removeAttribute('aria-hidden');
        this._faceEl.setAttribute('aria-expanded', 'true');
        this._syncSelected();
        this._setStatus('READY', '');
        this._updateTransportButtons();
        requestAnimationFrame(() => this._btnClose.focus());
    }

    private _close(): void {
        this._backdropEl.hidden = true;
        this._dialogEl.hidden   = true;
        this._backdropEl.setAttribute('aria-hidden', 'true');
        this._faceEl.setAttribute('aria-expanded', 'false');
        this._faceEl.focus();
    }

    private _onDialogKeyDown = (e: KeyboardEvent): void => {
        if (e.key === 'Escape') {
            e.stopPropagation();
            this._close();
            return;
        }

        if (['ArrowRight','ArrowLeft','ArrowDown','ArrowUp'].includes(e.key)) {
            const focused = this.shadowRoot!.activeElement as HTMLElement | null;
            if (!focused?.classList.contains('slot-btn')) return;
            e.preventDefault();
            const cols = 5;
            const idx  = parseInt(focused.dataset.idx ?? '0');
            let next = idx;
            if (e.key === 'ArrowRight') next = Math.min(this._slotCount - 1, idx + 1);
            if (e.key === 'ArrowLeft')  next = Math.max(0, idx - 1);
            if (e.key === 'ArrowDown')  next = Math.min(this._slotCount - 1, idx + cols);
            if (e.key === 'ArrowUp')    next = Math.max(0, idx - cols);
            (this._slotsEl.querySelector<HTMLElement>(`[data-idx="${next}"]`))?.focus();
        }

        if (e.key === 'Tab') {
            const focusable = Array.from(
                this._dialogEl.querySelectorAll<HTMLElement>('button:not([disabled])')
            );
            if (!focusable.length) return;
            const active = this.shadowRoot!.activeElement;
            if (e.shiftKey && active === focusable[0]) {
                e.preventDefault(); focusable[focusable.length - 1].focus();
            } else if (!e.shiftKey && active === focusable[focusable.length - 1]) {
                e.preventDefault(); focusable[0].focus();
            }
        }
    };

    // ── UI helpers ────────────────────────────────────────────────────────────

    private _setStatus(text: string, cls: '' | 'recording' | 'playing'): void {
        if (!this._statusEl) return;
        this._statusEl.textContent = text;
        this._statusEl.className   = cls;
    }

    private _updateTransportButtons(): void {
        if (!this._wrapPlay) return;
        const hasAudio = !!this._slots[this._selected].blob;
        // Play enabled when there is audio OR currently playing (so it can act as stop)
        this._wrapPlay.classList.toggle('t-disabled', !hasAudio && this._transport !== 'playing');
        // Record is always enabled: starts recording when idle, stops when recording
        this._wrapRecord.classList.remove('t-disabled');
    }

    private _applySize(): void {
        this.container.style.setProperty('--face-size', `${this._sizePx}px`);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    selectSlot(idx: number): void {
        this._selectSlot(Math.max(0, Math.min(this._slotCount - 1, idx)));
    }

    hasRecording(idx: number): boolean {
        return !!this._slots[idx]?.blob;
    }

    getBlob(idx: number): Blob | null {
        return this._slots[idx]?.blob ?? null;
    }
}
