// Minimal Web Serial API types (not in standard lib.dom.d.ts)
declare global {
    interface SerialPortInfo { usbVendorId?: number; usbProductId?: number; }
    interface SerialPortRequestOptions { filters?: SerialPortInfo[]; }
    interface SerialPort {
        readable: ReadableStream<Uint8Array> | null;
        writable: WritableStream<Uint8Array> | null;
        open(options: { baudRate: number }): Promise<void>;
        close(): Promise<void>;
    }
    interface Serial { requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>; }
    interface Navigator { serial: Serial; }
}

/**
 * Wraps the Web Serial API as an EventTarget.
 *
 * Dispatches `'data'` events (detail: `{ data: Uint8Array }`) when a
 * newline-terminated packet arrives. Dispatches `'error'` events on failures.
 *
 * Port filters default to nRF52 (0x2886/0x8045) and ESP32 (0x303A/0x1001).
 */
export class WebSerialPort extends EventTarget {
    private static readonly DEFAULT_FILTERS: SerialPortInfo[] = [
        { usbVendorId: 0x2886, usbProductId: 0x8045 }, // nRF52
        { usbVendorId: 0x303A, usbProductId: 0x1001 }, // ESP32
    ];

    port:   SerialPort | null = null;
    private _reader:          ReadableStreamDefaultReader<Uint8Array> | null = null;
    private _readLoopPromise: Promise<void> | null = null;
    private _buf:             number[] = [];

    get isOpen(): boolean { return !!this.port; }

    async open(filters: SerialPortInfo[] = WebSerialPort.DEFAULT_FILTERS): Promise<void> {
        if (this.port) return;
        this.port = await navigator.serial.requestPort({ filters });
        await this.port.open({ baudRate: 115200 });
        this._readLoopPromise = this._readLoop();
    }

    async close(): Promise<void> {
        if (!this.port) return;
        this._reader?.cancel();
        await this._readLoopPromise;
        await this.port.close();
        this.port = null;
        this._reader = null;
        this._readLoopPromise = null;
        this._buf = [];
    }

    async send(data: string | Uint8Array): Promise<void> {
        if (!this.port?.writable) return;
        const writer = this.port.writable.getWriter();
        const bytes = typeof data === 'string'
            ? new TextEncoder().encode(data)
            : data;
        try {
            await writer.write(bytes);
        } finally {
            writer.releaseLock();
        }
    }

    private async _readLoop(): Promise<void> {
        if (!this.port?.readable) return;
        while (this.port.readable) {
            this._reader = this.port.readable.getReader();
            try {
                const { value, done } = await this._reader.read();
                if (done) break;
                if (value) {
                    for (const byte of value) {
                        if (byte === 10) { // newline = end of packet
                            this.dispatchEvent(new CustomEvent('data', {
                                detail: { data: new Uint8Array(this._buf) },
                            }));
                            this._buf = [];
                        } else {
                            this._buf.push(byte);
                        }
                    }
                }
            } catch (err) {
                this.dispatchEvent(new CustomEvent('error', { detail: { err } }));
                break;
            } finally {
                this._reader.releaseLock();
            }
        }
    }
}
