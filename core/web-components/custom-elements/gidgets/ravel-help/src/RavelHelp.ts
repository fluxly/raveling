import { RavelElement } from '../../../../common/RavelElement';

/**
 * An inline help icon that reveals a black-and-white tooltip on click.
 *
 * Drop it anywhere in flow content; it renders as a small `?` circle that
 * sits at mid-line. Clicking the icon opens a popover above it; clicking
 * OK (or the icon again) closes it.
 *
 * ### Attributes
 * | Attribute | Type   | Default | Description                        |
 * |-----------|--------|---------|------------------------------------|
 * | `tip`     | string | `''`    | Help text shown in the popover     |
 * | `label`   | string | `?`     | Icon label (emoji or short string) |
 * | `width`   | string | `260px` | Max-width of the popover           |
 */
export class RavelHelp extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: inline-flex;
            position: relative;
            vertical-align: middle;
        }
        #container {
            position: relative;
            display: inline-flex;
            width: auto;
            height: auto;
        }
        #trigger {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 1.5px solid rgba(255, 255, 255, 0.35);
            background: rgba(255, 255, 255, 0.07);
            color: rgba(255, 255, 255, 0.55);
            font-size: 0.6rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: 'Silkscreen', monospace;
            line-height: 1;
            padding: 0;
            flex-shrink: 0;
            transition: background 0.12s, border-color 0.12s, color 0.12s;
            user-select: none;
        }
        #trigger:hover {
            background: rgba(255, 255, 255, 0.16);
            border-color: rgba(255, 255, 255, 0.7);
            color: #ffffff;
        }
        #trigger.open {
            background: rgba(0, 240, 255, 0.18);
            border-color: #00F0FF;
            color: #00F0FF;
        }
        /* ── Popup — opens to the right ─────────────────────── */
        #popup {
            position: absolute;
            left: calc(100% + 10px);
            top: 50%;
            transform: translateX(6px) translateY(-50%);
            background: #1a1a1a;
            color: rgba(255, 255, 255, 0.85);
            border-radius: 4px;
            padding: 14px 16px;
            max-width: 260px;
            min-width: 140px;
            width: max-content;
            font-size: 0.75rem;
            line-height: 1.6;
            font-family: 'Quantico', monospace;
            text-align: left;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
            z-index: 9999;
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.15s ease, transform 0.15s ease;
            box-sizing: border-box;
        }
        /* Left-pointing caret */
        #popup::before {
            content: '';
            position: absolute;
            right: 100%;
            top: 50%;
            transform: translateY(-50%);
            border-top:    5px solid transparent;
            border-bottom: 5px solid transparent;
            border-right:  6px solid rgba(255, 255, 255, 0.12);
        }
        #popup::after {
            content: '';
            position: absolute;
            right: calc(100% - 1px);
            top: 50%;
            transform: translateY(-50%);
            border-top:    4px solid transparent;
            border-bottom: 4px solid transparent;
            border-right:  5px solid #1a1a1a;
        }
        #popup.open {
            opacity: 1;
            pointer-events: auto;
            transform: translateX(0) translateY(-50%);
        }
        #tip-text {
            white-space: normal;
        }
        #ok-btn {
            border: 1px solid rgba(255, 255, 255, 0.18);
            border-radius: 4px;
            padding: 5px 14px;
            font-size: 0.65rem;
            cursor: pointer;
            background: transparent;
            color: rgba(255, 255, 255, 0.6);
            font-family: 'Silkscreen', monospace;
            transition: color 0.12s, border-color 0.12s;
            flex-shrink: 0;
            align-self: flex-end;
        }
        #ok-btn:hover {
            color: #ffffff;
            border-color: rgba(255, 255, 255, 0.5);
        }
    `;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'tip', 'label', 'width',
        ];
    }

    private triggerEl!: HTMLButtonElement;
    private popupEl!:   HTMLElement;
    private tipTextEl!: HTMLElement;
    private okBtnEl!:   HTMLButtonElement;

    private _tip   = '';
    private _label = '?';
    private _width = '260px';
    private _open  = false;

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelHelp.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.triggerEl = document.createElement('button');
        this.triggerEl.id = 'trigger';
        this.triggerEl.textContent = this._label;
        this.triggerEl.setAttribute('aria-label', 'Help');
        this.triggerEl.setAttribute('type', 'button');

        this.popupEl = document.createElement('div');
        this.popupEl.id = 'popup';
        this.popupEl.setAttribute('role', 'tooltip');

        this.tipTextEl = document.createElement('div');
        this.tipTextEl.id = 'tip-text';

        this.okBtnEl = document.createElement('button');
        this.okBtnEl.id = 'ok-btn';
        this.okBtnEl.textContent = 'OK';
        this.okBtnEl.setAttribute('type', 'button');

        this.popupEl.appendChild(this.tipTextEl);
        this.popupEl.appendChild(this.okBtnEl);

        this.container.appendChild(this.triggerEl);
        this.container.appendChild(this.popupEl);
    }

    protected setup(): void {
        super.setup();
        this.triggerEl.addEventListener('click', this._toggle);
        this.okBtnEl.addEventListener('click', this._close);
        document.addEventListener('click', this._onDocClick);
    }

    protected teardown(): void {
        this.triggerEl.removeEventListener('click', this._toggle);
        this.okBtnEl.removeEventListener('click', this._close);
        document.removeEventListener('click', this._onDocClick);
        super.teardown();
    }

    private _toggle = (): void => {
        this._setOpen(!this._open);
    };

    private _close = (): void => {
        this._setOpen(false);
    };

    private _onDocClick = (e: MouseEvent): void => {
        if (this._open && !e.composedPath().includes(this)) {
            this._setOpen(false);
        }
    };

    private _setOpen(on: boolean): void {
        this._open = on;
        this.popupEl.classList.toggle('open', on);
        this.triggerEl.classList.toggle('open', on);
        this.triggerEl.setAttribute('aria-expanded', String(on));
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);

        switch (name) {
            case 'tip':
                this._tip = newValue ?? '';
                if (this.tipTextEl) this.tipTextEl.textContent = this._tip;
                break;
            case 'label':
                this._label = newValue ?? '?';
                if (this.triggerEl) this.triggerEl.textContent = this._label;
                break;
            case 'width':
                this._width = newValue ?? '260px';
                if (this.popupEl) this.popupEl.style.maxWidth = this._width;
                break;
        }
    }
}
