import { RavelElement } from '../../../../common/RavelElement';

type DockPosition = 'left' | 'right' | 'top' | 'bottom';

/**
 * A fixed-position floating dock that accepts component registrations and
 * displays them as icon buttons. Clicking an item toggles maximize/minimize.
 *
 * ### Attributes
 * | Attribute  | Type                        | Default       | Description                         |
 * |------------|-----------------------------|---------------|-------------------------------------|
 * | `label`    | string                      | `ravel-dock`  | Message channel this dock listens on |
 * | `position` | `left\|right\|top\|bottom`  | `right`       | Viewport edge to attach to           |
 *
 * ### Messages received (on `[label]` channel)
 * | cmd        | content                  | Effect                              |
 * |------------|--------------------------|-------------------------------------|
 * | `dock-me`  | HTMLElement              | Add item (reads element's `icon` + `label` attrs) |
 * | `undock`   | `{ label: string }`      | Remove item                         |
 * | `minimize` | `{ label: string }`      | Mark item inactive                  |
 * | `maximize` | `{ label: string }`      | Mark item active                    |
 *
 * ### Messages broadcast (window-level, on `[label]` channel)
 * | cmd        | content             | Trigger                      |
 * |------------|---------------------|------------------------------|
 * | `maximize` | `{ label: string }` | User activates an item       |
 * | `minimize` | `{ label: string }` | User deactivates active item |
 */
export class RavelDock extends RavelElement {

    private static readonly localStyles = `
        :host {
            position: fixed;
            z-index: 9000;
            display: block;
            right: 16px;
            top: 50%;
            transform: translateY(-50%);
        }
        :host([position="left"]) {
            right: auto;
            left: 16px;
            top: 50%;
            transform: translateY(-50%);
        }
        :host([position="top"]) {
            right: auto;
            top: 16px;
            left: 50%;
            transform: translateX(-50%);
        }
        :host([position="bottom"]) {
            right: auto;
            top: auto;
            bottom: 16px;
            left: 50%;
            transform: translateX(-50%);
        }

        #container {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding: 8px;
            background: rgba(28, 28, 28, 0.92);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border: 1px solid rgba(102, 102, 102, 0.25);
            border-radius: 28px;
            box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
        }
        :host([position="top"]) #container,
        :host([position="bottom"]) #container {
            flex-direction: row;
        }

        .dock-item {
            position: relative;
            width: 44px;
            height: 44px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            border: 1px solid transparent;
            background: transparent;
            cursor: pointer;
            font-size: 22px;
            color: rgba(255, 255, 255, 0.55);
            padding: 0;
            flex-shrink: 0;
            transition: background 0.15s, border-color 0.15s, box-shadow 0.15s, color 0.15s;
        }
        .dock-item:hover,
        .dock-item:focus-visible {
            background: rgba(32, 200, 216, 0.12);
            border-color: rgba(32, 200, 216, 0.6);
            box-shadow: 0 0 10px rgba(32, 200, 216, 0.25);
            color: #20C8D8;
            outline: none;
        }
        .dock-item.active {
            background: rgba(32, 200, 216, 0.18);
            border-color: rgba(32, 200, 216, 0.65);
            box-shadow: 0 0 12px rgba(32, 200, 216, 0.35);
            color: #20C8D8;
        }

        /* Tooltip via CSS attr() — appears on the open side of the dock */
        .dock-item::after {
            content: attr(data-label);
            position: absolute;
            right: calc(100% + 10px);
            top: 50%;
            transform: translateY(-50%);
            background: rgba(20, 20, 20, 0.96);
            color: #E6E2D3;
            font-size: 10px;
            font-family: 'Quantico', monospace, sans-serif;
            white-space: nowrap;
            padding: 4px 9px;
            border-radius: 4px;
            border: 1px solid rgba(102, 102, 102, 0.3);
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.12s;
            z-index: 1;
        }
        .dock-item:hover::after,
        .dock-item:focus-visible::after {
            opacity: 1;
        }
        :host([position="left"]) .dock-item::after {
            right: auto;
            left: calc(100% + 10px);
        }
        :host([position="top"]) .dock-item::after,
        :host([position="bottom"]) .dock-item::after {
            right: auto;
            top: calc(100% + 10px);
            left: 50%;
            transform: translateX(-50%);
        }
    `;

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'label', 'position'];
    }

    private _label: string = 'ravel-dock';
    private _position: DockPosition = 'right';
    private _items: Map<string, { icon: string; active: boolean }> = new Map();

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();
        const style = document.createElement('style');
        style.textContent = RavelDock.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);
        this.container.setAttribute('role', 'toolbar');
        this.container.setAttribute('aria-label', 'Component dock');
        // Override base tabindex — focus belongs to individual items, not the host
        this.setAttribute('tabindex', '-1');
    }

    protected setup(): void {
        super.setup();
        this.subscribe([this._label]);
        this.addEventListener(this._label, this._onMessage);
        this.container.addEventListener('click', this._onContainerClick);
        this.container.addEventListener('keydown', this._onContainerKeyDown);
    }

    protected teardown(): void {
        this.unsubscribe([this._label]);
        this.removeEventListener(this._label, this._onMessage);
        this.container.removeEventListener('click', this._onContainerClick);
        this.container.removeEventListener('keydown', this._onContainerKeyDown);
        super.teardown();
    }

    // ── Messages ──────────────────────────────────────────────────────────────

    private _onMessage = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent<{ cmd: string; content: unknown }>).detail ?? {};
        switch (cmd) {
            case 'dock-me': {
                const el = content as HTMLElement;
                const label = el.getAttribute('label') ?? el.tagName.toLowerCase();
                const icon  = el.getAttribute('icon')  ?? '◻';
                this._addItem(label, icon);
                break;
            }
            case 'undock': {
                const label = (content as { label?: string })?.label;
                if (label) this._removeItem(label);
                break;
            }
            case 'minimize': {
                const label = (content as { label?: string })?.label;
                if (label) this._setActive(label, false);
                break;
            }
            case 'maximize': {
                const label = (content as { label?: string })?.label;
                if (label) this._setActive(label, true);
                break;
            }
        }
    };

    // ── Item management ───────────────────────────────────────────────────────

    private _addItem(label: string, icon: string): void {
        if (this._items.has(label)) return;
        this._items.set(label, { icon, active: false });
        const btn = this._createBtn(label, icon, false);
        // Roving tabindex: first item gets 0, rest get -1
        btn.setAttribute('tabindex', this._items.size === 1 ? '0' : '-1');
        this.container.appendChild(btn);
    }

    private _removeItem(label: string): void {
        if (!this._items.has(label)) return;
        this._items.delete(label);
        this.container.querySelector(`[data-label="${CSS.escape(label)}"]`)?.remove();
        // Give tabindex="0" to first remaining item
        const first = this.container.querySelector<HTMLElement>('.dock-item');
        if (first) first.setAttribute('tabindex', '0');
    }

    private _setActive(label: string, active: boolean): void {
        const item = this._items.get(label);
        if (!item) return;
        item.active = active;
        const btn = this.container.querySelector<HTMLElement>(`[data-label="${CSS.escape(label)}"]`);
        if (btn) {
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', String(active));
        }
    }

    private _createBtn(label: string, icon: string, active: boolean): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dock-item' + (active ? ' active' : '');
        btn.dataset.label = label;
        btn.setAttribute('aria-label', label);
        btn.setAttribute('aria-pressed', String(active));
        btn.textContent = icon;
        return btn;
    }

    // ── Interaction ───────────────────────────────────────────────────────────

    private _onContainerClick = (e: MouseEvent): void => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('.dock-item');
        if (!btn?.dataset.label) return;
        this._toggleItem(btn.dataset.label);
    };

    private _onContainerKeyDown = (e: KeyboardEvent): void => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('.dock-item');
        if (!btn) return;

        const isVertical = this._position === 'left' || this._position === 'right';
        const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
        const prevKey = isVertical ? 'ArrowUp'   : 'ArrowLeft';

        if (e.key === nextKey || (isVertical && e.key === 'ArrowRight') || (!isVertical && e.key === 'ArrowDown')) {
            e.preventDefault();
            this._moveFocus(btn, 1);
        } else if (e.key === prevKey || (isVertical && e.key === 'ArrowLeft') || (!isVertical && e.key === 'ArrowUp')) {
            e.preventDefault();
            this._moveFocus(btn, -1);
        } else if (e.key === 'Home') {
            e.preventDefault();
            this._focusAt(0);
        } else if (e.key === 'End') {
            e.preventDefault();
            this._focusAt(-1);
        }
    };

    private _moveFocus(current: HTMLElement, direction: 1 | -1): void {
        const items = [...this.container.querySelectorAll<HTMLElement>('.dock-item')];
        const idx = items.indexOf(current);
        const next = items[idx + direction];
        if (next) this._focusItem(items, idx + direction);
    }

    private _focusAt(index: number): void {
        const items = [...this.container.querySelectorAll<HTMLElement>('.dock-item')];
        const i = index < 0 ? items.length + index : index;
        this._focusItem(items, i);
    }

    private _focusItem(items: HTMLElement[], index: number): void {
        if (index < 0 || index >= items.length) return;
        items.forEach((item, i) => item.setAttribute('tabindex', i === index ? '0' : '-1'));
        items[index].focus();
    }

    private _toggleItem(label: string): void {
        const item = this._items.get(label);
        if (!item) return;
        const nowActive = !item.active;
        this._setActive(label, nowActive);
        this.broadcastMessage(this._label, nowActive ? 'maximize' : 'minimize', { label });
    }

    // ── Attributes ────────────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (name === 'label')    this._label    = newValue ?? 'ravel-dock';
        if (name === 'position') this._position = (newValue as DockPosition) ?? 'right';
    }
}
