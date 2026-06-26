import { RavelElement } from '../../../../common/RavelElement';

/**
 * Action Button with Prerequisites — a large prominent button that is enabled
 * only when a paired `ravel-checklist` emits `allPass: true` on the shared channel.
 *
 * ### Attributes
 * | Attribute  | Type   | Default | Description                              |
 * |------------|--------|---------|------------------------------------------|
 * | `label`    | string | `"Publish"` | Button text                         |
 * | `channel`  | string | `""`    | Shared channel with ravel-checklist      |
 * | `disabled` | bool   | false   | Force-disable regardless of checklist    |
 *
 * ### Messages received (channel)
 * | cmd                | content                    | Effect                         |
 * |--------------------|----------------------------|--------------------------------|
 * | `checklist-change` | `{ allPass, hasWarn, ... }`| Enables/disables the button    |
 *
 * ### DOM Events dispatched (bubbles + composed)
 * | Event        | Detail | When                         |
 * |--------------|--------|------------------------------|
 * | `abp-action` | `{}`   | Button clicked while enabled |
 */
export class RavelAbpButton extends RavelElement {
    static get observedAttributes(): string[] { return ['label', 'channel', 'disabled']; }

    private _checklistPassed = false;

    protected initialize(): void {
        super.initialize();
        this.shadowRoot!.innerHTML = `<style>${STYLES}</style>
            <button class="abp" type="button" aria-disabled="true" disabled>
                <span class="abp-icon" aria-hidden="true">🔒</span>
                <span class="abp-label"></span>
            </button>`;
        this._render();
    }

    attributeChangedCallback(_: string, prev: string | null, next: string | null): void {
        if (prev !== next) this._render();
    }

    // ── Messaging ─────────────────────────────────────────────────────────────

    private _onMessage = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent).detail ?? {};
        if (cmd === 'checklist-change') {
            this._checklistPassed = !!content?.allPass;
            this._render();
        }
    };

    protected setup(): void {
        super.setup();
        const ch = this.getAttribute('channel');
        if (ch) { this.subscribe([ch]); this.addEventListener(ch, this._onMessage); }

        this.shadowRoot?.querySelector('.abp')?.addEventListener('click', () => {
            if (!this._isEnabled()) return;
            this.dispatchEvent(new CustomEvent('abp-action', { bubbles: true, composed: true, detail: {} }));
        });
    }

    protected teardown(): void {
        const ch = this.getAttribute('channel');
        if (ch) { this.unsubscribe([ch]); this.removeEventListener(ch, this._onMessage); }
        super.teardown();
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private _isEnabled(): boolean {
        return this._checklistPassed && !this.hasAttribute('disabled');
    }

    private _render(): void {
        const btn   = this.shadowRoot?.querySelector('.abp') as HTMLButtonElement | null;
        const label = this.shadowRoot?.querySelector('.abp-label') as HTMLElement | null;
        const icon  = this.shadowRoot?.querySelector('.abp-icon') as HTMLElement | null;
        if (!btn || !label || !icon) return;

        const enabled = this._isEnabled();
        label.textContent = this.getAttribute('label') ?? 'Publish';
        icon.textContent  = enabled ? '🚀' : '🔒';
        btn.disabled      = !enabled;
        btn.setAttribute('aria-disabled', String(!enabled));
        btn.setAttribute('data-enabled', String(enabled));
    }
}

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLES = `
    :host { display: block; }

    .abp {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        min-height: 52px;
        padding: 12px 24px;
        border-radius: 8px;
        border: 2px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.04);
        cursor: not-allowed;
        font-family: var(--ravel-font, 'Silkscreen', monospace);
        font-size: 0.95rem;
        font-weight: 700;
        letter-spacing: 0.06em;
        color: rgba(255,255,255,0.20);
        transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s;
        user-select: none;
    }

    .abp[data-enabled="true"] {
        background: rgba(167,255,0,0.12);
        border-color: rgba(167,255,0,0.5);
        color: #A7FF00;
        cursor: pointer;
        box-shadow: 0 0 18px rgba(167,255,0,0.18);
    }

    .abp[data-enabled="true"]:hover {
        background: rgba(167,255,0,0.22);
        box-shadow: 0 0 28px rgba(167,255,0,0.28);
    }

    .abp[data-enabled="true"]:active {
        background: rgba(167,255,0,0.30);
        transform: scale(0.98);
    }

    .abp:focus-visible {
        outline: 2px solid #A7FF00;
        outline-offset: 3px;
    }

    .abp-icon { font-size: 1.2rem; line-height: 1; flex-shrink: 0; }
    .abp-label { flex: 1; text-align: center; }
`;
