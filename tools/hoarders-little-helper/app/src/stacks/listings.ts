/**
 * Listings stack — two tabs:
 *   Drafts  — items with no active listing; create new listings
 *   Active  — all current listings by marketplace status
 */

import { convertFileSrc } from '@tauri-apps/api/core';
import {
    listItems, listPhotosForItem, listAllListings, listListingsForItem,
    insertListing, updateListing,
    ItemRow, PhotoRow, ListingRow,
} from '../db/index';
import { loadDescription } from '../services/description';
import { getTagsForItem }  from '../db/index';
import { MARKETPLACE_PLUGINS, getPlugin } from '../../../plugins/registry';
import type { ListingPayload } from '../../../plugins/interface';

type Tab = 'drafts' | 'active';
let _activeTab: Tab = 'drafts';

export function render(): string {
    return `
        <div class="stack-view">
            <div class="stack-header">
                <span class="stack-header-icon" aria-hidden="true">🏷️</span>
                <h1 class="stack-title">Listings</h1>
            </div>
            <div class="tab-bar" role="tablist" aria-label="Listings tabs">
                <button class="tab-btn" role="tab" id="tab-drafts" aria-controls="panel-drafts"
                        aria-selected="${_activeTab === 'drafts'}">Drafts</button>
                <button class="tab-btn" role="tab" id="tab-active" aria-controls="panel-active"
                        aria-selected="${_activeTab === 'active'}">Active</button>
            </div>
            <div id="panel-drafts" role="tabpanel" aria-labelledby="tab-drafts" ${_activeTab !== 'drafts' ? 'hidden' : ''}>
                <div id="drafts-list" class="tile-grid" role="list" aria-label="Items without listings"></div>
                <p id="drafts-empty" class="stack-placeholder text" hidden>
                    All items have active listings. Great work!
                </p>
            </div>
            <div id="panel-active" role="tabpanel" aria-labelledby="tab-active" ${_activeTab !== 'active' ? 'hidden' : ''}>
                <div id="active-list" class="tile-grid" role="list" aria-label="Active listings"></div>
                <p id="active-empty" class="stack-placeholder text" hidden>
                    No active listings yet. Create one from the Drafts tab.
                </p>
            </div>

            <!-- Detail drawer (item + marketplace preview) -->
            <div id="listings-detail" hidden></div>
        </div>
        <style>
            .tab-bar {
                display: flex;
                gap: 6px;
                padding: 2px 0 12px;
                flex-shrink: 0;
            }
            .tab-btn {
                font-family: Silkscreen, monospace;
                font-size: 0.78rem;
                padding: 7px 18px;
                border-radius: 5px;
                border: 1px solid rgba(255,255,255,0.12);
                background: rgba(255,255,255,0.04);
                color: rgba(255,255,255,0.45);
                cursor: pointer;
                min-height: 36px;
            }
            .tab-btn[aria-selected="true"] {
                background: rgba(255,79,179,0.15);
                border-color: rgba(255,79,179,0.4);
                color: #fff;
            }
            .tab-btn:focus-visible { outline: 2px solid #00F0FF; outline-offset: 2px; }

            .tile-grid {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .item-tile {
                display: flex;
                align-items: center;
                gap: 14px;
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.07);
                border-radius: 8px;
                padding: 12px 14px;
                cursor: pointer;
                transition: background 0.12s, border-color 0.12s;
                min-height: 68px;
            }
            .item-tile:hover    { background: rgba(255,255,255,0.06); border-color: rgba(255,255,255,0.12); }
            .item-tile:focus-visible { outline: 2px solid #00F0FF; outline-offset: 2px; }

            .tile-thumb {
                width: 48px;
                height: 48px;
                border-radius: 4px;
                object-fit: cover;
                background: rgba(255,255,255,0.06);
                flex-shrink: 0;
            }
            .tile-thumb-placeholder {
                width: 48px;
                height: 48px;
                border-radius: 4px;
                background: rgba(255,255,255,0.06);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.3rem;
                flex-shrink: 0;
            }
            .tile-info { flex: 1; min-width: 0; }
            .tile-title {
                font-family: Quantico, monospace;
                font-size: 0.88rem;
                color: rgba(255,255,255,0.85);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .tile-sub {
                font-size: 0.75rem;
                color: rgba(255,255,255,0.35);
                margin-top: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .tile-badge {
                font-size: 0.7rem;
                padding: 3px 9px;
                border-radius: 4px;
                font-family: Silkscreen, monospace;
                border: 1px solid;
                flex-shrink: 0;
            }
            .badge-draft  { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.12); color: rgba(255,255,255,0.35); }
            .badge-active { background: rgba(167,255,0,0.1);    border-color: rgba(167,255,0,0.3);    color: #A7FF00; }
            .badge-sold   { background: rgba(0,240,255,0.08);   border-color: rgba(0,240,255,0.2);    color: #00F0FF; }
            .badge-error  { background: rgba(255,79,179,0.08);  border-color: rgba(255,79,179,0.2);   color: #FF4FB3; }

            /* Detail drawer */
            #listings-detail {
                margin-top: 16px;
                border-top: 1px solid rgba(255,255,255,0.07);
                padding-top: 16px;
            }
            .detail-header {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 14px;
            }
            .detail-title {
                font-family: Silkscreen, monospace;
                font-size: 0.88rem;
                color: rgba(255,255,255,0.6);
                flex: 1;
            }
            .btn-close-detail {
                font-family: Silkscreen, monospace;
                font-size: 0.72rem;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.35);
                padding: 5px 12px;
                border-radius: 4px;
                cursor: pointer;
                min-height: 32px;
            }
            .btn-close-detail:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.6); }

            .price-row {
                display: flex;
                align-items: center;
                gap: 10px;
                margin-bottom: 14px;
            }
            .price-label {
                font-family: Quantico, monospace;
                font-size: 0.82rem;
                color: rgba(255,255,255,0.45);
                flex-shrink: 0;
            }
            .price-input {
                width: 110px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 5px;
                color: #fff;
                font-family: Quantico, monospace;
                font-size: 0.88rem;
                padding: 6px 10px;
                min-height: 36px;
            }
            .price-input:focus { outline: 2px solid #00F0FF; }

            .plugin-tabs {
                display: flex;
                gap: 6px;
                margin-bottom: 16px;
                flex-wrap: wrap;
            }
            .plugin-tab-btn {
                font-family: Silkscreen, monospace;
                font-size: 0.72rem;
                padding: 5px 12px;
                border-radius: 4px;
                border: 1px solid rgba(255,255,255,0.10);
                background: rgba(255,255,255,0.03);
                color: rgba(255,255,255,0.40);
                cursor: pointer;
                min-height: 32px;
            }
            .plugin-tab-btn[aria-selected="true"] {
                background: rgba(0,240,255,0.10);
                border-color: rgba(0,240,255,0.3);
                color: #00F0FF;
            }
            .plugin-tab-btn:focus-visible { outline: 2px solid #00F0FF; outline-offset: 2px; }

            hlh-marketplace-preview { display: block; }
        </style>
    `;
}

export function mount(el: HTMLElement): void {
    _wireTab(el, 'drafts');
    _wireTab(el, 'active');
    void _loadDrafts(el);
    void _loadActive(el);
}

// ── Tab switching ─────────────────────────────────────────────────────────────

function _wireTab(el: HTMLElement, tab: Tab): void {
    el.querySelector(`#tab-${tab}`)?.addEventListener('click', () => {
        _activeTab = tab;
        (['drafts', 'active'] as Tab[]).forEach(t => {
            const btn   = el.querySelector(`#tab-${t}`)!;
            const panel = el.querySelector(`#panel-${t}`)!;
            const active = t === tab;
            btn.setAttribute('aria-selected', String(active));
            panel.toggleAttribute('hidden', !active);
        });
    });
}

// ── Drafts tab ────────────────────────────────────────────────────────────────

async function _loadDrafts(el: HTMLElement): Promise<void> {
    const grid  = el.querySelector('#drafts-list')!;
    const empty = el.querySelector<HTMLElement>('#drafts-empty')!;

    const items    = await listItems(200, 0);
    const listings = await listAllListings('active');
    const listedIds = new Set(listings.map(l => l.item_id));

    const drafts = items.filter(item => !listedIds.has(item.id));
    empty.hidden = drafts.length > 0;

    for (const item of drafts) {
        const photos = await listPhotosForItem(item.id);
        const tile   = _draftTile(item, photos);
        tile.addEventListener('click', () => void _openDetail(el, item, null));
        tile.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void _openDetail(el, item, null); }
        });
        grid.appendChild(tile);
    }
}

function _draftTile(item: ItemRow, photos: PhotoRow[]): HTMLElement {
    const tile = document.createElement('div');
    tile.className = 'item-tile';
    tile.setAttribute('role', 'listitem');
    tile.setAttribute('tabindex', '0');
    tile.setAttribute('aria-label', item.title ?? 'Untitled item');

    const hero = photos.find(p => p.is_hero) ?? photos[0];
    const thumb = hero?.thumbnail ? convertFileSrc(hero.thumbnail) : '';

    tile.innerHTML = `
        ${thumb
            ? `<img class="tile-thumb" src="${_esc(thumb)}" alt="" aria-hidden="true">`
            : `<div class="tile-thumb-placeholder" aria-hidden="true">📦</div>`}
        <div class="tile-info">
            <div class="tile-title">${_esc(item.title ?? 'Untitled')}</div>
            <div class="tile-sub">${_esc([item.category, item.condition, item.year].filter(Boolean).join(' · '))}</div>
        </div>
        <span class="tile-badge badge-draft">Draft</span>`;
    return tile;
}

// ── Active tab ────────────────────────────────────────────────────────────────

async function _loadActive(el: HTMLElement): Promise<void> {
    const grid  = el.querySelector('#active-list')!;
    const empty = el.querySelector<HTMLElement>('#active-empty')!;

    const listings = await listAllListings();
    const active   = listings.filter(l => l.status !== 'draft');
    empty.hidden   = active.length > 0;

    const items = await listItems(500, 0);
    const itemMap = new Map(items.map(i => [i.id, i]));

    for (const listing of active) {
        const item  = itemMap.get(listing.item_id);
        if (!item) continue;
        const tile  = _activeTile(item, listing);
        tile.addEventListener('click', () => void _openDetail(el, item, listing));
        grid.appendChild(tile);
    }
}

function _activeTile(item: ItemRow, listing: ListingRow): HTMLElement {
    const tile = document.createElement('div');
    tile.className = 'item-tile';
    tile.setAttribute('role', 'listitem');
    tile.setAttribute('tabindex', '0');

    const plugin = getPlugin(listing.marketplace);
    const badgeCls = `badge-${listing.status}`;

    tile.innerHTML = `
        <div class="tile-thumb-placeholder" aria-hidden="true">${plugin?.icon ?? '🏷️'}</div>
        <div class="tile-info">
            <div class="tile-title">${_esc(item.title ?? 'Untitled')}</div>
            <div class="tile-sub">${_esc(plugin?.name ?? listing.marketplace)} · ${listing.published_at ? new Date(listing.published_at).toLocaleDateString() : 'draft'}</div>
        </div>
        <span class="tile-badge ${_esc(badgeCls)}">${_esc(listing.status)}</span>`;
    return tile;
}

// ── Detail drawer ─────────────────────────────────────────────────────────────

async function _openDetail(el: HTMLElement, item: ItemRow, existingListing: ListingRow | null): Promise<void> {
    const drawer = el.querySelector<HTMLElement>('#listings-detail')!;
    drawer.hidden = false;
    drawer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Load description for pre-filling title/description
    const desc = await loadDescription(item.id);
    const tags  = (await getTagsForItem(item.id)).map(t => t.name);

    let priceCents = 0;
    let selectedPlugin = MARKETPLACE_PLUGINS[0]?.id ?? 'csv';
    let listingId: string | null = existingListing?.id ?? null;

    if (existingListing?.payload) {
        try {
            const p = JSON.parse(existingListing.payload) as ListingPayload;
            priceCents = p.price ?? 0;
        } catch { /* ignore */ }
    }

    const pluginTabsHtml = MARKETPLACE_PLUGINS.map(p =>
        `<button class="plugin-tab-btn" data-plugin="${_esc(p.id)}"
                 aria-selected="${p.id === selectedPlugin}"
                 aria-label="${_esc(p.name)} marketplace">
            ${_esc(p.icon)} ${_esc(p.name)}
         </button>`
    ).join('');

    drawer.innerHTML = `
        <div class="detail-header">
            <span class="detail-title">${_esc(item.title ?? 'New Listing')}</span>
            <button class="btn-close-detail" id="btn-close-detail" aria-label="Close listing detail">✕ Close</button>
        </div>
        <div class="price-row">
            <label class="price-label" for="price-input">Price (USD)</label>
            <input id="price-input" class="price-input" type="number" min="0" step="0.01"
                   value="${(priceCents / 100).toFixed(2)}" placeholder="0.00" aria-label="Price in USD">
        </div>
        <div class="plugin-tabs" role="tablist" aria-label="Marketplace">${pluginTabsHtml}</div>
        <div id="plugin-preview-wrap"></div>`;

    drawer.querySelector('#btn-close-detail')?.addEventListener('click', () => {
        drawer.hidden = true;
    });

    const priceInput = drawer.querySelector<HTMLInputElement>('#price-input')!;

    const _buildPayload = (): ListingPayload => {
        const price = Math.round(parseFloat(priceInput.value || '0') * 100) || 0;
        return {
            title:       desc?.short_title    ?? desc?.marketplace_title ?? item.title ?? '',
            description: desc?.description    ?? desc?.abebooks_description ?? item.notes ?? '',
            price,
            condition:   item.condition ?? '',
            category:    item.category  ?? '',
            photos:      [],             // photo paths injected when available
            sku:         item.id,
            tags,
            author:      item.author    ?? undefined,
            publisher:   item.publisher ?? undefined,
            year:        item.year      ?? undefined,
        };
    };

    const _renderPreview = async (): Promise<void> => {
        const wrap = drawer.querySelector<HTMLElement>('#plugin-preview-wrap')!;
        if (!listingId) {
            listingId = await insertListing({
                item_id:     item.id,
                marketplace: selectedPlugin,
                payload:     _buildPayload(),
            });
        } else {
            await updateListing(listingId, { payload: _buildPayload() });
        }
        wrap.innerHTML = `
            <hlh-marketplace-preview
                plugin-id="${_esc(selectedPlugin)}"
                listing-id="${_esc(listingId!)}"
                payload="${_esc(JSON.stringify(_buildPayload()))}">
            </hlh-marketplace-preview>`;
    };

    // Plugin tab switching
    drawer.querySelectorAll<HTMLElement>('.plugin-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            selectedPlugin = btn.dataset['plugin']!;
            drawer.querySelectorAll('.plugin-tab-btn').forEach(b =>
                b.setAttribute('aria-selected', b === btn ? 'true' : 'false'));
            void _renderPreview();
        });
    });

    // Re-render when price changes
    priceInput.addEventListener('change', () => void _renderPreview());

    // Handle export done: refresh active tab
    drawer.addEventListener('hlh-export-done', (e: Event) => {
        const { result } = (e as CustomEvent).detail;
        if (result.success) void _reloadActive(el);
    });

    void _renderPreview();
}

async function _reloadActive(el: HTMLElement): Promise<void> {
    const grid = el.querySelector('#active-list')!;
    grid.innerHTML = '';
    await _loadActive(el);
}

function _esc(s: string): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
