import { RavelElement } from '../../../../common/RavelElement';

export interface LogEntry {
    id:          string;
    timestamp:   string;   // ISO 8601
    service:     string;   // thread id or service name
    cmd:         string;   // 'match'|'recognize'|'explain'|'value'|etc.
    confidence:  number | null;  // 0–1
    source:      string | null;  // citation string
    approved_at: string | null;  // null = pending
    summary?:    string;   // short human-readable summary
}

/**
 * Timestamped log of research evidence events.
 * Receives entries via channel messages or the `setEntries()` method.
 *
 * ### Attributes
 * | Attribute   | Type   | Default          | Description              |
 * |-------------|--------|------------------|--------------------------|
 * | `channel`   | string | `research-log`   | Message channel          |
 * | `max-items` | number | `100`            | Max entries shown        |
 *
 * ### Messages received (channel)
 * | cmd          | content       | Effect                      |
 * |--------------|---------------|-----------------------------|
 * | `add-entry`  | `LogEntry`    | Prepend an entry            |
 * | `set-entries`| `LogEntry[]`  | Replace all entries         |
 * | `clear`      | `{}`          | Remove all entries          |
 *
 * ### Public methods
 * | Method                       | Description                    |
 * |------------------------------|--------------------------------|
 * | `setEntries(e: LogEntry[])`  | Replace all entries            |
 * | `addEntry(e: LogEntry)`      | Prepend one entry              |
 */
export class RavelResearchLog extends RavelElement {
    static get observedAttributes(): string[] {
        return ['channel', 'max-items'];
    }

    private _entries: LogEntry[] = [];

    // ── Shadow DOM ────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();
        this.shadowRoot!.innerHTML = `
            <style>
                :host { display: block; }

                * { box-sizing: border-box; }

                .log {
                    font-family: var(--ravel-font, 'Quantico', monospace);
                    display: flex;
                    flex-direction: column;
                    gap: 1px;
                }

                .log-empty {
                    font-size: 0.8rem;
                    color: rgba(255,255,255,0.22);
                    font-style: italic;
                    padding: 8px 0;
                }

                .entry {
                    display: grid;
                    grid-template-columns: 80px auto 1fr auto;
                    grid-template-rows: auto auto;
                    gap: 2px 10px;
                    padding: 8px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                    align-items: start;
                }

                .entry:last-child { border-bottom: none; }

                .entry-time {
                    font-size: 0.68rem;
                    color: rgba(255,255,255,0.25);
                    font-variant-numeric: tabular-nums;
                    white-space: nowrap;
                    padding-top: 2px;
                }

                .entry-service {
                    grid-column: 2;
                    font-size: 0.68rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: rgba(0,240,255,0.6);
                    white-space: nowrap;
                    padding-top: 3px;
                }

                .entry-summary {
                    grid-column: 3;
                    font-size: 0.8rem;
                    color: rgba(255,255,255,0.75);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .entry-pill {
                    grid-column: 4;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .entry-source {
                    grid-row: 2;
                    grid-column: 2 / 5;
                    font-size: 0.72rem;
                    color: rgba(255,255,255,0.30);
                    font-style: italic;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .approved-dot {
                    display: inline-block;
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #A7FF00;
                    flex-shrink: 0;
                    title: 'Approved';
                }

                .pending-dot {
                    display: inline-block;
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: rgba(255,255,255,0.15);
                    flex-shrink: 0;
                }
            </style>
            <div class="log" role="log" aria-label="Research evidence log" aria-live="polite"></div>
        `;
        this._renderList();
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    private _onMsg = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent).detail ?? {};
        if (cmd === 'add-entry' && content?.id) {
            this.addEntry(content as LogEntry);
        } else if (cmd === 'set-entries' && Array.isArray(content)) {
            this.setEntries(content as LogEntry[]);
        } else if (cmd === 'clear') {
            this._entries = [];
            this._renderList();
        }
    };

    protected setup(): void {
        super.setup();
        const ch = this.getAttribute('channel') ?? 'research-log';
        this.subscribe([ch]);
        this.addEventListener(ch, this._onMsg);
        this._renderList();
    }

    protected teardown(): void {
        const ch = this.getAttribute('channel') ?? 'research-log';
        this.unsubscribe([ch]);
        this.removeEventListener(ch, this._onMsg);
        super.teardown();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    setEntries(entries: LogEntry[]): void {
        this._entries = [...entries];
        this._renderList();
    }

    addEntry(entry: LogEntry): void {
        const max = parseInt(this.getAttribute('max-items') ?? '100', 10);
        this._entries.unshift(entry);
        if (this._entries.length > max) this._entries.length = max;
        this._renderList();
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private _renderList(): void {
        const root = this.shadowRoot;
        if (!root) return;

        const log = root.querySelector('.log')!;

        if (this._entries.length === 0) {
            log.innerHTML = '<div class="log-empty">No research events yet.</div>';
            return;
        }

        log.innerHTML = this._entries.map(e => this._renderEntry(e)).join('');
    }

    private _renderEntry(e: LogEntry): string {
        const time       = _formatTime(e.timestamp);
        const hasPill    = typeof e.confidence === 'number';
        const approved   = !!e.approved_at;
        const dot        = approved
            ? `<span class="approved-dot" title="Approved" aria-label="Approved"></span>`
            : `<span class="pending-dot"  title="Pending"  aria-label="Pending review"></span>`;
        const summary    = e.summary ?? e.cmd;

        return `
            <div class="entry" role="listitem">
                <span class="entry-time">${_esc(time)}</span>
                <span class="entry-service">${_esc(e.service)}</span>
                <span class="entry-summary">${_esc(summary)}</span>
                <span class="entry-pill">
                    ${hasPill
                        ? `<ravel-confidence-pill value="${e.confidence}"></ravel-confidence-pill>`
                        : ''}
                    ${dot}
                </span>
                ${e.source
                    ? `<span class="entry-source">${_esc(e.source)}</span>`
                    : ''}
            </div>`;
    }
}

function _formatTime(iso: string): string {
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

function _esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
