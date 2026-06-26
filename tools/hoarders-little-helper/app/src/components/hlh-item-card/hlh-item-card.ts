/**
 * hlh-item-card — full editor for a single cataloged item.
 *
 * Attributes
 *   item-id  string  — DB item id (required)
 *
 * Events dispatched (bubbles + composed)
 *   hlh-item-saved   detail: { itemId: string }
 *   hlh-item-deleted detail: { itemId: string }
 */
import { convertFileSrc } from '@tauri-apps/api/core';
import {
    getItem, updateItem, listPhotosForItem,
    getTagsForItem, setTagsForItem, listTags,
    ItemRow, PhotoRow,
} from '../../db/index';
import { registry }       from '../../services/qthread-registry';
import { classifyPhoto }  from '../../services/vision';
import { extractText }    from '../../services/ocr';

type FieldDef = {
    key:         string;
    label:       string;
    value?:      string | number | null;
    type?:       'text' | 'number' | 'year' | 'textarea' | 'select';
    options?:    string[];
    span?:       1 | 2;
    placeholder?: string;
};

class HlhItemCard extends HTMLElement {
    private _shadow: ShadowRoot;
    private _itemId = '';

    constructor() {
        super();
        this._shadow = this.attachShadow({ mode: 'open' });
        this._shadow.innerHTML = `
            <style>
                :host { display: block; width: 100%; }
                .card {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid rgba(255,255,255,0.09);
                    border-radius: 10px;
                    padding: 24px;
                }
                .card-title {
                    font-family: Silkscreen, monospace;
                    font-size: 1rem;
                    color: rgba(255,255,255,0.5);
                    margin: 0;
                }
                .body { display: flex; gap: 20px; }
                .photo-col { flex-shrink: 0; width: 200px; }
                .field-col { flex: 1; min-width: 0; }
                .footer {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    justify-content: flex-end;
                    padding-top: 12px;
                    border-top: 1px solid rgba(255,255,255,0.06);
                }
                .footer-normal  { display: flex; gap: 10px; justify-content: flex-end; width: 100%; }
                .footer-confirm { display: flex; gap: 10px; align-items: center; justify-content: flex-end; width: 100%; }
                .footer-confirm[hidden] { display: none; }
                .delete-msg {
                    font-family: Quantico, monospace;
                    font-size: 0.85rem;
                    color: rgba(255,255,255,0.5);
                    flex: 1;
                }
                button {
                    font-family: Silkscreen, monospace;
                    font-size: 0.85rem;
                    padding: 10px 20px;
                    border-radius: 5px;
                    border: 1px solid;
                    cursor: pointer;
                    min-height: 44px;
                }
                .btn-save {
                    background: rgba(255,79,179,0.15);
                    border-color: rgba(255,79,179,0.4);
                    color: #fff;
                }
                .btn-save:hover { background: rgba(255,79,179,0.28); }
                .btn-delete {
                    background: rgba(255,255,255,0.03);
                    border-color: rgba(255,255,255,0.12);
                    color: rgba(255,255,255,0.4);
                }
                .btn-delete:hover {
                    background: rgba(255,60,60,0.12);
                    border-color: rgba(255,80,80,0.35);
                    color: rgba(255,255,255,0.65);
                }
                .btn-confirm-delete {
                    background: rgba(255,60,60,0.15);
                    border-color: rgba(255,80,80,0.4);
                    color: #fff;
                }
                .btn-confirm-delete:hover {
                    background: rgba(255,60,60,0.28);
                    border-color: rgba(255,80,80,0.6);
                }
                button:focus-visible { outline: 2px solid #00F0FF; outline-offset: 2px; }
                .error {
                    font-family: Quantico, monospace;
                    font-size: 0.85rem;
                    color: #ff6b6b;
                    padding: 12px;
                }
                ravel-photo-strip  { display: block; }
                ravel-field-grid   { display: block; }
                ravel-tag-editor   { display: block; }
                .tag-row {
                    margin-top: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .tag-label {
                    font-size: 9px;
                    letter-spacing: 0.12em;
                    color: rgba(255,255,255,0.28);
                    text-transform: uppercase;
                    font-family: var(--ravel-font, 'Silkscreen', monospace);
                }
                .evidence-details {
                    border: 1px solid rgba(255,255,255,0.07);
                    border-radius: 6px;
                    overflow: hidden;
                }
                .evidence-summary {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 10px 14px;
                    background: rgba(255,255,255,0.03);
                    cursor: pointer;
                    font-size: 9px;
                    letter-spacing: 0.12em;
                    color: rgba(255,255,255,0.35);
                    text-transform: uppercase;
                    font-family: Silkscreen, monospace;
                    min-height: 44px;
                    list-style: none;
                    user-select: none;
                }
                .evidence-summary::marker { display: none; }
                .evidence-summary::-webkit-details-marker { display: none; }
                .evidence-body {
                    padding: 14px;
                    border-top: 1px solid rgba(255,255,255,0.06);
                }
                hlh-quiddity-panel    { display: block; }
                hlh-description-panel { display: block; }
                hlh-valuation-panel   { display: block; }
                hlh-collection-match  { display: block; }
            </style>
            <div class="card">
                <p class="card-title">Loading…</p>
            </div>
        `;
    }

    static get observedAttributes(): string[] { return ['item-id']; }

    connectedCallback():    void { this._load(); }
    attributeChangedCallback(): void { this._load(); }

    /** Programmatically trigger save — used by the global Cmd+S shortcut. */
    public save(): void {
        (this._shadow.querySelector('.btn-save') as HTMLButtonElement)?.click();
    }

    private async _load(): Promise<void> {
        const itemId = this.getAttribute('item-id') ?? '';
        if (!itemId || itemId === this._itemId) return;
        this._itemId = itemId;

        let item: ItemRow | null = null;
        let photos: PhotoRow[]   = [];
        let itemTags: string[]   = [];
        let allTags:  string[]   = [];

        try {
            [item, photos] = await Promise.all([
                getItem(itemId),
                listPhotosForItem(itemId),
            ]);
            const [tagRows, allTagRows] = await Promise.all([
                getTagsForItem(itemId),
                listTags(),
            ]);
            itemTags = tagRows.map(t => t.name);
            allTags  = allTagRows.map(t => t.name);
        } catch (err) {
            this._showError(String(err));
            return;
        }

        if (!item) {
            this._showError('Item not found.');
            return;
        }

        this._render(item, photos, itemTags, allTags);
    }

    private _showError(msg: string): void {
        this._shadow.innerHTML = `<p class="error">${msg}</p>`;
    }

    private _render(item: ItemRow, photos: PhotoRow[], itemTags: string[], allTags: string[]): void {
        const card = this._shadow.querySelector('.card')!;

        // Build field definitions
        const fields: FieldDef[] = [
            { key: 'title',     label: 'Title',     value: item.title,     type: 'text',     span: 2 },
            { key: 'brand',     label: 'Brand',     value: item.brand,     type: 'text' },
            { key: 'author',    label: 'Author',     value: item.author,    type: 'text' },
            { key: 'publisher', label: 'Publisher',  value: item.publisher, type: 'text' },
            { key: 'category',  label: 'Category',   value: item.category,  type: 'text' },
            { key: 'year',      label: 'Year',       value: item.year,      type: 'year' },
            {
                key:     'condition',
                label:   'Condition',
                value:   item.condition,
                type:    'select',
                options: ['', 'poor', 'fair', 'good', 'vg', 'fine', 'mint'],
            },
            { key: 'notes', label: 'Notes', value: item.notes, type: 'textarea', span: 2 },
        ];

        // Convert photo paths to asset:// URLs
        const photoItems = photos.map(p => ({
            id:      p.id,
            src:     p.thumbnail ? convertFileSrc(p.thumbnail) : '',
            alt:     item.title ?? 'Photo',
            is_hero: !!p.is_hero,
        }));

        card.innerHTML = `
            <p class="card-title">${item.title ?? 'New Item'}</p>
            <div class="body">
                <div class="photo-col">
                    <ravel-photo-strip id="strip-${item.id}"></ravel-photo-strip>
                </div>
                <div class="field-col">
                    <ravel-field-grid id="grid-${item.id}" columns="2"></ravel-field-grid>
                    <div class="tag-row">
                        <div class="tag-label">Tags</div>
                        <ravel-tag-editor id="tags-${item.id}"
                            tags="${JSON.stringify(itemTags).replace(/"/g, '&quot;')}"
                            placeholder="Add tag…"></ravel-tag-editor>
                    </div>
                </div>
            </div>
            <details class="evidence-details">
                <summary class="evidence-summary">🧵 Q-Thread Evidence</summary>
                <div class="evidence-body">
                    <hlh-quiddity-panel id="qpanel-${item.id}" item-id="${item.id}"></hlh-quiddity-panel>
                </div>
            </details>

            <details class="evidence-details">
                <summary class="evidence-summary">✨ Descriptions</summary>
                <div class="evidence-body">
                    <hlh-description-panel id="dpanel-${item.id}" item-id="${item.id}"></hlh-description-panel>
                </div>
            </details>

            <details class="evidence-details">
                <summary class="evidence-summary">💰 Valuation</summary>
                <div class="evidence-body">
                    <hlh-valuation-panel id="vpanel-${item.id}" item-id="${item.id}"></hlh-valuation-panel>
                </div>
            </details>

            <details class="evidence-details">
                <summary class="evidence-summary">📁 Collections</summary>
                <div class="evidence-body">
                    <hlh-collection-match id="cmatch-${item.id}" item-id="${item.id}"></hlh-collection-match>
                </div>
            </details>

            <div class="footer">
                <div class="footer-normal">
                    <button class="btn-delete" type="button">🗑 Delete</button>
                    <button class="btn-save"   type="button">💾 Save</button>
                </div>
                <div class="footer-confirm" hidden>
                    <span class="delete-msg">Delete this item?</span>
                    <button class="btn-cancel-delete" type="button">Cancel</button>
                    <button class="btn-confirm-delete" type="button">🗑 Yes, Delete</button>
                </div>
            </div>
        `;

        // Populate ravel-photo-strip
        const strip = card.querySelector<any>(`#strip-${item.id}`);
        if (strip?.setPhotos) strip.setPhotos(photoItems);

        // Populate ravel-field-grid
        const grid = card.querySelector<any>(`#grid-${item.id}`);
        if (grid?.setFields) grid.setFields(fields);

        // Tag editor suggestions
        const tagEditor = card.querySelector<any>(`#tags-${item.id}`);
        if (tagEditor?.setSuggestions) tagEditor.setSuggestions(allTags);

        // Save button — persists fields AND tags
        card.querySelector('.btn-save')?.addEventListener('click', async () => {
            const updatedFields = grid?.getFields?.() ?? [];
            const patch: Partial<ItemRow> = {};
            for (const f of updatedFields) {
                (patch as Record<string, unknown>)[f.key] = f.value ?? null;
            }
            const currentTags: string[] = tagEditor?.getTags?.() ?? [];
            try {
                await Promise.all([
                    updateItem(item.id, patch),
                    setTagsForItem(item.id, currentTags),
                ]);
                // Run Q-Thread evidence gathering in the background — don't block the UI.
                const fields = {
                    title:     (patch.title     ?? null) as string | null,
                    brand:     (patch.brand     ?? null) as string | null,
                    author:    (patch.author    ?? null) as string | null,
                    publisher: (patch.publisher ?? null) as string | null,
                    category:  (patch.category  ?? null) as string | null,
                    year:      (patch.year      ?? null) as number | null,
                    condition: (patch.condition ?? null) as string | null,
                    notes:     (patch.notes     ?? null) as string | null,
                };
                // Run all analysis in the background, then refresh the evidence panel.
                void (async () => {
                    await registry.runMatch(item.id, fields);
                    // Vision + OCR on the first photo if available
                    if (photos[0]?.original) {
                        await Promise.allSettled([
                            classifyPhoto(photos[0].original, item.id),
                            extractText(photos[0].original, item.id),
                        ]);
                    }
                    const panel = card.querySelector<any>(`#qpanel-${item.id}`);
                    panel?.refresh?.();
                })();
                this.dispatchEvent(new CustomEvent('hlh-item-saved', {
                    bubbles: true, composed: true,
                    detail: { itemId: item.id },
                }));
            } catch (err) {
                console.error('Save failed:', err);
            }
        });

        // Delete button — inline two-step confirmation
        const footerNormal  = card.querySelector<HTMLElement>('.footer-normal')!;
        const footerConfirm = card.querySelector<HTMLElement>('.footer-confirm')!;

        card.querySelector('.btn-delete')?.addEventListener('click', () => {
            footerNormal.hidden  = true;
            footerConfirm.hidden = false;
            card.querySelector<HTMLElement>('.btn-cancel-delete')?.focus();
        });

        card.querySelector('.btn-cancel-delete')?.addEventListener('click', () => {
            footerNormal.hidden  = false;
            footerConfirm.hidden = true;
            card.querySelector<HTMLElement>('.btn-delete')?.focus();
        });

        card.querySelector('.btn-confirm-delete')?.addEventListener('click', async () => {
            try {
                await updateItem(item.id, { deleted_at: new Date().toISOString() } as Partial<ItemRow>);
                this.dispatchEvent(new CustomEvent('hlh-item-deleted', {
                    bubbles: true, composed: true,
                    detail: { itemId: item.id },
                }));
            } catch (err) {
                console.error('Delete failed:', err);
            }
        });
    }
}

customElements.define('hlh-item-card', HlhItemCard);
