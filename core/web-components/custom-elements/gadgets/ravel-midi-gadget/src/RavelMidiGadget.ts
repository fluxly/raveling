import { RavelElement } from '../../../../common/RavelElement';

/**
 * Hardware-layer MIDI gadget. Bridges the Web MIDI API into the Ravel messaging
 * system. Place this element on any page that needs real MIDI I/O.
 *
 * **Outbound (Ravel → hardware):** listens on the `ravel-midi-gadget` window
 * channel for `cmd: 'send'` messages from `<ravel-midi-broker>` and writes the
 * raw byte array to the selected MIDI output port.
 *
 * **Inbound (hardware → Ravel):** listens to MIDI input ports and routes raw
 * bytes to `<ravel-midi-broker>` via `sendMessage(broker, 'raw', { data, deviceName })`.
 *
 * ### macOS setup
 * Enable the IAC Driver in Audio MIDI Setup → MIDI Studio → IAC Driver → "Device
 * is online". The IAC port then appears here as a MIDI output, and Logic Pro (or
 * any DAW) can receive from it.
 *
 * ### Attributes
 * | Attribute      | Type     | Default               | Description                                           |
 * |----------------|----------|-----------------------|-------------------------------------------------------|
 * | `output`       | string   | `''`                  | Output port name (substring match). Empty = first.    |
 * | `input`        | string   | `''`                  | Input port name filter. Empty = all. `'none'` = none. |
 * | `broker`       | string   | `'ravel-midi-broker'` | Pub/sub label of the broker to route inbound MIDI to. |
 * | `autoconnect`  | boolean  | false                 | Request MIDI access automatically on connect.         |
 *
 * ### Window events received (channel `'ravel-midi-gadget'`)
 * | cmd    | content               | Effect                              |
 * |--------|-----------------------|-------------------------------------|
 * | `send` | `{ data: number[] }` | Write bytes to selected output port |
 *
 * ### Messages sent (to broker via RavelMessenger)
 * | cmd   | content                                     | Trigger                     |
 * |-------|---------------------------------------------|-----------------------------|
 * | `raw` | `{ data: number[], deviceName: string }`    | MIDI data received from input |
 */
export class RavelMidiGadget extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: inline-block;
            cursor: default;
            font-family: var(--ravel-font, 'Silkscreen', monospace);
        }
        #head {
            background: #0e0e12;
            border: 1px solid rgba(255,79,179,0.20);
            border-radius: 5px;
            padding: 7px 10px 8px;
            display: flex;
            flex-direction: column;
            gap: 6px;
            min-width: 168px;
            user-select: none;
            -webkit-user-select: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
        .head-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .head-title {
            font-size: 7px;
            letter-spacing: 0.12em;
            color: rgba(255,255,255,0.28);
            text-transform: uppercase;
            line-height: 1;
        }
        .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: rgba(255,255,255,0.15);
            transition: background 200ms ease, box-shadow 200ms ease;
        }
        .status-dot.connected  { background: #A7FF00; box-shadow: 0 0 5px 1px rgba(167,255,0,0.55); }
        .status-dot.loading    { background: #FE6810; box-shadow: 0 0 5px 1px rgba(254,104,16,0.55); animation: rmg-blink 0.8s ease infinite; }
        .status-dot.error      { background: #FF37A8; box-shadow: 0 0 5px 1px rgba(255,55,168,0.55); }
        @keyframes rmg-blink {
            0%, 100% { opacity: 0.6; }
            50%       { opacity: 1; }
        }
        .controls-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .led-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .led-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
        }
        .led-divider {
            width: 1px;
            height: 10px;
            background: rgba(255,255,255,0.07);
        }
        .led {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
            transition: background 0.04s ease-out, box-shadow 0.12s ease-out;
        }
        .led.on.rx { background: #A7FF00; box-shadow: 0 0 6px 1px rgba(167,255,0,0.65); border-color: rgba(167,255,0,0.6); }
        .led.on.tx { background: #FF37A8; box-shadow: 0 0 6px 1px rgba(255,55,168,0.65); border-color: rgba(255,55,168,0.6); }
        .led-tag {
            font-size: 4px;
            color: rgba(255,255,255,0.18);
            letter-spacing: 0.06em;
            line-height: 1;
        }
        .btn-connect {
            flex: 1;
            appearance: none;
            background: rgba(255,79,179,0.10);
            border: 1px solid rgba(255,79,179,0.30);
            border-radius: 3px;
            color: rgba(255,79,179,0.80);
            font-family: var(--ravel-font, 'Silkscreen', monospace);
            font-size: 6px;
            letter-spacing: 0.10em;
            padding: 4px 6px;
            cursor: pointer;
            text-transform: uppercase;
            transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
            white-space: nowrap;
        }
        .btn-connect:hover {
            background: rgba(255,79,179,0.20);
            border-color: rgba(255,79,179,0.55);
            color: #FF4FB3;
        }
        .btn-connect:focus-visible {
            outline: 2px solid rgba(255,79,179,0.6);
            outline-offset: 2px;
        }
        .btn-connect.connected {
            background: rgba(167,255,0,0.08);
            border-color: rgba(167,255,0,0.25);
            color: rgba(167,255,0,0.65);
        }
        .btn-connect.connected:hover {
            background: rgba(167,255,0,0.15);
            border-color: rgba(167,255,0,0.50);
            color: #A7FF00;
        }
        .port-panel {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .port-panel[hidden] { display: none; }
        .port-row {
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .port-label {
            font-size: 5px;
            color: rgba(255,255,255,0.22);
            letter-spacing: 0.08em;
            text-transform: uppercase;
            min-width: 16px;
            text-align: right;
        }
        .port-select {
            flex: 1;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 3px;
            color: rgba(255,255,255,0.65);
            font-family: var(--ravel-font, 'Silkscreen', monospace);
            font-size: 5px;
            padding: 2px 4px;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            max-width: 132px;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .port-select:focus-visible {
            outline: 1px solid rgba(255,79,179,0.5);
            outline-offset: 1px;
        }
        .port-select option {
            background: #0e0e12;
            color: #E6E2D3;
            font-size: 12px;
        }
    `;

    private static readonly componentHtml = `
        <div id="head" role="region" aria-label="MIDI gadget controls">
            <div class="head-row">
                <span class="head-title">MIDI GADGET</span>
                <span class="status-dot" id="status-dot" role="status" aria-label="MIDI connection status: disconnected"></span>
            </div>
            <div class="controls-row">
                <div class="led-row">
                    <div class="led-wrap">
                        <div class="led rx" id="led-rx"></div>
                        <span class="led-tag">RX</span>
                    </div>
                    <div class="led-divider"></div>
                    <div class="led-wrap">
                        <div class="led tx" id="led-tx"></div>
                        <span class="led-tag">TX</span>
                    </div>
                </div>
                <button id="btn-connect" class="btn-connect" type="button" aria-pressed="false">
                    CONNECT MIDI
                </button>
            </div>
            <div id="port-panel" class="port-panel" hidden aria-label="Port selection">
                <div class="port-row">
                    <span class="port-label">OUT</span>
                    <select id="sel-out" class="port-select" aria-label="MIDI output port">
                        <option value="">— none —</option>
                    </select>
                </div>
                <div class="port-row">
                    <span class="port-label">IN</span>
                    <select id="sel-in" class="port-select" aria-label="MIDI input port">
                        <option value="">All</option>
                        <option value="none">None</option>
                    </select>
                </div>
            </div>
        </div>
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'output', 'input', 'broker', 'autoconnect'];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _statusDot!:  HTMLElement;
    private _btnConnect!: HTMLButtonElement;
    private _ledRx!:      HTMLElement;
    private _ledTx!:      HTMLElement;
    private _portPanel!:  HTMLElement;
    private _selOut!:     HTMLSelectElement;
    private _selIn!:      HTMLSelectElement;

    private _isReady = false;

    // ── Config ────────────────────────────────────────────────────────────────

    private _outputName = '';
    private _inputName  = '';
    private _broker     = 'ravel-midi-broker';

    // ── MIDI state ────────────────────────────────────────────────────────────

    private _midiAccess: MIDIAccess | null = null;

    // Maps MIDIInput → its onmidimessage handler so we can cleanly remove it.
    private _inputListeners = new Map<MIDIInput, (e: MIDIMessageEvent) => void>();

    // LED timers
    private _rxTimer: ReturnType<typeof setTimeout> | null = null;
    private _txTimer: ReturnType<typeof setTimeout> | null = null;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelMidiGadget.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelMidiGadget.componentHtml;

        this._statusDot  = this.container.querySelector<HTMLElement>('#status-dot')!;
        this._btnConnect = this.container.querySelector<HTMLButtonElement>('#btn-connect')!;
        this._ledRx      = this.container.querySelector<HTMLElement>('#led-rx')!;
        this._ledTx      = this.container.querySelector<HTMLElement>('#led-tx')!;
        this._portPanel  = this.container.querySelector<HTMLElement>('#port-panel')!;
        this._selOut     = this.container.querySelector<HTMLSelectElement>('#sel-out')!;
        this._selIn      = this.container.querySelector<HTMLSelectElement>('#sel-in')!;
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;

        this._btnConnect.addEventListener('click', this._onConnectClick);
        this._selOut.addEventListener('change',   this._onOutputChange);
        this._selIn.addEventListener('change',    this._onInputChange);

        window.addEventListener('ravel-midi-gadget', this._onWindowSend);

        if (this.hasAttribute('autoconnect')) {
            this.connect().catch(console.error);
        }
    }

    protected teardown(): void {
        this._isReady = false;

        this._btnConnect.removeEventListener('click', this._onConnectClick);
        this._selOut.removeEventListener('change',   this._onOutputChange);
        this._selIn.removeEventListener('change',    this._onInputChange);

        window.removeEventListener('ravel-midi-gadget', this._onWindowSend);

        this._unbindAllInputs();
        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        switch (name) {
            case 'output':
                this._outputName = newValue ?? '';
                if (this._midiAccess) this._autoSelectOutput();
                break;
            case 'input':
                this._inputName = newValue ?? '';
                if (this._midiAccess) this._autoSelectInput();
                break;
            case 'broker':
                this._broker = newValue ?? 'ravel-midi-broker';
                break;
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    async connect(): Promise<void> {
        if (!navigator.requestMIDIAccess) {
            this._setStatus('not supported', 'error');
            return;
        }

        this._setStatus('connecting…', 'loading');

        try {
            this._midiAccess = await navigator.requestMIDIAccess({ sysex: false });
            this._midiAccess.onstatechange = this._onStateChange;
            this._populatePorts();
            this._setStatus('connected', 'connected');
            if (this._isReady) {
                this._portPanel.removeAttribute('hidden');
                this._btnConnect.classList.add('connected');
                this._btnConnect.setAttribute('aria-pressed', 'true');
                this._btnConnect.textContent = 'MIDI READY';
            }
        } catch (err) {
            this._setStatus(err instanceof Error ? err.message : 'error', 'error');
            console.error('[ravel-midi-gadget] MIDI access denied:', err);
        }
    }

    disconnect(): void {
        this._unbindAllInputs();
        this._midiAccess = null;
        if (this._isReady) {
            this._portPanel.setAttribute('hidden', '');
            this._btnConnect.classList.remove('connected');
            this._btnConnect.setAttribute('aria-pressed', 'false');
            this._btnConnect.textContent = 'CONNECT MIDI';
            this._selOut.innerHTML = '<option value="">— none —</option>';
            this._selIn.innerHTML = '<option value="">All</option><option value="none">None</option>';
        }
        this._setStatus('disconnected', 'idle');
    }

    // ── Window event: outbound MIDI bytes from broker ─────────────────────────

    private _onWindowSend = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent<{ cmd: string; content: unknown }>).detail ?? {};
        if (cmd !== 'send') return;
        const c = content as { data?: number[] };
        if (!c?.data?.length) return;
        this._sendBytes(c.data);
    };

    private _sendBytes(data: number[]): void {
        const outputId = this._selOut?.value;
        if (!outputId || !this._midiAccess) return;
        const output = this._midiAccess.outputs.get(outputId);
        if (!output) return;
        try {
            output.send(data);
            this._flashTx();
        } catch (err) {
            console.error('[ravel-midi-gadget] send error:', err);
        }
    }

    // ── MIDI state change: ports connected / disconnected ─────────────────────

    private _onStateChange = (): void => {
        if (!this._midiAccess) return;
        this._populatePorts();
    };

    // ── Port population ───────────────────────────────────────────────────────

    private _populatePorts(): void {
        if (!this._midiAccess || !this._isReady) return;

        // ── Outputs ──
        const prevOutId = this._selOut.value;
        this._selOut.innerHTML = '<option value="">— none —</option>';
        for (const [id, out] of this._midiAccess.outputs) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = out.name ?? id;
            this._selOut.appendChild(opt);
        }
        // Restore previous selection if still available, otherwise auto-select by name.
        if (prevOutId && this._selOut.querySelector(`option[value="${prevOutId}"]`)) {
            this._selOut.value = prevOutId;
        } else {
            this._autoSelectOutput();
        }

        // ── Inputs ──
        const prevInId = this._selIn.value;
        this._selIn.innerHTML = '<option value="">All</option><option value="none">None</option>';
        for (const [id, inp] of this._midiAccess.inputs) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = inp.name ?? id;
            this._selIn.appendChild(opt);
        }
        if (prevInId && (prevInId === '' || prevInId === 'none' || this._selIn.querySelector(`option[value="${prevInId}"]`))) {
            this._selIn.value = prevInId;
        } else {
            this._autoSelectInput();
        }

        this._updateInputListeners();
    }

    private _autoSelectOutput(): void {
        if (!this._midiAccess || !this._isReady) return;
        const filter = this._outputName.toLowerCase();
        for (const [id, out] of this._midiAccess.outputs) {
            if (!filter || out.name?.toLowerCase().includes(filter)) {
                this._selOut.value = id;
                return;
            }
        }
        this._selOut.value = '';
    }

    private _autoSelectInput(): void {
        if (!this._midiAccess || !this._isReady) return;
        const filter = this._inputName.toLowerCase();
        if (filter === 'none') { this._selIn.value = 'none'; return; }
        if (!filter)           { this._selIn.value = ''; return; }
        for (const [id, inp] of this._midiAccess.inputs) {
            if (inp.name?.toLowerCase().includes(filter)) {
                this._selIn.value = id;
                return;
            }
        }
        this._selIn.value = '';
    }

    // ── Input listener management ─────────────────────────────────────────────

    private _updateInputListeners(): void {
        if (!this._midiAccess) return;
        const selVal = this._selIn.value;

        // Unbind ports that are no longer selected.
        for (const input of [...this._inputListeners.keys()]) {
            const wanted = selVal === '' || input.id === selVal;
            if (!wanted) this._unbindInput(input);
        }

        if (selVal === 'none') return;

        // Bind newly wanted ports.
        for (const input of this._midiAccess.inputs.values()) {
            const wanted = selVal === '' || input.id === selVal;
            if (wanted) this._bindInput(input);
        }
    }

    private _bindInput(input: MIDIInput): void {
        if (this._inputListeners.has(input)) return;
        const handler = (e: MIDIMessageEvent): void => {
            if (!e.data?.length) return;
            this._flashRx();
            const data = Array.from(e.data);
            this.sendMessage(this._broker, 'raw', { data, deviceName: input.name ?? '' });
        };
        this._inputListeners.set(input, handler);
        input.addEventListener('midimessage', handler as EventListener);
    }

    private _unbindInput(input: MIDIInput): void {
        const handler = this._inputListeners.get(input);
        if (!handler) return;
        input.removeEventListener('midimessage', handler as EventListener);
        this._inputListeners.delete(input);
    }

    private _unbindAllInputs(): void {
        for (const input of this._inputListeners.keys()) {
            this._unbindInput(input);
        }
    }

    // ── LED flashes ───────────────────────────────────────────────────────────

    private _flashRx(): void {
        if (!this._ledRx) return;
        this._ledRx.classList.add('on');
        if (this._rxTimer !== null) clearTimeout(this._rxTimer);
        this._rxTimer = setTimeout(() => {
            this._ledRx?.classList.remove('on');
            this._rxTimer = null;
        }, 80);
    }

    private _flashTx(): void {
        if (!this._ledTx) return;
        this._ledTx.classList.add('on');
        if (this._txTimer !== null) clearTimeout(this._txTimer);
        this._txTimer = setTimeout(() => {
            this._ledTx?.classList.remove('on');
            this._txTimer = null;
        }, 80);
    }

    // ── Status dot ────────────────────────────────────────────────────────────

    private _setStatus(label: string, state: 'idle' | 'loading' | 'connected' | 'error'): void {
        if (!this._isReady) return;
        this._statusDot.className = `status-dot${state !== 'idle' ? ' ' + state : ''}`;
        this._statusDot.setAttribute('aria-label', `MIDI connection status: ${label}`);
    }

    // ── UI event handlers ─────────────────────────────────────────────────────

    private _onConnectClick = (): void => {
        if (this._midiAccess) {
            // Already connected — refresh ports.
            this._populatePorts();
        } else {
            this.connect().catch(console.error);
        }
    };

    private _onOutputChange = (): void => {
        // Output selection is read in _sendBytes; nothing to do here except reflect.
    };

    private _onInputChange = (): void => {
        this._updateInputListeners();
    };
}
