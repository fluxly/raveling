import { RavelElement } from '../../../../common/RavelElement';

export type JobStatus = 'queued' | 'running' | 'done' | 'error';

export interface Job {
    id:      string;
    label:   string;
    status:  JobStatus;
    progress?: number; // 0–1
    message?: string;
}

/**
 * Background job list with status indicators and progress bars.
 * Receives jobs via channel messages; renders them in a scrollable list.
 *
 * ### Attributes
 * | Attribute   | Type   | Default       | Description               |
 * |-------------|--------|---------------|---------------------------|
 * | `channel`   | string | `job-monitor` | Message channel           |
 * | `max-jobs`  | number | `50`          | Max jobs kept in list     |
 * | `collapsed` | bool   | false         | Collapse to header only   |
 *
 * ### Messages received (channel)
 * | cmd          | content                  | Effect                       |
 * |--------------|--------------------------|------------------------------|
 * | `add-job`    | `Job`                    | Add or replace a job by id   |
 * | `update-job` | `Partial<Job> & {id}`    | Patch a job by id            |
 * | `remove-job` | `{ id: string }`         | Remove a job by id           |
 * | `clear-done` | `{}`                     | Remove all done/error jobs   |
 */
export class RavelJobMonitor extends RavelElement {
    static get observedAttributes(): string[] {
        return ['channel', 'max-jobs', 'collapsed'];
    }

    private _jobs: Map<string, Job> = new Map();

    // ── Shadow DOM ────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();
        this.shadowRoot!.innerHTML = `
            <style>
                :host { display: block; }

                .monitor {
                    font-family: var(--ravel-font, 'Quantico', monospace);
                    background: var(--ravel-surface, #2a2a2a);
                    border: 1px solid rgba(255,255,255,0.10);
                    border-radius: 6px;
                    overflow: hidden;
                }

                .header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 12px;
                    background: rgba(255,255,255,0.04);
                    border-bottom: 1px solid rgba(255,255,255,0.08);
                    cursor: pointer;
                    user-select: none;
                    min-height: 44px;
                }

                .header-title {
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: rgba(255,255,255,0.5);
                }

                .header-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 18px;
                    height: 18px;
                    padding: 0 5px;
                    border-radius: 999px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    background: rgba(255,255,255,0.08);
                    color: rgba(255,255,255,0.5);
                }

                .header-badge[data-running] {
                    background: rgba(0,240,255,0.15);
                    color: #00F0FF;
                }

                .toggle-btn {
                    appearance: none;
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.4);
                    font-size: 0.75rem;
                    cursor: pointer;
                    padding: 4px;
                    min-width: 44px;
                    min-height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .list {
                    max-height: 300px;
                    overflow-y: auto;
                }

                :host([collapsed]) .list { display: none; }

                .job-row {
                    display: grid;
                    grid-template-columns: 1fr auto;
                    grid-template-rows: auto auto;
                    gap: 3px 8px;
                    padding: 10px 12px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .job-row:last-child { border-bottom: none; }

                .job-label {
                    font-size: 0.8rem;
                    color: rgba(255,255,255,0.8);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .job-status {
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .job-status[data-status="queued"]  { color: rgba(255,255,255,0.35); }
                .job-status[data-status="running"] { color: #00F0FF; }
                .job-status[data-status="done"]    { color: #A7FF00; }
                .job-status[data-status="error"]   { color: #FF4FB3; }

                .job-message {
                    grid-column: 1 / -1;
                    font-size: 0.72rem;
                    color: rgba(255,255,255,0.35);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .job-bar-track {
                    grid-column: 1 / -1;
                    height: 3px;
                    background: rgba(255,255,255,0.08);
                    border-radius: 999px;
                    overflow: hidden;
                }

                .job-bar-fill {
                    height: 100%;
                    background: #00F0FF;
                    border-radius: 999px;
                    transition: width 0.2s ease;
                }

                .job-bar-fill[data-status="done"]  { background: #A7FF00; }
                .job-bar-fill[data-status="error"] { background: #FF4FB3; }

                .empty {
                    padding: 20px;
                    text-align: center;
                    font-size: 0.8rem;
                    color: rgba(255,255,255,0.2);
                    font-style: italic;
                }
            </style>
            <div class="monitor" role="region" aria-label="Background jobs">
                <div class="header" role="button" tabindex="0"
                     aria-expanded="true" aria-controls="job-list">
                    <span class="header-title">Jobs</span>
                    <span class="header-badge" id="badge">0</span>
                    <button class="toggle-btn" aria-label="Collapse job list">▲</button>
                </div>
                <div class="list" id="job-list" role="list">
                    <div class="empty">No background jobs</div>
                </div>
            </div>
        `;

        const header = this.shadowRoot!.querySelector('.header')!;
        const btn    = this.shadowRoot!.querySelector('.toggle-btn')!;

        header.addEventListener('click', () => this._toggleCollapsed());
        header.addEventListener('keydown', (e: Event) => {
            const ke = e as KeyboardEvent;
            if (ke.key === 'Enter' || ke.key === ' ') { e.preventDefault(); this._toggleCollapsed(); }
        });
        btn.addEventListener('click', (e: Event) => { e.stopPropagation(); this._toggleCollapsed(); });
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    private _onMsg = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent).detail ?? {};
        if (cmd === 'add-job' && content?.id) {
            this._addOrReplace(content as Job);
        } else if (cmd === 'update-job' && content?.id) {
            this._patchJob(content as Partial<Job> & { id: string });
        } else if (cmd === 'remove-job' && content?.id) {
            this._jobs.delete(content.id);
            this._renderList();
        } else if (cmd === 'clear-done') {
            for (const [id, j] of this._jobs) {
                if (j.status === 'done' || j.status === 'error') this._jobs.delete(id);
            }
            this._renderList();
        }
    };

    protected setup(): void {
        super.setup();
        const ch = this.getAttribute('channel') ?? 'job-monitor';
        this.subscribe([ch]);
        this.addEventListener(ch, this._onMsg);
        this._renderList();
    }

    protected teardown(): void {
        const ch = this.getAttribute('channel') ?? 'job-monitor';
        this.unsubscribe([ch]);
        this.removeEventListener(ch, this._onMsg);
        super.teardown();
    }

    attributeChangedCallback(name: string, prev: string | null, next: string | null): void {
        if (prev === next) return;
        if (name === 'collapsed') {
            const header = this.shadowRoot?.querySelector('.header');
            const btn    = this.shadowRoot?.querySelector('.toggle-btn');
            if (header) header.setAttribute('aria-expanded', String(!this.hasAttribute('collapsed')));
            if (btn) (btn as HTMLElement).textContent = this.hasAttribute('collapsed') ? '▼' : '▲';
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    addJob(job: Job): void { this._addOrReplace(job); }

    updateJob(patch: Partial<Job> & { id: string }): void { this._patchJob(patch); }

    clearDone(): void {
        for (const [id, j] of this._jobs) {
            if (j.status === 'done' || j.status === 'error') this._jobs.delete(id);
        }
        this._renderList();
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private _toggleCollapsed(): void {
        if (this.hasAttribute('collapsed')) {
            this.removeAttribute('collapsed');
        } else {
            this.setAttribute('collapsed', '');
        }
    }

    private _addOrReplace(job: Job): void {
        const max = parseInt(this.getAttribute('max-jobs') ?? '50', 10);
        this._jobs.set(job.id, { ...job });
        // Trim oldest if over limit
        if (this._jobs.size > max) {
            const oldest = this._jobs.keys().next().value;
            if (oldest) this._jobs.delete(oldest);
        }
        this._renderList();
    }

    private _patchJob(patch: Partial<Job> & { id: string }): void {
        const existing = this._jobs.get(patch.id);
        if (!existing) return;
        this._jobs.set(patch.id, { ...existing, ...patch });
        this._renderList();
    }

    private _renderList(): void {
        const root = this.shadowRoot;
        if (!root) return;

        const list  = root.getElementById('job-list')!;
        const badge = root.getElementById('badge')!;
        const jobs  = [...this._jobs.values()].reverse();

        const running = jobs.filter(j => j.status === 'running').length;
        badge.textContent   = String(jobs.length);
        badge.toggleAttribute('data-running', running > 0);

        if (jobs.length === 0) {
            list.innerHTML = '<div class="empty">No background jobs</div>';
            return;
        }

        list.innerHTML = '';
        for (const job of jobs) {
            const row = document.createElement('div');
            row.className  = 'job-row';
            row.setAttribute('role', 'listitem');

            const hasProgress = typeof job.progress === 'number';
            const pct = hasProgress ? Math.round(job.progress! * 100) : 0;

            row.innerHTML = `
                <span class="job-label">${_esc(job.label)}</span>
                <span class="job-status" data-status="${job.status}">${job.status}</span>
                ${job.message ? `<span class="job-message">${_esc(job.message)}</span>` : ''}
                ${hasProgress ? `
                    <div class="job-bar-track" role="progressbar"
                         aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"
                         aria-label="${_esc(job.label)} progress">
                        <div class="job-bar-fill" data-status="${job.status}"
                             style="width:${pct}%"></div>
                    </div>` : ''}
            `;
            list.appendChild(row);
        }
    }
}

function _esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
