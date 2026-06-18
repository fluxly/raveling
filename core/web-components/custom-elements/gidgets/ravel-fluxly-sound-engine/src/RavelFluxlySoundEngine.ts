import { RavelElement } from '../../../../common/RavelElement';

/**
 * Headless Web Audio sample player backed by an AudioWorklet.
 *
 * Loads a WAV file and plays it back at a configurable rate.
 * Negative rates play in reverse; zero suspends output.
 * The component has no visible UI unless `show-control` is set.
 *
 * ### Attributes
 * | Attribute      | Type    | Default                        | Description                    |
 * |----------------|---------|--------------------------------|--------------------------------|
 * | `filename`     | string  | `'sample-0.wav'`               | URL of the WAV file to load    |
 * | `message-id`   | string  | `'ravel-fluxly-sound-engine'`  | Message channel to subscribe   |
 * | `no-loop`      | boolean | `false`                        | Stop at end instead of looping |
 * | `show-control` | boolean | `false`                        | Show the debug rate panel      |
 *
 * ### Messages received (on `message-id` channel)
 * | cmd             | content           | Effect                                |
 * |-----------------|-------------------|---------------------------------------|
 * | `playback-rate` | number (float)    | Set playback rate immediately         |
 * | `resume`        | —                 | Resume playback (after no-loop end)   |
 */
export class RavelFluxlySoundEngine extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: inline-block;
        }

        #container {
            display: none;
        }

        #container.visible {
            display: flex;
            flex-direction: column;
            gap: 10px;
            background: #1a1a1a;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 4px;
            padding: 14px 16px;
            font-family: 'Silkscreen', monospace;
            font-size: 0.7rem;
            color: rgba(255,255,255,0.7);
            min-width: 260px;
        }

        .row {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .label {
            width: 80px;
            flex-shrink: 0;
            color: rgba(255,255,255,0.4);
            font-family: 'Quantico', monospace;
            font-size: 0.72rem;
        }

        input[type="range"] {
            flex: 1;
            accent-color: #00F0FF;
        }

        .value {
            width: 40px;
            text-align: right;
            font-family: 'Quantico', monospace;
            font-size: 0.72rem;
            color: #00F0FF;
        }

        button#start {
            appearance: none;
            background: transparent;
            border: 1px solid rgba(0,240,255,0.35);
            border-radius: 4px;
            padding: 6px 12px;
            font-family: 'Silkscreen', monospace;
            font-size: 0.65rem;
            color: #00F0FF;
            cursor: pointer;
            align-self: flex-start;
            transition: border-color 100ms, color 100ms;
        }
        button#start:hover {
            border-color: #00F0FF;
            color: #ffffff;
        }

        .status-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: 'Quantico', monospace;
            font-size: 0.7rem;
            color: rgba(255,255,255,0.35);
        }

        .dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: rgba(255,255,255,0.15);
            flex-shrink: 0;
        }
        .dot.loading { background: #FE6810; box-shadow: 0 0 4px #FE6810; }
        .dot.ready   { background: #A7FF00; box-shadow: 0 0 4px #A7FF00; }
        .dot.error   { background: #FF37A8; box-shadow: 0 0 4px #FF37A8; }
    `;

    private static readonly componentHtml = `
        <button id="start" type="button">Resume audio</button>
        <div class="row">
            <span class="label">playback rate</span>
            <input type="range" id="rate" min="-5" max="5" step="0.01" value="1">
            <span class="value" id="rateValue">1.00</span>
        </div>
        <div class="status-row">
            <span class="dot" id="dot"></span>
            <span id="statusText">idle</span>
        </div>
    `;

    // ── Worklet processor code (loaded via Blob URL) ───────────────────────────

    private static readonly workletCode = `
class SamplePlayerProcessor extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: 'playbackRate', defaultValue: 1.0, minValue: -16.0, maxValue: 16.0, automationRate: 'a-rate' },
            { name: 'noLoop',       defaultValue: 0.0 }
        ];
    }

    constructor() {
        super();
        this.channelData = [];
        this.sampleRate  = 44100;
        this.length      = 0;
        this.position    = 0;
        this.playing     = true;

        this.port.onmessage = (event) => {
            if (event.data.type === 'sample-data') {
                const { channelData, sampleRate, length } = event.data;
                this.channelData = channelData.map(arr => new Float32Array(arr));
                this.sampleRate  = sampleRate;
                this.length      = length;
                this.position    = 0;
            }
            if ('playing' in event.data) {
                this.playing = !!event.data.playing;
            }
        };
    }

    process(inputs, outputs, parameters) {
        if (!this.channelData.length || !this.playing) return true;

        const output     = outputs[0];
        const rateParam  = parameters.playbackRate;
        const noLoop     = (parameters.noLoop[0] ?? 0) > 0.5;
        const numChannels = output.length;

        for (let i = 0; i < output[0].length; i++) {
            const rate = rateParam.length > 1 ? rateParam[i] : rateParam[0];

            for (let ch = 0; ch < numChannels; ch++) {
                const data  = this.channelData[ch % this.channelData.length];
                const idx   = ((Math.floor(this.position) % this.length) + this.length) % this.length;
                output[ch][i] = data[idx];
            }

            this.position += rate;

            if (noLoop) {
                if (this.position >= this.length || this.position < 0) {
                    this.position = this.position < 0 ? this.length - 1 : 0;
                    this.playing  = false;
                }
            } else {
                if (this.position >= this.length) this.position = 0;
                if (this.position < 0)            this.position = this.length - 1;
            }
        }

        return true;
    }
}

registerProcessor('sample-player', SamplePlayerProcessor);
`;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes,
            'message-id', 'show-control', 'filename', 'no-loop'];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _startBtn!:    HTMLButtonElement;
    private _rateSlider!:  HTMLInputElement;
    private _rateValueEl!: HTMLElement;
    private _dotEl!:       HTMLElement;
    private _statusTextEl!: HTMLElement;

    // ── State ─────────────────────────────────────────────────────────────────

    private _isReady    = false;
    private _audioCtx:  AudioContext | null = null;
    private _node:      AudioWorkletNode | null = null;
    private _rate       = 1.0;
    private _noLoop     = false;
    private _filename   = 'sample-0.wav';
    private _messageId  = 'ravel-fluxly-sound-engine';

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelFluxlySoundEngine.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelFluxlySoundEngine.componentHtml;

        this._startBtn     = this.container.querySelector<HTMLButtonElement>('#start')!;
        this._rateSlider   = this.container.querySelector<HTMLInputElement>('#rate')!;
        this._rateValueEl  = this.container.querySelector<HTMLElement>('#rateValue')!;
        this._dotEl        = this.container.querySelector<HTMLElement>('#dot')!;
        this._statusTextEl = this.container.querySelector<HTMLElement>('#statusText')!;
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;

        this._startBtn.addEventListener('click',   this._onStartClick);
        this._rateSlider.addEventListener('input', this._onRateInput);

        this.subscribe([this._messageId]);
        this.addEventListener(this._messageId, this._onMessage);

        this._startAudio();
    }

    protected teardown(): void {
        this._isReady = false;

        this._startBtn.removeEventListener('click',   this._onStartClick);
        this._rateSlider.removeEventListener('input', this._onRateInput);
        this.removeEventListener(this._messageId, this._onMessage);
        this.unsubscribe([this._messageId]);

        this._stopAudio();
        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (oldValue === newValue) return;

        switch (name) {
            case 'show-control':
                this.container.classList.toggle('visible', newValue !== null);
                break;
            case 'message-id':
                if (newValue !== null) {
                    if (this._isReady) {
                        this.removeEventListener(this._messageId, this._onMessage);
                        this.unsubscribe([this._messageId]);
                    }
                    this._messageId = newValue;
                    if (this._isReady) {
                        this.subscribe([this._messageId]);
                        this.addEventListener(this._messageId, this._onMessage);
                    }
                }
                break;
            case 'filename':
                if (newValue !== null) this._filename = newValue;
                break;
            case 'no-loop':
                this._noLoop = newValue !== null;
                break;
        }
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    private _onStartClick = (): void => {
        this._startAudio();
    };

    private _onRateInput = (): void => {
        const rate = parseFloat(this._rateSlider.value);
        this._setRate(rate);
        this.sendMessage(this._messageId, 'playback-rate', rate);
    };

    private _onMessage = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent<{ cmd: string; content: unknown }>).detail;
        if (cmd === 'playback-rate') {
            const rate = parseFloat(String(content));
            if (Number.isFinite(rate)) this._setRate(rate);
        }
        if (cmd === 'resume') {
            this._resumeAudio();
        }
    };

    // ── Audio helpers ─────────────────────────────────────────────────────────

    private _startAudio = async (): Promise<void> => {
        this._stopAudio();
        this._setStatus('loading', 'loading');

        try {
            const blob    = new Blob([RavelFluxlySoundEngine.workletCode], { type: 'application/javascript' });
            const blobUrl = URL.createObjectURL(blob);

            this._audioCtx = new AudioContext();
            await this._audioCtx.audioWorklet.addModule(blobUrl);
            URL.revokeObjectURL(blobUrl);

            this._node = new AudioWorkletNode(this._audioCtx, 'sample-player', {
                outputChannelCount: [1],
                numberOfInputs:  0,
                numberOfOutputs: 1,
                parameterData: {
                    playbackRate: this._rate,
                    noLoop: this._noLoop ? 1.0 : 0.0,
                },
            });

            const response    = await fetch(this._filename);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this._audioCtx.decodeAudioData(arrayBuffer);

            const channelData: Float32Array[] = [];
            for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
                channelData.push(audioBuffer.getChannelData(i).slice());
            }

            this._node.port.postMessage({
                type:        'sample-data',
                channelData,
                sampleRate:  audioBuffer.sampleRate,
                length:      audioBuffer.length,
            });

            this._node.connect(this._audioCtx.destination);
            await this._audioCtx.resume();

            this._setStatus('playing', 'ready');
        } catch (err) {
            console.error('[ravel-fluxly-sound-engine] startAudio failed:', err);
            this._setStatus('error', 'error');
        }
    };

    private _stopAudio(): void {
        if (this._node) {
            this._node.disconnect();
            this._node = null;
        }
        if (this._audioCtx) {
            this._audioCtx.close();
            this._audioCtx = null;
        }
    }

    private _resumeAudio(): void {
        if (this._node) {
            this._node.port.postMessage({ playing: true });
        }
    }

    private _setRate(rate: number): void {
        this._rate = rate;
        if (this._node && this._audioCtx) {
            this._node.parameters.get('playbackRate')
                ?.setValueAtTime(rate, this._audioCtx.currentTime);
        }
        if (this._isReady) {
            this._rateSlider.value = String(rate);
            this._rateValueEl.textContent = rate.toFixed(2);
        }
    }

    private _setStatus(text: string, dot: 'loading' | 'ready' | 'error'): void {
        if (!this._isReady) return;
        this._statusTextEl.textContent = text;
        this._dotEl.classList.remove('loading', 'ready', 'error');
        this._dotEl.classList.add(dot);
    }
}
