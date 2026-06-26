import { RavelElement } from '../../../../common/RavelElement';

/**
 * Three-value price range display: low / expected / optimistic.
 *
 * ### Attributes
 * | Attribute    | Type   | Default | Description                        |
 * |--------------|--------|---------|------------------------------------|
 * | `low`        | number | `0`     | Low estimate (USD cents)           |
 * | `expected`   | number | `0`     | Expected / fair-market (USD cents) |
 * | `optimistic` | number | `0`     | Best-case (USD cents)              |
 * | `currency`   | string | `USD`   | 3-letter currency code             |
 * | `basis`      | string | `""`    | Source / explanation caption       |
 * | `channel`    | string | `""`    | Pub/sub channel                    |
 *
 * ### Messages received
 * | cmd         | content                                      | Effect          |
 * |-------------|----------------------------------------------|-----------------|
 * | `set-value` | `{ low, expected, optimistic, currency?, basis? }` | Update all values |
 */
export class RavelPriceRange extends RavelElement {
    static get observedAttributes(): string[] {
        return ['low', 'expected', 'optimistic', 'currency', 'basis', 'channel'];
    }

    protected initialize(): void {
        super.initialize();
        this.shadowRoot!.innerHTML = `<style>${STYLES}</style><div class="price-range" role="group" aria-label="Price range estimate"></div>`;
        this._render();
    }

    attributeChangedCallback(_: string, prev: string | null, next: string | null): void {
        if (prev !== next) this._render();
    }

    private _onMessage = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent).detail ?? {};
        if (cmd === 'set-value' && content) {
            if (content.low        !== undefined) this.setAttribute('low',        String(content.low));
            if (content.expected   !== undefined) this.setAttribute('expected',   String(content.expected));
            if (content.optimistic !== undefined) this.setAttribute('optimistic', String(content.optimistic));
            if (content.currency   !== undefined) this.setAttribute('currency',   String(content.currency));
            if (content.basis      !== undefined) this.setAttribute('basis',      String(content.basis));
        }
    };

    protected setup(): void {
        super.setup();
        const ch = this.getAttribute('channel');
        if (ch) { this.subscribe([ch]); this.addEventListener(ch, this._onMessage); }
    }

    protected teardown(): void {
        const ch = this.getAttribute('channel');
        if (ch) { this.unsubscribe([ch]); this.removeEventListener(ch, this._onMessage); }
        super.teardown();
    }

    private _render(): void {
        const root = this.shadowRoot?.querySelector('.price-range');
        if (!root) return;

        const low        = parseInt(this.getAttribute('low')        ?? '0', 10) || 0;
        const expected   = parseInt(this.getAttribute('expected')   ?? '0', 10) || 0;
        const optimistic = parseInt(this.getAttribute('optimistic') ?? '0', 10) || 0;
        const currency   = this.getAttribute('currency') ?? 'USD';
        const basis      = this.getAttribute('basis') ?? '';

        if (low === 0 && expected === 0 && optimistic === 0) {
            root.innerHTML = `<div class="empty">No estimate available.</div>`;
            return;
        }

        const fmt = (cents: number): string =>
            new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents);

        const max = optimistic || 1;

        root.innerHTML = `
            <div class="bars" aria-hidden="true">
                <div class="bar-row">
                    <span class="bar-label">Low</span>
                    <div class="bar-track">
                        <div class="bar bar-low"  style="width:${Math.round(low / max * 100)}%"></div>
                    </div>
                    <span class="bar-value">${fmt(low)}</span>
                </div>
                <div class="bar-row">
                    <span class="bar-label">Expected</span>
                    <div class="bar-track">
                        <div class="bar bar-expected" style="width:${Math.round(expected / max * 100)}%"></div>
                    </div>
                    <span class="bar-value">${fmt(expected)}</span>
                </div>
                <div class="bar-row">
                    <span class="bar-label">Optimistic</span>
                    <div class="bar-track">
                        <div class="bar bar-optimistic" style="width:100%"></div>
                    </div>
                    <span class="bar-value">${fmt(optimistic)}</span>
                </div>
            </div>
            <div class="sr-summary" aria-live="polite">
                Price range: low ${fmt(low)}, expected ${fmt(expected)}, optimistic ${fmt(optimistic)}.
            </div>
            ${basis ? `<div class="basis">${_esc(basis)}</div>` : ''}
        `;
    }

    // ── Public API ─────────────────────────────────────────────────────────────

    setRange(low: number, expected: number, optimistic: number, currency = 'USD', basis = ''): void {
        this.setAttribute('low',        String(low));
        this.setAttribute('expected',   String(expected));
        this.setAttribute('optimistic', String(optimistic));
        this.setAttribute('currency',   currency);
        if (basis) this.setAttribute('basis', basis);
    }
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const STYLES = `
    :host { display: block; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .empty {
        font-family: var(--ravel-font, 'Quantico', monospace);
        font-size: 0.8rem;
        color: rgba(255,255,255,0.25);
        font-style: italic;
    }

    .bars {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .bar-row {
        display: grid;
        grid-template-columns: 80px 1fr 72px;
        align-items: center;
        gap: 10px;
    }

    .bar-label {
        font-family: var(--ravel-font, 'Quantico', monospace);
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: rgba(255,255,255,0.35);
        text-align: right;
    }

    .bar-track {
        height: 10px;
        background: rgba(255,255,255,0.06);
        border-radius: 5px;
        overflow: hidden;
    }

    .bar {
        height: 100%;
        border-radius: 5px;
        min-width: 4px;
        transition: width 0.35s ease;
    }

    .bar-low        { background: #B300FF; box-shadow: 0 0 6px rgba(179,0,255,0.4); }
    .bar-expected   { background: #FE6810; box-shadow: 0 0 6px rgba(254,104,16,0.4); }
    .bar-optimistic { background: #A7FF00; box-shadow: 0 0 8px rgba(167,255,0,0.4); }

    .bar-value {
        font-family: var(--ravel-font, 'Quantico', monospace);
        font-size: 0.82rem;
        font-weight: 700;
        color: rgba(255,255,255,0.80);
        text-align: right;
        white-space: nowrap;
    }

    .sr-summary {
        position: absolute;
        width: 1px; height: 1px;
        overflow: hidden;
        clip: rect(0,0,0,0);
        white-space: nowrap;
    }

    .basis {
        margin-top: 10px;
        font-family: var(--ravel-font, 'Quantico', monospace);
        font-size: 0.72rem;
        color: rgba(255,255,255,0.28);
        line-height: 1.5;
        font-style: italic;
    }
`;

function _esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
