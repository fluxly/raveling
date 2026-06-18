import { RavelElement } from '../../../../common/RavelElement';

/**
 * A multi-mode menu component. Set `type` to choose the presentation style.
 *
 * - **`dropdown`** (default) — a trigger button that opens a floating panel below it.
 * - **`context`** — no visible trigger; the element itself is the right-click zone.
 *   Make it cover the desired area with CSS (`position:absolute; inset:0`).
 * - **`bar`** — items are laid out horizontally with no panel, useful as a nav strip.
 *
 * Slot any number of `<button>`, `<a>`, or `<hr>` elements as items.
 * Add `data-cmd="..."` to items to identify them in the `menu-select` event.
 *
 * ### Attributes
 * | Attribute | Type                             | Default      | Description                    |
 * |-----------|----------------------------------|--------------|--------------------------------|
 * | `type`    | `dropdown \| context \| bar`     | `dropdown`   | Menu presentation style        |
 * | `label`   | string                           | `'Menu'`     | Trigger button text (dropdown) |
 * | `open`    | boolean                          | `false`      | Force-open the menu panel      |
 *
 * ### Events
 * | Event         | detail                          | Trigger             |
 * |---------------|---------------------------------|---------------------|
 * | `menu-select` | `{ cmd: string, item: Element}` | Item clicked        |
 *
 * Also broadcasts on `'ravel-menu'` channel: `{ cmd: 'select', content: { cmd } }`.
 *
 * ### Keyboard (dropdown / context)
 * `↓`/`↑` — move focus · `Enter`/`Space` — activate · `Escape` — close
 */
export class RavelMenu extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: inline-block;
            position: relative;
            box-sizing: border-box;
        }
        #container {
            position: relative;
            width: auto;
            height: auto;
        }

        /* ── Trigger button ─────────────────────────────── */
        #trigger {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 7px 14px;
            background: transparent;
            border: 1px solid rgba(255,255,255,0.22);
            border-radius: 4px;
            color: rgba(255,255,255,0.75);
            font-family: 'Silkscreen', monospace;
            font-size: 0.7rem;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
            line-height: 1;
            transition: color 0.12s, border-color 0.12s, background 0.12s;
        }
        #trigger::after {
            content: '▾';
            font-size: 0.6rem;
            opacity: 0.6;
        }
        #trigger:hover {
            color: #ffffff;
            border-color: rgba(255,255,255,0.5);
        }
        #trigger.open {
            color: #00F0FF;
            border-color: #00F0FF;
            background: rgba(0,240,255,0.08);
        }

        /* ── Panel ──────────────────────────────────────── */
        #panel {
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            min-width: 160px;
            background: #1a1a1a;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 4px;
            padding: 4px;
            z-index: 9999;
            box-shadow: 0 4px 20px rgba(0,0,0,0.7);
            display: none;
            flex-direction: column;
            gap: 1px;
            box-sizing: border-box;
        }
        #panel.open { display: flex; }

        /* ── Context type ───────────────────────────────── */
        :host([type="context"]) { display: block; }
        :host([type="context"]) #trigger { display: none; }
        :host([type="context"]) #panel   { position: fixed; }

        /* ── Bar type ───────────────────────────────────── */
        :host([type="bar"]) { display: flex; width: 100%; }
        :host([type="bar"]) #trigger { display: none; }
        :host([type="bar"]) #panel {
            position: static;
            flex-direction: row;
            background: transparent;
            border: none;
            box-shadow: none;
            padding: 0;
            gap: 0;
            min-width: unset;
            width: 100%;
        }

        /* ── Slotted items ──────────────────────────────── */
        ::slotted(button),
        ::slotted(a) {
            display: block;
            width: 100%;
            padding: 8px 12px;
            background: transparent;
            border: none;
            border-radius: 2px;
            color: rgba(255,255,255,0.75);
            font-family: 'Silkscreen', monospace;
            font-size: 0.7rem;
            text-align: left;
            cursor: pointer;
            white-space: nowrap;
            text-decoration: none;
            box-sizing: border-box;
            line-height: 1.4;
            transition: background 0.1s, color 0.1s;
        }
        ::slotted(button:hover),
        ::slotted(a:hover) {
            background: rgba(0,240,255,0.1);
            color: #00F0FF;
        }
        ::slotted(button:focus-visible),
        ::slotted(a:focus-visible) {
            outline: 2px solid #00F0FF;
            outline-offset: -2px;
            background: rgba(0,240,255,0.08);
            color: #00F0FF;
        }
        ::slotted(button[disabled]) {
            opacity: 0.3;
            cursor: not-allowed;
            pointer-events: none;
        }
        ::slotted(hr) {
            display: block;
            border: none;
            border-top: 1px solid rgba(255,255,255,0.1);
            margin: 3px 0;
            width: 100%;
        }

        /* Bar items: don't stretch full width */
        :host([type="bar"]) ::slotted(button),
        :host([type="bar"]) ::slotted(a) {
            width: auto;
            padding: 8px 14px;
            border-radius: 4px;
        }
    `;

    private static readonly componentHtml = `
        <button id="trigger" type="button" aria-haspopup="menu" aria-expanded="false">Menu</button>
        <div id="panel" role="menu" part="panel">
            <slot></slot>
        </div>
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'type', 'label', 'open'];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _triggerEl!: HTMLButtonElement;
    private _panelEl!:   HTMLElement;
    private _slotEl!:    HTMLSlotElement;

    // ── State ─────────────────────────────────────────────────────────────────

    private _isReady = false;
    private _isOpen  = false;
    private _type:   'dropdown' | 'context' | 'bar' = 'dropdown';
    private _label   = 'Menu';

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelMenu.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelMenu.componentHtml;

        this._triggerEl = this.container.querySelector<HTMLButtonElement>('#trigger')!;
        this._panelEl   = this.container.querySelector<HTMLElement>('#panel')!;
        this._slotEl    = this.container.querySelector<HTMLSlotElement>('slot')!;
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;

        this._applyLabel();
        this._applyType();

        this._triggerEl.addEventListener('click',       this._onTriggerClick);
        this._slotEl.addEventListener('slotchange',     this._onSlotChange);
        this.addEventListener('contextmenu',            this._onContextMenu);
        document.addEventListener('click',              this._onDocClick);
        document.addEventListener('keydown',            this._onKeyDown);
    }

    protected teardown(): void {
        this._isReady = false;
        this._close();

        this._triggerEl.removeEventListener('click',   this._onTriggerClick);
        this._slotEl.removeEventListener('slotchange', this._onSlotChange);
        this.removeEventListener('contextmenu',        this._onContextMenu);
        document.removeEventListener('click',          this._onDocClick);
        document.removeEventListener('keydown',        this._onKeyDown);

        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (oldValue === newValue) return;

        switch (name) {
            case 'type':
                this._type = (newValue as 'dropdown' | 'context' | 'bar') ?? 'dropdown';
                if (this._isReady) this._applyType();
                break;
            case 'label':
                this._label = newValue ?? 'Menu';
                if (this._isReady) this._applyLabel();
                break;
            case 'open':
                if (this._isReady) {
                    if (newValue !== null) this._openPanel(); else this._close();
                }
                break;
        }
    }

    // ── Event handlers ────────────────────────────────────────────────────────

    private _onTriggerClick = (): void => {
        if (this._type !== 'dropdown') return;
        if (this._isOpen) this._close(); else this._openPanel();
    };

    private _onContextMenu = (e: MouseEvent): void => {
        if (this._type !== 'context') return;
        e.preventDefault();
        this._openPanel(e.clientX, e.clientY);
    };

    private _onDocClick = (e: MouseEvent): void => {
        if (!this._isOpen) return;
        if (!e.composedPath().includes(this)) this._close();
    };

    private _onKeyDown = (e: KeyboardEvent): void => {
        if (this._type === 'bar') return;

        if (!this._isOpen) {
            // Open on ArrowDown when trigger is focused
            if (e.key === 'ArrowDown' && document.activeElement === this._triggerEl) {
                e.preventDefault();
                this._openPanel();
            }
            return;
        }

        const items = this._focusableItems();
        const idx   = items.indexOf(document.activeElement as HTMLElement);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                items[(idx + 1) % items.length]?.focus();
                break;
            case 'ArrowUp':
                e.preventDefault();
                items[(idx - 1 + items.length) % items.length]?.focus();
                break;
            case 'Escape':
                e.preventDefault();
                this._close();
                if (this._type === 'dropdown') this._triggerEl.focus();
                break;
        }
    };

    private _onSlotChange = (): void => {
        this._bindItems();
    };

    private _onItemClick = (e: Event): void => {
        const item = e.currentTarget as HTMLElement;
        const cmd  = item.dataset['cmd'] ?? item.textContent?.trim() ?? '';

        this.dispatchEvent(new CustomEvent('menu-select', {
            bubbles: true, composed: true,
            detail: { cmd, item },
        }));
        this.broadcastMessage('ravel-menu', 'select', { cmd });

        if (this._type !== 'bar') this._close();
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    private _applyType(): void {
        if (this._type === 'bar') {
            this._panelEl.classList.add('open');
        } else {
            if (!this._isOpen) this._panelEl.classList.remove('open');
        }
    }

    private _applyLabel(): void {
        this._triggerEl.textContent = this._label;
        this._triggerEl.setAttribute('aria-label', this._label);
    }

    private _openPanel(x?: number, y?: number): void {
        if (this._type === 'bar') return;

        if (this._type === 'context' && x !== undefined && y !== undefined) {
            this._panelEl.style.left = `${x}px`;
            this._panelEl.style.top  = `${y}px`;
        }

        this._isOpen = true;
        this._panelEl.classList.add('open');
        this._triggerEl.setAttribute('aria-expanded', 'true');
        this._triggerEl.classList.add('open');
        this.setAttribute('open', '');

        // Focus first item
        requestAnimationFrame(() => this._focusableItems()[0]?.focus());
    }

    private _close(): void {
        if (this._type === 'bar') return;
        this._isOpen = false;
        this._panelEl.classList.remove('open');
        this._triggerEl.setAttribute('aria-expanded', 'false');
        this._triggerEl.classList.remove('open');
        this.removeAttribute('open');
    }

    private _bindItems(): void {
        for (const item of this._focusableItems()) {
            item.removeEventListener('click', this._onItemClick);
            item.addEventListener('click',    this._onItemClick);
        }
    }

    private _focusableItems(): HTMLElement[] {
        return (this._slotEl.assignedElements({ flatten: true }) as HTMLElement[])
            .filter(el => el.matches('button:not([disabled]), a'));
    }
}
