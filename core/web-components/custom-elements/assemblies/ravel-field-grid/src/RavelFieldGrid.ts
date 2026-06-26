import { RavelElement } from '../../../../common/RavelElement';

export interface FieldDef {
    key:          string;
    label:        string;
    value?:       string;
    type?:        'text' | 'number' | 'year' | 'textarea' | 'select';
    options?:     string[];
    span?:        1 | 2;
    placeholder?: string;
    readonly?:    boolean;
}

/**
 * Structured metadata grid inspired by library catalog cards. Renders a set of
 * labeled fields in a CSS Grid layout. Supports read-only display and editable
 * input mode — toggled per-component or per-field.
 *
 * ### Attributes
 * | Attribute   | Type    | Default          | Description                        |
 * |-------------|---------|------------------|------------------------------------|
 * | `fields`    | JSON    | `[]`             | Array of `FieldDef` objects        |
 * | `editable`  | boolean | `false`          | Enable editing for all fields      |
 * | `columns`   | number  | `2`              | Grid column count (1–4)            |
 * | `channel`   | string  | `field-grid`     | Message channel                    |
 *
 * ### Messages emitted (channel + DOM event)
 * | cmd            | content                        | Trigger           |
 * |----------------|--------------------------------|-------------------|
 * | `field-change` | `{ key, value, prev }`         | Field edited      |
 *
 * ### Messages received (channel)
 * | cmd           | content                 | Effect                        |
 * |---------------|-------------------------|-------------------------------|
 * | `set-field`   | `{ key, value }`        | Update a single field value   |
 * | `set-fields`  | `FieldDef[]`            | Replace all fields            |
 * | `set-editable`| `{ editable: boolean }` | Toggle edit mode              |
 */
export class RavelFieldGrid extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: block;
            font-family: var(--ravel-font, 'Silkscreen', monospace);
        }

        #grid {
            display: grid;
            grid-template-columns: repeat(var(--columns, 2), 1fr);
            gap: 1px;
            background: rgba(255,255,255,0.06);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 6px;
            overflow: hidden;
        }

        .field {
            display: flex;
            flex-direction: column;
            background: #0e0e12;
            padding: 9px 14px 11px;
            min-height: 54px;
        }
        .field.span-2 { grid-column: 1 / -1; }

        .field-label {
            font-size: 9px;
            letter-spacing: 0.12em;
            color: rgba(255,255,255,0.28);
            text-transform: uppercase;
            margin-bottom: 5px;
            flex-shrink: 0;
            pointer-events: none;
            user-select: none;
        }

        /* Read-only value */
        .field-value-display {
            font-family: 'Quantico', monospace;
            font-size: 14px;
            color: rgba(255,255,255,0.80);
            line-height: 1.3;
            word-break: break-word;
            min-height: 20px;
        }
        .field-value-display:empty::after {
            content: '—';
            color: rgba(255,255,255,0.18);
        }

        /* Editable inputs */
        .field-input {
            font-family: 'Quantico', monospace;
            font-size: 14px;
            color: #fff;
            background: none;
            border: none;
            border-bottom: 1px solid rgba(255,255,255,0.12);
            padding: 0 0 3px;
            width: 100%;
            outline: none;
            box-sizing: border-box;
            transition: border-color 0.12s;
        }
        .field-input:focus {
            border-bottom-color: var(--ravel-focus, #00F0FF);
        }
        .field-input::placeholder {
            color: rgba(255,255,255,0.18);
        }

        textarea.field-input {
            resize: vertical;
            min-height: 64px;
            padding-top: 2px;
            line-height: 1.5;
        }

        select.field-input {
            cursor: pointer;
            appearance: none;
            padding-right: 20px;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(255,255,255,0.35)'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 2px center;
        }
        select.field-input option {
            background: #1a1a2e;
            color: #fff;
        }
    `;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'fields', 'editable', 'columns', 'channel',
        ];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _gridEl!: HTMLElement;

    // ── State ─────────────────────────────────────────────────────────────────

    private _fields:   FieldDef[] = [];
    private _editable  = false;
    private _columns   = 2;
    private _channel   = 'field-grid';

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelFieldGrid.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = `<div id="grid"></div>`;
        this._gridEl = this.container.querySelector<HTMLElement>('#grid')!;
    }

    protected setup(): void {
        super.setup();
        this.subscribe([this._channel]);
        this.addEventListener(this._channel, this._onChannelMessage);
        this._applyColumns();
        this._render();
    }

    protected teardown(): void {
        this.unsubscribe([this._channel]);
        this.removeEventListener(this._channel, this._onChannelMessage);
        super.teardown();
    }

    // ── Attributes ────────────────────────────────────────────────────────────

    attributeChangedCallback(name: string, old: string | null, value: string | null): void {
        super.attributeChangedCallback(name, old, value);
        switch (name) {
            case 'fields':
                try {
                    this._fields = value ? JSON.parse(value) : [];
                } catch {
                    this._fields = [];
                }
                if (this._gridEl) this._render();
                break;
            case 'editable':
                this._editable = value !== null;
                if (this._gridEl) this._render();
                break;
            case 'columns': {
                const n = Math.max(1, Math.min(4, parseInt(value ?? '2') || 2));
                this._columns = n;
                if (this._gridEl) this._applyColumns();
                break;
            }
            case 'channel':
                if (this._gridEl) {
                    this.unsubscribe([this._channel]);
                    this.removeEventListener(this._channel, this._onChannelMessage);
                }
                this._channel = value ?? 'field-grid';
                if (this._gridEl) {
                    this.subscribe([this._channel]);
                    this.addEventListener(this._channel, this._onChannelMessage);
                }
                break;
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    getFields(): FieldDef[] {
        return this._fields.map(f => ({ ...f }));
    }

    setField(key: string, value: string): void {
        const f = this._fields.find(f => f.key === key);
        if (f) { f.value = value; this._render(); }
    }

    setFields(fields: FieldDef[]): void {
        this._fields = fields;
        this._render();
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private _applyColumns(): void {
        this._gridEl.style.setProperty('--columns', String(this._columns));
    }

    private _render(): void {
        if (!this._gridEl) return;
        this._gridEl.innerHTML = '';

        for (const f of this._fields) {
            const cell = document.createElement('div');
            cell.className = 'field' + (f.span === 2 ? ' span-2' : '');

            const label = document.createElement('span');
            label.className   = 'field-label';
            label.textContent = f.label;
            label.id          = `label-${f.key}`;
            cell.appendChild(label);

            const editable = this._editable && !f.readonly;

            if (editable) {
                cell.appendChild(this._buildInput(f));
            } else {
                const display = document.createElement('span');
                display.className   = 'field-value-display';
                display.textContent = f.value ?? '';
                display.setAttribute('aria-labelledby', `label-${f.key}`);
                cell.appendChild(display);
            }

            this._gridEl.appendChild(cell);
        }
    }

    private _buildInput(f: FieldDef): HTMLElement {
        let el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

        if (f.type === 'textarea') {
            el = document.createElement('textarea');
            (el as HTMLTextAreaElement).rows = 3;
        } else if (f.type === 'select' && f.options?.length) {
            el = document.createElement('select');
            const blank = document.createElement('option');
            blank.value = '';
            blank.textContent = f.placeholder ?? '—';
            el.appendChild(blank);
            for (const opt of f.options) {
                const o = document.createElement('option');
                o.value = o.textContent = opt;
                el.appendChild(o);
            }
        } else {
            el = document.createElement('input');
            (el as HTMLInputElement).type =
                f.type === 'number' || f.type === 'year' ? 'number' : 'text';
            if (f.type === 'year') {
                (el as HTMLInputElement).min = '1800';
                (el as HTMLInputElement).max = String(new Date().getFullYear() + 5);
            }
        }

        el.className             = 'field-input';
        el.value                 = f.value ?? '';
        el.placeholder           = f.placeholder ?? '';
        el.setAttribute('aria-labelledby', `label-${f.key}`);

        el.addEventListener('change', () => {
            const prev  = f.value ?? '';
            f.value     = el.value;
            this.sendMessage(this._channel, 'field-change', { key: f.key, value: f.value, prev });
            this.broadcastMessage(this._channel, 'field-change', { key: f.key, value: f.value, prev });
            this.dispatchEvent(new CustomEvent('field-change', {
                bubbles: true, composed: true,
                detail: { key: f.key, value: f.value, prev },
            }));
        });

        return el;
    }

    // ── Messages ──────────────────────────────────────────────────────────────

    private _onChannelMessage = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent).detail ?? {};

        if (cmd === 'set-field') {
            const { key, value } = content as { key: string; value: string };
            this.setField(key, value);
        }
        if (cmd === 'set-fields') {
            this.setFields(content as FieldDef[]);
        }
        if (cmd === 'set-editable') {
            const { editable } = content as { editable: boolean };
            if (editable) this.setAttribute('editable', '');
            else this.removeAttribute('editable');
        }
    };
}
