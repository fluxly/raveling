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
            border: 1.5px solid rgba(255, 255, 255, 0.45);
            background: rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.65);
            font-size: 0.7rem;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: inherit;
            line-height: 1;
            padding: 0;
            flex-shrink: 0;
            transition: background 0.15s, border-color 0.15s, color 0.15s;
            user-select: none;
        }
        #trigger:hover {
            background: rgba(255, 255, 255, 0.18);
            border-color: rgba(255, 255, 255, 0.8);
            color: #ffffff;
        }
        #trigger.open {
            background: rgba(255, 255, 255, 0.22);
            border-color: #ffffff;
            color: #ffffff;
        }
        #popup {
            position: absolute;
            bottom: calc(100% + 10px);
            left: 50%;
            transform: translateX(-50%) translateY(4px);
            background: #111111;
            color: #ffffff;
            border-radius: 18px;
            padding: 18px 22px;
            max-width: 260px;
            min-width: 140px;
            width: max-content;
            font-size: 0.88rem;
            line-height: 1.55;
            font-family: 'Segoe UI', system-ui, sans-serif;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 14px;
            z-index: 9999;
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-shadow: 0 6px 28px rgba(0, 0, 0, 0.6);
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.18s ease, transform 0.18s ease;
            box-sizing: border-box;
        }
        #popup.open {
            opacity: 1;
            pointer-events: auto;
            transform: translateX(-50%) translateY(0);
        }
        #tip-text {
            white-space: normal;
        }
        #ok-btn {
            border: none;
            border-radius: 999px;
            padding: 7px 26px;
            font-size: 0.82rem;
            cursor: pointer;
            background: rgba(255, 255, 255, 0.14);
            color: rgba(255, 255, 255, 0.85);
            font-family: inherit;
            letter-spacing: 0.3px;
            transition: background 0.15s;
            flex-shrink: 0;
        }
        #ok-btn:hover {
            background: rgba(255, 255, 255, 0.24);
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
