import { RavelElement } from '../../../../common/RavelElement';

/**
 * DOM broker that bridges Web MIDI into the Ravel messaging system.
 *
 * Place `<ravel-midi-broker>` anywhere on the page. It renders a compact
 * status head with RX and TX LED indicators showing live throughput. It
 * assumes that a `<ravel-midi-gadget>` element handles Web MIDI device access
 * and sends raw MIDI bytes into Ravel. The broker parses those bytes and
 * broadcasts structured events that page components can consume. It also
 * accepts structured MIDI commands from components and encodes them back to
 * raw bytes for the gadget to transmit.
 *
 * ### Attributes
 * | Attribute | Type   | Default               | Description                                       |
 * |-----------|--------|-----------------------|---------------------------------------------------|
 * | `label`   | string | `'ravel-midi-broker'` | Pub/sub channel this broker subscribes to         |
 * | `channel` | string | `'midi'`              | Broadcast channel for parsed outbound MIDI events |
 * | `device`  | string | `''`                  | Device-name filter; empty string = all devices    |
 *
 * ### Messages received (on `label` channel, via RavelMessenger.sendMessage)
 * | cmd    | content                                             | Effect                       |
 * |--------|-----------------------------------------------------|------------------------------|
 * | `raw`  | `{ data: number[], deviceName?: string }`           | Parse and broadcast          |
 * | `send` | `{ type, channel?, note?, velocity?, ... }`         | Encode and forward to gadget |
 *
 * ### Messages broadcast (on `channel` channel, via window)
 * `note-on`, `note-off`, `cc`, `pitch-bend`, `program-change`,
 * `aftertouch`, `poly-aftertouch`, `clock`, `sysex`
 */
export class RavelMidiBroker extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: inline-block;
            cursor: default;
            font-family: var(--ravel-font, 'Silkscreen', monospace);
        }
        #container {
            width: auto;
            height: auto;
            position: relative;
        }
        #head {
            background: #0e0e12;
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 5px;
            padding: 7px 12px 6px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            min-width: 68px;
            user-select: none;
            -webkit-user-select: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
        .head-title {
            font-size: 7px;
            letter-spacing: 0.12em;
            color: rgba(255,255,255,0.28);
            text-transform: uppercase;
            line-height: 1;
        }
        .led-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 2px 0 1px;
        }
        .led-wrap {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 3px;
        }
        .led-divider {
            width: 1px;
            height: 12px;
            background: rgba(255,255,255,0.07);
        }
        .led {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            background: rgba(255,255,255,0.04);
            border: 1px solid rgba(255,255,255,0.08);
            transition: background 0.04s ease-out, box-shadow 0.12s ease-out, border-color 0.04s ease-out;
        }
        .led.on.rx {
            background: #A7FF00;
            box-shadow: 0 0 7px 2px rgba(167,255,0,0.65);
            border-color: rgba(167,255,0,0.6);
        }
        .led.on.tx {
            background: #FF37A8;
            box-shadow: 0 0 7px 2px rgba(255,55,168,0.65);
            border-color: rgba(255,55,168,0.6);
        }
        .led-tag {
            font-size: 5px;
            color: rgba(255,255,255,0.18);
            letter-spacing: 0.06em;
            line-height: 1;
        }
        .head-channel {
            font-size: 5px;
            color: rgba(255,255,255,0.15);
            letter-spacing: 0.05em;
            max-width: 72px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: center;
            line-height: 1;
        }
    `;

    private static readonly componentHtml = `
        <div id="head" role="status" aria-label="MIDI broker activity">
            <span class="head-title">MIDI</span>
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
            <div class="head-channel" id="head-channel">midi</div>
        </div>
    `;

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'label', 'channel', 'device'];
    }

    private _label   = 'ravel-midi-broker';
    private _channel = 'midi';
    private _device  = '';

    private _rxLed:     HTMLElement | null = null;
    private _txLed:     HTMLElement | null = null;
    private _channelEl: HTMLElement | null = null;
    private _rxTimer:   ReturnType<typeof setTimeout> | null = null;
    private _txTimer:   ReturnType<typeof setTimeout> | null = null;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();
        const style = document.createElement('style');
        style.textContent = RavelMidiBroker.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);
        this.container.innerHTML = RavelMidiBroker.componentHtml;
        this._rxLed     = this.container.querySelector('#led-rx');
        this._txLed     = this.container.querySelector('#led-tx');
        this._channelEl = this.container.querySelector('#head-channel');
        this._renderChannel();
    }

    protected setup(): void {
        super.setup();
        this.subscribe([this._label]);
        this.addEventListener(this._label, this._onMessage);
    }

    protected teardown(): void {
        this.removeEventListener(this._label, this._onMessage);
        this.unsubscribe([this._label]);
        super.teardown();
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private _renderChannel(): void {
        if (this._channelEl) this._channelEl.textContent = this._channel;
    }

    // ── LED activity ──────────────────────────────────────────────────────────

    private _flashRx(): void {
        if (!this._rxLed) return;
        this._rxLed.classList.add('on');
        if (this._rxTimer !== null) clearTimeout(this._rxTimer);
        this._rxTimer = setTimeout(() => {
            this._rxLed?.classList.remove('on');
            this._rxTimer = null;
        }, 80);
    }

    private _flashTx(): void {
        if (!this._txLed) return;
        this._txLed.classList.add('on');
        if (this._txTimer !== null) clearTimeout(this._txTimer);
        this._txTimer = setTimeout(() => {
            this._txLed?.classList.remove('on');
            this._txTimer = null;
        }, 80);
    }

    // ── Attribute handling ────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        switch (name) {
            case 'label': {
                const prev = this._label;
                this._label = newValue ?? 'ravel-midi-broker';
                if (this.isConnected && prev !== this._label) {
                    this.removeEventListener(prev, this._onMessage);
                    this.unsubscribe([prev]);
                    this.subscribe([this._label]);
                    this.addEventListener(this._label, this._onMessage);
                }
                break;
            }
            case 'channel':
                this._channel = newValue ?? 'midi';
                this._renderChannel();
                break;
            case 'device':
                this._device = newValue ?? '';
                break;
        }
    }

    // ── Inbound message handler ───────────────────────────────────────────────

    private _onMessage = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent<{ cmd: string; content: unknown }>).detail ?? {};
        switch (cmd) {
            case 'raw': {
                const c = content as { data?: number[]; deviceName?: string };
                if (!c?.data) return;
                if (this._device && c.deviceName && c.deviceName !== this._device) return;
                this._flashRx();
                this._dispatchMidi(c.data, c.deviceName);
                break;
            }
            case 'send':
                this._flashRx();
                this._handleSend(content);
                break;
        }
    };

    // ── Emit helper: broadcast + flash TX ────────────────────────────────────

    private _emit(cmd: string, content: unknown): void {
        this.broadcastMessage(this._channel, cmd, content);
        this._flashTx();
    }

    // ── MIDI in: raw bytes → structured broadcast ─────────────────────────────

    private _dispatchMidi(data: number[], deviceName?: string): void {
        if (!data || data.length < 1) return;
        const status = data[0];
        const type   = status & 0xF0;
        const ch     = status & 0x0F;

        switch (type) {
            case 0x90: {
                const note      = data[1] ?? 0;
                const velocity  = data[2] ?? 0;
                const eventName = velocity === 0 ? 'note-off' : 'note-on';
                this._emit(eventName, { channel: ch, note, velocity, deviceName });
                break;
            }
            case 0x80:
                this._emit('note-off', { channel: ch, note: data[1] ?? 0, velocity: data[2] ?? 0, deviceName });
                break;
            case 0xB0:
                this._emit('cc', { channel: ch, controller: data[1] ?? 0, value: data[2] ?? 0, deviceName });
                break;
            case 0xE0: {
                const value = (((data[2] ?? 0) << 7) | (data[1] ?? 0)) - 8192;
                this._emit('pitch-bend', { channel: ch, value, deviceName });
                break;
            }
            case 0xC0:
                this._emit('program-change', { channel: ch, program: data[1] ?? 0, deviceName });
                break;
            case 0xD0:
                this._emit('aftertouch', { channel: ch, pressure: data[1] ?? 0, deviceName });
                break;
            case 0xA0:
                this._emit('poly-aftertouch', { channel: ch, note: data[1] ?? 0, pressure: data[2] ?? 0, deviceName });
                break;
            case 0xF0:
                if      (status === 0xF8) this._emit('clock', { type: 'tick' });
                else if (status === 0xFA) this._emit('clock', { type: 'start' });
                else if (status === 0xFB) this._emit('clock', { type: 'continue' });
                else if (status === 0xFC) this._emit('clock', { type: 'stop' });
                else if (status === 0xF0) this._emit('sysex', { data });
                break;
        }
    }

    // ── MIDI out: structured message → raw bytes → forward to gadget ──────────

    private _handleSend(content: unknown): void {
        const c = content as {
            type:        string;
            channel?:    number;
            note?:       number;
            velocity?:   number;
            controller?: number;
            value?:      number;
            program?:    number;
            pressure?:   number;
            data?:       number[];
        };
        if (!c?.type) return;
        const ch = (c.channel ?? 0) & 0x0F;
        let bytes: number[];

        switch (c.type) {
            case 'note-on':
                bytes = [0x90 | ch, (c.note ?? 60) & 0x7F, (c.velocity ?? 64) & 0x7F];
                break;
            case 'note-off':
                bytes = [0x80 | ch, (c.note ?? 60) & 0x7F, (c.velocity ?? 0) & 0x7F];
                break;
            case 'cc':
                bytes = [0xB0 | ch, (c.controller ?? 0) & 0x7F, (c.value ?? 0) & 0x7F];
                break;
            case 'pitch-bend': {
                const v = Math.max(0, Math.min(16383, (c.value ?? 0) + 8192));
                bytes = [0xE0 | ch, v & 0x7F, (v >> 7) & 0x7F];
                break;
            }
            case 'program-change':
                bytes = [0xC0 | ch, (c.program ?? 0) & 0x7F];
                break;
            case 'aftertouch':
                bytes = [0xD0 | ch, (c.pressure ?? 0) & 0x7F];
                break;
            case 'poly-aftertouch':
                bytes = [0xA0 | ch, (c.note ?? 60) & 0x7F, (c.pressure ?? 0) & 0x7F];
                break;
            case 'sysex':
                bytes = c.data ?? [0xF0, 0xF7];
                break;
            default:
                return;
        }

        this.broadcastMessage('ravel-midi-gadget', 'send', { data: bytes });
        this._flashTx();
    }
}
