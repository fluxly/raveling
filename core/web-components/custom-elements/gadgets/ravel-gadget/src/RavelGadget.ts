// Minimal Web Bluetooth API types (not in standard lib.dom.d.ts)
declare global {
    interface BluetoothRemoteGATTCharacteristic {
        uuid: string;
        value: DataView | null;
        writeValue(value: BufferSource): Promise<void>;
        startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>;
        addEventListener(type: 'characteristicvaluechanged', listener: (e: Event) => void): void;
        removeEventListener(type: 'characteristicvaluechanged', listener: (e: Event) => void): void;
    }
    interface BluetoothRemoteGATTService {
        getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
    }
    interface BluetoothRemoteGATTServer {
        connected: boolean;
        connect(): Promise<BluetoothRemoteGATTServer>;
        disconnect(): void;
        getPrimaryService(uuid: number | string): Promise<BluetoothRemoteGATTService>;
    }
    interface BluetoothDevice {
        name?: string;
        gatt: BluetoothRemoteGATTServer;
        addEventListener(type: 'gattserverdisconnected', listener: (e: Event) => void): void;
        removeEventListener(type: 'gattserverdisconnected', listener: (e: Event) => void): void;
    }
    interface BluetoothRequestDeviceFilter { namePrefix?: string; }
    interface RequestDeviceOptions {
        filters?: BluetoothRequestDeviceFilter[];
        optionalServices?: (number | string)[];
    }
    interface Bluetooth { requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>; }
    interface Navigator { bluetooth: Bluetooth; }
}

import { RavelElement } from '../../../../common/RavelElement';
import { WebSerialPort } from './WebSerialPort';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
type GadgetType      = 'ble' | 'serial';

/**
 * Hardware interface component — connects a Raveling app to a physical gadget
 * via Bluetooth LE or USB Serial (Web Serial API).
 *
 * ### Attributes
 * | Attribute    | Type             | Default        | Description                    |
 * |--------------|------------------|----------------|--------------------------------|
 * | `type`       | `ble \| serial`  | `'ble'`        | Connection method              |
 * | `uid`        | string           | `''`           | Device UID shown in UI         |
 * | `label`      | string           | `'gadget'`     | Display name                   |
 * | `show-comms` | boolean          | false          | Show manual send/receive panel |
 *
 * ### Messages broadcast (on `'ravel-gadget'` channel)
 * | cmd          | content                            | Trigger                   |
 * |--------------|------------------------------------|---------------------------|
 * | `connected`  | `{ uid, type }`                    | Device connected          |
 * | `data`       | `{ uid, type, data: Uint8Array }`  | Data received from device |
 * | `disconnected` | `{ uid, type }`                  | Device disconnected       |
 *
 * ### Messages received (on `'ravel-gadget'` channel)
 * | cmd    | content                  | Effect                             |
 * |--------|--------------------------|------------------------------------|
 * | `send` | `{ uid?, data: number }` | Write byte to connected device     |
 */
export class RavelGadget extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: inline-block;
            font-family: inherit;
            font-size: 12px;
            user-select: none;
        }
        .card {
            background: rgba(24, 24, 24, 0.95);
            border: 2px solid rgba(255,255,255,0.12);
            border-radius: 16px;
            padding: 16px 20px;
            min-width: 200px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            transition: border-color 0.2s;
        }
        .card.connected    { border-color: #A7FF00; }
        .card.connecting   { border-color: #FE6810; }
        .card.error        { border-color: #FF37A8; }
        .header {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .icon { font-size: 1.6em; line-height: 1; }
        .label-text {
            color: #ffffff;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .type-badge {
            font-size: 0.75em;
            color: rgba(255,255,255,0.35);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 4px;
            padding: 1px 6px;
        }
        .status-row {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: rgba(255,255,255,0.15);
            flex-shrink: 0;
            transition: background 0.2s;
        }
        .dot.connected    { background: #A7FF00; }
        .dot.connecting   { background: #FE6810; }
        .dot.error        { background: #FF37A8; }
        .status-text {
            font-size: 0.85em;
            color: rgba(255,255,255,0.45);
        }
        .uid-row {
            display: flex;
            gap: 6px;
            font-size: 0.8em;
            color: rgba(255,255,255,0.35);
        }
        .uid-value { color: rgba(255,255,255,0.65); font-family: monospace; }
        button {
            appearance: none;
            border: 1px solid rgba(255,255,255,0.18);
            background: rgba(255,255,255,0.06);
            border-radius: 8px;
            padding: 8px 14px;
            font: inherit;
            color: rgba(255,255,255,0.75);
            cursor: pointer;
            transition: background 0.12s, border-color 0.12s, color 0.12s;
            min-height: 44px;
        }
        button:hover { background: rgba(255,255,255,0.12); }
        button:disabled { opacity: 0.35; cursor: not-allowed; }
        button.disconnect {
            border-color: #FF37A8;
            color: #FF37A8;
        }
        .comms {
            display: none;
            flex-direction: column;
            gap: 6px;
            border-top: 1px solid rgba(255,255,255,0.08);
            padding-top: 10px;
        }
        :host([show-comms]) .comms { display: flex; }
        .comms-row { display: flex; gap: 6px; }
        .comms input[type="text"] {
            flex: 1;
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 6px;
            padding: 5px 8px;
            font: inherit;
            color: #ffffff;
            outline: none;
            min-height: 0;
        }
        .comms input[type="text"]:focus { border-color: #00F0FF; }
        .comms button { padding: 5px 12px; min-height: 0; }
        .recv-log {
            font-size: 0.75em;
            color: #A7FF00;
            font-family: monospace;
            white-space: pre-wrap;
            max-height: 60px;
            overflow-y: auto;
            opacity: 0.85;
        }
    `;

    private static readonly componentHtml = `
        <div class="card" id="card">
            <div class="header">
                <span class="icon" id="icon">📟</span>
                <span class="label-text" id="label-text">gadget</span>
                <span class="type-badge" id="type-badge">BLE</span>
            </div>
            <div class="status-row">
                <span class="dot" id="dot"></span>
                <span class="status-text" id="status-text">disconnected</span>
            </div>
            <div class="uid-row" id="uid-row" hidden>
                <span>UID</span>
                <span class="uid-value" id="uid-value"></span>
            </div>
            <button id="connect-btn" type="button">Connect</button>
            <div class="comms">
                <div class="comms-row">
                    <input type="text" id="send-input" placeholder="bytes to send…" aria-label="Data to send">
                    <button id="send-btn" type="button">Send</button>
                </div>
                <div class="recv-log" id="recv-log" aria-live="polite" aria-label="Received data"></div>
            </div>
        </div>
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'type', 'uid', 'label', 'show-comms'];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private cardEl!:      HTMLElement;
    private iconEl!:      HTMLElement;
    private labelTextEl!: HTMLElement;
    private typeBadgeEl!: HTMLElement;
    private dotEl!:       HTMLElement;
    private statusTextEl!:HTMLElement;
    private uidRowEl!:    HTMLElement;
    private uidValueEl!:  HTMLElement;
    private connectBtnEl!:HTMLButtonElement;
    private sendInputEl!: HTMLInputElement;
    private sendBtnEl!:   HTMLButtonElement;
    private recvLogEl!:   HTMLElement;

    private _isReady = false;

    // ── Component state ───────────────────────────────────────────────────────

    private _type:   GadgetType      = 'ble';
    private _uid:    string          = '';
    private _label:  string          = 'gadget';
    private _state:  ConnectionState = 'disconnected';

    // ── BLE state ─────────────────────────────────────────────────────────────

    private _bleDevice:    BluetoothDevice | null                    = null;
    private _bleWriteChar: BluetoothRemoteGATTCharacteristic | null  = null;
    private _bleReadChar:  BluetoothRemoteGATTCharacteristic | null  = null;

    // ── Serial state ──────────────────────────────────────────────────────────

    private _serial: WebSerialPort | null = null;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelGadget.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelGadget.componentHtml;

        this.cardEl       = this.container.querySelector<HTMLElement>('#card')!;
        this.iconEl       = this.container.querySelector<HTMLElement>('#icon')!;
        this.labelTextEl  = this.container.querySelector<HTMLElement>('#label-text')!;
        this.typeBadgeEl  = this.container.querySelector<HTMLElement>('#type-badge')!;
        this.dotEl        = this.container.querySelector<HTMLElement>('#dot')!;
        this.statusTextEl = this.container.querySelector<HTMLElement>('#status-text')!;
        this.uidRowEl     = this.container.querySelector<HTMLElement>('#uid-row')!;
        this.uidValueEl   = this.container.querySelector<HTMLElement>('#uid-value')!;
        this.connectBtnEl = this.container.querySelector<HTMLButtonElement>('#connect-btn')!;
        this.sendInputEl  = this.container.querySelector<HTMLInputElement>('#send-input')!;
        this.sendBtnEl    = this.container.querySelector<HTMLButtonElement>('#send-btn')!;
        this.recvLogEl    = this.container.querySelector<HTMLElement>('#recv-log')!;

        this.setAttribute('role', 'region');
        this.setAttribute('aria-label', `Ravel gadget: ${this._label}`);
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;

        this.connectBtnEl.addEventListener('click', this._onConnectClick);
        this.sendBtnEl.addEventListener('click',    this._onSendClick);
        this.sendInputEl.addEventListener('keydown', this._onSendKeydown);

        this._syncUi();
    }

    protected teardown(): void {
        this._isReady = false;

        this.connectBtnEl.removeEventListener('click', this._onConnectClick);
        this.sendBtnEl.removeEventListener('click',    this._onSendClick);
        this.sendInputEl.removeEventListener('keydown', this._onSendKeydown);

        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        switch (name) {
            case 'type':
                this._type = (newValue === 'serial') ? 'serial' : 'ble';
                break;
            case 'uid':
                this._uid = newValue ?? '';
                break;
            case 'label':
                this._label = newValue ?? 'gadget';
                break;
        }
        if (this._isReady) this._syncUi();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    get connectionState(): ConnectionState { return this._state; }

    async sendData(data: number | Uint8Array | string): Promise<void> {
        if (this._state !== 'connected') return;
        if (this._type === 'ble') {
            await this._bleSend(data);
        } else {
            const bytes = typeof data === 'number'
                ? Uint8Array.of(data)
                : typeof data === 'string'
                    ? new TextEncoder().encode(data)
                    : data;
            await this._serial?.send(bytes);
        }
    }

    // ── Event handlers (arrow properties — safe for add/removeEventListener) ──

    private _onConnectClick = (): void => {
        if (this._state === 'connected') {
            this._disconnect();
        } else if (this._state !== 'connecting') {
            this._connect().catch(() => {});
        }
    };

    private _onSendClick = (): void => {
        const val = this.sendInputEl.value.trim();
        if (!val) return;
        this.sendData(val).catch(() => {});
        this.sendInputEl.value = '';
    };

    private _onSendKeydown = (e: KeyboardEvent): void => {
        if (e.key === 'Enter') this._onSendClick();
    };

    // ── Connection logic ──────────────────────────────────────────────────────

    private async _connect(): Promise<void> {
        this._setState('connecting');
        try {
            if (this._type === 'ble') {
                await this._connectBle();
            } else {
                await this._connectSerial();
            }
            this._setState('connected');
            this.broadcastMessage('ravel-gadget', 'connected', { uid: this._uid, type: this._type });
        } catch (err) {
            this._setState('error');
            // Revert to disconnected after a moment so the user can retry
            setTimeout(() => { if (this._state === 'error') this._setState('disconnected'); }, 2000);
        }
    }

    private _disconnect(): void {
        if (this._type === 'ble') {
            this._bleDisconnect();
        } else {
            this._serial?.close().catch(() => {});
            this._serial = null;
        }
        this._setState('disconnected');
        this.broadcastMessage('ravel-gadget', 'disconnected', { uid: this._uid, type: this._type });
    }

    // ── BLE ───────────────────────────────────────────────────────────────────

    private async _connectBle(): Promise<void> {
        this._bleDevice = await navigator.bluetooth.requestDevice({
            filters:          [{ namePrefix: 'Ravel' }],
            optionalServices: [0xff00],
        });
        this._bleDevice.addEventListener('gattserverdisconnected', this._onBleDisconnected);
        const server  = await this._bleDevice.gatt.connect();
        const service = await server.getPrimaryService(0xff00);
        const chars   = await service.getCharacteristics();
        this._subscribeToCharacteristics(chars);
    }

    private _subscribeToCharacteristics(chars: BluetoothRemoteGATTCharacteristic[]): void {
        for (const char of chars) {
            if (char.uuid.includes('fff1')) this._bleWriteChar = char;
            if (char.uuid.includes('fff2')) {
                this._bleReadChar = char;
                char.addEventListener('characteristicvaluechanged', this._onBleData);
                char.startNotifications();
            }
        }
    }

    private _bleDisconnect(): void {
        this._bleReadChar?.removeEventListener('characteristicvaluechanged', this._onBleData);
        this._bleWriteChar = null;
        this._bleReadChar  = null;
        if (this._bleDevice) {
            this._bleDevice.removeEventListener('gattserverdisconnected', this._onBleDisconnected);
            if (this._bleDevice.gatt.connected) this._bleDevice.gatt.disconnect();
            this._bleDevice = null;
        }
    }

    private _onBleDisconnected = (): void => {
        this._bleWriteChar = null;
        this._bleReadChar  = null;
        this._bleDevice    = null;
        this._setState('disconnected');
        this.broadcastMessage('ravel-gadget', 'disconnected', { uid: this._uid, type: 'ble' });
    };

    private _onBleData = (e: Event): void => {
        const value = (e.target as BluetoothRemoteGATTCharacteristic).value;
        if (!value) return;
        const byte = value.getUint8(0);
        this._handleIncomingData(Uint8Array.of(byte));
    };

    private async _bleSend(data: number | Uint8Array | string): Promise<void> {
        if (!this._bleWriteChar || !this._bleDevice?.gatt.connected) return;
        const bytes = typeof data === 'number'
            ? Uint8Array.of(data)
            : typeof data === 'string'
                ? new TextEncoder().encode(data)
                : data;
        await this._bleWriteChar.writeValue(bytes);
    }

    // ── Serial ────────────────────────────────────────────────────────────────

    private async _connectSerial(): Promise<void> {
        this._serial = new WebSerialPort();
        this._serial.addEventListener('data',  this._onSerialData as EventListener);
        this._serial.addEventListener('error', this._onSerialError as EventListener);
        await this._serial.open();
    }

    private _onSerialData = (e: CustomEvent<{ data: Uint8Array }>): void => {
        this._handleIncomingData(e.detail.data);
    };

    private _onSerialError = (): void => {
        this._serial = null;
        this._setState('error');
        setTimeout(() => { if (this._state === 'error') this._setState('disconnected'); }, 2000);
    };

    // ── Data handling ─────────────────────────────────────────────────────────

    private _handleIncomingData(data: Uint8Array): void {
        this.broadcastMessage('ravel-gadget', 'data', { uid: this._uid, type: this._type, data });
        if (this._isReady) {
            const decoded = new TextDecoder().decode(data);
            const line    = decoded.replace(/\n/g, '') || `[${data.join(',')}]`;
            this.recvLogEl.textContent = line + '\n' + this.recvLogEl.textContent;
        }
    }

    // ── UI sync ───────────────────────────────────────────────────────────────

    private _setState(state: ConnectionState): void {
        this._state = state;
        if (this._isReady) this._syncUi();
    }

    private _syncUi(): void {
        if (!this._isReady) return;

        // Card border
        this.cardEl.className = `card ${this._state}`;

        // Header
        this.iconEl.textContent  = this._type === 'ble' ? '📡' : '🔌';
        this.labelTextEl.textContent = this._label;
        this.typeBadgeEl.textContent = this._type.toUpperCase();

        // Status dot + text
        this.dotEl.className        = `dot ${this._state}`;
        this.statusTextEl.textContent = this._state;

        // UID
        if (this._uid) {
            this.uidRowEl.hidden      = false;
            this.uidValueEl.textContent = this._uid;
        } else {
            this.uidRowEl.hidden = true;
        }

        // Connect button
        const busy = this._state === 'connecting';
        this.connectBtnEl.disabled  = busy;
        this.connectBtnEl.textContent = this._state === 'connected' ? 'Disconnect' : 'Connect';
        this.connectBtnEl.className = this._state === 'connected' ? 'disconnect' : '';

        // ARIA label
        this.setAttribute('aria-label', `Ravel gadget ${this._label}: ${this._state}`);
    }
}
