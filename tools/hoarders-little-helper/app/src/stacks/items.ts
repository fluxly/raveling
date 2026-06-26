import { convertFileSrc } from '@tauri-apps/api/core';
import {
    listItems, searchItems, listPhotosForItem, countItems,
    getTagsForItem, ItemRow, PhotoRow,
} from '../db/index';
import '../components/hlh-item-card/hlh-item-card';
import { getNavSignal } from '../nav-signal';

export function render(): string {
    return `
        <div class="stack-view">
            <div class="stack-header">
                <span class="stack-header-icon" aria-hidden="true">🗃️</span>
                <h1 class="stack-title">Items</h1>
                <span class="stack-count" id="items-count">—</span>
            </div>

            <!-- Search bar -->
            <div class="search-wrap">
                <label class="sr-only" for="items-search">Search items</label>
                <input id="items-search" type="search" class="search-input text"
                       placeholder="Search title, brand, author, notes…"
                       aria-label="Search items" />
            </div>

            <!-- Inline item editor (hidden when nothing selected) -->
            <div id="item-detail" hidden></div>

            <!-- Grid of item tiles -->
            <div id="items-grid" class="items-grid" role="list" aria-label="Cataloged items"></div>
            <p id="items-empty" class="stack-placeholder text" hidden>
                No items found. Import photos from the Inbox and create items to get started.
            </p>
        </div>
        <style>
            .search-wrap {
                flex-shrink: 0;
            }
            .search-input {
                width: 100%;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.10);
                border-radius: 6px;
                color: #e6e2d3;
                font-size: 0.9rem;
                padding: 10px 14px;
                min-height: 44px;
                outline: none;
                transition: border-color 0.12s;
            }
            .search-input:focus {
                border-color: rgba(0,240,255,0.4);
            }
            .search-input::placeholder { color: rgba(255,255,255,0.22); }
            .items-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                gap: 14px;
            }
            .item-tile {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.10);
                border-radius: 8px;
                overflow: hidden;
                cursor: pointer;
                transition: border-color 0.12s;
                display: flex;
                flex-direction: column;
                text-align: left;
            }
            .item-tile:hover { border-color: rgba(255,79,179,0.4); }
            .item-tile:focus-visible { outline: 2px solid #00F0FF; outline-offset: 2px; }
            .item-tile.selected { border-color: rgba(255,79,179,0.7); }
            .thumb-wrap {
                width: 100%;
                aspect-ratio: 1;
                background: #111;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .item-thumb { width: 100%; height: 100%; object-fit: cover; display: block; }
            .thumb-placeholder { font-size: 2rem; color: rgba(255,255,255,0.15); }
            .item-meta {
                padding: 10px 12px;
                display: flex;
                flex-direction: column;
                gap: 3px;
            }
            .item-title {
                font-family: Quantico, monospace;
                font-size: 0.78rem;
                color: rgba(255,255,255,0.75);
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .item-category {
                font-family: Quantico, monospace;
                font-size: 0.65rem;
                color: rgba(255,79,179,0.7);
                text-transform: uppercase;
                letter-spacing: 0.06em;
            }
            .item-tags {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-top: 2px;
            }
            .item-tag {
                font-family: Quantico, monospace;
                font-size: 0.6rem;
                padding: 2px 6px;
                background: rgba(255,79,179,0.12);
                border: 1px solid rgba(255,79,179,0.25);
                border-radius: 8px;
                color: rgba(255,255,255,0.55);
                white-space: nowrap;
            }
            #item-detail { margin-bottom: 4px; }
            .sr-only {
                position: absolute; width: 1px; height: 1px;
                padding: 0; margin: -1px; overflow: hidden;
                clip: rect(0,0,0,0); white-space: nowrap; border: 0;
            }
        </style>
    `;
}

export async function mount(el: HTMLElement): Promise<void> {
    const grid      = el.querySelector<HTMLElement>('#items-grid')!;
    const emptyMsg  = el.querySelector<HTMLElement>('#items-empty')!;
    const countEl   = el.querySelector<HTMLElement>('#items-count')!;
    const detailEl  = el.querySelector<HTMLElement>('#item-detail')!;
    const searchEl  = el.querySelector<HTMLInputElement>('#items-search')!;

    // Initial load
    await _renderGrid(grid, emptyMsg, countEl, detailEl);

    // Search (debounced)
    let _timer: ReturnType<typeof setTimeout>;
    searchEl.addEventListener('input', () => {
        clearTimeout(_timer);
        _timer = setTimeout(async () => {
            const q = searchEl.value.trim();
            const items = q
                ? await searchItems(q)
                : await listItems(200);
            await _populateGrid(items, grid, emptyMsg, countEl, detailEl);
        }, 250);
    });

    // Keyboard shortcuts — cleaned up automatically when the router navigates away
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        // Esc — deselect current item
        if (e.key === 'Escape') {
            const selected = grid.querySelector<HTMLElement>('.item-tile.selected');
            if (selected) {
                grid.querySelectorAll('.item-tile').forEach(t => t.classList.remove('selected'));
                detailEl.innerHTML = '';
                detailEl.hidden = true;
                selected.focus();
            }
            return;
        }
        // / — focus search (only when not already inside a form control or custom element)
        if (e.key === '/' && !_isFocusInContent()) {
            e.preventDefault();
            searchEl.focus();
            searchEl.select();
        }
    }, { signal: getNavSignal() });

    // Re-render list after save or delete
    el.addEventListener('hlh-item-saved', async () => {
        const q = searchEl.value.trim();
        const items = q ? await searchItems(q) : await listItems(200);
        await _populateGrid(items, grid, emptyMsg, countEl, detailEl);
    });
    el.addEventListener('hlh-item-deleted', async () => {
        detailEl.innerHTML = '';
        detailEl.hidden = true;
        const items = await listItems(200);
        await _populateGrid(items, grid, emptyMsg, countEl, detailEl);
    });
}

async function _renderGrid(
    grid: HTMLElement,
    emptyMsg: HTMLElement,
    countEl: HTMLElement,
    detailEl: HTMLElement,
): Promise<void> {
    const items = await listItems(200);
    await _populateGrid(items, grid, emptyMsg, countEl, detailEl);
}

async function _populateGrid(
    items: ItemRow[],
    grid: HTMLElement,
    emptyMsg: HTMLElement,
    countEl: HTMLElement,
    detailEl: HTMLElement,
): Promise<void> {
    const n = await countItems();
    countEl.textContent = `${n} item${n === 1 ? '' : 's'}`;
    emptyMsg.hidden = items.length > 0;
    grid.innerHTML = '';

    for (const item of items) {
        let heroPhoto: PhotoRow | null = null;
        let tags: string[] = [];

        try {
            const [photos, tagRows] = await Promise.all([
                listPhotosForItem(item.id),
                getTagsForItem(item.id),
            ]);
            heroPhoto = photos.find(p => p.is_hero) ?? photos[0] ?? null;
            tags = tagRows.map(t => t.name);
        } catch { /* ignore */ }

        const tile = _makeTile(item, heroPhoto, tags);
        tile.addEventListener('click',   () => _selectItem(item.id, tile, grid, detailEl));
        tile.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                _selectItem(item.id, tile, grid, detailEl);
            }
        });
        grid.appendChild(tile);
    }
}

function _selectItem(
    itemId: string,
    tile: HTMLElement,
    grid: HTMLElement,
    detailEl: HTMLElement,
): void {
    const isSelected = tile.classList.contains('selected');
    grid.querySelectorAll('.item-tile').forEach(t => t.classList.remove('selected'));

    if (isSelected) {
        detailEl.innerHTML = '';
        detailEl.hidden = true;
        return;
    }

    tile.classList.add('selected');
    detailEl.hidden = false;

    let card = detailEl.querySelector<HTMLElement>('hlh-item-card');
    if (!card) {
        card = document.createElement('hlh-item-card') as HTMLElement;
        detailEl.appendChild(card);
    }
    card.setAttribute('item-id', itemId);
    detailEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function _makeTile(item: ItemRow, hero: PhotoRow | null, tags: string[]): HTMLElement {
    const div = document.createElement('div');
    div.className  = 'item-tile';
    div.setAttribute('role', 'listitem');
    div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', item.title ?? 'Unnamed item');

    const thumbSrc = hero?.thumbnail ? convertFileSrc(hero.thumbnail) : '';
    const title    = item.title ?? 'Unnamed';

    div.innerHTML = `
        <div class="thumb-wrap">
            ${thumbSrc
                ? `<img class="item-thumb" src="${thumbSrc}" alt="${_esc(title)}" loading="lazy" />`
                : `<span class="thumb-placeholder" aria-hidden="true">📦</span>`}
        </div>
        <div class="item-meta">
            <div class="item-title" title="${_esc(title)}">${_esc(title)}</div>
            ${item.category ? `<div class="item-category">${_esc(item.category)}</div>` : ''}
            ${tags.length > 0 ? `
                <div class="item-tags" aria-label="Tags">
                    ${tags.slice(0, 3).map(t => `<span class="item-tag">${_esc(t)}</span>`).join('')}
                    ${tags.length > 3 ? `<span class="item-tag">+${tags.length - 3}</span>` : ''}
                </div>` : ''}
        </div>
    `;
    return div;
}

function _esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}

// Returns true when focus is inside a form control or a custom element (shadow host).
// Prevents the "/" shortcut from firing while the user is typing in a field.
function _isFocusInContent(): boolean {
    const ae = document.activeElement;
    if (!ae || ae === document.body) return false;
    const tag = ae.tagName.toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return true;
    if ((ae as HTMLElement).isContentEditable) return true;
    if (tag.includes('-')) return true; // any custom element / shadow host
    return false;
}
