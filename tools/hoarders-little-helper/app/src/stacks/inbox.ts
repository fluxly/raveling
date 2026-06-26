import { open }         from '@tauri-apps/plugin-dialog';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { appDataDir }  from '@tauri-apps/api/path';
import { v4 as uuidv4 } from 'uuid';
import {
    insertPhoto, listInboxPhotos, deletePhoto, assignPhotoToItem,
    insertItem, PhotoRow,
} from '../db/index';
import '../components/hlh-inbox-card/hlh-inbox-card';

interface ImportedPhoto {
    id:        string;
    original:  string;
    thumbnail: string;
    medium:    string;
    phash:     string;
    width:     number;
    height:    number;
    is_blurry: boolean;
}

interface ImportResult {
    photos: ImportedPhoto[];
    errors: { path: string; message: string }[];
}

export function render(): string {
    return `
        <div class="stack-view">
            <div class="stack-header">
                <span class="stack-header-icon" aria-hidden="true">📥</span>
                <h1 class="stack-title">Inbox</h1>
                <span class="stack-count" id="inbox-count"></span>
            </div>
            <div class="stack-actions">
                <button class="hlh-btn" id="btn-import" type="button">📷 Import Photos</button>
            </div>
            <div id="inbox-grid" class="inbox-grid" aria-live="polite" aria-label="Inbox photos"></div>
            <p id="inbox-empty" class="stack-placeholder text" hidden>
                No photos in inbox. Click Import to start cataloging a new batch.
            </p>
            <div id="inbox-errors" class="inbox-errors" hidden></div>
        </div>
        <style>
            .inbox-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
                gap: 16px;
            }
            .inbox-errors {
                font-family: Quantico, monospace;
                font-size: 0.8rem;
                color: #ff6b6b;
                padding: 12px;
                background: rgba(255,60,60,0.08);
                border: 1px solid rgba(255,60,60,0.2);
                border-radius: 6px;
            }
        </style>
    `;
}

export async function mount(el: HTMLElement): Promise<void> {
    const grid      = el.querySelector<HTMLElement>('#inbox-grid')!;
    const emptyMsg  = el.querySelector<HTMLElement>('#inbox-empty')!;
    const countEl   = el.querySelector<HTMLElement>('#inbox-count')!;
    const errorsEl  = el.querySelector<HTMLElement>('#inbox-errors')!;
    const btnImport = el.querySelector<HTMLButtonElement>('#btn-import')!;

    // Load existing inbox photos
    await _refresh(grid, emptyMsg, countEl);

    // Wire "Create Item" and "Discard" events
    grid.addEventListener('hlh-create-item', async (e: Event) => {
        const { photoId } = (e as CustomEvent<{ photoId: string }>).detail;
        await _createItemFromPhoto(photoId, grid, emptyMsg, countEl);
    });

    grid.addEventListener('hlh-discard', async (e: Event) => {
        const { photoId } = (e as CustomEvent<{ photoId: string }>).detail;
        await deletePhoto(photoId);
        el.querySelector(`[photo-id="${photoId}"]`)?.remove();
        await _updateCount(grid, emptyMsg, countEl);
    });

    // Wire Import button
    btnImport.addEventListener('click', async () => {
        btnImport.disabled = true;
        btnImport.textContent = '⏳ Importing…';
        errorsEl.hidden = true;
        try {
            await _runImport(grid, emptyMsg, countEl, errorsEl);
        } finally {
            btnImport.disabled = false;
            btnImport.textContent = '📷 Import Photos';
        }
    });
}

async function _runImport(
    grid: HTMLElement,
    emptyMsg: HTMLElement,
    countEl: HTMLElement,
    errorsEl: HTMLElement,
): Promise<void> {
    // 1. Open file picker
    const selected = await open({
        multiple: true,
        filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] }],
    });
    if (!selected || (Array.isArray(selected) && selected.length === 0)) return;
    const paths = Array.isArray(selected) ? selected : [selected];

    // 2. Determine library destination
    const dataDir = await appDataDir();
    const destDir = `${dataDir}/photos`;

    // 3. Call Rust import command
    const result = await invoke<ImportResult>('import_photos', { paths, destDir });

    // 4. Persist each photo to DB and add card to grid
    for (const p of result.photos) {
        await insertPhoto({
            id:        p.id,
            item_id:   null,
            original:  p.original,
            thumbnail: p.thumbnail,
            medium:    p.medium,
            phash:     p.phash,
            is_blurry: p.is_blurry,
        });
        grid.appendChild(_makeCard(p.id, p.thumbnail, _basename(p.original), p.is_blurry));
    }

    // 5. Show any errors
    if (result.errors.length > 0) {
        errorsEl.hidden = false;
        errorsEl.innerHTML = `<strong>Failed to import:</strong><ul>` +
            result.errors.map(e => `<li>${_basename(e.path)}: ${e.message}</li>`).join('') +
            `</ul>`;
    }

    await _updateCount(grid, emptyMsg, countEl);
}

async function _refresh(
    grid: HTMLElement,
    emptyMsg: HTMLElement,
    countEl: HTMLElement,
): Promise<void> {
    const photos = await listInboxPhotos();
    grid.innerHTML = '';
    for (const p of photos) {
        grid.appendChild(_makeCard(
            p.id,
            p.thumbnail ?? '',
            _basename(p.original),
            !!p.is_blurry,
        ));
    }
    _updateCountSync(photos.length, emptyMsg, countEl);
}

async function _updateCount(
    grid: HTMLElement,
    emptyMsg: HTMLElement,
    countEl: HTMLElement,
): Promise<void> {
    const n = grid.querySelectorAll('hlh-inbox-card').length;
    _updateCountSync(n, emptyMsg, countEl);
}

function _updateCountSync(n: number, emptyMsg: HTMLElement, countEl: HTMLElement): void {
    countEl.textContent = n > 0 ? `${n}` : '';
    emptyMsg.hidden     = n > 0;
}

async function _createItemFromPhoto(
    photoId: string,
    grid: HTMLElement,
    emptyMsg: HTMLElement,
    countEl: HTMLElement,
): Promise<void> {
    const newItemId = uuidv4();
    await insertItem(newItemId, {});
    await assignPhotoToItem(photoId, newItemId);

    // Remove card from inbox
    grid.querySelector(`[photo-id="${photoId}"]`)?.remove();
    await _updateCount(grid, emptyMsg, countEl);

    // Navigate to Items stack so user can fill in details
    window.dispatchEvent(new CustomEvent('app-nav', {
        detail: { cmd: 'select', content: { id: 'items' } },
    }));
}

function _makeCard(
    id: string,
    thumbPath: string,
    filename: string,
    isBlurry: boolean,
): HTMLElement {
    const card = document.createElement('hlh-inbox-card') as HTMLElement;
    card.setAttribute('photo-id',  id);
    card.setAttribute('thumb-src', thumbPath ? convertFileSrc(thumbPath) : '');
    card.setAttribute('filename',  filename);
    if (isBlurry) card.setAttribute('is-blurry', '');
    return card;
}

function _basename(path: string): string {
    return path.split(/[\\/]/).pop() ?? path;
}
