import { RavelElement } from '../../../../common/RavelElement';

/**
 * A full-viewport overlay card that wraps arbitrary HTML content.
 *
 * ### Attributes
 * | Attribute    | Type    | Default     | Description                        |
 * |--------------|---------|-------------|------------------------------------|
 * | `color`      | string  | `#000000`   | Background color                   |
 * | `text-color` | string  | `#ffffff`   | Text color                         |
 * | `font-size`  | string  | `2rem`      | CSS font-size for slotted text     |
 * | `z-index`    | number  | `10`        | Stack order                        |
 */
export class RavelCard extends RavelElement {

    private static readonly localStyles = `
        :host {
            position: absolute;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            box-sizing: border-box;
            z-index: 10;
        }
        #container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: #000000;
            color: #ffffff;
            font-size: 2rem;
        }
    `;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'color', 'text-color', 'font-size', 'z-index',
        ];
    }

    private _color     = '#000000';
    private _textColor = '#ffffff';
    private _fontSize  = '2rem';
    private _zIndex    = 10;

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelCard.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = '<slot></slot>';
    }

    protected setup(): void {
        super.setup();
        this._applyStyles();
        this.style.zIndex = String(this._zIndex);
    }

    private _applyStyles(): void {
        this.container.style.background = this._color;
        this.container.style.color      = this._textColor;
        this.container.style.fontSize   = this._fontSize;
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);

        switch (name) {
            case 'color':
                this._color = newValue ?? '#000000';
                if (this.container) this._applyStyles();
                break;
            case 'text-color':
                this._textColor = newValue ?? '#ffffff';
                if (this.container) this._applyStyles();
                break;
            case 'font-size':
                this._fontSize = newValue ?? '2rem';
                if (this.container) this._applyStyles();
                break;
            case 'z-index':
                this._zIndex = Number(newValue) || 10;
                this.style.zIndex = String(this._zIndex);
                break;
        }
    }
}
