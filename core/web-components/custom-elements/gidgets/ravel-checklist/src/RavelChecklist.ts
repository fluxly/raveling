import { RavelElement } from '../../../../common/RavelElement';

/**
 * Checklist of labelled rules with pass / warn / fail / pending status.
 * Emits `checklist-change` on channel whenever any item changes.
 *
 * ### Attributes
 * | Attribute | Type   | Default | Description                         |
 * |-----------|--------|---------|-------------------------------------|
 * | `items`   | JSON   | `[]`    | Array of ChecklistItem              |
 * | `channel` | string | `""`    | Pub/sub channel                     |
 *
 * ### ChecklistItem shape
 * `{ label: string, status: 'pass'|'warn'|'fail'|'pending', message?: string, required?: boolean }`
 *
 * ### Messages received
 * | cmd           | content                                    | Effect               |
 * |---------------|--------------------------------------------|----------------------|
 * | `set-items`   | `ChecklistItem[]`                          | Replace all rows     |
 * | `update-item` | `{ index: number, status, message? }`      | Update one row       |
 *
 * ### Messages emitted
 * | cmd                | content                                | When                |
 * |--------------------|----------------------------------------|---------------------|
 * | `checklist-change` | `{ allPass, hasWarn, hasFail }`        | After any change    |
 */

export interface ChecklistItem {
    label:    string;
    status:   'pass' | 'warn' | 'fail' | 'pending';
    message?: string;
    required?: boolean;
}

const ICON: Record<ChecklistItem['status'], string> = {
    pass:    '✅',
    warn:    '⚠️',
    fail:    '❌',
    pending: '⏳',
};

export class RavelChecklist extends RavelElement {
    static get observedAttributes(): string[] { return ['items', 'channel']; }

    private _items: ChecklistItem[] = [];

    protected initialize(): void {
        super.initialize();
        this.shadowRoot!.innerHTML = `<style>${STYLES}</style><ul class="checklist" role="list" aria-label="Checklist"></ul>`;
        this._parseItems();
        this._render();
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (prev === next) return;
        if (name === 'items') { this._parseItems(); this._render(); }
    }

    // ── Messaging ─────────────────────────────────────────────────────────────

    private _onMessage = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent).detail ?? {};
        if (cmd === 'set-items' && Array.isArray(content)) {
            this._items = content as ChecklistItem[];
            this._render();
            this._emitChange();
        } else if (cmd === 'update-item' && typeof content?.index === 'number') {
            const row = this._items[content.index];
            if (row) {
                row.status  = content.status ?? row.status;
                row.message = content.message ?? row.message;
                this._render();
                this._emitChange();
            }
        }
    };

    protected setup(): void {
        super.setup();
        const ch = this.getAttribute('channel');
        if (ch) { this.subscribe([ch]); this.addEventListener(ch, this._onMessage); }
    }

    protected teardown(): void {
        const ch = this.getAttribute('channel');
        if (ch) { this.unsubscribe([ch]); this.removeEventListener(ch, this._onMessage); }
        super.teardown();
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private _parseItems(): void {
        try {
            const raw = this.getAttribute('items');
            this._items = raw ? (JSON.parse(raw) as ChecklistItem[]) : [];
        } catch { this._items = []; }
    }

    private _render(): void {
        const ul = this.shadowRoot?.querySelector('.checklist');
        if (!ul) return;
        ul.innerHTML = this._items.length === 0
            ? '<li class="empty" role="listitem">No checks defined.</li>'
            : this._items.map((item, i) => `
                <li class="row" role="listitem" data-status="${item.status}" data-index="${i}">
                    <span class="icon" aria-hidden="true">${ICON[item.status]}</span>
                    <span class="label">${_esc(item.label)}${item.required ? ' <span class="req" aria-label="required">*</span>' : ''}</span>
                    ${item.message ? `<span class="msg">${_esc(item.message)}</span>` : ''}
                </li>`).join('');
    }

    private _emitChange(): void {
        const ch = this.getAttribute('channel');
        if (!ch) return;
        const allPass = this._items.every(i => i.status === 'pass' || (!i.required && i.status === 'warn'));
        const hasWarn = this._items.some(i => i.status === 'warn');
        const hasFail = this._items.some(i => i.status === 'fail');
        this.sendMessage(ch, 'checklist-change', { allPass, hasWarn, hasFail }, 1);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    setItems(items: ChecklistItem[]): void {
        this._items = items;
        this._render();
        this._emitChange();
    }

    getItems(): ChecklistItem[] { return [...this._items]; }

    get allPass(): boolean {
        return this._items.every(i => i.status === 'pass' || (!i.required && i.status === 'warn'));
    }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = `
    :host { display: block; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .checklist {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 2px;
        font-family: var(--ravel-font, 'Quantico', monospace);
        font-size: 0.82rem;
    }

    .empty {
        color: rgba(255,255,255,0.25);
        font-style: italic;
        padding: 8px 0;
    }

    .row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 7px 10px;
        border-radius: 5px;
        border: 1px solid transparent;
        transition: background 0.1s;
    }

    .row[data-status="pass"]    { background: rgba(167,255,0,0.06);   border-color: rgba(167,255,0,0.15);   }
    .row[data-status="warn"]    { background: rgba(254,104,16,0.08);  border-color: rgba(254,104,16,0.2);   }
    .row[data-status="fail"]    { background: rgba(255,79,179,0.07);  border-color: rgba(255,79,179,0.18);  }
    .row[data-status="pending"] { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.07); }

    .icon {
        flex-shrink: 0;
        font-size: 0.9rem;
        line-height: 1.3;
    }

    .label {
        flex: 1;
        color: rgba(255,255,255,0.80);
        line-height: 1.4;
    }

    .req { color: #FF4FB3; margin-left: 2px; font-weight: 700; }

    .msg {
        font-size: 0.72rem;
        color: rgba(255,255,255,0.40);
        flex-shrink: 0;
        align-self: center;
    }

    .row[data-status="fail"] .msg  { color: rgba(255,79,179,0.75); }
    .row[data-status="warn"] .msg  { color: rgba(254,104,16,0.75); }
`;

function _esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
