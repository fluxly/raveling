import '@raveling/components';
import './components/hlh-inbox-card/hlh-inbox-card';
import './components/hlh-item-card/hlh-item-card';
import './components/hlh-quiddity-panel/hlh-quiddity-panel';
import './components/hlh-description-panel/hlh-description-panel';
import './components/hlh-marketplace-preview/hlh-marketplace-preview';
import './components/hlh-valuation-panel/hlh-valuation-panel';
import './components/hlh-collection-match/hlh-collection-match';
import { initDb, countItems } from './db/index';
import { registry }   from './services/qthread-registry';
import { aiService }  from '../../backend/ai-service/index';
import { Router } from './router';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const statusDb    = document.getElementById('status-db')!;
const statusItems = document.getElementById('status-items')!;
const errorOverlay = document.getElementById('error-overlay')!;
const errorMsg    = document.getElementById('error-msg')!;

function showError(msg: string): void {
    errorMsg.textContent = msg;
    errorOverlay.hidden  = false;
}

async function refreshStatusBar(): Promise<void> {
    try {
        const n = await countItems();
        statusItems.textContent = `${n} item${n === 1 ? '' : 's'}`;
    } catch { /* ignore */ }
}

async function main(): Promise<void> {
    // 1. Initialize database
    statusDb.textContent = 'DB: connecting…';
    try {
        await initDb();
        statusDb.textContent = 'DB: ready';
        await Promise.all([registry.init(), aiService.init()]);
        await refreshStatusBar();
    } catch (err) {
        statusDb.textContent = 'DB: error';
        showError(String(err));
        return;
    }

    // 2. Start the router
    const contentEl = document.getElementById('content')!;
    const router    = new Router(contentEl);

    // 3. Wire up stack-browser navigation
    window.addEventListener('app-nav', (e: Event) => {
        const { cmd, content } = (e as CustomEvent).detail ?? {};
        if (cmd === 'select') {
            router.navigate((content as { id: string }).id);
        }
    });

    // 4. Navigate to the initial stack
    const nav = document.getElementById('nav')!;
    const initialStack = nav.getAttribute('selected') ?? 'inbox';
    router.navigate(initialStack);

    // 5. Global keyboard shortcut: Cmd/Ctrl+S → save the visible item card
    document.addEventListener('keydown', (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            const card = document.querySelector<any>('hlh-item-card');
            card?.save?.();
        }
    });
}

main().catch(err => showError(String(err)));
