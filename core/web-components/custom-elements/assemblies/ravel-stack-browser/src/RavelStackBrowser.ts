import { RavelElement } from '../../../../common/RavelElement';

interface StackDef {
    id:    string;
    label: string;
    icon:  string;
    count: number | null;
}

/**
 * HyperCard-style stack navigation panel. Reads `<ravel-stack>` children
 * for its list of stacks and tracks which is currently selected.
 *
 * ### Attributes
 * | Attribute       | Type                      | Default          | Description                    |
 * |-----------------|---------------------------|------------------|--------------------------------|
 * | `selected`      | string                    | first stack's id | Active stack id                |
 * | `orientation`   | `vertical \| horizontal`  | `vertical`       | Layout direction               |
 * | `channel`       | string                    | `stack-browser`  | Message channel                |
 *
 * ### Children
 * ```html
 * <ravel-stack id="inbox" label="Inbox" icon="📥" count="3"></ravel-stack>
 * ```
 * `count` renders a badge; omit for none.
 *
 * ### Messages emitted (channel)
 * | cmd      | content          | Trigger               |
 * |----------|------------------|-----------------------|
 * | `select` | `{ id, label }`  | User changes stack    |
 *
 * ### Messages received (channel)
 * | cmd         | content                    | Effect                      |
 * |-------------|----------------------------|-----------------------------|
 * | `set-count` | `{ id: string, count: number }` | Update a stack badge   |
 * | `select`    | `{ id: string }`           | Sync selection externally   |
 *
 * ### DOM events (bubbling, composed)
 * | Event    | detail           | Trigger            |
 * |----------|------------------|--------------------|
 * | `select` | `{ id, label }`  | Stack selected     |
 */
export class RavelStackBrowser extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: block;
            background: #0e0e12;
            border-right: 1px solid rgba(255,255,255,0.08);
            font-family: var(--ravel-font, 'Silkscreen', monospace);
            --stack-accent: var(--ravel-accent, #FF4FB3);
        }
        :host([orientation="horizontal"]) {
            border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        #list {
            display: flex;
            flex-direction: column;
            padding: 8px 0;
            gap: 2px;
            height: 100%;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.08) transparent;
        }
        :host([orientation="horizontal"]) #list {
            flex-direction: row;
            padding: 0;
            height: auto;
            overflow-y: visible;
            overflow-x: auto;
            gap: 0;
        }

        .stack-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 16px;
            border: none;
            border-left: 3px solid transparent;
            border-bottom: none;
            background: none;
            cursor: pointer;
            color: rgba(255,255,255,0.38);
            font-family: inherit;
            font-size: 11px;
            letter-spacing: 0.10em;
            text-transform: uppercase;
            text-align: left;
            width: 100%;
            min-height: 44px;
            box-sizing: border-box;
            flex-shrink: 0;
            transition: color 0.12s, background 0.12s, border-color 0.12s;
        }
        :host([orientation="horizontal"]) .stack-item {
            flex-direction: column;
            width: auto;
            min-width: 72px;
            min-height: 64px;
            padding: 10px 14px 8px;
            border-left: none;
            border-bottom: 3px solid transparent;
            gap: 5px;
            justify-content: center;
        }

        .stack-item:hover {
            background: rgba(255,255,255,0.05);
            color: rgba(255,255,255,0.65);
        }
        .stack-item[aria-selected="true"] {
            color: #fff;
            background: rgba(255,79,179,0.09);
            border-left-color: var(--stack-accent);
        }
        :host([orientation="horizontal"]) .stack-item[aria-selected="true"] {
            border-left-color: transparent;
            border-bottom-color: var(--stack-accent);
        }
        .stack-item:focus-visible {
            outline: 2px solid var(--ravel-focus, #00F0FF);
            outline-offset: -2px;
        }

        .stack-icon {
            font-size: 18px;
            line-height: 1;
            flex-shrink: 0;
            pointer-events: none;
        }
        :host([orientation="horizontal"]) .stack-icon {
            font-size: 22px;
        }

        .stack-label {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            pointer-events: none;
        }
        :host([orientation="horizontal"]) .stack-label {
            flex: none;
            font-size: 9px;
            text-align: center;
        }

        .stack-count {
            font-size: 9px;
            background: var(--stack-accent);
            color: #000;
            padding: 1px 6px;
            border-radius: 8px;
            min-width: 18px;
            text-align: center;
            flex-shrink: 0;
            line-height: 1.6;
            pointer-events: none;
        }
    `;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'selected', 'orientation', 'channel',
        ];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _listEl!: HTMLElement;

    // ── State ─────────────────────────────────────────────────────────────────

    private _selected    = '';
    private _channel     = 'stack-browser';
    private _observer!:  MutationObserver;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        this.setAttribute('role', 'navigation');
        this.removeAttribute('tabindex');

        const style = document.createElement('style');
        style.textContent = RavelStackBrowser.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = `
            <div id="list" role="tablist" aria-label="Stacks" aria-orientation="vertical"></div>
        `;
        this._listEl = this.container.querySelector<HTMLElement>('#list')!;
    }

    protected setup(): void {
        super.setup();

        this._observer = new MutationObserver(() => this._render());
        this._observer.observe(this, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['label', 'icon', 'count'],
        });

        this.subscribe([this._channel]);
        this.addEventListener(this._channel, this._onChannelMessage);
        this._listEl.addEventListener('keydown', this._onKeyDown);

        this._render();
    }

    protected teardown(): void {
        this._observer.disconnect();
        this.unsubscribe([this._channel]);
        this.removeEventListener(this._channel, this._onChannelMessage);
        this._listEl.removeEventListener('keydown', this._onKeyDown);
        super.teardown();
    }

    // ── Attributes ────────────────────────────────────────────────────────────

    attributeChangedCallback(name: string, old: string | null, value: string | null): void {
        super.attributeChangedCallback(name, old, value);
        switch (name) {
            case 'selected':
                this._selected = value ?? '';
                if (this._listEl) this._updateSelection();
                break;
            case 'orientation':
                if (this._listEl) {
                    this._listEl.setAttribute('aria-orientation',
                        value === 'horizontal' ? 'horizontal' : 'vertical');
                }
                break;
            case 'channel':
                if (this._listEl) {
                    this.unsubscribe([this._channel]);
                    this.removeEventListener(this._channel, this._onChannelMessage);
                }
                this._channel = value ?? 'stack-browser';
                if (this._listEl) {
                    this.subscribe([this._channel]);
                    this.addEventListener(this._channel, this._onChannelMessage);
                }
                break;
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private _readStacks(): StackDef[] {
        return Array.from(this.querySelectorAll<HTMLElement>('ravel-stack'))
            .map(el => ({
                id:    el.getAttribute('id') ?? '',
                label: el.getAttribute('label') ?? '',
                icon:  el.getAttribute('icon') ?? '',
                count: el.hasAttribute('count')
                    ? parseInt(el.getAttribute('count')!, 10) : null,
            }))
            .filter(s => s.id);
    }

    private _render(): void {
        if (!this._listEl) return;
        const stacks = this._readStacks();
        if (!this._selected && stacks.length > 0) this._selected = stacks[0].id;

        this._listEl.innerHTML = '';
        for (const s of stacks) {
            const btn = document.createElement('button');
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', String(s.id === this._selected));
            btn.setAttribute('tabindex', s.id === this._selected ? '0' : '-1');
            btn.setAttribute('aria-label', s.label);
            btn.dataset.id    = s.id;
            btn.dataset.label = s.label;
            btn.className     = 'stack-item';

            const countHtml = s.count !== null
                ? `<span class="stack-count" aria-label="${s.count} items">${s.count}</span>`
                : '';

            btn.innerHTML = `
                <span class="stack-icon" aria-hidden="true">${s.icon}</span>
                <span class="stack-label">${s.label}</span>
                ${countHtml}
            `;
            btn.addEventListener('click', () => this._select(s.id, s.label));
            this._listEl.appendChild(btn);
        }
    }

    // ── Selection ─────────────────────────────────────────────────────────────

    private _select(id: string, label: string): void {
        if (id === this._selected) return;
        this._selected = id;
        this._updateSelection();
        this.sendMessage(this._channel, 'select', { id, label });
        this.broadcastMessage(this._channel, 'select', { id, label });
        this.dispatchEvent(new CustomEvent('select', {
            bubbles: true, composed: true, detail: { id, label },
        }));
    }

    private _updateSelection(): void {
        this._listEl.querySelectorAll<HTMLElement>('.stack-item').forEach(btn => {
            const sel = btn.dataset.id === this._selected;
            btn.setAttribute('aria-selected', String(sel));
            btn.setAttribute('tabindex', sel ? '0' : '-1');
        });
    }

    // ── Keyboard ──────────────────────────────────────────────────────────────

    private _onKeyDown = (e: KeyboardEvent): void => {
        const items = Array.from(this._listEl.querySelectorAll<HTMLElement>('.stack-item'));
        if (!items.length) return;

        const focused = this.shadowRoot!.activeElement as HTMLElement | null;
        const idx = focused ? items.indexOf(focused) : -1;

        const isHoriz = this.getAttribute('orientation') === 'horizontal';
        let target: HTMLElement | null = null;

        if (e.key === (isHoriz ? 'ArrowRight' : 'ArrowDown'))
            target = items[Math.min(items.length - 1, idx + 1)];
        if (e.key === (isHoriz ? 'ArrowLeft' : 'ArrowUp'))
            target = items[Math.max(0, idx - 1)];
        if (e.key === 'Home') target = items[0];
        if (e.key === 'End')  target = items[items.length - 1];

        if (target) {
            e.preventDefault();
            target.focus();
            this._select(target.dataset.id!, target.dataset.label!);
        }
    };

    // ── Messages ──────────────────────────────────────────────────────────────

    private _onChannelMessage = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent).detail ?? {};

        if (cmd === 'set-count') {
            const { id, count } = content as { id: string; count: number };
            const stackEl = this.querySelector(`ravel-stack[id="${id}"]`);
            if (stackEl) stackEl.setAttribute('count', String(count));
        }

        if (cmd === 'select') {
            const { id } = content as { id: string };
            if (id !== this._selected) {
                this._selected = id;
                this._updateSelection();
            }
        }
    };
}
