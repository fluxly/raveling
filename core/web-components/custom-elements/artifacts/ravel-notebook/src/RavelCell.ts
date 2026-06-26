import { RavelElement } from '../../../../common/RavelElement';

/**
 * A single cell inside a `<ravel-notebook>`.
 *
 * The parent notebook assigns a 1-based `index` via `setIndex()` after the
 * slot resolves. Cells are styled by `type` and accept arbitrary slotted
 * content — prose HTML for `text`, raw code text for `code`, any Ravel
 * component for `live`, and preformatted data for `output`.
 *
 * ### Attributes
 * | Attribute | Type   | Default  | Description                                    |
 * |-----------|--------|----------|------------------------------------------------|
 * | `type`    | string | `'text'` | Cell kind: `text`, `code`, `live`, `output`    |
 * | `lang`    | string | `''`     | Language badge shown in the gutter (code only) |
 * | `label`   | string | `''`     | Optional caption shown above the cell body     |
 */
export class RavelCell extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: block;
            font-family: var(--ravel-font, 'Quantico', monospace);
        }
        #container {
            width: auto;
            height: auto;
            position: relative;
        }
        #cell {
            display: flex;
            align-items: stretch;
        }

        /* ── Gutter ──────────────────────────────────────────── */
        .gutter {
            width: 52px;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            padding: 16px 14px 0 0;
            gap: 5px;
            user-select: none;
            -webkit-user-select: none;
        }
        #num {
            font-family: 'Silkscreen', monospace;
            font-size: 0.6rem;
            color: rgba(255,255,255,0.2);
            line-height: 1;
            letter-spacing: 0.02em;
        }
        .gutter-lang {
            font-family: 'Silkscreen', monospace;
            font-size: 0.42rem;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            color: rgba(255,255,255,0.18);
            display: none;
        }
        :host([lang]) .gutter-lang { display: block; }

        :host([type="code"])   #num,
        :host([type="code"])   .gutter-lang { color: rgba(167,255,0,0.65); }
        :host([type="live"])   #num          { color: rgba(0,240,255,0.65); }
        :host([type="output"]) #num          { color: rgba(254,104,16,0.65); }

        /* ── Inner (label + body) ────────────────────────────── */
        .inner {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
        }
        .cell-label {
            font-family: 'Silkscreen', monospace;
            font-size: 0.48rem;
            color: rgba(255,255,255,0.22);
            letter-spacing: 0.08em;
            text-transform: uppercase;
            padding: 10px 0 4px 0;
            display: none;
        }
        :host([label]) .cell-label { display: block; }

        /* ── Body ────────────────────────────────────────────── */
        .body {
            padding: 14px 24px 20px 0;
            color: rgba(255,255,255,0.82);
            line-height: 1.78;
            font-size: 0.9rem;
        }

        :host([type="code"]) .body {
            padding: 13px 18px;
            margin: 4px 0 8px;
            background: #080e08;
            border-left: 2px solid rgba(167,255,0,0.38);
            font-family: 'Quantico', monospace;
            white-space: pre-wrap;
            font-size: 0.82rem;
            color: rgba(192,252,168,0.88);
            line-height: 1.62;
            overflow-x: auto;
        }
        :host([type="output"]) .body {
            padding: 12px 18px;
            margin: 4px 0 8px;
            background: #0d0b08;
            border-left: 2px solid rgba(254,104,16,0.32);
            font-family: 'Quantico', monospace;
            white-space: pre-wrap;
            font-size: 0.82rem;
            color: rgba(254,160,80,0.78);
            line-height: 1.62;
            overflow-x: auto;
        }
        :host([type="live"]) .body {
            padding: 20px;
            margin: 4px 0 8px;
            border: 2px dotted rgba(0,240,255,0.18);
            border-radius: 4px;
            background: rgba(0,240,255,0.015);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-wrap: wrap;
            gap: 16px;
            min-height: 80px;
        }
    `;

    private static readonly componentHtml = `
        <div id="cell">
            <div class="gutter">
                <span id="num" aria-hidden="true">·</span>
                <span class="gutter-lang" id="gutter-lang" aria-hidden="true"></span>
            </div>
            <div class="inner">
                <div class="cell-label" id="cell-label"></div>
                <div class="body"><slot></slot></div>
            </div>
        </div>
    `;

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'type', 'lang', 'label'];
    }

    private _type  = 'text';
    private _lang  = '';
    private _label = '';
    private _index = 0;

    private _numEl:      HTMLElement | null = null;
    private _gutterLang: HTMLElement | null = null;
    private _labelEl:    HTMLElement | null = null;

    /** Called by the parent `<ravel-notebook>` after slot resolution. */
    setIndex(n: number): void {
        this._index = n;
        if (this._numEl) this._numEl.textContent = String(n);
        this.setAttribute('aria-label', `${this._type} cell ${n}${this._lang ? ` — ${this._lang}` : ''}`);
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();
        const style = document.createElement('style');
        style.textContent = RavelCell.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);
        this.container.innerHTML = RavelCell.componentHtml;
        this._numEl      = this.container.querySelector('#num');
        this._gutterLang = this.container.querySelector('#gutter-lang');
        this._labelEl    = this.container.querySelector('#cell-label');
        this._renderAll();
    }

    protected setup(): void {
        super.setup();
    }

    protected teardown(): void {
        super.teardown();
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private _renderAll(): void {
        if (this._numEl && this._index)     this._numEl.textContent      = String(this._index);
        if (this._gutterLang)               this._gutterLang.textContent  = this._lang;
        if (this._labelEl)                  this._labelEl.textContent     = this._label;
    }

    // ── Attributes ────────────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        switch (name) {
            case 'type':
                this._type = newValue ?? 'text';
                break;
            case 'lang':
                this._lang = newValue ?? '';
                if (this._gutterLang) this._gutterLang.textContent = this._lang;
                break;
            case 'label':
                this._label = newValue ?? '';
                if (this._labelEl) this._labelEl.textContent = this._label;
                break;
        }
    }
}
