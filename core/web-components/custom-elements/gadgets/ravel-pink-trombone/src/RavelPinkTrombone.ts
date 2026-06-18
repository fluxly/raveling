import { RavelElement } from '../../../../common/RavelElement';
import { TROMBONE_WORKLET_CODE } from './worklet-code';

/**
 * A vocal synthesis engine based on Pink Trombone (Neil Thapen / Yonatan Rozin).
 * Receives parameter messages and drives a Web Audio glottis + vocal-tract model.
 *
 * ### Attributes
 * | Attribute         | Type    | Default | Description                                  |
 * |-------------------|---------|---------|----------------------------------------------|
 * | `w`               | number  | `320`   | Width in px                                  |
 * | `h`               | number  | `130`   | Height in px                                 |
 * | `frequency`       | number  | `140`   | Glottal oscillator frequency (Hz, 80–1100)   |
 * | `tenseness`       | number  | `0.6`   | Vocal fold tension (0 = breathy, 1 = pressed)|
 * | `intensity`       | number  | `1.0`   | Glottal drive / breath pressure (0–1)        |
 * | `loudness`        | number  | `0.5`   | Output gain after tract simulation (0–1)     |
 * | `tongue-index`    | number  | `12.9`  | Front–back tongue position (12–29)           |
 * | `tongue-diameter` | number  | `2.43`  | Tongue constriction openness (2.05–3.5)      |
 * | `active`          | boolean | —       | Start audio synthesis when present           |
 *
 * ### Messages received (on `'ravel-pink-trombone'` channel)
 * | cmd        | content                                                             | Effect                  |
 * |------------|---------------------------------------------------------------------|-------------------------|
 * | `start`    | —                                                                   | Begin synthesis         |
 * | `stop`     | —                                                                   | Suspend synthesis       |
 * | `params`   | `{ frequency?, tenseness?, intensity?, loudness?, tongue?: {...} }` | Update all params       |
 * | `frequency`| number                                                              | Set frequency           |
 * | `tenseness`| number                                                              | Set tenseness           |
 * | `intensity`| number                                                              | Set intensity           |
 * | `loudness` | number                                                              | Set output gain         |
 * | `tongue`   | `{ index?, diameter? }`                                             | Set tongue position     |
 *
 * ### Messages broadcast (on `'ravel-pink-trombone'` channel)
 * | cmd     | content                       | Trigger               |
 * |---------|-------------------------------|-----------------------|
 * | `ready` | `{ sampleRate }`              | Worklet loaded        |
 * | `error` | `{ message }`                 | Audio init failure    |
 */
export class RavelPinkTrombone extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: inline-block;
            box-sizing: border-box;
        }
        #container {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            box-sizing: border-box;
            background: #0a0a18;
            border: 1px solid #252540;
            border-radius: 6px;
            overflow: hidden;
            font-family: 'Quantico', monospace, sans-serif;
        }
        #viz-wrapper {
            flex: 1;
            position: relative;
            min-height: 0;
        }
        #viz-canvas {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            display: block;
        }
        #status-bar {
            display: flex;
            align-items: center;
            gap: 7px;
            padding: 5px 10px;
            background: #07070f;
            border-top: 1px solid #1a1a30;
            flex-shrink: 0;
        }
        #status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #252540;
            flex-shrink: 0;
            transition: background 0.3s ease, box-shadow 0.3s ease;
        }
        #status-dot.active {
            background: #44ffaa;
            box-shadow: 0 0 5px #44ffaa88;
        }
        #status-text {
            font-size: 10px;
            color: #44445a;
            text-transform: uppercase;
            letter-spacing: 1.2px;
            flex: 1;
        }
        #status-text.active { color: #66ddaa; }
        #freq-display {
            font-size: 10px;
            color: #333355;
            font-variant-numeric: tabular-nums;
            transition: color 0.3s ease;
        }
        #freq-display.active { color: #556688; }
    `;

    private static readonly componentHtml = `
        <div id="viz-wrapper">
            <canvas id="viz-canvas" role="img" aria-label="Vocal synthesis spectrum — idle"></canvas>
        </div>
        <div id="status-bar">
            <div id="status-dot"></div>
            <span id="status-text" aria-live="polite" aria-atomic="true">Idle</span>
            <span id="freq-display">—</span>
        </div>
    `;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'w', 'h',
            'frequency', 'tenseness', 'intensity', 'loudness',
            'tongue-index', 'tongue-diameter',
            'active',
        ];
    }

    // ── DOM refs ────────────────────────────────────────────────────────────────

    private _canvas!: HTMLCanvasElement;
    private _statusDot!: HTMLElement;
    private _statusText!: HTMLElement;
    private _freqDisplay!: HTMLElement;

    // ── Audio nodes ─────────────────────────────────────────────────────────────

    private _ctx: AudioContext | null = null;
    private _glottis: AudioWorkletNode | null = null;
    private _tract: AudioWorkletNode | null = null;
    private _gain: GainNode | null = null;
    private _analyser: AnalyserNode | null = null;
    private _noiseSource: AudioBufferSourceNode | null = null;
    private _workletReady = false;
    private _initPromise: Promise<void> | null = null;

    // ── Visualizer ──────────────────────────────────────────────────────────────

    private _rafId: number | null = null;
    private _freqData: Uint8Array | null = null;

    // ── State ───────────────────────────────────────────────────────────────────

    private _w = 320;
    private _h = 130;
    private _active = false;
    private _params = {
        frequency:       140,
        tenseness:       0.6,
        intensity:       1.0,
        loudness:        0.5,
        tongue: {
            index:    12.9,
            diameter: 2.43,
        },
    };

    // ── Lifecycle ───────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();
        const style = document.createElement('style');
        style.textContent = RavelPinkTrombone.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);
        this.container.innerHTML = RavelPinkTrombone.componentHtml;
        this._canvas      = this.container.querySelector<HTMLCanvasElement>('#viz-canvas')!;
        this._statusDot   = this.container.querySelector<HTMLElement>('#status-dot')!;
        this._statusText  = this.container.querySelector<HTMLElement>('#status-text')!;
        this._freqDisplay = this.container.querySelector<HTMLElement>('#freq-display')!;
        this.setAttribute('aria-label', 'Pink Trombone vocal synthesizer');
    }

    protected setup(): void {
        super.setup();
        this._applySize();
        this._startViz();
        window.addEventListener('ravel-pink-trombone', this._handleMessage as EventListener);
    }

    protected teardown(): void {
        window.removeEventListener('ravel-pink-trombone', this._handleMessage as EventListener);
        this._stopAudio();
        this._stopViz();
        super.teardown();
    }

    // ── Size ────────────────────────────────────────────────────────────────────

    private _applySize(): void {
        this.style.width  = `${this._w}px`;
        this.style.height = `${this._h}px`;
    }

    // ── Audio ───────────────────────────────────────────────────────────────────

    private _initAudio(): Promise<void> {
        if (this._initPromise) return this._initPromise;
        this._initPromise = this._doInitAudio();
        return this._initPromise;
    }

    private async _doInitAudio(): Promise<void> {
        const blob    = new Blob([TROMBONE_WORKLET_CODE], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        try {
            this._ctx = new AudioContext();
            await this._ctx.audioWorklet.addModule(blobUrl);
            URL.revokeObjectURL(blobUrl);

            this._glottis = new AudioWorkletNode(this._ctx, 'glottis', {
                numberOfInputs:    1,
                numberOfOutputs:   2,
                outputChannelCount: [1, 1],
                processorOptions:  { i: 0 },
            });

            this._tract = new AudioWorkletNode(this._ctx, 'tract', {
                numberOfInputs:    3,
                numberOfOutputs:   1,
                outputChannelCount: [2],
                processorOptions:  { i: 0 },
            });

            this._gain     = this._ctx.createGain();
            this._analyser = this._ctx.createAnalyser();
            this._analyser.fftSize = 512;
            this._freqData = new Uint8Array(this._analyser.frequencyBinCount);

            // White noise buffer (2 s)
            const bufLen  = 2 * this._ctx.sampleRate;
            const noiseBuf = this._ctx.createBuffer(1, bufLen, this._ctx.sampleRate);
            const data = noiseBuf.getChannelData(0);
            for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
            this._noiseSource = this._ctx.createBufferSource();
            this._noiseSource.buffer = noiseBuf;
            this._noiseSource.loop   = true;

            // Aspiration: bandpass 500 Hz → glottis input[0]
            const aspFilter = this._ctx.createBiquadFilter();
            aspFilter.type            = 'bandpass';
            aspFilter.frequency.value = 500;
            aspFilter.Q.value         = 0.5;

            // Fricative: bandpass 1000 Hz → tract input[1]
            const fricFilter = this._ctx.createBiquadFilter();
            fricFilter.type            = 'bandpass';
            fricFilter.frequency.value = 1000;
            fricFilter.Q.value         = 0.5;

            // Wire: noise → filters → glottis / tract
            this._noiseSource.connect(aspFilter);
            this._noiseSource.connect(fricFilter);
            aspFilter.connect(this._glottis, 0, 0);       // noise → glottis in[0]
            this._glottis.connect(this._tract, 0, 0);     // glottal sig → tract in[0]
            fricFilter.connect(this._tract, 0, 1);        // fric noise  → tract in[1]
            this._glottis.connect(this._tract, 1, 2);     // noise mod   → tract in[2]
            this._tract.connect(this._gain);
            this._gain.connect(this._analyser);
            this._analyser.connect(this._ctx.destination);

            this._noiseSource.start();
            this._workletReady = true;
            this._applyParams();
            this.broadcastMessage('ravel-pink-trombone', 'ready', { sampleRate: this._ctx.sampleRate });

        } catch (err) {
            URL.revokeObjectURL(blobUrl);
            this._initPromise = null;
            const message = err instanceof Error ? err.message : String(err);
            console.error('[ravel-pink-trombone] audio init failed:', err);
            this.broadcastMessage('ravel-pink-trombone', 'error', { message });
        }
    }

    private _stopAudio(): void {
        if (this._noiseSource) {
            try { this._noiseSource.stop(); } catch (_) {}
            this._noiseSource.disconnect();
            this._noiseSource = null;
        }
        [this._tract, this._glottis, this._gain, this._analyser].forEach(n => {
            if (n) { n.disconnect(); }
        });
        this._tract = this._glottis = this._gain = this._analyser = null;
        this._freqData = null;
        if (this._ctx) { this._ctx.close(); this._ctx = null; }
        this._workletReady = false;
        this._initPromise  = null;
    }

    private _applyParams(): void {
        if (!this._workletReady || !this._glottis || !this._tract || !this._gain) return;
        const p = this._params;
        this._glottis.parameters.get('frequency')!.value      = p.frequency;
        this._glottis.parameters.get('tenseness')!.value      = p.tenseness;
        this._glottis.parameters.get('intensity')!.value      = p.intensity;
        this._tract.parameters.get('tongue-index')!.value     = p.tongue.index;
        this._tract.parameters.get('tongue-diameter')!.value  = p.tongue.diameter;
        this._gain.gain.value = p.loudness;
    }

    private _setActive(on: boolean): void {
        this._active = on;
        this._statusDot.classList.toggle('active', on);
        this._statusText.classList.toggle('active', on);
        this._freqDisplay.classList.toggle('active', on);
        this._statusText.textContent = on ? 'Active' : 'Idle';
        this._canvas.setAttribute('aria-label',
            on ? `Vocal synthesis spectrum — ${Math.round(this._params.frequency)} Hz` : 'Vocal synthesis spectrum — idle');

        if (on) {
            this._initAudio().then(() => {
                if (this._ctx?.state === 'suspended') this._ctx.resume();
            });
        } else if (this._ctx?.state === 'running') {
            this._ctx.suspend();
        }
    }

    // ── Visualizer ──────────────────────────────────────────────────────────────

    private _startViz(): void {
        const draw = () => {
            this._rafId = requestAnimationFrame(draw);
            const canvas = this._canvas;
            if (!canvas) return;
            const w = canvas.offsetWidth || this._w;
            const h = canvas.offsetHeight || (this._h - 28);
            if (canvas.width !== w)  canvas.width  = w;
            if (canvas.height !== h) canvas.height = h;

            const ctx2d = canvas.getContext('2d');
            if (!ctx2d) return;

            ctx2d.fillStyle = '#07070f';
            ctx2d.fillRect(0, 0, w, h);

            if (this._analyser && this._freqData && this._active && this._workletReady) {
                this._analyser.getByteFrequencyData(this._freqData);
                // Show the lower half of the spectrum (vocal range) spread across full width
                const useBins = Math.min(this._freqData.length, Math.ceil(this._freqData.length * 0.6));
                const barW = w / useBins;
                for (let i = 0; i < useBins; i++) {
                    const val  = this._freqData[i] / 255;
                    const barH = val * h * 0.88;
                    if (barH < 1) continue;
                    const hue = 175 + val * 55;
                    const lum = 38 + val * 22;
                    ctx2d.fillStyle = `hsla(${hue},65%,${lum}%,${0.55 + val * 0.45})`;
                    ctx2d.fillRect(i * barW, h - barH, Math.max(1, barW - 1), barH);
                }
                // Update freq display
                if (this._freqDisplay) {
                    this._freqDisplay.textContent = `${Math.round(this._params.frequency)} Hz`;
                }
            } else {
                // Idle: dim flat line
                ctx2d.strokeStyle = '#15152a';
                ctx2d.lineWidth   = 1;
                ctx2d.beginPath();
                ctx2d.moveTo(0, h / 2);
                ctx2d.lineTo(w, h / 2);
                ctx2d.stroke();
                if (this._freqDisplay && !this._active) {
                    this._freqDisplay.textContent = '—';
                }
            }
        };
        draw();
    }

    private _stopViz(): void {
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
    }

    // ── Messages ────────────────────────────────────────────────────────────────

    private _handleMessage = (e: CustomEvent): void => {
        const { cmd, content } = (e as CustomEvent<{ cmd: string; content: unknown }>).detail ?? {};
        switch (cmd) {
            case 'start':
                this._setActive(true);
                break;
            case 'stop':
                this._setActive(false);
                break;
            case 'params':
                if (content && typeof content === 'object') {
                    this._mergeParams(content as Record<string, unknown>);
                    this._applyParams();
                }
                break;
            case 'frequency':
                if (typeof content === 'number') { this._params.frequency = content; this._applyParams(); }
                break;
            case 'tenseness':
                if (typeof content === 'number') { this._params.tenseness = content; this._applyParams(); }
                break;
            case 'intensity':
                if (typeof content === 'number') { this._params.intensity = content; this._applyParams(); }
                break;
            case 'loudness':
                if (typeof content === 'number') { this._params.loudness  = content; this._applyParams(); }
                break;
            case 'tongue':
                if (content && typeof content === 'object') {
                    const t = content as { index?: number; diameter?: number };
                    if (typeof t.index    === 'number') this._params.tongue.index    = t.index;
                    if (typeof t.diameter === 'number') this._params.tongue.diameter = t.diameter;
                    this._applyParams();
                }
                break;
        }
    };

    private _mergeParams(p: Record<string, unknown>): void {
        if (typeof p.frequency === 'number') this._params.frequency = p.frequency;
        if (typeof p.tenseness === 'number') this._params.tenseness = p.tenseness;
        if (typeof p.intensity === 'number') this._params.intensity = p.intensity;
        if (typeof p.loudness  === 'number') this._params.loudness  = p.loudness;
        if (p.tongue && typeof p.tongue === 'object') {
            const t = p.tongue as { index?: number; diameter?: number };
            if (typeof t.index    === 'number') this._params.tongue.index    = t.index;
            if (typeof t.diameter === 'number') this._params.tongue.diameter = t.diameter;
        }
    }

    // ── Attribute handling ───────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        switch (name) {
            case 'w':
                this._w = Number(newValue) || 320;
                if (this.container) this._applySize();
                break;
            case 'h':
                this._h = Number(newValue) || 130;
                if (this.container) this._applySize();
                break;
            case 'frequency':
                this._params.frequency = Number(newValue) || 140;
                this._applyParams();
                break;
            case 'tenseness':
                this._params.tenseness = Number(newValue) || 0.6;
                this._applyParams();
                break;
            case 'intensity':
                this._params.intensity = Number(newValue) ?? 1.0;
                this._applyParams();
                break;
            case 'loudness':
                this._params.loudness = Number(newValue) ?? 0.5;
                this._applyParams();
                break;
            case 'tongue-index':
                this._params.tongue.index = Number(newValue) || 12.9;
                this._applyParams();
                break;
            case 'tongue-diameter':
                this._params.tongue.diameter = Number(newValue) || 2.43;
                this._applyParams();
                break;
            case 'active':
                this._setActive(newValue !== null);
                break;
        }
    }
}
