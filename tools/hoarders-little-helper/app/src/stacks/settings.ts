import { getSetting, setSetting } from '../db/index';
import { aiService } from '../../../backend/ai-service/index';

export function render(): string {
    return `
        <div class="stack-view">
            <div class="stack-header">
                <span class="stack-header-icon" aria-hidden="true">⚙️</span>
                <h1 class="stack-title">Settings</h1>
            </div>

            <!-- ── AI Provider ── -->
            <div class="settings-group">
                <div class="settings-label">AI Provider — Anthropic</div>
                <div class="settings-value text" id="ai-status">Checking…</div>

                <div class="api-key-row" id="api-key-row">
                    <input type="password"
                           id="api-key-input"
                           class="api-key-input text"
                           placeholder="sk-ant-…"
                           aria-label="Anthropic API key"
                           autocomplete="off"
                           spellcheck="false" />
                    <button class="hlh-btn" id="btn-save-key" type="button">Save Key</button>
                    <button class="hlh-btn hlh-btn-ghost" id="btn-clear-key" type="button">Clear</button>
                </div>
                <p class="settings-hint text">
                    Used for photo classification, OCR, and PDF import.
                    Keys are stored locally in your SQLite database, never transmitted to Raveling.
                </p>
            </div>

            <!-- ── Library ── -->
            <div class="settings-group">
                <div class="settings-label">Library Location</div>
                <div class="settings-value text" id="lib-path">
                    Using default app data directory.
                </div>
            </div>

            <!-- ── Marketplace ── -->
            <div class="settings-group">
                <div class="settings-label">Marketplace Credentials</div>
                <div class="settings-value text">No connections configured. (Phase 8)</div>
            </div>
        </div>
    `;
}

export async function mount(el: HTMLElement): Promise<void> {
    const statusEl = el.querySelector('#ai-status')!;
    const input    = el.querySelector('#api-key-input')    as HTMLInputElement;
    const btnSave  = el.querySelector('#btn-save-key')     as HTMLButtonElement;
    const btnClear = el.querySelector('#btn-clear-key')    as HTMLButtonElement;

    // ── Load current key ───────────────────────────────────────────────────────
    const stored = await getSetting('anthropic_api_key');
    if (stored) {
        input.value       = stored;
        statusEl.textContent = '✓ API key configured — AI features enabled.';
        statusEl.setAttribute('style', 'color: #A7FF00');
    } else {
        statusEl.textContent = 'No API key. AI features (vision, OCR) disabled.';
        statusEl.setAttribute('style', 'color: rgba(255,255,255,0.4)');
    }

    // ── Save ───────────────────────────────────────────────────────────────────
    btnSave.addEventListener('click', async () => {
        const key = input.value.trim();
        if (!key) { statusEl.textContent = 'Key cannot be empty.'; return; }
        if (!key.startsWith('sk-ant-')) {
            statusEl.textContent = 'Key should start with sk-ant-';
            return;
        }

        await setSetting('anthropic_api_key', key);
        aiService.setApiKey(key);
        statusEl.textContent = '✓ Saved — AI features enabled.';
        statusEl.setAttribute('style', 'color: #A7FF00');
    });

    // ── Clear ──────────────────────────────────────────────────────────────────
    btnClear.addEventListener('click', async () => {
        input.value = '';
        await setSetting('anthropic_api_key', '');
        aiService.setApiKey('');
        statusEl.textContent = 'API key cleared.';
        statusEl.removeAttribute('style');
    });
}
