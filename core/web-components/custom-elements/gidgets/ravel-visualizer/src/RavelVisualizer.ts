import { RavelElement } from '../../../../common/RavelElement';

// p5 is loaded as a global <script>, not an npm package — minimal types for instance mode.
interface P5Sketch {
    setup?:  () => void;
    draw?:   () => void;
    remove(): void;
    createCanvas(w: number, h: number): void;
    canvas:  HTMLCanvasElement | null;
    width:   number;
    height:  number;
    frameRate(fps: number): void;
    background(v: number | string, g?: number, b?: number): void;
    fill(v: number | string, g?: number, b?: number, a?: number): void;
    noFill(): void;
    stroke(v: number | string, g?: number, b?: number, a?: number): void;
    noStroke(): void;
    strokeWeight(w: number): void;
    beginShape(): void;
    endShape(): void;
    vertex(x: number, y: number): void;
    rect(x: number, y: number, w: number, h: number): void;
    circle(x: number, y: number, d: number): void;
    textAlign(h: unknown, v?: unknown): void;
    text(str: string, x: number, y: number): void;
    map(val: number, s1: number, t1: number, s2: number, t2: number): number;
    CENTER: unknown;
}

type P5Constructor = new (sketch: (p: P5Sketch) => void, container?: HTMLElement) => P5Sketch;

type VisualizerType = 'oscilloscope' | 'buffer';

/**
 * An audio visualizer in a pixel-art bezel.
 *
 * `type="oscilloscope"` — live waveform via a Web Audio `AnalyserNode`.
 * `type="buffer"` — static waveform from a decoded `AudioBuffer`, with playhead.
 *
 * p5.js must be loaded as a global `<script>` before this element is registered.
 *
 * ### Attributes
 * | Attribute    | Type                      | Default         | Description                  |
 * |--------------|---------------------------|-----------------|------------------------------|
 * | `type`       | `oscilloscope` \| `buffer`| `oscilloscope`  | Visualizer mode              |
 * | `w`          | number                    | `300`           | Component width in px        |
 * | `h`          | number                    | `200`           | Component height in px       |
 * | `color`      | string                    | `#111111`       | Display background color     |
 * | `pixel-size` | number                    | `10`            | Bezel thickness in px        |
 *
 * ### Public API
 * - `setAnalyser(analyser)` — (oscilloscope) connect a Web Audio `AnalyserNode`
 * - `setBuffer(buffer)` — (buffer) load a decoded `AudioBuffer`
 * - `setPosition(sampleIndex | null)` — (buffer) update playhead; `null` hides it
 */
export class RavelVisualizer extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: inline-block;
            box-sizing: border-box;
            overflow: hidden;
        }
        #container {
            position: relative;
            width: 100%;
            height: 100%;
        }
        #screen {
            position: absolute;
            inset: 0;
        }
        .px {
            position: absolute;
            background: #000000;
        }
        #p5-container {
            position: absolute;
            overflow: hidden;
        }
        #container-shadow {
            position: absolute;
            background: rgba(0, 0, 0, 0.5);
            pointer-events: none;
        }
        /* p5 1.x sets canvas.style.display="none" in its Renderer constructor.
           Override it so the canvas is visible as soon as it's appended. */
        canvas {
            display: block !important;
            visibility: visible !important;
        }
    `;

    private static readonly componentHtml = `
        <div id="screen">
            <div id="top-px"    class="px"></div>
            <div id="left-px"   class="px"></div>
            <div id="right-px"  class="px"></div>
            <div id="bottom-px" class="px"></div>
            <div id="p5-container"></div>
            <div id="container-shadow"></div>
        </div>
    `;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'type', 'w', 'h', 'color', 'pixel-size',
        ];
    }

    // Shadow DOM refs
    private _p5ContainerEl!: HTMLElement;
    private _topPx!:         HTMLElement;
    private _leftPx!:        HTMLElement;
    private _rightPx!:       HTMLElement;
    private _bottomPx!:      HTMLElement;
    private _shadowEl!:      HTMLElement;

    // Display state
    private _type:      VisualizerType = 'oscilloscope';
    private _w:         number = 300;
    private _h:         number = 200;
    private _color:     string = '#111111';
    private _pixelSize: number = 10;

    // Audio data (read live by the running sketch)
    private _analyser:       AnalyserNode | null = null;
    private _dataArray:      Uint8Array   | null = null;
    private _audioBuffer:    AudioBuffer  | null = null;
    private _playheadSample: number       | null = null;

    // p5 instance
    private _p5:        P5Sketch | null = null;
    private _connected: boolean  = false;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelVisualizer.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelVisualizer.componentHtml;
        this._p5ContainerEl = this.container.querySelector<HTMLElement>('#p5-container')!;
        this._topPx         = this.container.querySelector<HTMLElement>('#top-px')!;
        this._leftPx        = this.container.querySelector<HTMLElement>('#left-px')!;
        this._rightPx       = this.container.querySelector<HTMLElement>('#right-px')!;
        this._bottomPx      = this.container.querySelector<HTMLElement>('#bottom-px')!;
        this._shadowEl      = this.container.querySelector<HTMLElement>('#container-shadow')!;

        this.setAttribute('role', 'img');
        this._updateAriaLabel();
    }

    protected setup(): void {
        super.setup();
        this._connected = true;
        this.style.width  = `${this._w}px`;
        this.style.height = `${this._h}px`;
        this._buildScreen();
        this._createP5();
    }

    protected teardown(): void {
        this._connected = false;
        this._destroyP5();
        super.teardown();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** (oscilloscope) Connect a Web Audio AnalyserNode for live waveform display. */
    setAnalyser(analyser: AnalyserNode): void {
        this._analyser  = analyser;
        this._dataArray = new Uint8Array(analyser.fftSize);
    }

    /** (buffer) Load a decoded AudioBuffer and display its static waveform. */
    setBuffer(buffer: AudioBuffer): void {
        this._audioBuffer = buffer;
    }

    /** (buffer) Move the playhead to the given sample index, or `null` to hide it. */
    setPosition(sampleIndex: number | null): void {
        this._playheadSample = sampleIndex;
    }

    // ── Pixel-art bezel ───────────────────────────────────────────────────────

    private _buildScreen(): void {
        const ps     = this._pixelSize;
        const innerW = this._w - ps * 2;
        const innerH = this._h - ps * 2;

        this._setRect(this._topPx,         ps,          0,           innerW, ps);
        this._setRect(this._leftPx,        0,           ps,          ps,     innerH);
        this._setRect(this._rightPx,       innerW + ps, ps,          ps,     innerH);
        this._setRect(this._bottomPx,      ps,          innerH + ps, innerW, ps);
        this._setRect(this._p5ContainerEl, ps,          ps,          innerW, innerH);
        // Thin shadow overlay at bottom of display area — depth effect
        this._setRect(this._shadowEl,      ps,          innerH,      innerW, ps);

        this._p5ContainerEl.style.background = this._color;
    }

    private _setRect(el: HTMLElement, x: number, y: number, w: number, h: number): void {
        el.style.left   = `${x}px`;
        el.style.top    = `${y}px`;
        el.style.width  = `${w}px`;
        el.style.height = `${h}px`;
    }

    // ── p5 management ─────────────────────────────────────────────────────────

    private _p5Constructor(): P5Constructor | null {
        const P5 = (window as unknown as { p5?: P5Constructor }).p5;
        if (!P5) {
            console.warn('[ravel-visualizer] p5 not found on window — load <script src="p5.min.js"> before this element.');
            return null;
        }
        return P5;
    }

    private _createP5(): void {
        const P5 = this._p5Constructor();
        if (!P5) return;
        const sketch = this._type === 'buffer'
            ? (p: P5Sketch) => this._bufferSketch(p)
            : (p: P5Sketch) => this._oscilloscopeSketch(p);
        this._p5 = new P5(sketch, this._p5ContainerEl);
    }

    private _destroyP5(): void {
        if (this._p5) {
            try { this._p5.remove(); } catch { /* already removed */ }
            this._p5 = null;
        }
        if (this._p5ContainerEl) this._p5ContainerEl.innerHTML = '';
    }

    private _rebuild(): void {
        if (!this._connected) return;
        this._destroyP5();
        this.style.width  = `${this._w}px`;
        this.style.height = `${this._h}px`;
        this._buildScreen();
        this._createP5();
    }

    // ── Sketches ──────────────────────────────────────────────────────────────

    private _oscilloscopeSketch(p: P5Sketch): void {
        p.setup = () => {
            p.createCanvas(this._w - this._pixelSize * 2, this._h - this._pixelSize * 2);
            p.frameRate(15);
            // p5 1.x sets display:none on the canvas in its Renderer constructor;
            // override it here so the canvas is visible immediately.
            if (p.canvas) {
                p.canvas.style.display    = 'block';
                p.canvas.style.visibility = 'visible';
            }
        };

        p.draw = () => {
            p.background(this._color);

            if (this._analyser && this._dataArray) {
                this._analyser.getByteTimeDomainData(this._dataArray);
                p.stroke(0, 255, 0);
                p.strokeWeight(2);
                p.noFill();
                p.beginShape();
                for (let i = 0; i < this._dataArray.length; i++) {
                    const x = p.map(i, 0, this._dataArray.length, 0, p.width);
                    const y = p.map(this._dataArray[i], 0, 255, 0, p.height - 10);
                    p.vertex(x, y);
                }
                p.endShape();
            } else {
                p.fill(120);
                p.noStroke();
                p.textAlign(p.CENTER, p.CENTER);
                p.text('No analyser connected', p.width / 2, p.height / 2);
            }
        };
    }

    private _bufferSketch(p: P5Sketch): void {
        p.setup = () => {
            p.createCanvas(this._w - this._pixelSize * 2, this._h - this._pixelSize * 2);
            p.frameRate(30);
            if (p.canvas) {
                p.canvas.style.display    = 'block';
                p.canvas.style.visibility = 'visible';
            }
        };

        p.draw = () => {
            p.background(this._color);

            if (!this._audioBuffer) {
                p.fill(120);
                p.noStroke();
                p.textAlign(p.CENTER, p.CENTER);
                p.text('No audio loaded', p.width / 2, p.height / 2);
                return;
            }

            const channelData = this._audioBuffer.getChannelData(0);
            const step        = Math.ceil(channelData.length / p.width);
            const midY        = p.height / 2;
            const squiggleAmp = 2;

            for (let x = 0; x < p.width; x++) {
                const base = x * step;
                let min = 1.0, max = -1.0;
                for (let i = 0; i < step; i++) {
                    const s = channelData[base + i] ?? 0;
                    if (s < min) min = s;
                    if (s > max) max = s;
                }
                const y1       = midY + min * midY;
                const y2       = midY + max * midY;
                const squiggle = Math.random() * squiggleAmp - squiggleAmp / 2;
                p.noFill();
                p.stroke(200, 200, 200);
                p.rect(x, y1 + squiggle, 1, y2 - y1 + squiggle);
            }

            if (this._playheadSample !== null) {
                const px = Math.floor(this._playheadSample / step);
                if (px >= 0 && px < p.width) {
                    const base = px * step;
                    let min = 1.0, max = -1.0;
                    for (let i = 0; i < step; i++) {
                        const s = channelData[base + i] ?? 0;
                        if (s < min) min = s;
                        if (s > max) max = s;
                    }
                    const y1 = midY + min * midY;
                    const y2 = midY + max * midY;
                    p.noStroke();
                    p.fill(255, 255, 255, 100);
                    p.circle(px, midY, y2 - y1);
                    p.circle(px, midY, (y2 - y1) / 2);
                    p.circle(px, midY, 4);
                }
            }
        };
    }

    // ── Attribute handling ────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);

        switch (name) {
            case 'type':
                this._type = newValue === 'buffer' ? 'buffer' : 'oscilloscope';
                this._updateAriaLabel();
                this._rebuild();
                break;
            case 'w':
                this._w = Math.max(1, Number(newValue) || 300);
                this._rebuild();
                break;
            case 'h':
                this._h = Math.max(1, Number(newValue) || 200);
                this._rebuild();
                break;
            case 'color':
                this._color = newValue ?? '#111111';
                if (this._connected && this._p5ContainerEl) {
                    this._p5ContainerEl.style.background = this._color;
                }
                break;
            case 'pixel-size':
                this._pixelSize = Math.max(1, Number(newValue) || 10);
                this._rebuild();
                break;
        }
    }

    private _updateAriaLabel(): void {
        this.setAttribute('aria-label',
            this._type === 'oscilloscope'
                ? 'Oscilloscope audio visualizer'
                : 'Waveform buffer audio visualizer'
        );
    }
}
