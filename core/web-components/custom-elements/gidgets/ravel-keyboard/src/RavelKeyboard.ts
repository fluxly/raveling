import { RavelElement } from '../../../../common/RavelElement';

const WW  = 28;  // white key width
const WH  = 80;  // white key height
const BW  = 18;  // black key width
const BH  = 50;  // black key height
const GAP = 1;   // gap between white keys

const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

// Maps a MIDI note to its white-key index on an infinite keyboard.
function whiteIdx(note: number): number {
    const pcToW = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
    return Math.floor(note / 12) * 7 + pcToW[note % 12];
}

function noteLabel(note: number): string {
    const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    return `${NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

/**
 * Playable piano keyboard. Sends `note-on` / `note-off` via the Ravel
 * messaging system so it plugs directly into `<ravel-midi-broker>`.
 * Supports mouse glide, multi-touch polyphony, and keyboard navigation.
 *
 * ### Attributes
 * | Attribute  | Type    | Default               | Description                              |
 * |------------|---------|-----------------------|------------------------------------------|
 * | `from`     | number  | `60`                  | Lowest MIDI note (inclusive)             |
 * | `to`       | number  | `83`                  | Highest MIDI note (inclusive)            |
 * | `channel`  | string  | `'ravel-midi-broker'` | Pub/sub channel to send messages on      |
 * | `midi-ch`  | number  | `0`                   | MIDI channel (0–15) in message payloads  |
 * | `velocity` | number  | `100`                 | Note-on velocity (1–127)                 |
 * | `labels`   | `on\|off` | `on`                | Show note labels on white keys           |
 *
 * ### Messages sent (on `channel`)
 * | cmd    | content                                            | Trigger           |
 * |--------|----------------------------------------------------|-------------------|
 * | `send` | `{ type:'note-on',  channel, note, velocity }`    | Key pressed       |
 * | `send` | `{ type:'note-off', channel, note, velocity:0 }`  | Key released      |
 *
 * ### DOM events dispatched (bubbling, composed)
 * | Event      | detail                             | Trigger       |
 * |------------|------------------------------------|---------------|
 * | `note-on`  | `{ note, velocity, channel }`      | Key pressed   |
 * | `note-off` | `{ note, channel }`                | Key released  |
 */
export class RavelKeyboard extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: inline-block;
            user-select: none;
            -webkit-user-select: none;
            touch-action: none;
        }
        #piano {
            position: relative;
            height: ${WH}px;
        }
        .key {
            position: absolute;
            cursor: pointer;
            box-sizing: border-box;
        }
        .key-w {
            width: ${WW}px;
            height: ${WH}px;
            background: linear-gradient(180deg, #ddd8cc 0%, #f5f0e8 12%, #f5f0e8 100%);
            border: 1px solid rgba(40,30,15,0.45);
            border-top: 2px solid rgba(40,30,15,0.25);
            border-radius: 0 0 3px 3px;
            z-index: 0;
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            align-items: center;
            padding-bottom: 5px;
            transition: background 50ms ease;
        }
        .key-w:focus-visible {
            outline: 2px solid var(--ravel-focus, #00F0FF);
            outline-offset: -2px;
            z-index: 3;
        }
        .key-w.active {
            background: linear-gradient(180deg, #8fd900 0%, #a7ff00 15%, #a7ff00 100%);
            border-color: rgba(80,140,0,0.7);
        }
        .key-b {
            width: ${BW}px;
            height: ${BH}px;
            background: linear-gradient(180deg, #2c2c2c 0%, #1a1a1a 55%, #262626 100%);
            border: 1px solid #000;
            border-top: none;
            border-radius: 0 0 2px 2px;
            z-index: 1;
            transition: background 50ms ease;
        }
        .key-b:focus-visible {
            outline: 2px solid var(--ravel-focus, #00F0FF);
            outline-offset: -2px;
            z-index: 3;
        }
        .key-b.active {
            background: linear-gradient(180deg, #8fd900 0%, #a7ff00 60%, #8fd900 100%);
        }
        .key-label {
            font-family: var(--ravel-font, 'Silkscreen', monospace);
            font-size: 5px;
            color: rgba(0,0,0,0.32);
            letter-spacing: 0;
            pointer-events: none;
            line-height: 1;
        }
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'from', 'to', 'channel', 'midi-ch', 'velocity', 'labels',
        ];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _pianoEl!: HTMLElement;

    // ── Config ────────────────────────────────────────────────────────────────

    private _from       = 60;
    private _to         = 83;
    private _channel    = 'ravel-midi-broker';
    private _midiCh     = 0;
    private _velocity   = 100;
    private _showLabels = true;

    // ── Key state ─────────────────────────────────────────────────────────────

    private _keyEls       = new Map<number, HTMLElement>(); // note → element
    private _pointerNotes = new Map<number, number>();      // pointerId → note
    private _kbNotes      = new Set<number>();              // keyboard-held notes

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelKeyboard.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this._pianoEl = document.createElement('div');
        this._pianoEl.id = 'piano';
        this._pianoEl.setAttribute('role', 'group');
        this._pianoEl.setAttribute('aria-label', 'Piano keyboard');
        this.container.appendChild(this._pianoEl);

        this._buildKeyboard();
    }

    protected setup(): void {
        super.setup();
        this._pianoEl.addEventListener('pointerdown',   this._onPointerDown);
        this._pianoEl.addEventListener('pointermove',   this._onPointerMove);
        this._pianoEl.addEventListener('pointerup',     this._onPointerUp);
        this._pianoEl.addEventListener('pointercancel', this._onPointerUp);
        this._pianoEl.addEventListener('keydown',       this._onKeyDown);
        this._pianoEl.addEventListener('keyup',         this._onKeyUp);
    }

    protected teardown(): void {
        for (const note of this._pointerNotes.values()) this._endNote(note);
        this._pointerNotes.clear();
        for (const note of this._kbNotes) this._endNote(note);
        this._kbNotes.clear();

        this._pianoEl.removeEventListener('pointerdown',   this._onPointerDown);
        this._pianoEl.removeEventListener('pointermove',   this._onPointerMove);
        this._pianoEl.removeEventListener('pointerup',     this._onPointerUp);
        this._pianoEl.removeEventListener('pointercancel', this._onPointerUp);
        this._pianoEl.removeEventListener('keydown',       this._onKeyDown);
        this._pianoEl.removeEventListener('keyup',         this._onKeyUp);

        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        switch (name) {
            case 'from':
                this._from = parseInt(newValue ?? '60') || 60;
                this._rebuild();
                break;
            case 'to':
                this._to = parseInt(newValue ?? '83') || 83;
                this._rebuild();
                break;
            case 'channel':
                this._channel = newValue ?? 'ravel-midi-broker';
                break;
            case 'midi-ch':
                this._midiCh = Math.max(0, Math.min(15, parseInt(newValue ?? '0') || 0));
                break;
            case 'velocity':
                this._velocity = Math.max(1, Math.min(127, parseInt(newValue ?? '100') || 100));
                break;
            case 'labels':
                this._showLabels = newValue !== 'off';
                this._rebuild();
                break;
        }
    }

    // ── Keyboard build ────────────────────────────────────────────────────────

    private _buildKeyboard(): void {
        if (!this._pianoEl) return;
        this._pianoEl.innerHTML = '';
        this._keyEls.clear();

        const originW = whiteIdx(this._from);
        let maxW = 0;

        for (let note = this._from; note <= this._to; note++) {
            const isBlack = BLACK_PCS.has(note % 12);
            const el = document.createElement('div');
            el.className = `key ${isBlack ? 'key-b' : 'key-w'}`;
            el.dataset.note = String(note);
            el.setAttribute('role', 'button');
            el.setAttribute('aria-label', noteLabel(note));
            el.setAttribute('aria-pressed', 'false');
            el.setAttribute('tabindex', '0');

            if (!isBlack) {
                const w = whiteIdx(note) - originW;
                el.style.left = `${w * (WW + GAP)}px`;
                maxW = Math.max(maxW, w + 1);

                if (this._showLabels) {
                    const lbl = document.createElement('span');
                    lbl.className = 'key-label';
                    lbl.textContent = noteLabel(note);
                    lbl.setAttribute('aria-hidden', 'true');
                    el.appendChild(lbl);
                }
            } else {
                const prevW = whiteIdx(note - 1) - originW;
                el.style.left = `${prevW * (WW + GAP) + WW - Math.round(BW / 2)}px`;
            }

            this._pianoEl.appendChild(el);
            this._keyEls.set(note, el);
        }

        this._pianoEl.style.width = `${maxW * (WW + GAP) - GAP}px`;
    }

    private _rebuild(): void {
        for (const note of this._pointerNotes.values()) this._endNote(note);
        this._pointerNotes.clear();
        for (const note of this._kbNotes) this._endNote(note);
        this._kbNotes.clear();
        this._buildKeyboard();
    }

    // ── Hit testing (pointer capture keeps target fixed; use coordinates) ─────

    private _keyAtPoint(clientX: number, clientY: number): HTMLElement | null {
        const rect = this._pianoEl.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        if (x < 0 || x > rect.width || y < 0 || y > rect.height) return null;

        // Black keys take visual priority — check them first.
        for (const el of this._keyEls.values()) {
            if (!el.classList.contains('key-b')) continue;
            const kl = parseFloat(el.style.left);
            if (x >= kl && x < kl + BW && y < BH) return el;
        }
        for (const el of this._keyEls.values()) {
            if (!el.classList.contains('key-w')) continue;
            const kl = parseFloat(el.style.left);
            if (x >= kl && x < kl + WW) return el;
        }
        return null;
    }

    // ── Note start / end ──────────────────────────────────────────────────────

    private _startNote(note: number): void {
        const el = this._keyEls.get(note);
        if (!el) return;
        el.classList.add('active');
        el.setAttribute('aria-pressed', 'true');

        this.sendMessage(this._channel, 'send', {
            type: 'note-on', channel: this._midiCh, note, velocity: this._velocity,
        });
        this.dispatchEvent(new CustomEvent('note-on', {
            bubbles: true, composed: true,
            detail: { note, velocity: this._velocity, channel: this._midiCh },
        }));
    }

    private _endNote(note: number): void {
        const el = this._keyEls.get(note);
        if (!el) return;
        el.classList.remove('active');
        el.setAttribute('aria-pressed', 'false');

        this.sendMessage(this._channel, 'send', {
            type: 'note-off', channel: this._midiCh, note, velocity: 0,
        });
        this.dispatchEvent(new CustomEvent('note-off', {
            bubbles: true, composed: true,
            detail: { note, channel: this._midiCh },
        }));
    }

    // ── Pointer events (glide + multi-touch) ──────────────────────────────────

    private _onPointerDown = (e: PointerEvent): void => {
        const key = this._keyAtPoint(e.clientX, e.clientY);
        if (!key) return;
        e.preventDefault();
        this._pianoEl.setPointerCapture(e.pointerId);
        const note = parseInt(key.dataset.note!);
        this._pointerNotes.set(e.pointerId, note);
        this._startNote(note);
    };

    private _onPointerMove = (e: PointerEvent): void => {
        const prev = this._pointerNotes.get(e.pointerId);
        if (prev === undefined) return;
        const key = this._keyAtPoint(e.clientX, e.clientY);
        const note = key ? parseInt(key.dataset.note!) : -1;
        if (note === prev) return;
        this._endNote(prev);
        if (note >= 0) {
            this._pointerNotes.set(e.pointerId, note);
            this._startNote(note);
        } else {
            this._pointerNotes.delete(e.pointerId);
        }
    };

    private _onPointerUp = (e: PointerEvent): void => {
        const note = this._pointerNotes.get(e.pointerId);
        if (note !== undefined) {
            this._endNote(note);
            this._pointerNotes.delete(e.pointerId);
        }
    };

    // ── Keyboard navigation ───────────────────────────────────────────────────

    private _onKeyDown = (e: KeyboardEvent): void => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        const key = (e.target as Element).closest<HTMLElement>('[data-note]');
        if (!key) return;
        e.preventDefault();
        const note = parseInt(key.dataset.note!);
        if (!this._kbNotes.has(note)) {
            this._kbNotes.add(note);
            this._startNote(note);
        }
    };

    private _onKeyUp = (e: KeyboardEvent): void => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        const key = (e.target as Element).closest<HTMLElement>('[data-note]');
        if (!key) return;
        const note = parseInt(key.dataset.note!);
        if (this._kbNotes.has(note)) {
            this._kbNotes.delete(note);
            this._endNote(note);
        }
    };
}
