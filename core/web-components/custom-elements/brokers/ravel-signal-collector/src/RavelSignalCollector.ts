import { RavelElement } from '../../../../common/RavelElement';

/**
 * Named-value registry. Declare signals as slotted `<ravel-signal>` children;
 * any component can update a signal by sending a message on the `label` channel
 * where `cmd` is the signal name and `content` is the new value.
 *
 * ```html
 * <ravel-signal-collector>
 *   <ravel-signal icon="🍎" value="200"></ravel-signal>
 *   <ravel-signal icon="🌡️"></ravel-signal>
 * </ravel-signal-collector>
 * ```
 *
 * To update signal "🍎" from anywhere:
 * ```ts
 * this.sendMessage('signal', '🍎', 127);
 * ```
 *
 * ### Attributes
 * | Attribute   | Type   | Default            | Description                                     |
 * |-------------|--------|--------------------|-------------------------------------------------|
 * | `label`     | string | `'signal'`         | Pub/sub channel to subscribe to for updates     |
 * | `channel`   | string | `'signal-update'`  | Broadcast channel emitted on each value change  |
 *
 * ### Messages received (on `label` channel)
 * | cmd          | content  | Effect                                  |
 * |--------------|----------|-----------------------------------------|
 * | *(any)*      | any      | Sets signal named `cmd` to `content`    |
 *
 * ### Messages broadcast (on `channel`)
 * | cmd          | content                    | Trigger                  |
 * |--------------|----------------------------|--------------------------|
 * | *(name)*     | new value                  | Signal value changed     |
 *
 * ### Public API
 * | Method                    | Description                                     |
 * |---------------------------|-------------------------------------------------|
 * | `get(name)`               | Current value of a signal, or `undefined`       |
 * | `set(name, value)`        | Update a signal and broadcast the change        |
 * | `getAll()`                | Snapshot `Map<string, unknown>` of all signals  |
 * | `getPicklist()`           | Returns an HTML `<select>` string of all names  |
 */
export class RavelSignalCollector extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: inline-block;
            font-family: var(--ravel-font, 'Silkscreen', monospace);
        }
        #head {
            background: #0e0e12;
            border: 1px solid rgba(0,204,0,0.22);
            border-radius: 5px;
            padding: 7px 10px 8px;
            display: flex;
            flex-direction: column;
            gap: 5px;
            min-width: 160px;
            max-width: 260px;
            user-select: none;
            -webkit-user-select: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
        }
        .head-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 6px;
        }
        .head-title {
            font-size: 7px;
            letter-spacing: 0.12em;
            color: rgba(255,255,255,0.28);
            text-transform: uppercase;
            line-height: 1;
        }
        .head-count {
            font-size: 5px;
            color: rgba(0,204,0,0.55);
            letter-spacing: 0.06em;
        }
        .sig-list {
            display: flex;
            flex-direction: column;
            gap: 3px;
            max-height: 160px;
            overflow-y: auto;
            scrollbar-width: none;
        }
        .sig-list::-webkit-scrollbar { display: none; }
        .sig-list:empty::before {
            content: 'no signals';
            font-size: 5px;
            color: rgba(255,255,255,0.15);
            letter-spacing: 0.08em;
        }
        .sig-row {
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 1px 0;
        }
        .sig-name {
            font-size: 10px;
            line-height: 1;
            min-width: 18px;
        }
        .sig-divider {
            flex: 1;
            height: 1px;
            background: rgba(255,255,255,0.06);
        }
        .sig-val {
            font-size: 6px;
            color: rgba(0,204,0,0.75);
            letter-spacing: 0.04em;
            min-width: 28px;
            text-align: right;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 80px;
            transition: color 120ms ease;
        }
        .sig-val.flash {
            color: #A7FF00;
        }
        .head-label {
            font-size: 5px;
            color: rgba(255,255,255,0.15);
            letter-spacing: 0.05em;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            max-width: 140px;
        }
        slot { display: none; }
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'label', 'channel'];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _headEl!:    HTMLElement;
    private _countEl!:   HTMLElement;
    private _listEl!:    HTMLElement;
    private _labelEl!:   HTMLElement;
    private _slot!:      HTMLSlotElement;

    // ── Config ────────────────────────────────────────────────────────────────

    private _label   = 'signal';
    private _channel = 'signal-update';

    // ── State ─────────────────────────────────────────────────────────────────

    private _signals = new Map<string, unknown>();
    private _flashTimers = new Map<string, ReturnType<typeof setTimeout>>();

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelSignalCollector.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = `
            <div id="head" role="region" aria-label="Signal registry">
                <div class="head-row">
                    <span class="head-title">SIGNALS</span>
                    <span class="head-count" id="count" aria-live="polite">0</span>
                </div>
                <div class="sig-list" id="sig-list" aria-label="Signal values"></div>
                <div class="head-label" id="head-label">${this._label}</div>
            </div>
            <slot></slot>
        `;

        this._headEl  = this.container.querySelector<HTMLElement>('#head')!;
        this._countEl = this.container.querySelector<HTMLElement>('#count')!;
        this._listEl  = this.container.querySelector<HTMLElement>('#sig-list')!;
        this._labelEl = this.container.querySelector<HTMLElement>('#head-label')!;
        this._slot    = this.container.querySelector<HTMLSlotElement>('slot')!;

        this._renderLabel();
    }

    protected setup(): void {
        super.setup();
        this._slot.addEventListener('slotchange', this._onSlotChange);
        this.subscribe([this._label]);
        this.addEventListener(this._label, this._onMessage);
        this._onSlotChange(); // flush any children that arrived before connect
    }

    protected teardown(): void {
        this._slot.removeEventListener('slotchange', this._onSlotChange);
        this.removeEventListener(this._label, this._onMessage);
        this.unsubscribe([this._label]);
        for (const t of this._flashTimers.values()) clearTimeout(t);
        this._flashTimers.clear();
        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        switch (name) {
            case 'label': {
                const prev = this._label;
                this._label = newValue ?? 'signal';
                if (this.isConnected && prev !== this._label) {
                    this.removeEventListener(prev, this._onMessage);
                    this.unsubscribe([prev]);
                    this.subscribe([this._label]);
                    this.addEventListener(this._label, this._onMessage);
                }
                this._renderLabel();
                break;
            }
            case 'channel':
                this._channel = newValue ?? 'signal-update';
                break;
        }
    }

    // ── Slot → signal seeding ─────────────────────────────────────────────────

    private _onSlotChange = (): void => {
        for (const el of this._slot.assignedElements()) {
            const icon = el.getAttribute('icon');
            if (!icon) continue;
            if (this._signals.has(icon)) continue; // don't overwrite live values
            const raw = el.getAttribute('value');
            const value: unknown = raw !== null
                ? (raw !== '' && !isNaN(Number(raw)) ? Number(raw) : raw)
                : null;
            this._signals.set(icon, value);
        }
        this._renderAll();
    };

    // ── Inbound message handler ───────────────────────────────────────────────

    private _onMessage = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent<{ cmd: string; content: unknown }>).detail ?? {};
        if (!cmd) return;
        this._applyUpdate(cmd, content);
    };

    private _applyUpdate(name: string, value: unknown): void {
        const isNew = !this._signals.has(name);
        this._signals.set(name, value);
        if (isNew) {
            this._renderAll();
        } else {
            this._updateRow(name, value);
        }
        this.broadcastMessage(this._channel, name, value);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    get(name: string): unknown {
        return this._signals.get(name);
    }

    set(name: string, value: unknown): void {
        this._applyUpdate(name, value);
    }

    getAll(): Map<string, unknown> {
        return new Map(this._signals);
    }

    getPicklist(): string {
        const options = [...this._signals.keys()]
            .map(k => `<option value="${k}">${k}</option>`)
            .join('');
        return `<select name="signal-list">${options}</select>`;
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    private _renderAll(): void {
        if (!this._listEl) return;
        this._listEl.innerHTML = '';
        for (const [name, value] of this._signals) {
            this._listEl.appendChild(this._makeRow(name, value));
        }
        this._updateCount();
    }

    private _makeRow(name: string, value: unknown): HTMLElement {
        const row = document.createElement('div');
        row.className = 'sig-row';
        row.dataset.sig = name;
        row.innerHTML = `
            <span class="sig-name" aria-hidden="true">${name}</span>
            <span class="sig-divider"></span>
            <span class="sig-val">${this._fmt(value)}</span>
        `;
        return row;
    }

    private _updateRow(name: string, value: unknown): void {
        if (!this._listEl) return;
        const row = this._listEl.querySelector<HTMLElement>(`[data-sig="${CSS.escape(name)}"]`);
        if (!row) { this._renderAll(); return; }
        const valEl = row.querySelector<HTMLElement>('.sig-val');
        if (!valEl) return;
        valEl.textContent = this._fmt(value);
        // Brief flash to show update
        valEl.classList.add('flash');
        const prev = this._flashTimers.get(name);
        if (prev !== undefined) clearTimeout(prev);
        this._flashTimers.set(name, setTimeout(() => {
            valEl.classList.remove('flash');
            this._flashTimers.delete(name);
        }, 120));
    }

    private _updateCount(): void {
        if (this._countEl) this._countEl.textContent = `${this._signals.size}`;
    }

    private _renderLabel(): void {
        if (this._labelEl) this._labelEl.textContent = this._label;
    }

    private _fmt(value: unknown): string {
        if (value === null || value === undefined) return '—';
        if (typeof value === 'number') {
            return Number.isInteger(value) ? String(value) : value.toFixed(2);
        }
        return String(value).slice(0, 20);
    }
}
