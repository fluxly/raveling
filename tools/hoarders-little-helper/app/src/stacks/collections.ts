import { convertFileSrc } from '@tauri-apps/api/core';
import {
    listCollections, insertCollection, updateCollection, deleteCollection,
    getCollectionItems, listItems, addItemToCollection, removeItemFromCollection,
    listPhotosForItem, CollectionRow, ItemRow, PhotoRow,
} from '../db/index';

export function render(): string {
    return `
        <div class="stack-view">
            <div class="stack-header">
                <span class="stack-header-icon" aria-hidden="true">📚</span>
                <h1 class="stack-title">Collections</h1>
                <span class="stack-count" id="coll-count"></span>
            </div>
            <div class="stack-actions">
                <button class="hlh-btn" id="btn-new-collection" type="button">+ New Collection</button>
            </div>

            <!-- New-collection form (hidden by default) -->
            <form id="new-coll-form" class="coll-form" hidden aria-label="New collection">
                <input id="new-coll-name" type="text" class="coll-input text"
                       placeholder="Collection name" maxlength="100"
                       aria-label="Collection name" required />
                <input id="new-coll-desc" type="text" class="coll-input text"
                       placeholder="Description (optional)"
                       aria-label="Description" />
                <div class="form-actions">
                    <button class="hlh-btn" type="submit">Create</button>
                    <button class="hlh-btn hlh-btn-ghost" type="button" id="btn-cancel-new">Cancel</button>
                </div>
            </form>

            <!-- Collections list -->
            <div id="coll-list" class="coll-list" role="list" aria-label="Collections"></div>
            <p id="coll-empty" class="stack-placeholder text" hidden>
                No collections yet. Create one to start grouping your items.
            </p>

            <!-- Collection detail -->
            <div id="coll-detail" hidden>
                <div class="coll-detail-header">
                    <h2 id="coll-detail-title" class="coll-detail-name"></h2>
                    <span id="coll-detail-count" class="stack-count"></span>
                    <button class="hlh-btn hlh-btn-ghost hlh-btn-sm" id="btn-rename" type="button">Rename</button>
                    <button class="hlh-btn hlh-btn-danger hlh-btn-sm" id="btn-delete-coll" type="button">Delete</button>
                </div>
                <div id="coll-items-grid" class="coll-items-grid" role="list" aria-label="Items in collection"></div>
                <p id="coll-items-empty" class="stack-placeholder text" hidden>
                    No items in this collection yet.
                </p>
                <details class="add-items-panel">
                    <summary class="add-items-summary text">＋ Add Items</summary>
                    <div id="all-items-picker" class="all-items-picker" role="list"
                         aria-label="All items — click to add to collection"></div>
                </details>
            </div>
        </div>
        <style>
            .coll-form {
                display: flex;
                flex-direction: column;
                gap: 10px;
                padding: 16px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.09);
                border-radius: 8px;
            }
            .coll-input {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 5px;
                color: #e6e2d3;
                font-size: 0.9rem;
                padding: 8px 12px;
                min-height: 44px;
                outline: none;
                transition: border-color 0.12s;
            }
            .coll-input:focus { border-color: rgba(0,240,255,0.4); }
            .form-actions { display: flex; gap: 10px; }
            .hlh-btn-ghost {
                background: rgba(255,255,255,0.03);
                border-color: rgba(255,255,255,0.15);
                color: rgba(255,255,255,0.55);
            }
            .hlh-btn-danger {
                background: rgba(255,60,60,0.10);
                border-color: rgba(255,80,80,0.3);
                color: rgba(255,255,255,0.65);
            }
            .hlh-btn-sm { font-size: 0.7rem; padding: 6px 12px; min-height: 32px; }
            .coll-list { display: flex; flex-direction: column; gap: 6px; }
            .coll-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 8px;
                cursor: pointer;
                transition: border-color 0.12s;
                text-align: left;
            }
            .coll-row:hover { border-color: rgba(255,79,179,0.35); }
            .coll-row:focus-visible { outline: 2px solid #00F0FF; outline-offset: 2px; }
            .coll-row.selected { border-color: rgba(255,79,179,0.65); }
            .coll-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
            .coll-name { font-family: Silkscreen, monospace; font-size: 0.85rem; color: #fff; flex: 1; }
            .coll-item-count { font-family: Quantico, monospace; font-size: 0.75rem; color: rgba(255,255,255,0.3); }
            .coll-detail-header {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 14px 0;
                border-top: 1px solid rgba(255,255,255,0.07);
                flex-wrap: wrap;
            }
            .coll-detail-name { font-family: Silkscreen, monospace; font-size: 1rem; color: #fff; flex: 1; }
            .coll-items-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                gap: 10px;
                margin-bottom: 16px;
            }
            .coll-item-tile {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.10);
                border-radius: 7px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                position: relative;
            }
            .coll-item-thumb-wrap {
                width: 100%; aspect-ratio: 1; background: #111;
                display: flex; align-items: center; justify-content: center; overflow: hidden;
            }
            .coll-item-thumb { width: 100%; height: 100%; object-fit: cover; }
            .coll-item-thumb-ph { font-size: 1.5rem; color: rgba(255,255,255,0.15); }
            .coll-item-label {
                font-family: Quantico, monospace;
                font-size: 0.65rem;
                color: rgba(255,255,255,0.55);
                padding: 6px 8px;
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }
            .btn-remove-item {
                position: absolute; top: 4px; right: 4px;
                background: rgba(0,0,0,0.6);
                border: none; border-radius: 50%;
                color: rgba(255,255,255,0.7);
                font-size: 12px;
                width: 22px; height: 22px;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer;
                opacity: 0; transition: opacity 0.12s;
            }
            .coll-item-tile:hover .btn-remove-item { opacity: 1; }
            .btn-remove-item:focus-visible { outline: 2px solid #00F0FF; opacity: 1; }
            .add-items-panel {
                margin-top: 8px;
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 8px;
                overflow: hidden;
            }
            .add-items-summary {
                padding: 12px 16px;
                font-size: 0.85rem;
                color: rgba(255,255,255,0.5);
                cursor: pointer;
                list-style: none; user-select: none;
            }
            .add-items-summary::-webkit-details-marker { display: none; }
            .add-items-summary:hover { color: rgba(255,255,255,0.75); }
            .all-items-picker {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
                gap: 8px;
                padding: 12px 16px 16px;
                max-height: 260px;
                overflow-y: auto;
            }
            .picker-tile {
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 6px; overflow: hidden;
                cursor: pointer; transition: border-color 0.12s;
                display: flex; flex-direction: column;
            }
            .picker-tile:hover { border-color: rgba(0,240,255,0.35); }
            .picker-tile.in-collection { border-color: rgba(255,79,179,0.5); opacity: 0.45; cursor: default; }
            .picker-tile:focus-visible { outline: 2px solid #00F0FF; outline-offset: 2px; }
            .picker-thumb-wrap {
                width: 100%; aspect-ratio: 1; background: #111;
                display: flex; align-items: center; justify-content: center; overflow: hidden;
            }
            .picker-thumb { width: 100%; height: 100%; object-fit: cover; }
            .picker-ph { font-size: 1.2rem; color: rgba(255,255,255,0.15); }
            .picker-label {
                font-family: Quantico, monospace;
                font-size: 0.6rem; color: rgba(255,255,255,0.5);
                padding: 5px 7px;
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            }
        </style>
    `;
}

export async function mount(el: HTMLElement): Promise<void> {
    const countEl   = el.querySelector<HTMLElement>('#coll-count')!;
    const listEl    = el.querySelector<HTMLElement>('#coll-list')!;
    const emptyMsg  = el.querySelector<HTMLElement>('#coll-empty')!;
    const detailEl  = el.querySelector<HTMLElement>('#coll-detail')!;
    const btnNew    = el.querySelector<HTMLButtonElement>('#btn-new-collection')!;
    const form      = el.querySelector<HTMLFormElement>('#new-coll-form')!;
    const btnCancel = el.querySelector<HTMLButtonElement>('#btn-cancel-new')!;

    let _selectedId: string | null = null;

    const _refresh = async () => {
        const colls = await listCollections();
        countEl.textContent = `${colls.length}`;
        emptyMsg.hidden = colls.length > 0;
        listEl.innerHTML = '';

        for (const c of colls) {
            let itemCount = 0;
            try {
                const items = await getCollectionItems(c.id);
                itemCount = items.length;
            } catch { /* ignore */ }

            const row = _makeCollRow(c, itemCount);
            row.addEventListener('click', () => {
                _selectedId = c.id;
                void _selectCollection(c, row, listEl, detailEl, _refresh);
            });
            row.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    _selectedId = c.id;
                    void _selectCollection(c, row, listEl, detailEl, _refresh);
                }
            });
            if (c.id === _selectedId) row.classList.add('selected');
            listEl.appendChild(row);
        }
    };

    btnNew.addEventListener('click', () => {
        form.hidden = false;
        form.querySelector<HTMLInputElement>('#new-coll-name')?.focus();
    });
    btnCancel.addEventListener('click', () => { form.hidden = true; form.reset(); });
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (form.querySelector<HTMLInputElement>('#new-coll-name')!).value.trim();
        const desc = (form.querySelector<HTMLInputElement>('#new-coll-desc')!).value.trim();
        if (!name) return;
        await insertCollection(crypto.randomUUID(), name, desc || undefined);
        form.hidden = true;
        form.reset();
        await _refresh();
    });

    await _refresh();
}

async function _selectCollection(
    coll: CollectionRow,
    row: HTMLElement,
    listEl: HTMLElement,
    detailEl: HTMLElement,
    refresh: () => Promise<void>,
): Promise<void> {
    listEl.querySelectorAll('.coll-row').forEach(r => r.classList.remove('selected'));
    row.classList.add('selected');
    detailEl.hidden = false;
    await _renderDetail(coll, detailEl, refresh);
}

async function _renderDetail(
    coll: CollectionRow,
    detailEl: HTMLElement,
    refresh: () => Promise<void>,
): Promise<void> {
    const titleEl    = detailEl.querySelector<HTMLElement>('#coll-detail-title')!;
    const countEl    = detailEl.querySelector<HTMLElement>('#coll-detail-count')!;
    const itemsGrid  = detailEl.querySelector<HTMLElement>('#coll-items-grid')!;
    const itemsEmpty = detailEl.querySelector<HTMLElement>('#coll-items-empty')!;
    const pickerEl   = detailEl.querySelector<HTMLElement>('#all-items-picker')!;
    const btnRename  = detailEl.querySelector<HTMLButtonElement>('#btn-rename')!;
    const btnDelete  = detailEl.querySelector<HTMLButtonElement>('#btn-delete-coll')!;

    titleEl.textContent = coll.name;

    const [collItems, allItems] = await Promise.all([
        getCollectionItems(coll.id),
        listItems(500),
    ]);
    const collItemIds = new Set(collItems.map(i => i.id));

    countEl.textContent = `${collItems.length} item${collItems.length === 1 ? '' : 's'}`;
    itemsEmpty.hidden = collItems.length > 0;
    itemsGrid.innerHTML = '';

    for (const item of collItems) {
        const tile = await _makeCollItemTile(item, async () => {
            await removeItemFromCollection(coll.id, item.id);
            await _renderDetail(coll, detailEl, refresh);
            await refresh();
        });
        itemsGrid.appendChild(tile);
    }

    pickerEl.innerHTML = '';
    for (const item of allItems) {
        const inColl = collItemIds.has(item.id);
        const tile   = await _makePickerTile(item, inColl);
        if (!inColl) {
            tile.addEventListener('click', async () => {
                await addItemToCollection(coll.id, item.id);
                await _renderDetail(coll, detailEl, refresh);
                await refresh();
            });
            tile.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (tile as HTMLElement).click(); }
            });
        }
        pickerEl.appendChild(tile);
    }

    // Rename — inline prompt
    btnRename.onclick = async () => {
        const newName = prompt('New name:', coll.name);
        if (!newName?.trim() || newName.trim() === coll.name) return;
        await updateCollection(coll.id, { name: newName.trim() });
        coll = { ...coll, name: newName.trim() };
        titleEl.textContent = coll.name;
        await refresh();
    };

    // Delete
    btnDelete.onclick = async () => {
        if (!confirm(`Delete "${coll.name}"? Items will NOT be deleted.`)) return;
        await deleteCollection(coll.id);
        detailEl.hidden = true;
        await refresh();
    };
}

async function _makeCollItemTile(item: ItemRow, onRemove: () => Promise<void>): Promise<HTMLElement> {
    const div = document.createElement('div');
    div.className = 'coll-item-tile';
    div.setAttribute('role', 'listitem');

    const heroPhoto = await _getHero(item.id);
    const thumbSrc  = heroPhoto?.thumbnail ? convertFileSrc(heroPhoto.thumbnail) : '';
    const title     = item.title ?? 'Unnamed';

    div.innerHTML = `
        <div class="coll-item-thumb-wrap">
            ${thumbSrc
                ? `<img class="coll-item-thumb" src="${thumbSrc}" alt="${_esc(title)}" />`
                : `<span class="coll-item-thumb-ph" aria-hidden="true">📦</span>`}
        </div>
        <div class="coll-item-label" title="${_esc(title)}">${_esc(title)}</div>
        <button class="btn-remove-item" type="button"
                aria-label="Remove ${_esc(title)} from collection">×</button>
    `;
    div.querySelector('.btn-remove-item')?.addEventListener('click', (e) => {
        e.stopPropagation();
        void onRemove();
    });
    return div;
}

async function _makePickerTile(item: ItemRow, inCollection: boolean): Promise<HTMLElement> {
    const div = document.createElement('div');
    div.className = `picker-tile${inCollection ? ' in-collection' : ''}`;
    div.setAttribute('role', 'listitem');
    if (!inCollection) div.setAttribute('tabindex', '0');
    div.setAttribute('aria-label', `${item.title ?? 'Unnamed'}${inCollection ? ' (already added)' : ''}`);

    const heroPhoto = await _getHero(item.id);
    const thumbSrc  = heroPhoto?.thumbnail ? convertFileSrc(heroPhoto.thumbnail) : '';
    const title     = item.title ?? 'Unnamed';

    div.innerHTML = `
        <div class="picker-thumb-wrap">
            ${thumbSrc
                ? `<img class="picker-thumb" src="${thumbSrc}" alt="${_esc(title)}" />`
                : `<span class="picker-ph" aria-hidden="true">📦</span>`}
        </div>
        <div class="picker-label" title="${_esc(title)}">${_esc(title)}</div>
    `;
    return div;
}

function _makeCollRow(coll: CollectionRow, itemCount: number): HTMLElement {
    const div = document.createElement('div');
    div.className = 'coll-row';
    div.setAttribute('role', 'listitem');
    div.setAttribute('tabindex', '0');
    div.setAttribute('data-coll-id', coll.id);
    div.setAttribute('aria-label', `${coll.name}, ${itemCount} items`);
    div.innerHTML = `
        <span class="coll-dot" style="background:${coll.color ?? '#FF4FB3'}" aria-hidden="true"></span>
        <span class="coll-name">${_esc(coll.name)}</span>
        <span class="coll-item-count">${itemCount} item${itemCount === 1 ? '' : 's'}</span>
    `;
    return div;
}

async function _getHero(itemId: string): Promise<PhotoRow | null> {
    try {
        const photos = await listPhotosForItem(itemId);
        return photos.find(p => p.is_hero) ?? photos[0] ?? null;
    } catch { return null; }
}

function _esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}
