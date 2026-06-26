/**
 * hlh-valuation-panel
 *
 * Displays the aggregated price range estimate for one item.
 * Uses ravel-price-range for the visual bars.
 * "Ask Claude" button triggers an AI market estimate (user-initiated only).
 *
 * Attributes:
 *   item-id  — string — DB item id
 *
 * Events emitted (bubbles + composed):
 *   hlh-valuation-updated  detail: { itemId, result: ValuationResult }
 */

import { getItem } from '../../db/index';
import { loadValuation, askClaudeValuation, type ValuationResult } from '../../services/valuation';

class HlhValuationPanel extends HTMLElement {
    static get observedAttributes(): string[] { return ['item-id']; }

    private _root: ShadowRoot;
    private _asking = false;

    constructor() {
        super();
        this._root = this.attachShadow({ mode: 'open' });
        this._root.innerHTML = `<style>${STYLES}</style><div class="panel"></div>`;
    }

    connectedCallback(): void { void this._load(); }
    attributeChangedCallback(_: string, p: string | null, n: string | null): void {
        if (p !== n) void this._load();
    }

    async refresh(): Promise<void> { await this._load(); }

    private async _load(): Promise<void> {
        const itemId = this.getAttribute('item-id');
        if (!itemId) { this._renderEmpty('No item selected.'); return; }

        const result = await loadValuation(itemId);
        if (result) {
            this._renderResult(itemId, result);
        } else {
            this._renderEmpty('No valuation data yet. Save the item to run Q-Thread matching, or ask Claude.');
            this._appendAskButton(itemId, null);
        }
    }

    private _renderEmpty(msg: string): void {
        this._root.querySelector('.panel')!.innerHTML =
            `<div class="vp-empty">${msg}</div>`;
    }

    private _renderResult(itemId: string, r: ValuationResult): void {
        const panel = this._root.querySelector('.panel')!;
        const fmt   = (c: number) => `$${(c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

        panel.innerHTML = `
            <div class="vp-range">
                <ravel-price-range
                    low="${r.low}"
                    expected="${r.expected}"
                    optimistic="${r.optimistic}"
                    currency="${_esc(r.currency)}"
                    ${r.basis ? `basis="${_esc(r.basis)}"` : ''}
                ></ravel-price-range>
            </div>

            ${r.aiEstimate ? '<div class="vp-ai-badge">✨ Claude estimate</div>' : ''}

            ${r.sources.length > 0 ? `
                <details class="vp-sources">
                    <summary class="vp-sources-toggle">Sources (${r.sources.length})</summary>
                    <ul class="vp-source-list">
                        ${r.sources.map(s => `
                            <li class="vp-source-item">
                                <span class="vp-source-id">${_esc(s.threadId)}</span>
                                <span class="vp-source-range">${fmt(s.low)} – ${fmt(s.optimistic)}</span>
                            </li>`).join('')}
                    </ul>
                </details>` : ''}

            <div class="vp-actions" id="vp-actions"></div>
        `;

        this._appendAskButton(itemId, r);
    }

    private _appendAskButton(itemId: string, existing: ValuationResult | null): void {
        const actions = this._root.querySelector<HTMLElement>('#vp-actions') ??
                        this._root.querySelector('.panel')!;

        const btn = document.createElement('button');
        btn.className   = 'vp-ask-btn';
        btn.textContent = existing?.aiEstimate ? '↺ Re-ask Claude' : '✨ Ask Claude for market estimate';
        btn.setAttribute('aria-label', 'Ask Claude AI for a market valuation');

        btn.addEventListener('click', () => void this._askClaude(itemId, existing, btn));
        actions.appendChild(btn);
    }

    private async _askClaude(
        itemId:   string,
        existing: ValuationResult | null,
        btn:      HTMLButtonElement,
    ): Promise<void> {
        if (this._asking) return;
        this._asking = true;
        btn.disabled     = true;
        btn.textContent  = '⏳ Asking Claude…';

        const item = await getItem(itemId);
        if (!item) { btn.textContent = 'Item not found.'; this._asking = false; return; }

        const result = await askClaudeValuation(item, itemId, existing);
        this._asking = false;

        if (!result) {
            btn.disabled    = false;
            btn.textContent = '✨ Ask Claude';
            const panel = this._root.querySelector('.panel')!;
            const err   = document.createElement('div');
            err.className   = 'vp-error';
            err.textContent = 'Could not get estimate. Check your API key in Settings.';
            panel.insertBefore(err, btn);
            return;
        }

        this.dispatchEvent(new CustomEvent('hlh-valuation-updated', {
            bubbles: true, composed: true,
            detail:  { itemId, result },
        }));

        this._renderResult(itemId, result);
    }
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const STYLES = `
    :host { display: block; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-family: var(--ravel-font, 'Quantico', monospace);
    }

    .vp-empty {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.25);
        font-style: italic;
        line-height: 1.5;
    }

    .vp-error {
        font-size: 0.78rem;
        color: #FF6B6B;
        line-height: 1.5;
    }

    ravel-price-range { display: block; }

    .vp-ai-badge {
        font-size: 0.7rem;
        color: #A7FF00;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        font-family: Silkscreen, monospace;
    }

    .vp-sources {
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 5px;
        overflow: hidden;
    }

    .vp-sources-toggle {
        padding: 7px 10px;
        cursor: pointer;
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255,255,255,0.30);
        background: rgba(255,255,255,0.02);
        list-style: none;
        user-select: none;
    }
    .vp-sources-toggle::-webkit-details-marker { display: none; }

    .vp-source-list {
        list-style: none;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .vp-source-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.75rem;
    }

    .vp-source-id    { color: rgba(255,255,255,0.40); }
    .vp-source-range { color: rgba(255,255,255,0.65); font-weight: 700; }

    .vp-actions { display: flex; flex-direction: column; }

    .vp-ask-btn {
        appearance: none;
        background: rgba(167,255,0,0.08);
        border: 1px solid rgba(167,255,0,0.25);
        color: #A7FF00;
        font-family: var(--ravel-font, 'Quantico', monospace);
        font-size: 0.82rem;
        font-weight: 700;
        padding: 9px 16px;
        border-radius: 5px;
        cursor: pointer;
        min-height: 40px;
        transition: background 0.12s;
        text-align: left;
    }
    .vp-ask-btn:hover:not([disabled]) { background: rgba(167,255,0,0.16); }
    .vp-ask-btn:focus-visible { outline: 2px solid #A7FF00; outline-offset: 2px; }
    .vp-ask-btn[disabled] { opacity: 0.5; cursor: default; }
`;

function _esc(s: string): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

customElements.define('hlh-valuation-panel', HlhValuationPanel);
