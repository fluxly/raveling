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

const CHROMATIC_DESC = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];

interface NoteInfo { name: string; octave: number; color: string; }

export class RavelRoll extends RavelElement {

    private static readonly PPQ            = 128;
    private static readonly TICKS_PER_UNIT = 4;       // PPQ * 4 / 128  (1 unit = 1/128th note)
    private static readonly TEMPO_US       = 500_000; // 120 BPM

    private static readonly localStyles = `
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            box-sizing: border-box;
            overflow: hidden;
        }
        #container {
            display: flex;
            flex-direction: column;
            height: 100%;
            min-height: 0;
        }
        #scroll-area {
            flex: 1 1 0;
            min-height: 0;
            overflow: auto;
            scrollbar-color: #2a2a44 #0d0d1e;
            scrollbar-width: thin;
        }
        #scroll-area::-webkit-scrollbar {
            width: 6px;
            height: 6px;
        }
        #scroll-area::-webkit-scrollbar-track {
            background: #0d0d1e;
        }
        #scroll-area::-webkit-scrollbar-thumb {
            background: #2a2a44;
            border-radius: 3px;
        }
        #scroll-area::-webkit-scrollbar-thumb:hover {
            background: #3a3a5a;
        }
        #scroll-area::-webkit-scrollbar-corner {
            background: #0d0d1e;
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
            flex: 0 0 auto;
            position: relative;
        }
        #onion {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            width: auto;
            pointer-events: none;
            z-index: 5;
            opacity: 0.6;
            transform-origin: left top;
        }
        #onion svg {
            height: 100%;
            display: block;
        }
        #control-bar {
            flex-shrink: 0;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 8px;
            background: #0d0d1e;
            border-top: 1px solid #1e1e36;
        }
        #control-bar input[type=range] {
            flex: 1;
            margin: 0;
            cursor: pointer;
            accent-color: #3355cc;
        }
    `;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'tracks', 'unit-width', 'quantum', 'track-h',
            'tick', 'tick-mul', 'length', 'h', 'show-keyboard', 'onion-src',
        ];
    }

    private _trackEls: HTMLElement[] = [];
    private scrollAreaEl!: HTMLDivElement;
    private innerEl!: HTMLDivElement;
    private keyboardEl!: HTMLDivElement;
    private tracksWrapperEl!: HTMLDivElement;
    private onionEl!: HTMLDivElement;
    private controlBarEl!: HTMLDivElement;
    private offsetSliderEl!: HTMLInputElement;
    private widthSliderEl!: HTMLInputElement;
    private lengthSliderEl!: HTMLInputElement;
    private exportBtnEl!: HTMLElement;
    private importBtnEl!: HTMLElement;
    private midiFileInputEl!: HTMLInputElement;

    private _tracks           = 87;
    private _unitWidth        = 2;
    private _quantum          = 8;
    private _trackH           = 20;
    private _tick             = 32;
    private _tickMul          = 4;
    private _length           = 512;
    private _h                = 0;
    private _showKeyboard     = true;
    private _onionSrc         = '';
    private _onionNaturalWidth = 0;
    private _onionScalePct    = 100;   // displayed width as % of natural
    private _onionTempoBpm    = 120;   // read from data-tempo on the SVG, used for MIDI export
    private _onionOffsetX     = 0;     // translateX in px

    // Lifecycle

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelRoll.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        // ── Scroll area ──────────────────────────────────────────
        this.scrollAreaEl = document.createElement('div');
        this.scrollAreaEl.id = 'scroll-area';

        // ── Inner flex row ───────────────────────────────────────
        this.innerEl = document.createElement('div');
        this.innerEl.id = 'inner';

        this.keyboardEl = document.createElement('div');
        this.keyboardEl.id = 'keyboard';

        this.tracksWrapperEl = document.createElement('div');
        this.tracksWrapperEl.id = 'tracks-wrapper';

        this.onionEl = document.createElement('div');
        this.onionEl.id = 'onion';
        this.tracksWrapperEl.appendChild(this.onionEl);

        this.innerEl.appendChild(this.keyboardEl);
        this.innerEl.appendChild(this.tracksWrapperEl);
        this.scrollAreaEl.appendChild(this.innerEl);
        this.container.appendChild(this.scrollAreaEl);

        // ── Control bar ──────────────────────────────────────────
        this.controlBarEl = document.createElement('div');
        this.controlBarEl.id = 'control-bar';

        this.offsetSliderEl = this._makeSlider(-500, 500, 1, 0, () => {
            this._onionOffsetX = Number(this.offsetSliderEl.value);
            this._applyOnionTransform();
        });

        this.widthSliderEl = this._makeSlider(1, 400, 0.5, 91.5, () => {
            this._onionScalePct = Number(this.widthSliderEl.value);
            this._applyOnionTransform();
        });

        this.lengthSliderEl = this._makeSlider(8, 16384, 8, this._length, () => {
            const minLen = this._getPopulatedLength();
            const val    = Math.max(minLen, Number(this.lengthSliderEl.value));
            if (val !== Number(this.lengthSliderEl.value)) this.lengthSliderEl.value = String(val);
            this._length = val;
            this._applyWidth();
        });

        this.controlBarEl.appendChild(this.offsetSliderEl);
        this.controlBarEl.appendChild(this.widthSliderEl);
        this.controlBarEl.appendChild(this.lengthSliderEl);

        this.midiFileInputEl = document.createElement('input');
        this.midiFileInputEl.type = 'file';
        this.midiFileInputEl.accept = '.mid,.midi';
        this.midiFileInputEl.style.display = 'none';
        this.midiFileInputEl.addEventListener('change', () => {
            const file = this.midiFileInputEl.files?.[0];
            if (!file) return;
            file.arrayBuffer().then(buf => this._importMidi(buf));
            this.midiFileInputEl.value = '';
        });
        this.container.appendChild(this.midiFileInputEl);

        this.importBtnEl = document.createElement('ravel-button');
        this.importBtnEl.setAttribute('label', 'MIDI IN');
        this.importBtnEl.setAttribute('w', '72');
        this.importBtnEl.setAttribute('h', '24');
        (this.importBtnEl as any).addVirtualListener('click', () => this.midiFileInputEl.click());
        this.controlBarEl.appendChild(this.importBtnEl);

        this.exportBtnEl = document.createElement('ravel-button');
        this.exportBtnEl.setAttribute('label', 'MIDI');
        this.exportBtnEl.setAttribute('w', '56');
        this.exportBtnEl.setAttribute('h', '24');
        (this.exportBtnEl as any).addVirtualListener('click', () => this._exportMidi());
        this.controlBarEl.appendChild(this.exportBtnEl);

        this.container.appendChild(this.controlBarEl);
    }

    protected setup(): void {
        super.setup();
        window.addEventListener('ravel-roll-track', this._handleTrackEvent);
        this._applyHeight();
        this._applyWidth();
        this._applyKeyboard();
        this._applyOnionSrc();
        this._buildTracks();
    }

    protected teardown(): void {
        window.removeEventListener('ravel-roll-track', this._handleTrackEvent);
        this._trackEls = [];
        super.teardown();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private _makeSlider(
        min: number, max: number, step: number, value: number,
        onInput: () => void,
    ): HTMLInputElement {
        const el = document.createElement('input');
        el.type  = 'range';
        el.min   = String(min);
        el.max   = String(max);
        el.step  = String(step);
        el.value = String(value);
        el.addEventListener('input', onInput);
        return el;
    }

    // ── Track management ──────────────────────────────────────────────────────

    private _buildTracks(): void {
        this.tracksWrapperEl.innerHTML = '';
        this.tracksWrapperEl.appendChild(this.onionEl);
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
        for (const el of this._trackEls) el.setAttribute(attr, value);
    }

    // ── Layout ────────────────────────────────────────────────────────────────

    private _applyHeight(): void {
        this.style.height = this._h > 0 ? `${this._h}px` : '';
    }

    private _applyWidth(): void {
        if (!this.tracksWrapperEl) return;
        const scaledOnion = this._onionNaturalWidth * this._onionScalePct / 100;
        const w = Math.max(this._length * this._unitWidth, scaledOnion);
        this.tracksWrapperEl.style.width = `${w}px`;
    }

    // ── Keyboard ──────────────────────────────────────────────────────────────

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

    // ── Onion skin ────────────────────────────────────────────────────────────

    private _applyOnionSrc(): void {
        if (!this.onionEl) return;
        this.onionEl.innerHTML = '';
        this._onionNaturalWidth = 0;
        this._onionOffsetX = 0;
        this._onionScalePct = 100;

        this._onionTempoBpm = 120;

        if (!this._onionSrc) {
            this._applyWidth();
            return;
        }

        fetch(this._onionSrc)
            .then(r => {
                if (!r.ok) throw new Error(`${r.status} ${r.statusText} — ${this._onionSrc}`);
                return r.text();
            })
            .then(svgText => {
                const tmp = document.createElement('div');
                tmp.innerHTML = svgText;
                const svg = tmp.querySelector('svg');
                if (!svg) throw new Error('No <svg> element found in response');

                const naturalW      = parseFloat(svg.getAttribute('width') || '0');
                const tempoAttr     = parseFloat(svg.getAttribute('data-tempo') || '0');
                const svgUnitWidth  = parseFloat(svg.getAttribute('data-unit-width') || '0');
                this._onionTempoBpm = tempoAttr > 0 ? tempoAttr : 120;

                // Auto-scale so 1 SVG unit = 1 roll unit pixel-wide.
                // If the SVG lacks data-unit-width, default to 100%.
                const autoScale = svgUnitWidth > 0
                    ? (this._unitWidth / svgUnitWidth) * 100
                    : 91.5;

                svg.style.height = '100%';
                svg.style.display = 'block';
                svg.setAttribute('preserveAspectRatio', 'none');

                this.onionEl.innerHTML = '';
                this.onionEl.appendChild(svg);

                this._onionNaturalWidth = naturalW;
                this._onionScalePct = autoScale;
                this._onionOffsetX = 0;

                this.offsetSliderEl.value = '0';
                this.widthSliderEl.value  = String(autoScale);

                this._applyOnionTransform();
                this._applyWidth();
            })
            .catch(err => console.error('[ravel-roll] onion-src:', err));
    }

    private _applyOnionTransform(): void {
        if (!this.onionEl) return;
        const svg = this.onionEl.querySelector('svg') as SVGSVGElement | null;

        const scaledW = this._onionNaturalWidth * this._onionScalePct / 100;
        if (svg) svg.style.width = scaledW > 0 ? `${scaledW}px` : '100%';

        this.onionEl.style.transform = `translateX(${this._onionOffsetX}px)`;

        this._applyWidth();
    }

    // ── Track length helpers ──────────────────────────────────────────────────

    private _handleTrackEvent = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent).detail ?? {};
        if (cmd !== 'state-change') return;
        const prefix = this.id || 'rr';
        if (typeof content?.id !== 'string' || !content.id.startsWith(prefix + '-')) return;
        this._updateLengthSliderMin();
    };

    private _updateLengthSliderMin(): void {
        const min = Math.max(8, this._getPopulatedLength());
        this.lengthSliderEl.min = String(min);
        if (this._length < min) {
            this._length = min;
            this.lengthSliderEl.value = String(min);
            this._applyWidth();
        }
    }

    private _getPopulatedLength(): number {
        let max = 0;
        for (const trackEl of this._trackEls) {
            const state = (trackEl as any).getState() as { perfs: { start: number; length: number }[] };
            for (const p of state.perfs) max = Math.max(max, p.start + p.length);
        }
        return Math.ceil(max);
    }

    // ── Static helpers ────────────────────────────────────────────────────────

    private static _noteList(count: number): NoteInfo[] {
        const result: NoteInfo[] = [];
        let octave = 7, idx = 0;
        for (let i = 0; i < count; i++) {
            const name = CHROMATIC_DESC[idx];
            result.push({ name, octave, color: NOTE_COLORS[name] ?? '#4488ff' });
            if (++idx >= CHROMATIC_DESC.length) { idx = 0; octave--; }
        }
        return result;
    }

    // ── MIDI import ───────────────────────────────────────────────────────────

    private _importMidi(buffer: ArrayBuffer): void {
        let parsed: ReturnType<typeof RavelRoll._parseMidi>;
        try {
            parsed = RavelRoll._parseMidi(buffer);
        } catch (e) {
            console.error('[ravel-roll] MIDI import failed:', e);
            return;
        }

        const { ppq, tempoUs, notes } = parsed;

        // Build pitch → track element map
        const pitchMap = new Map<number, HTMLElement>();
        for (const trackEl of this._trackEls) {
            const pitch = RavelRoll._labelToMidi(trackEl.getAttribute('label') ?? '');
            if (pitch >= 0) pitchMap.set(pitch, trackEl);
        }

        // Clear existing perfs on all tracks
        for (const trackEl of this._trackEls) {
            for (const p of Array.from(trackEl.querySelectorAll('ravel-roll-perf'))) p.remove();
        }

        // 1 unit = 1/128th note = PPQ/32 ticks
        const ticksPerUnit = ppq / 32;
        let seq = 0;

        for (const note of notes) {
            const trackEl = pitchMap.get(note.pitch);
            if (!trackEl) continue;
            const startUnit  = Math.round(note.startTick / ticksPerUnit);
            const lengthUnit = Math.max(1, Math.round((note.endTick - note.startTick) / ticksPerUnit));
            const perf = document.createElement('ravel-roll-perf') as HTMLElement;
            perf.id   = `${this.id || 'rr'}-imp-${++seq}`;
            perf.setAttribute('length', String(lengthUnit));
            (trackEl as any).dockPerf(perf, startUnit);
        }

        this._onionTempoBpm = Math.round(60_000_000 / tempoUs);
        this._updateLengthSliderMin();
    }

    private static _parseMidi(buffer: ArrayBuffer): {
        ppq: number;
        tempoUs: number;
        notes: { pitch: number; startTick: number; endTick: number }[];
    } {
        const view  = new DataView(buffer);
        const u8    = new Uint8Array(buffer);

        if (view.getUint32(0) !== 0x4D546864) throw new Error('Not a MIDI file');

        const ppq = view.getUint16(12);
        let pos   = 8 + view.getUint32(4); // skip past MThd chunk

        const notes: { pitch: number; startTick: number; endTick: number }[] = [];
        let tempoUs = 500_000;

        const readVarlen = (p: number): [number, number] => {
            let val = 0, n = 0, b: number;
            do { b = u8[p + n]; val = (val << 7) | (b & 0x7F); n++; } while (b & 0x80);
            return [val, n];
        };

        while (pos + 8 <= buffer.byteLength) {
            const magic  = view.getUint32(pos);
            const trkLen = view.getUint32(pos + 4);
            const trkEnd = pos + 8 + trkLen;
            pos += 8;

            if (magic !== 0x4D54726B) { pos = trkEnd; continue; } // skip non-MTrk

            let absTime = 0, runStatus = 0;
            const open = new Map<number, number>(); // (ch<<8)|pitch → startTick

            while (pos < trkEnd) {
                const [delta, db] = readVarlen(pos);
                pos += db;
                absTime += delta;

                const b0 = u8[pos];
                let status: number;
                if (b0 & 0x80) {
                    status = b0; pos++;
                    if (status < 0xF0) runStatus = status;
                } else {
                    status = runStatus; // running status — don't advance
                }

                const type = status & 0xF0;
                const ch   = status & 0x0F;

                if (type === 0x90 || type === 0x80) {
                    const pitch = u8[pos++], vel = u8[pos++];
                    const key   = (ch << 8) | pitch;
                    if (type === 0x90 && vel > 0) {
                        open.set(key, absTime);
                    } else {
                        const start = open.get(key);
                        if (start !== undefined) {
                            open.delete(key);
                            notes.push({ pitch, startTick: start, endTick: absTime });
                        }
                    }
                } else if (type === 0xA0 || type === 0xB0 || type === 0xE0) {
                    pos += 2;
                } else if (type === 0xC0 || type === 0xD0) {
                    pos += 1;
                } else if (status === 0xFF) {
                    const mType = u8[pos++];
                    const [mLen, mlb] = readVarlen(pos); pos += mlb;
                    if (mType === 0x51 && mLen === 3) {
                        tempoUs = (u8[pos] << 16) | (u8[pos + 1] << 8) | u8[pos + 2];
                    }
                    pos += mLen;
                } else if (status === 0xF0 || status === 0xF7) {
                    const [sLen, slb] = readVarlen(pos); pos += slb + sLen;
                }
            }

            pos = trkEnd;
            for (const [key, startTick] of open) {
                notes.push({ pitch: key & 0xFF, startTick, endTick: absTime });
            }
        }

        return { ppq, tempoUs, notes };
    }

    // ── MIDI export ───────────────────────────────────────────────────────────

    private _exportMidi(): void {
        const TPU = RavelRoll.TICKS_PER_UNIT;
        const CH  = 0;
        const VEL = 100;

        interface Ev { tick: number; on: boolean; pitch: number; }
        const evs: Ev[] = [];

        for (const trackEl of this._trackEls) {
            const state = (trackEl as any).getState() as {
                label: string;
                perfs: { start: number; length: number }[];
            };
            const pitch = RavelRoll._labelToMidi(state.label);
            if (pitch < 0 || pitch > 127) continue;
            for (const p of state.perfs) {
                evs.push({ tick: Math.round(p.start * TPU),               on: true,  pitch });
                evs.push({ tick: Math.round((p.start + p.length) * TPU),  on: false, pitch });
            }
        }

        // Sort: ascending tick; note-off before note-on at same tick
        evs.sort((a, b) => a.tick !== b.tick ? a.tick - b.tick : (a.on ? 1 : -1));

        // ── Build track chunk ─────────────────────────────────────────────────
        const trk: number[] = [];

        const T = Math.round(60_000_000 / this._onionTempoBpm);
        trk.push(0x00, 0xFF, 0x51, 0x03, (T >> 16) & 0xFF, (T >> 8) & 0xFF, T & 0xFF);

        let prev = 0;
        for (const ev of evs) {
            const delta = ev.tick - prev;
            prev = ev.tick;
            trk.push(...RavelRoll._varlen(delta));
            trk.push(ev.on ? (0x90 | CH) : (0x80 | CH), ev.pitch, ev.on ? VEL : 0x00);
        }

        trk.push(0x00, 0xFF, 0x2F, 0x00); // end of track

        // ── Assemble MIDI file ────────────────────────────────────────────────
        const P = RavelRoll.PPQ;
        const file: number[] = [
            0x4D, 0x54, 0x68, 0x64,          // MThd
            0x00, 0x00, 0x00, 0x06,           // header length = 6
            0x00, 0x00,                        // format 0
            0x00, 0x01,                        // 1 track
            (P >> 8) & 0xFF, P & 0xFF,        // PPQ = 128
            0x4D, 0x54, 0x72, 0x6B,           // MTrk
            (trk.length >> 24) & 0xFF,
            (trk.length >> 16) & 0xFF,
            (trk.length >>  8) & 0xFF,
             trk.length         & 0xFF,
            ...trk,
        ];

        const blob = new Blob([new Uint8Array(file)], { type: 'audio/midi' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `${this.id || 'ravel-roll'}.mid`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /** Encodes a non-negative integer as a MIDI variable-length quantity. */
    private static _varlen(n: number): number[] {
        if (n === 0) return [0x00];
        const out: number[] = [];
        while (n > 0) {
            out.unshift(n & 0x7F);
            n >>>= 7;
        }
        for (let i = 0; i < out.length - 1; i++) out[i] |= 0x80;
        return out;
    }

    /** Converts a label like "A#4" or "B7" to a MIDI note number (0–127), or -1 on failure. */
    private static _labelToMidi(label: string): number {
        const OFF: Record<string, number> = {
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4,  'F':  5,
            'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
        };
        const m = label.match(/^([A-G]#?)(-?\d+)$/);
        if (!m) return -1;
        const semitone = OFF[m[1]];
        if (semitone === undefined) return -1;
        return (parseInt(m[2], 10) + 1) * 12 + semitone;
    }

    // ── Attribute handling ────────────────────────────────────────────────────

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
            case 'onion-src':
                this._onionSrc = newValue ?? '';
                this._applyOnionSrc();
                break;
        }
    }
}
