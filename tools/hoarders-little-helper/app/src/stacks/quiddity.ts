import {
    listQthreads, setQthreadEnabled, listWishlists, insertWishlist,
    searchQuiddityItems, getWishlistItems,
    type QThreadRegistryRow, type QuiddityItemRow, type WishlistRow,
} from '../db/index';
import { registry } from '../services/qthread-registry';

type TabId = 'threads' | 'browser' | 'wishlists' | 'import-queue';

let _activeTab: TabId = 'threads';

export function render(): string {
    return `
        <div class="stack-view">
            <div class="stack-header">
                <span class="stack-header-icon" aria-hidden="true">🧵</span>
                <h1 class="stack-title">Quiddity</h1>
            </div>

            <div class="q-tabs" role="tablist" aria-label="Quiddity sections">
                ${_tab('threads',      '🧵 Q-Threads')}
                ${_tab('browser',      '🔍 Browser')}
                ${_tab('wishlists',    '✨ Wishlists')}
                ${_tab('import-queue', '📥 Import Queue')}
            </div>

            <div id="q-tab-content" class="q-tab-content"></div>
        </div>
    `;
}

export async function mount(el: HTMLElement): Promise<void> {
    // Wire tabs
    el.querySelectorAll('[data-tab]').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = (btn as HTMLElement).dataset['tab'] as TabId;
            _switchTab(el, id);
        });
    });

    await _switchTab(el, _activeTab);
}

// ── Tab switching ─────────────────────────────────────────────────────────────

async function _switchTab(el: HTMLElement, id: TabId): Promise<void> {
    _activeTab = id;

    // Update aria state
    el.querySelectorAll('[data-tab]').forEach(btn => {
        const isActive = (btn as HTMLElement).dataset['tab'] === id;
        btn.setAttribute('aria-selected', String(isActive));
        btn.classList.toggle('active', isActive);
    });

    const content = el.querySelector('#q-tab-content') as HTMLElement;
    content.innerHTML = '<div class="q-loading text">Loading…</div>';

    switch (id) {
        case 'threads':      await _renderThreads(content, el);    break;
        case 'browser':      await _renderBrowser(content, el);    break;
        case 'wishlists':    await _renderWishlists(content, el);  break;
        case 'import-queue': await _renderImportQueue(content, el); break;
    }
}

// ── Threads tab ───────────────────────────────────────────────────────────────

async function _renderThreads(content: HTMLElement, root: HTMLElement): Promise<void> {
    const rows = await listQthreads();

    content.innerHTML = `
        ${rows.length === 0 ? `
            <div class="q-empty text">
                No Q-Threads installed yet.<br>
                Add a thread module to <code>q-threads/</code> and register it in the runtime.
            </div>` : `
            <div class="q-thread-list" role="list">
                ${rows.map(r => _threadRow(r)).join('')}
            </div>`
        }
    `;

    // Wire enable/disable toggles
    content.querySelectorAll('[data-thread-toggle]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const el      = btn as HTMLElement;
            const id      = el.dataset['threadId']!;
            const enabled = el.dataset['threadEnabled'] === '1';
            await registry.setEnabled(id, !enabled);
            await _renderThreads(content, root);
        });
    });
}

function _threadRow(r: QThreadRegistryRow): string {
    const enabled = r.enabled === 1;
    return `
        <div class="q-thread-row" role="listitem">
            <div class="q-thread-info">
                <span class="q-thread-name">${_esc(r.name)}</span>
                <span class="q-thread-version">v${_esc(r.version)}</span>
            </div>
            <div class="q-thread-meta">
                <span class="q-thread-id">${_esc(r.id)}</span>
                <span class="q-thread-priority">priority: ${r.priority}</span>
            </div>
            <button class="hlh-btn ${enabled ? 'hlh-btn-active' : 'hlh-btn-ghost'} q-thread-toggle"
                    data-thread-toggle
                    data-thread-id="${_esc(r.id)}"
                    data-thread-enabled="${r.enabled}"
                    aria-pressed="${enabled}"
                    aria-label="${enabled ? 'Disable' : 'Enable'} ${_esc(r.name)}">
                ${enabled ? 'Enabled' : 'Disabled'}
            </button>
        </div>
    `;
}

// ── Browser tab ───────────────────────────────────────────────────────────────

async function _renderBrowser(content: HTMLElement, root: HTMLElement): Promise<void> {
    content.innerHTML = `
        <div class="q-search-bar">
            <input type="search" id="q-search" class="q-search-input text"
                   placeholder="Search Quiddity Database…"
                   aria-label="Search quiddity items" />
        </div>
        <div id="q-results" class="q-results" role="list" aria-label="Search results">
            <div class="q-empty text">Type to search the Quiddity Database.</div>
        </div>
    `;

    let debounce: ReturnType<typeof setTimeout>;
    const input   = content.querySelector('#q-search') as HTMLInputElement;
    const results = content.querySelector('#q-results') as HTMLElement;

    input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(async () => {
            const q = input.value.trim();
            if (q.length < 2) {
                results.innerHTML = '<div class="q-empty text">Type to search the Quiddity Database.</div>';
                return;
            }
            const rows = await searchQuiddityItems(q);
            if (rows.length === 0) {
                results.innerHTML = `<div class="q-empty text">No results for "${_esc(q)}".</div>`;
                return;
            }
            results.innerHTML = rows.map(r => _quiddityCard(r)).join('');
        }, 250);
    });
}

function _quiddityCard(r: QuiddityItemRow): string {
    return `
        <div class="q-card" role="listitem">
            <div class="q-card-qid">${_esc(r.qid)}</div>
            <div class="q-card-name">${_esc(r.canonical_name)}</div>
            ${r.subtitle ? `<div class="q-card-sub">${_esc(r.subtitle)}</div>` : ''}
            <span class="q-card-type">${_esc(r.type)}</span>
        </div>
    `;
}

// ── Wishlists tab ─────────────────────────────────────────────────────────────

async function _renderWishlists(content: HTMLElement, root: HTMLElement): Promise<void> {
    const lists = await listWishlists();

    content.innerHTML = `
        <div class="q-wl-actions">
            <button class="hlh-btn" id="btn-new-wl" type="button">+ New Wishlist</button>
        </div>
        <form id="new-wl-form" hidden class="q-wl-form">
            <input id="new-wl-name" type="text" class="q-input text"
                   placeholder="Wishlist name" required aria-label="Wishlist name" />
            <div class="form-actions">
                <button class="hlh-btn" type="submit">Create</button>
                <button class="hlh-btn hlh-btn-ghost" type="button" id="btn-cancel-wl">Cancel</button>
            </div>
        </form>

        ${lists.length === 0
            ? '<div class="q-empty text">No wishlists yet. Create one to track items you want to find.</div>'
            : `<div class="q-wl-list" role="list">${lists.map(l => _wishlistRow(l)).join('')}</div>`
        }
    `;

    const btnNew    = content.querySelector('#btn-new-wl')!;
    const form      = content.querySelector('#new-wl-form') as HTMLFormElement;
    const btnCancel = content.querySelector('#btn-cancel-wl')!;

    btnNew.addEventListener('click', () => {
        form.hidden = false;
        (form.querySelector('#new-wl-name') as HTMLInputElement).focus();
    });
    btnCancel.addEventListener('click', () => { form.hidden = true; form.reset(); });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = (form.querySelector('#new-wl-name') as HTMLInputElement).value.trim();
        if (!name) return;
        await insertWishlist(crypto.randomUUID(), name);
        await _renderWishlists(content, root);
    });

    // Wire expand buttons
    content.querySelectorAll('[data-expand-wl]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = (btn as HTMLElement).dataset['expandWl']!;
            const items = await getWishlistItems(id);
            const detail = content.querySelector(`#wl-detail-${id}`);
            if (detail) {
                detail.innerHTML = items.length === 0
                    ? '<span class="q-empty text">Empty wishlist.</span>'
                    : items.map(i => `
                        <div class="wl-item-row">
                            <span class="wl-item-qid">${_esc(i.qid)}</span>
                            ${i.notes ? `<span class="wl-item-notes">${_esc(i.notes)}</span>` : ''}
                        </div>`).join('');
            }
        });
    });
}

function _wishlistRow(wl: WishlistRow): string {
    return `
        <div class="q-wl-row" role="listitem">
            <button class="q-wl-expand" data-expand-wl="${_esc(wl.id)}"
                    aria-expanded="false" aria-controls="wl-detail-${_esc(wl.id)}">
                <span class="q-wl-name">${_esc(wl.name)}</span>
                <span class="q-wl-meta">${wl.thread_id ? _esc(wl.thread_id) : 'manual'}</span>
                <span class="q-wl-chevron" aria-hidden="true">▶</span>
            </button>
            <div id="wl-detail-${_esc(wl.id)}" class="q-wl-detail" hidden></div>
        </div>
    `;
}

// ── Import Queue tab ──────────────────────────────────────────────────────────

async function _renderImportQueue(content: HTMLElement, _root: HTMLElement): Promise<void> {
    content.innerHTML = `
        <div class="q-empty text">
            Import queue is not yet active.<br>
            Q-Thread import sources will appear here when threads with import capability are installed.
        </div>
        <ravel-job-monitor channel="qthread-import" style="margin-top: 16px;"></ravel-job-monitor>
    `;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _tab(id: TabId, label: string): string {
    const active = _activeTab === id;
    return `
        <button class="q-tab ${active ? 'active' : ''}"
                role="tab" data-tab="${id}"
                aria-selected="${active}"
                id="q-tab-${id}"
                aria-controls="q-tab-content">
            ${label}
        </button>`;
}

function _esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
