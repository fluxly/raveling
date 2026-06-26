import { RavelElement } from '../../../../common/RavelElement';

/**
 * A scrollable interactive document reader containing `<ravel-cell>` elements.
 *
 * Modelled after Jupyter Notebook / Colab — a vertical sequence of numbered
 * cells of mixed types (`text`, `code`, `live`, `output`). The notebook
 * assigns a sequential index to each slotted `<ravel-cell>` and re-indexes
 * on any slot change.
 *
 * ### Attributes
 * | Attribute | Type   | Default | Description                                           |
 * |-----------|--------|---------|-------------------------------------------------------|
 * | `title`   | string | `''`    | Notebook heading shown in the header                  |
 *
 * ### Usage
 * ```html
 * <ravel-notebook title="My Project">
 *   <ravel-cell type="text">
 *     <h2>Introduction</h2>
 *     <p>Some prose…</p>
 *   </ravel-cell>
 *   <ravel-cell type="code" lang="javascript">
 * const osc = ctx.createOscillator();
 *   </ravel-cell>
 *   <ravel-cell type="live">
 *     <ravel-knob label="Frequency"></ravel-knob>
 *   </ravel-cell>
 *   <ravel-cell type="output">
 * { "note": 60, "velocity": 80 }
 *   </ravel-cell>
 * </ravel-notebook>
 * ```
 */
export class RavelNotebook extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: block;
            background: var(--ravel-bg, #111115);
            color: rgba(255,255,255,0.82);
            font-family: var(--ravel-font, 'Quantico', monospace);
        }
        #container {
            width: 100%;
            height: auto;
            position: relative;
        }

        #notebook {
            max-width: 860px;
            margin: 0 auto;
            padding-bottom: 64px;
        }

        /* ── Header ──────────────────────────────────────────── */
        #nb-header {
            padding: 36px 0 28px 52px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            margin-bottom: 8px;
        }
        .nb-kicker {
            font-family: 'Silkscreen', monospace;
            font-size: 0.5rem;
            color: rgba(255,255,255,0.18);
            letter-spacing: 0.14em;
            text-transform: uppercase;
            margin-bottom: 10px;
            line-height: 1;
        }
        #nb-title {
            font-family: 'Silkscreen', monospace;
            font-size: 1.35rem;
            color: #ffffff;
            line-height: 1.3;
            word-break: break-word;
        }
        #nb-title:empty { display: none; }

        /* ── Body (cells) ────────────────────────────────────── */
        #nb-body {
            /* cells fill this naturally */
        }
    `;

    private static readonly componentHtml = `
        <div id="notebook" role="document">
            <header id="nb-header">
                <div class="nb-kicker">ravel-notebook</div>
                <div id="nb-title"></div>
            </header>
            <div id="nb-body">
                <slot id="slot"></slot>
            </div>
        </div>
    `;

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'title'];
    }

    private _title   = '';
    private _titleEl: HTMLElement | null      = null;
    private _slot:    HTMLSlotElement | null  = null;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();
        const style = document.createElement('style');
        style.textContent = RavelNotebook.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);
        this.container.innerHTML = RavelNotebook.componentHtml;
        this._titleEl = this.container.querySelector('#nb-title');
        this._slot    = this.container.querySelector('#slot');
        this._renderTitle();
    }

    protected setup(): void {
        super.setup();
        this._slot?.addEventListener('slotchange', this._onSlotChange);
        this._indexCells();
    }

    protected teardown(): void {
        this._slot?.removeEventListener('slotchange', this._onSlotChange);
        super.teardown();
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private _renderTitle(): void {
        if (this._titleEl) this._titleEl.textContent = this._title;
        if (this._title) this.setAttribute('aria-label', this._title);
    }

    // ── Cell indexing ─────────────────────────────────────────────────────────

    private _onSlotChange = (): void => {
        this._indexCells();
    };

    private _indexCells(): void {
        if (!this._slot) return;
        let n = 0;
        for (const el of this._slot.assignedElements()) {
            if (el.tagName.toLowerCase() === 'ravel-cell') {
                (el as HTMLElement & { setIndex(n: number): void }).setIndex(++n);
            }
        }
    }

    // ── Attributes ────────────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (name === 'title') {
            this._title = newValue ?? '';
            this._renderTitle();
        }
    }
}
