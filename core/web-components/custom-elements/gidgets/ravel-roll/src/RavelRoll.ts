import { RavelElement } from '../../../../common/RavelElement';
import { componentPath } from '../../../../common/RavelComponentPath.js';

const NOTE_COLORS: Record<string, string> = {
    'B':  '#e00000',
    'A#': '#cc4b01',
    'A':  '#fe6810',
    'G#': '#bb7e01',
    'G':  '#ea9f01',
    'F#': '#01b501',
    'F':  '#00ff00',
    'E':  '#0afeff',
    'D#': '#009a9a',
    'D':  '#0e65e5',
    'C#': '#ba0186',
    'C':  '#ff18c1',
};

// Descending chromatic order — B7 is at the top of the roll.
const CHROMATIC_DESC = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];

interface NoteInfo { name: string; octave: number; color: string; }

/**
 * A piano-roll container that generates and manages a column of
 * {@link RavelRollTrack} lanes, one per chromatic note from B7 (top) downward.
 *
 * The element fills its parent's width and scrolls both horizontally
 * (timeline axis) and vertically (pitch axis).
 *
 * ### Attributes
 * | Attribute       | Type    | Default | Description                                     |
 * |-----------------|---------|---------|--------------------------------------------------|
 * | `tracks`        | number  | `87`    | Number of tracks (notes) to generate             |
 * | `unit-width`    | number  | `60`    | Pixels per timeline unit — forwarded to tracks   |
 * | `quantum`       | number  | `1`     | Snap step in units — forwarded to tracks         |
 * | `track-h`       | number  | `20`    | Height of each track in px                       |
 * | `tick`          | number  | `1`     | Minor tick interval in units — forwarded         |
 * | `tick-mul`      | number  | `4`     | Major tick multiplier — forwarded                |
 * | `length`        | number  | `128`   | Scrollable width in units                        |
 * | `h`             | number  | `0`     | Roll height in px; `0` = unconstrained           |
 * | `show-keyboard` | boolean | `true`  | Show the piano keyboard hint on the left side    |
 */
export class RavelRoll extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: block;
            overflow: auto;
            width: 100%;
            box-sizing: border-box;
        }
        #inner {
            display: flex;
            flex-direction: row;
            align-items: stretch;
            min-width: 100%;
        }
        #keyboard {
            position: sticky;
            left: 0;
            width: 80px;
            flex-shrink: 0;
            z-index: 10;
            background-repeat: no-repeat;
            background-size: 100% 100%;
            background-color: #1a1a2e;
        }
        #tracks-wrapper {
            flex: 1 1 auto;
            min-width: 0;
        }
    `;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'tracks', 'unit-width', 'quantum', 'track-h',
            'tick', 'tick-mul', 'length', 'h', 'show-keyboard',
        ];
    }

    private _trackEls: HTMLElement[] = [];
    private innerEl!: HTMLDivElement;
    private keyboardEl!: HTMLDivElement;
    private tracksWrapperEl!: HTMLDivElement;

    private _tracks        = 87;
    private _unitWidth     = 60;
    private _quantum       = 1;
    private _trackH        = 20;
    private _tick          = 1;
    private _tickMul       = 4;
    private _length        = 128;
    private _h             = 0;
    private _showKeyboard  = true;

    // Lifecycle

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelRoll.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        // Build inner flex layout inside #container
        this.innerEl = document.createElement('div');
        this.innerEl.id = 'inner';

        this.keyboardEl = document.createElement('div');
        this.keyboardEl.id = 'keyboard';

        this.tracksWrapperEl = document.createElement('div');
        this.tracksWrapperEl.id = 'tracks-wrapper';

        this.innerEl.appendChild(this.keyboardEl);
        this.innerEl.appendChild(this.tracksWrapperEl);
        this.container.appendChild(this.innerEl);
    }

    protected setup(): void {
        super.setup();
        this._applyHeight();
        this._applyWidth();
        this._applyKeyboard();
        this._buildTracks();
    }

    protected teardown(): void {
        this._trackEls = [];
        super.teardown();
    }

    // ── Track management ──────────────────────────────────────

    private _buildTracks(): void {
        this.tracksWrapperEl.innerHTML = '';
        this._trackEls = [];

        const prefix = this.id || 'rr';
        for (const { name, octave, color } of RavelRoll._noteList(this._tracks)) {
            const el = document.createElement('ravel-roll-track') as HTMLElement;
            el.id = `${prefix}-${name.replace('#', 's')}${octave}`;
            el.setAttribute('label',      `${name}${octave}`);
            el.setAttribute('color',      color);
            el.setAttribute('h',          String(this._trackH));
            el.setAttribute('unit-width', String(this._unitWidth));
            el.setAttribute('quantum',    String(this._quantum));
            el.setAttribute('tick',       String(this._tick));
            el.setAttribute('tick-mul',   String(this._tickMul));
            this.tracksWrapperEl.appendChild(el);
            this._trackEls.push(el);
        }
    }

    private _syncAttr(attr: string, value: string): void {
        for (const el of this._trackEls) {
            el.setAttribute(attr, value);
        }
    }

    private _applyHeight(): void {
        this.style.height = this._h > 0 ? `${this._h}px` : '';
    }

    private _applyWidth(): void {
        if (this.tracksWrapperEl) {
            this.tracksWrapperEl.style.width = `${this._length * this._unitWidth}px`;
        }
    }

    private _applyKeyboard(): void {
        if (!this.keyboardEl) return;
        if (this._showKeyboard) {
            this.keyboardEl.style.display = '';
            this.keyboardEl.style.backgroundImage =
                `url('${componentPath}/images/piano-roll-keyboard.svg')`;
        } else {
            this.keyboardEl.style.display = 'none';
        }
    }

    // ── Static helpers ────────────────────────────────────────

    private static _noteList(count: number): NoteInfo[] {
        const result: NoteInfo[] = [];
        let octave = 7;
        let idx = 0;
        for (let i = 0; i < count; i++) {
            const name = CHROMATIC_DESC[idx];
            result.push({ name, octave, color: NOTE_COLORS[name] ?? '#4488ff' });
            if (++idx >= CHROMATIC_DESC.length) { idx = 0; octave--; }
        }
        return result;
    }

    // ── Attribute handling ────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);

        switch (name) {
            case 'tracks':
                this._tracks = Math.max(Number(newValue) || 87, 0);
                if (this.tracksWrapperEl) this._buildTracks();
                break;
            case 'unit-width':
                this._unitWidth = Number(newValue) || 60;
                if (this.tracksWrapperEl) { this._syncAttr('unit-width', String(this._unitWidth)); this._applyWidth(); }
                break;
            case 'quantum':
                this._quantum = Math.max(Number(newValue) || 1, 0.001);
                if (this._trackEls.length) this._syncAttr('quantum', String(this._quantum));
                break;
            case 'track-h':
                this._trackH = Number(newValue) || 20;
                if (this._trackEls.length) this._syncAttr('h', String(this._trackH));
                break;
            case 'tick':
                this._tick = Number(newValue) ?? 1;
                if (this._trackEls.length) this._syncAttr('tick', String(this._tick));
                break;
            case 'tick-mul':
                this._tickMul = Math.max(1, Number(newValue) || 4);
                if (this._trackEls.length) this._syncAttr('tick-mul', String(this._tickMul));
                break;
            case 'length':
                this._length = Number(newValue) || 128;
                if (this.tracksWrapperEl) this._applyWidth();
                break;
            case 'h':
                this._h = Number(newValue) || 0;
                this._applyHeight();
                break;
            case 'show-keyboard':
                this._showKeyboard = newValue !== 'false';
                this._applyKeyboard();
                break;
        }
    }
}
