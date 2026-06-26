import { RavelElement } from '../../../../common/RavelElement';

/**
 * Colored pill showing a confidence score 0–1 with a human-readable label.
 *
 * ### Attributes
 * | Attribute     | Type   | Default | Description                              |
 * |---------------|--------|---------|------------------------------------------|
 * | `value`       | number | `0`     | Confidence score, 0–1                    |
 * | `label`       | string | `""`    | Override label (default: auto from value)|
 * | `show-value`  | bool   | false   | Append numeric percentage to label       |
 * | `channel`     | string | `""`    | Message channel (optional)               |
 *
 * ### Color tiers (Fluoro)
 * | Range      | Color  | Name   |
 * |------------|--------|--------|
 * | ≥ 0.85     | Lime   | High   |
 * | ≥ 0.65     | Orange | Good   |
 * | ≥ 0.40     | Violet | Low    |
 * | < 0.40     | Pink   | Weak   |
 *
 * ### Messages received (channel)
 * | cmd          | content            | Effect             |
 * |--------------|--------------------|--------------------|
 * | `set-value`  | `{ value: number }`| Updates score      |
 * | `set-label`  | `{ label: string }`| Overrides label    |
 */
export class RavelConfidencePill extends RavelElement {
    static get observedAttributes(): string[] {
        return ['value', 'label', 'show-value', 'channel'];
    }

    // ── Shadow DOM ────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();
        this.shadowRoot!.innerHTML = `
            <style>
                :host { display: inline-flex; vertical-align: middle; }

                .pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 2px 10px 2px 8px;
                    border-radius: 999px;
                    font-family: var(--ravel-font, 'Quantico', monospace);
                    font-size: 0.75rem;
                    font-weight: 700;
                    letter-spacing: 0.03em;
                    text-transform: uppercase;
                    line-height: 1;
                    min-height: 22px;
                    user-select: none;
                    border: 1.5px solid currentColor;
                    transition: background 0.15s, color 0.15s, border-color 0.15s;
                }

                /* Fluoro tiers */
                .pill[data-tier="high"]   { color: #A7FF00; background: rgba(167,255,0,0.12);   }
                .pill[data-tier="good"]   { color: #FE6810; background: rgba(254,104,16,0.12);  }
                .pill[data-tier="low"]    { color: #B300FF; background: rgba(179,0,255,0.12);   }
                .pill[data-tier="weak"]   { color: #FF4FB3; background: rgba(255,79,179,0.12);  }

                .dot {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                    background: currentColor;
                    flex-shrink: 0;
                }
            </style>
            <span class="pill" role="img" aria-label="">
                <span class="dot"></span>
                <span class="text"></span>
            </span>
        `;
        this._render();
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    attributeChangedCallback(_: string, prev: string | null, next: string | null): void {
        if (prev !== next) this._render();
    }

    private _onChannelMessage = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent).detail ?? {};
        if (cmd === 'set-value' && typeof content?.value === 'number') {
            this.setAttribute('value', String(content.value));
        } else if (cmd === 'set-label' && typeof content?.label === 'string') {
            this.setAttribute('label', content.label);
        }
    };

    protected setup(): void {
        super.setup();
        const ch = this.getAttribute('channel');
        if (ch) {
            this.subscribe([ch]);
            this.addEventListener(ch, this._onChannelMessage);
        }
    }

    protected teardown(): void {
        const ch = this.getAttribute('channel');
        if (ch) {
            this.unsubscribe([ch]);
            this.removeEventListener(ch, this._onChannelMessage);
        }
        super.teardown();
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private _render(): void {
        const root = this.shadowRoot;
        if (!root) return;

        const value  = Math.max(0, Math.min(1, parseFloat(this.getAttribute('value') ?? '0') || 0));
        const tier   = value >= 0.85 ? 'high' : value >= 0.65 ? 'good' : value >= 0.40 ? 'low' : 'weak';
        const labels = { high: 'High', good: 'Good', low: 'Low', weak: 'Weak' };
        const label  = this.getAttribute('label') || labels[tier];
        const pct    = Math.round(value * 100);
        const show   = this.hasAttribute('show-value');
        const text   = show ? `${label} ${pct}%` : label;

        const pill = root.querySelector('.pill') as HTMLElement;
        const span = root.querySelector('.text') as HTMLElement;

        pill.setAttribute('data-tier', tier);
        pill.setAttribute('aria-label', `Confidence: ${text}`);
        span.textContent = text;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    get value(): number {
        return parseFloat(this.getAttribute('value') ?? '0') || 0;
    }
    set value(v: number) {
        this.setAttribute('value', String(Math.max(0, Math.min(1, v))));
    }
}
