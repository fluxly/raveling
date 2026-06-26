/**
 * hlh-description-panel
 *
 * Shows AI-generated listing descriptions for one item.
 * Each format has a copy-to-clipboard button.
 * Short title and marketplace title have an "Apply" button to write back to item.title.
 *
 * Attributes:
 *   item-id  — string — DB item ID
 *
 * Events emitted (bubbles+composed):
 *   hlh-description-generated  — detail: { itemId, result: DescriptionResult }
 *   hlh-title-applied          — detail: { itemId, title }
 */

import { generateDescriptions, loadDescription, type DescriptionResult } from '../../services/description';
import { getItem, updateItem, type ItemRow } from '../../db/index';

class HlhDescriptionPanel extends HTMLElement {
    static get observedAttributes(): string[] { return ['item-id']; }

    private _root: ShadowRoot;
    private _generating = false;

    constructor() {
        super();
        this._root = this.attachShadow({ mode: 'open' });
        this._root.innerHTML = `<style>${STYLES}</style><div class="panel"></div>`;
    }

    connectedCallback(): void { this._load(); }

    attributeChangedCallback(_: string, prev: string | null, next: string | null): void {
        if (prev !== next) this._load();
    }

    async refresh(): Promise<void> { await this._load(); }

    // ── Internal ──────────────────────────────────────────────────────────────

    private async _load(): Promise<void> {
        const itemId = this.getAttribute('item-id');
        if (!itemId) { this._renderEmpty('No item selected.'); return; }

        const existing = await loadDescription(itemId);
        if (existing) {
            this._renderResult(itemId, existing);
        } else {
            this._renderGenerate(itemId);
        }
    }

    private _renderEmpty(msg: string): void {
        this._root.querySelector('.panel')!.innerHTML =
            `<div class="dp-empty">${msg}</div>`;
    }

    private _renderGenerate(itemId: string): void {
        const panel = this._root.querySelector('.panel')!;
        panel.innerHTML = `
            <div class="dp-empty">No descriptions yet.</div>
            <button class="dp-generate-btn" id="btn-generate"
                    aria-label="Generate descriptions with AI">
                ✨ Generate Descriptions
            </button>`;

        panel.querySelector('#btn-generate')!.addEventListener('click', () => {
            void this._generate(itemId);
        });
    }

    private async _generate(itemId: string): Promise<void> {
        if (this._generating) return;
        this._generating = true;

        const panel = this._root.querySelector('.panel')!;
        panel.innerHTML = `
            <div class="dp-loading" role="status" aria-live="polite">
                <span class="dp-spinner" aria-hidden="true">⏳</span>
                Generating with Claude…
            </div>`;

        const item = await getItem(itemId);
        if (!item) { this._renderEmpty('Item not found.'); this._generating = false; return; }

        const result = await generateDescriptions(item, itemId);
        this._generating = false;

        if (!result) {
            panel.innerHTML = `
                <div class="dp-error">
                    Could not generate descriptions.
                    Check that your Anthropic API key is configured in Settings.
                </div>
                <button class="dp-generate-btn" id="btn-retry">Retry</button>`;
            panel.querySelector('#btn-retry')!.addEventListener('click', () => void this._generate(itemId));
            return;
        }

        this.dispatchEvent(new CustomEvent('hlh-description-generated', {
            bubbles: true, composed: true,
            detail:  { itemId, result },
        }));

        this._renderResult(itemId, result);
    }

    private _renderResult(itemId: string, r: DescriptionResult): void {
        const panel = this._root.querySelector('.panel')!;
        panel.innerHTML = `
            <div class="dp-toolbar">
                <button class="dp-regen-btn" id="btn-regen" aria-label="Regenerate descriptions">
                    ↺ Regenerate
                </button>
            </div>

            ${_field('Short Title', r.short_title, 'short_title', itemId, true)}
            ${_field('Marketplace Title', r.marketplace_title, 'marketplace_title', itemId, true)}
            ${_field('Long Title', r.long_title, 'long_title', itemId, false)}
            ${_field('SEO Summary', r.seo_summary, 'seo_summary', itemId, false)}
            ${_field('Condition Notes', r.condition_notes, 'condition_notes', itemId, false)}
            ${_field('Description', r.description, 'description', itemId, false, true)}
            ${_field('AbeBooks Style', r.abebooks_description, 'abebooks_description', itemId, false, true)}
        `;

        // Copy buttons
        panel.querySelectorAll('[data-copy]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const field = (btn as HTMLElement).dataset['copy']!;
                const value = (r as unknown as Record<string, string>)[field] ?? '';
                await navigator.clipboard.writeText(value);
                btn.textContent = '✓ Copied';
                setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
            });
        });

        // Apply-as-title buttons
        panel.querySelectorAll('[data-apply-title]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const field = (btn as HTMLElement).dataset['applyTitle']!;
                const value = (r as unknown as Record<string, string>)[field] ?? '';
                await updateItem(itemId, { title: value } as Partial<ItemRow>);
                btn.textContent = '✓ Applied';
                btn.setAttribute('disabled', '');
                this.dispatchEvent(new CustomEvent('hlh-title-applied', {
                    bubbles: true, composed: true,
                    detail:  { itemId, title: value },
                }));
            });
        });

        // Regenerate
        panel.querySelector('#btn-regen')!.addEventListener('click', async () => {
            void this._generate(itemId);
        });
    }
}

// ── Field renderer ────────────────────────────────────────────────────────────

function _field(
    label:      string,
    value:      string,
    fieldKey:   string,
    _itemId:    string,
    canApply:   boolean,
    multiline = false,
): string {
    const charCount = value?.length ?? 0;
    return `
    <div class="dp-field">
        <div class="dp-field-header">
            <span class="dp-field-label">${_esc(label)}</span>
            <span class="dp-char-count">${charCount} chars</span>
            <div class="dp-field-actions">
                ${canApply
                    ? `<button class="dp-action-btn dp-apply-btn"
                               data-apply-title="${_esc(fieldKey)}"
                               aria-label="Apply as item title">
                           Apply as title
                       </button>`
                    : ''}
                <button class="dp-action-btn dp-copy-btn"
                        data-copy="${_esc(fieldKey)}"
                        aria-label="Copy ${_esc(label)}">
                    Copy
                </button>
            </div>
        </div>
        <div class="dp-field-value ${multiline ? 'dp-multiline' : ''}">${_esc(value ?? '')}</div>
    </div>`;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = `
    :host { display: block; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .panel {
        font-family: var(--ravel-font, 'Quantico', monospace);
        font-size: 0.82rem;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .dp-empty {
        color: rgba(255,255,255,0.25);
        font-style: italic;
        font-size: 0.8rem;
    }

    .dp-error {
        color: #FF6B6B;
        font-size: 0.8rem;
        line-height: 1.5;
    }

    .dp-loading {
        display: flex;
        align-items: center;
        gap: 10px;
        color: rgba(255,255,255,0.5);
        font-size: 0.82rem;
        padding: 8px 0;
    }

    .dp-spinner { animation: spin 1.2s linear infinite; display: inline-block; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .dp-generate-btn, .dp-regen-btn, .dp-action-btn {
        appearance: none;
        border-radius: 5px;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.12s;
    }

    .dp-generate-btn {
        background: rgba(167,255,0,0.12);
        border: 1px solid rgba(167,255,0,0.35);
        color: #A7FF00;
        font-size: 0.88rem;
        font-weight: 700;
        padding: 10px 18px;
        min-height: 44px;
        width: 100%;
    }
    .dp-generate-btn:hover { background: rgba(167,255,0,0.22); }
    .dp-generate-btn:focus-visible { outline: 2px solid #A7FF00; outline-offset: 2px; }

    .dp-toolbar { display: flex; justify-content: flex-end; }
    .dp-regen-btn {
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,255,255,0.12);
        color: rgba(255,255,255,0.45);
        font-size: 0.75rem;
        padding: 5px 12px;
        min-height: 32px;
    }
    .dp-regen-btn:hover { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.75); }
    .dp-regen-btn:focus-visible { outline: 2px solid #00F0FF; outline-offset: 2px; }

    .dp-field {
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 6px;
        overflow: hidden;
    }

    .dp-field-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 10px;
        background: rgba(255,255,255,0.03);
        border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .dp-field-label {
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.07em;
        color: rgba(255,255,255,0.35);
        flex: 1;
    }

    .dp-char-count {
        font-size: 0.65rem;
        color: rgba(255,255,255,0.20);
        flex-shrink: 0;
    }

    .dp-field-actions {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
    }

    .dp-action-btn {
        font-size: 0.68rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 3px 9px;
        min-height: 26px;
    }

    .dp-copy-btn {
        background: rgba(0,240,255,0.08);
        border: 1px solid rgba(0,240,255,0.25);
        color: #00F0FF;
    }
    .dp-copy-btn:hover { background: rgba(0,240,255,0.16); }
    .dp-copy-btn:focus-visible { outline: 2px solid #00F0FF; outline-offset: 2px; }

    .dp-apply-btn {
        background: rgba(255,79,179,0.08);
        border: 1px solid rgba(255,79,179,0.25);
        color: #FF4FB3;
    }
    .dp-apply-btn:hover:not([disabled]) { background: rgba(255,79,179,0.16); }
    .dp-apply-btn[disabled] {
        background: rgba(167,255,0,0.08);
        border-color: rgba(167,255,0,0.25);
        color: #A7FF00;
        cursor: default;
    }
    .dp-apply-btn:focus-visible { outline: 2px solid #FF4FB3; outline-offset: 2px; }

    .dp-field-value {
        padding: 10px 12px;
        font-size: 0.82rem;
        color: rgba(255,255,255,0.80);
        line-height: 1.55;
        white-space: pre-wrap;
        word-break: break-word;
    }

    .dp-multiline {
        max-height: 200px;
        overflow-y: auto;
    }
`;

function _esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

customElements.define('hlh-description-panel', HlhDescriptionPanel);
