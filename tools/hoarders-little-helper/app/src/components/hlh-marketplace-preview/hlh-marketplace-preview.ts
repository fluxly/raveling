/**
 * hlh-marketplace-preview
 *
 * Shows the live preview + checklist + publish button for one marketplace.
 * The parent (listings stack) passes the plugin id and listing payload as
 * JSON attributes. The component calls plugin.validate() + plugin.preview()
 * and drives ravel-checklist / ravel-abp-button via a private channel.
 *
 * Attributes:
 *   plugin-id   — string — plugin id ('csv', 'abebooks', etc.)
 *   payload     — JSON   — ListingPayload
 *   listing-id  — string — DB listing id (for updating after export)
 *
 * Events emitted (bubbles + composed):
 *   hlh-export-done   detail: { pluginId, listingId, result: ExportResult }
 *   hlh-export-error  detail: { pluginId, listingId, error: string }
 */

import { save }            from '@tauri-apps/plugin-dialog';
import { writeTextFile }   from '@tauri-apps/plugin-fs';
import { getPlugin }       from '../../../../plugins/registry';
import { updateListing }   from '../../db/index';
import type { ListingPayload } from '../../../../plugins/interface';

class HlhMarketplacePreview extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['plugin-id', 'payload', 'listing-id'];
    }

    private _root: ShadowRoot;
    private _channel = '';

    constructor() {
        super();
        this._root = this.attachShadow({ mode: 'open' });
        this._root.innerHTML = `<style>${STYLES}</style><div class="preview-root"></div>`;
    }

    connectedCallback(): void { this._render(); }
    attributeChangedCallback(_: string, p: string | null, n: string | null): void {
        if (p !== n) this._render();
    }

    private _render(): void {
        const pluginId  = this.getAttribute('plugin-id') ?? '';
        const listingId = this.getAttribute('listing-id') ?? '';
        const plugin    = getPlugin(pluginId);
        const root      = this._root.querySelector('.preview-root')!;

        if (!plugin) {
            root.innerHTML = `<div class="empty">Unknown plugin: ${pluginId}</div>`;
            return;
        }

        let payload: ListingPayload;
        try {
            payload = JSON.parse(this.getAttribute('payload') ?? '{}') as ListingPayload;
        } catch {
            root.innerHTML = `<div class="empty">Invalid payload JSON.</div>`;
            return;
        }

        this._channel = `mp-preview-${pluginId}-${listingId || 'new'}`;
        const items   = plugin.validate(payload);
        const preview = plugin.preview(payload);

        root.innerHTML = `
            <div class="plugin-header">
                <span class="plugin-icon">${_esc(plugin.icon)}</span>
                <span class="plugin-name">${_esc(plugin.name)}</span>
            </div>
            <div class="preview-body">${preview}</div>
            <div class="checklist-wrap">
                <ravel-checklist id="cl-${pluginId}"
                    channel="${_esc(this._channel)}"
                    items="${_esc(JSON.stringify(items))}"></ravel-checklist>
            </div>
            <div class="abp-wrap">
                <ravel-abp-button
                    label="Export to ${_esc(plugin.name)}"
                    channel="${_esc(this._channel)}"></ravel-abp-button>
            </div>`;

        // Wait for abp-action, then run export
        root.querySelector('ravel-abp-button')?.addEventListener('abp-action', () => {
            void this._doExport(plugin, payload, listingId);
        });

        // Emit initial checklist state so the ABP button reflects it
        // (The checklist emits checklist-change when its items attr is set,
        //  but that happens in the component's setup. Nudge it after paint.)
        requestAnimationFrame(() => {
            const cl = root.querySelector<any>(`#cl-${pluginId}`);
            cl?.setItems?.(items);
        });
    }

    private async _doExport(
        plugin: ReturnType<typeof getPlugin>,
        payload: ListingPayload,
        listingId: string,
    ): Promise<void> {
        if (!plugin) return;

        const abp = this._root.querySelector<HTMLElement>('ravel-abp-button');
        if (abp) abp.setAttribute('disabled', '');

        try {
            const result = await plugin.export(payload);

            // If the plugin returned file content, show a Tauri save dialog
            if (result.exportContent !== undefined) {
                const path = await save({
                    title:       `Export ${plugin.name}`,
                    defaultPath: result.exportFilename ?? 'export.csv',
                    filters:     [{ name: plugin.name, extensions: ['csv', 'txt'] }],
                });
                if (!path) {
                    if (abp) abp.removeAttribute('disabled');
                    return;
                }
                await writeTextFile(path, result.exportContent);
                result.exportPath = path;
            }

            if (result.success && listingId) {
                await updateListing(listingId, {
                    status:       'active',
                    published_at: new Date().toISOString(),
                    remote_id:    result.remoteId ?? null,
                });
            }

            this.dispatchEvent(new CustomEvent('hlh-export-done', {
                bubbles: true, composed: true,
                detail:  { pluginId: plugin.id, listingId, result },
            }));
        } catch (err) {
            this.dispatchEvent(new CustomEvent('hlh-export-error', {
                bubbles: true, composed: true,
                detail:  { pluginId: plugin.id, listingId, error: String(err) },
            }));
        } finally {
            if (abp) abp.removeAttribute('disabled');
        }
    }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = `
    :host { display: block; }
    * { box-sizing: border-box; }

    .preview-root {
        display: flex;
        flex-direction: column;
        gap: 14px;
        font-family: var(--ravel-font, 'Quantico', monospace);
    }

    .empty {
        color: rgba(255,255,255,0.3);
        font-size: 0.82rem;
        font-family: var(--ravel-font, 'Quantico', monospace);
        padding: 16px 0;
    }

    .plugin-header {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.7rem;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.35);
    }

    .plugin-icon  { font-size: 1.1rem; }
    .plugin-name  { font-weight: 700; font-family: Silkscreen, monospace; }

    .preview-body {
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 6px;
        padding: 14px;
        background: rgba(255,255,255,0.02);
    }

    .checklist-wrap { }
    .abp-wrap       { }

    ravel-checklist    { display: block; }
    ravel-abp-button   { display: block; }
`;

function _esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

customElements.define('hlh-marketplace-preview', HlhMarketplacePreview);
