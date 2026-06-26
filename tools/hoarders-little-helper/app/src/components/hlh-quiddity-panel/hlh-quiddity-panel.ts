/**
 * hlh-quiddity-panel
 *
 * Shows Q-Thread evidence for one item. Displays per-thread confidence pills,
 * proposed field values, and per-field "Apply" buttons for human approval.
 *
 * Attributes:
 *   item-id  — string — ID of the inventory item to display evidence for
 *
 * Events emitted (bubbles+composed):
 *   hlh-field-applied  — detail: { itemId, field, value, eventId }
 */

import { approveResearchEvent, listResearchEventsForItem, type ResearchEventRow } from '../../db/index';
import { updateItem } from '../../db/index';
import type { ThreadEvidence } from '../../services/qthread-registry';

class HlhQuiddityPanel extends HTMLElement {
    static get observedAttributes(): string[] { return ['item-id']; }

    private _root: ShadowRoot;

    constructor() {
        super();
        this._root = this.attachShadow({ mode: 'open' });
    }

    connectedCallback(): void { this._load(); }

    attributeChangedCallback(_: string, prev: string | null, next: string | null): void {
        if (prev !== next) this._load();
    }

    // ── Public ────────────────────────────────────────────────────────────────

    async refresh(): Promise<void> { await this._load(); }

    // ── Internal ──────────────────────────────────────────────────────────────

    private async _load(): Promise<void> {
        const itemId = this.getAttribute('item-id');
        if (!itemId) { this._renderEmpty(); return; }

        const events = await listResearchEventsForItem(itemId);
        this._render(itemId, events);
    }

    private _renderEmpty(): void {
        this._root.innerHTML = `<style>${STYLES}</style>
            <div class="empty">No item selected.</div>`;
    }

    private _render(itemId: string, events: ResearchEventRow[]): void {
        const matchEvents  = events.filter(e => e.cmd === 'match' && e.result);
        const visionEvents = events.filter(e => e.cmd === 'classify' || e.cmd === 'extract');

        this._root.innerHTML = `<style>${STYLES}</style>
            <div class="panel">
                <div class="panel-header">Q-Thread Evidence</div>
                ${matchEvents.length === 0
                    ? '<div class="empty">No evidence yet — save the item to run Q-Threads.</div>'
                    : matchEvents.map(ev => this._renderEvent(ev)).join('')
                }

                ${visionEvents.length > 0 ? `
                <div class="panel-header" style="margin-top:16px;">Vision & OCR</div>
                ${visionEvents.map(ev => this._renderVisionEvent(ev)).join('')}
                ` : ''}

                ${events.length > 0 ? `
                <div class="panel-header" style="margin-top:16px;">Research History</div>
                <ravel-research-log id="rlog-${_esc(itemId)}"></ravel-research-log>
                ` : ''}
            </div>`;

        // Wire Apply buttons
        this._root.querySelectorAll('[data-apply]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const el      = btn as HTMLElement;
                const eventId = el.dataset['eventId']!;
                const field   = el.dataset['field']!;
                const value   = el.dataset['value']!;
                await this._applyField(itemId, field, value, eventId);
                el.textContent = '✓';
                el.setAttribute('disabled', '');
            });
        });

        // Populate research log
        const rlog = this._root.querySelector(`#rlog-${_esc(itemId)}`) as any;
        if (rlog?.setEntries) {
            const logEntries = events.map(ev => ({
                id:          ev.id,
                timestamp:   ev.created_at,
                service:     ev.service,
                cmd:         ev.cmd,
                confidence:  ev.confidence,
                source:      ev.source,
                approved_at: ev.approved_at,
                summary:     _eventSummary(ev),
            }));
            rlog.setEntries(logEntries);
        }
    }

    private _renderVisionEvent(ev: ResearchEventRow): string {
        let data: Record<string, unknown>;
        try { data = JSON.parse(ev.result ?? '{}'); } catch { return ''; }

        const isOcr     = ev.cmd === 'extract';
        const approved  = ev.approved_at ? '<span class="approved-badge">approved</span>' : '';
        const conf      = ev.confidence ?? 0;
        const itemId    = this.getAttribute('item-id')!;

        if (isOcr) {
            const fields: [string, unknown][] = Object.entries(data)
                .filter(([k, v]) => k !== 'other_text' && v != null && v !== '');
            if (fields.length === 0) return '';

            return `
            <div class="thread-block">
                <div class="thread-header">
                    <span class="thread-id">OCR</span>
                    <ravel-confidence-pill value="${conf}" show-value></ravel-confidence-pill>
                    ${approved}
                </div>
                <div class="proposed-fields">
                    <div class="fields-label">Extracted text</div>
                    ${fields.map(([k, v]) => {
                        if (k === 'other_text') return '';
                        const safeVal = String(v).replace(/"/g, '&quot;');
                        return `
                        <div class="field-row">
                            <span class="field-key">${_esc(k)}</span>
                            <span class="field-val">${_esc(String(v))}</span>
                            <button class="apply-btn" data-apply
                                data-event-id="${_esc(ev.id)}"
                                data-field="${_esc(k)}"
                                data-value="${safeVal}"
                                aria-label="Apply ${_esc(k)}: ${_esc(String(v))}">
                                Apply
                            </button>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        }

        // Vision classify result
        const category = data['category'] as string ?? 'unknown';
        const tags     = Array.isArray(data['tags']) ? data['tags'] as string[] : [];
        const notes    = data['condition_notes'] as string ?? '';

        return `
        <div class="thread-block">
            <div class="thread-header">
                <span class="thread-id">Vision</span>
                <ravel-confidence-pill value="${conf}" show-value></ravel-confidence-pill>
                ${approved}
            </div>
            <div class="match-title">Category: ${_esc(category)}</div>
            ${notes ? `<div class="match-title" style="font-size:0.75rem;color:rgba(255,255,255,0.45)">${_esc(notes)}</div>` : ''}
            ${tags.length > 0 ? `
            <div class="suggested-tags">
                <div class="fields-label">Suggested tags</div>
                <div class="tag-chips">${tags.map(t => `<span class="chip">${_esc(t)}</span>`).join('')}</div>
            </div>` : ''}
            <div class="proposed-fields" style="margin-top:8px;">
                <div class="fields-label">Apply category?</div>
                <div class="field-row">
                    <span class="field-key">category</span>
                    <span class="field-val">${_esc(category)}</span>
                    <button class="apply-btn" data-apply
                        data-event-id="${_esc(ev.id)}"
                        data-field="category"
                        data-value="${_esc(category)}"
                        aria-label="Apply category: ${_esc(category)}">Apply</button>
                </div>
            </div>
        </div>`;
    }

    private _renderEvent(ev: ResearchEventRow): string {
        let evidence: ThreadEvidence;
        try { evidence = JSON.parse(ev.result!); } catch { return ''; }

        const { threadId, matches, tags } = evidence;
        const top = matches[0];

        const approved = ev.approved_at ? ' <span class="approved-badge">approved</span>' : '';

        return `
        <div class="thread-block">
            <div class="thread-header">
                <span class="thread-id">${_esc(threadId)}</span>
                ${top ? `<ravel-confidence-pill value="${top.confidence}" show-value></ravel-confidence-pill>` : ''}
                ${approved}
            </div>

            ${top ? `
                <div class="match-title">${_esc(top.qid)} — ${_esc(top.explanation)}</div>

                ${Object.entries(top.fields).length > 0 ? `
                <div class="proposed-fields">
                    <div class="fields-label">Proposed fields</div>
                    ${Object.entries(top.fields).map(([k, v]) => {
                        if (v == null) return '';
                        const safeVal = String(v).replace(/"/g, '&quot;');
                        return `
                        <div class="field-row">
                            <span class="field-key">${_esc(k)}</span>
                            <span class="field-val">${_esc(String(v))}</span>
                            <button class="apply-btn" data-apply
                                data-event-id="${_esc(ev.id)}"
                                data-field="${_esc(k)}"
                                data-value="${safeVal}"
                                aria-label="Apply ${_esc(k)}: ${_esc(String(v))}">
                                Apply
                            </button>
                        </div>`;
                    }).join('')}
                </div>` : ''}

                ${top.mentions.length > 0 ? `
                <div class="mentions">
                    <div class="fields-label">Mentioned in</div>
                    ${top.mentions.slice(0, 3).map(m => `
                        <div class="mention-row">
                            <span class="mention-pub">${_esc(m.publication)}</span>
                            ${m.issue  ? `<span class="mention-meta">#${_esc(m.issue)}</span>` : ''}
                            ${m.page   ? `<span class="mention-meta">p.${_esc(m.page)}</span>` : ''}
                            <ravel-confidence-pill value="${m.confidence}"></ravel-confidence-pill>
                        </div>
                    `).join('')}
                </div>` : ''}
            ` : ''}

            ${tags.length > 0 ? `
                <div class="suggested-tags">
                    <div class="fields-label">Suggested tags</div>
                    <div class="tag-chips">
                        ${tags.map(t => `<span class="chip">${_esc(t)}</span>`).join('')}
                    </div>
                </div>` : ''}
        </div>`;
    }

    private async _applyField(
        itemId: string, field: string, value: string, eventId: string
    ): Promise<void> {
        const numFields = new Set(['year']);
        const parsed: Record<string, string | number | null> = {
            [field]: numFields.has(field) ? (parseInt(value, 10) || null) : value,
        };

        await Promise.all([
            updateItem(itemId, parsed as Parameters<typeof updateItem>[1]),
            approveResearchEvent(eventId),
        ]);

        this.dispatchEvent(new CustomEvent('hlh-field-applied', {
            bubbles: true, composed: true,
            detail:  { itemId, field, value, eventId },
        }));
    }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = `
    :host { display: block; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    .panel {
        font-family: var(--ravel-font, 'Quantico', monospace);
        font-size: 0.82rem;
    }

    .panel-header {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255,255,255,0.35);
        padding: 0 0 8px 0;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        margin-bottom: 12px;
    }

    .empty {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.25);
        font-style: italic;
        padding: 8px 0;
    }

    .thread-block {
        padding: 12px 0;
        border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .thread-block:last-child { border-bottom: none; }

    .thread-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 6px;
    }

    .thread-id {
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: rgba(255,255,255,0.4);
    }

    .approved-badge {
        font-size: 0.65rem;
        color: #A7FF00;
        background: rgba(167,255,0,0.10);
        border: 1px solid rgba(167,255,0,0.25);
        border-radius: 999px;
        padding: 1px 7px;
    }

    .match-title {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.75);
        margin-bottom: 8px;
    }

    .fields-label {
        font-size: 0.65rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255,255,255,0.25);
        margin-bottom: 5px;
    }

    .proposed-fields, .mentions, .suggested-tags { margin-bottom: 8px; }

    .field-row {
        display: grid;
        grid-template-columns: 90px 1fr auto;
        align-items: center;
        gap: 6px;
        padding: 4px 0;
        border-top: 1px solid rgba(255,255,255,0.04);
    }

    .field-key {
        color: rgba(255,255,255,0.4);
        font-size: 0.75rem;
    }

    .field-val {
        color: rgba(255,255,255,0.8);
        font-size: 0.8rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .apply-btn {
        appearance: none;
        background: rgba(0,240,255,0.10);
        border: 1px solid rgba(0,240,255,0.3);
        border-radius: 3px;
        color: #00F0FF;
        font-family: inherit;
        font-size: 0.7rem;
        font-weight: 700;
        padding: 2px 8px;
        cursor: pointer;
        min-height: 28px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        transition: background 0.1s;
    }
    .apply-btn:hover:not([disabled]) { background: rgba(0,240,255,0.2); }
    .apply-btn:focus-visible { outline: 2px solid #00F0FF; outline-offset: 2px; }
    .apply-btn[disabled] {
        background: rgba(167,255,0,0.10);
        border-color: rgba(167,255,0,0.3);
        color: #A7FF00;
        cursor: default;
    }

    .mention-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 0;
        font-size: 0.78rem;
    }
    .mention-pub  { color: rgba(255,255,255,0.7); flex: 1; }
    .mention-meta { color: rgba(255,255,255,0.35); font-size: 0.72rem; }

    .tag-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
        font-size: 0.72rem;
        padding: 2px 8px;
        border-radius: 999px;
        background: rgba(179,0,255,0.12);
        border: 1px solid rgba(179,0,255,0.3);
        color: #B300FF;
    }
`;

function _esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _eventSummary(ev: ResearchEventRow): string {
    if (!ev.result) return ev.cmd;
    try {
        const data = JSON.parse(ev.result);
        if (ev.cmd === 'match' && data.matches?.[0]) {
            return `Match: ${data.matches[0].qid} — ${Math.round((data.matches[0].confidence ?? 0) * 100)}% confidence`;
        }
        if (ev.cmd === 'classify') {
            return `Category classified as "${data.category ?? '?'}"`;
        }
        if (ev.cmd === 'extract') {
            const parts: string[] = [];
            if (data.isbn)  parts.push(`ISBN ${data.isbn}`);
            if (data.title) parts.push(`"${data.title}"`);
            if (data.author) parts.push(data.author);
            return parts.length ? `OCR: ${parts.join(' · ')}` : 'OCR: no structured text found';
        }
    } catch { /* ignore */ }
    return ev.cmd;
}

customElements.define('hlh-quiddity-panel', HlhQuiddityPanel);
