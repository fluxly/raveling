import { RavelElement } from '../../../../common/RavelElement';

/**
 * A bold square button with an inner HTML border and a symmetrical outer box-shadow ring.
 *
 * ### Attributes
 * | Attribute      | Type    | Default    | Description                                           |
 * |----------------|---------|------------|-------------------------------------------------------|
 * | `w`            | number  | `60`       | Width in px                                           |
 * | `h`            | number  | `60`       | Height in px                                          |
 * | `x`            | number  | `0`        | Left position in px (used when absolutely positioned) |
 * | `y`            | number  | `0`        | Top position in px                                    |
 * | `label`        | string  | `''`       | Button face text                                      |
 * | `color`        | string  | `#4466dd`  | Face background color                                 |
 * | `border-width` | number  | `2`        | Inner border thickness in px                          |
 * | `border-color` | string  | —          | Inner border color; defaults to a darkened `color`    |
 * | `shadow-size`  | number  | `4`        | Outer box-shadow spread in px                         |
 * | `shadow-color` | string  | —          | Outer shadow color; defaults to a further-darkened `color` |
 * | `no-click`     | boolean | `false`    | Disables pointer interaction                          |
 *
 * ### Events broadcast (on `'ravel-button'` channel)
 * | cmd     | content | Trigger        |
 * |---------|---------|----------------|
 * | `click` | `this`  | pointer release |
 */
export class RavelButton extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: inline-block;
            box-sizing: border-box;
        }
        #container {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            user-select: none;
            box-sizing: border-box;
            font-family: 'Quantico', monospace, sans-serif;
            transition: filter 0.06s ease;
        }
        #container.pressed {
            filter: brightness(0.75);
        }
        #label {
            font-size: 13px;
            font-weight: bold;
            color: rgba(255, 255, 255, 0.95);
            pointer-events: none;
            text-align: center;
        }
    `;

    private static readonly componentHtml = `
        <span id="label"></span>
    `;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'w', 'h', 'label', 'color',
            'border-width', 'border-color',
            'shadow-size', 'shadow-color',
            'no-click',
        ];
    }

    // Shadow DOM refs

    private labelEl!: HTMLElement;

    // State

    private _w = 60;
    private _h = 60;
    private _label = '';
    private _color = '#4466dd';
    private _borderWidth = 2;
    private _borderColor = '';
    private _shadowSize = 4;
    private _shadowColor = '';
    private _noClick = false;

    // Lifecycle

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelButton.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelButton.componentHtml;
        this.labelEl = this.container.querySelector<HTMLElement>('#label')!;
    }

    protected setup(): void {
        super.setup();

        this._applySize();
        this._applyVisuals();
        this._applyLabel();

        if (!this._noClick) {
            this.addEventListener('pointerdown', this.handlePointerDown);
        }
    }

    protected teardown(): void {
        this.removeEventListener('pointerdown', this.handlePointerDown);
        document.removeEventListener('pointerup',    this.handlePointerUp);
        document.removeEventListener('pointercancel', this.handlePointerUp);
        super.teardown();
    }

    // Style helpers

    private _applySize(): void {
        this.style.width  = `${this._w}px`;
        this.style.height = `${this._h}px`;
    }

    private _applyVisuals(): void {
        const borderColor = this._borderColor || this._darken(this._color, 0.35);
        const shadowColor = this._shadowColor || this._darken(this._color, 0.6);
        this.container.style.backgroundColor = this._color;
        this.container.style.border    = `${this._borderWidth}px solid ${borderColor}`;
        this.container.style.boxShadow = `0 0 0 ${this._shadowSize}px ${shadowColor}`;
    }

    private _applyLabel(): void {
        if (this.labelEl) this.labelEl.textContent = this._label;
    }

    /** Returns a darkened version of a hex color by reducing each channel by `amount` (0–1). */
    private _darken(hex: string, amount: number): string {
        const h    = hex.replace('#', '');
        const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
        const r    = Math.max(0, Math.round(parseInt(full.slice(0, 2), 16) * (1 - amount)));
        const g    = Math.max(0, Math.round(parseInt(full.slice(2, 4), 16) * (1 - amount)));
        const b    = Math.max(0, Math.round(parseInt(full.slice(4, 6), 16) * (1 - amount)));
        return `rgb(${r}, ${g}, ${b})`;
    }

    // Pointer interaction

    private handlePointerDown = (e: PointerEvent): void => {
        e.preventDefault();
        this.container.classList.add('pressed');
        document.addEventListener('pointerup',     this.handlePointerUp);
        document.addEventListener('pointercancel', this.handlePointerUp);
    };

    private handlePointerUp = (): void => {
        this.container.classList.remove('pressed');
        document.removeEventListener('pointerup',     this.handlePointerUp);
        document.removeEventListener('pointercancel', this.handlePointerUp);
        this.dispatchVirtualEvent('click', {});
        this.broadcastMessage('ravel-button', 'click', this);
    };

    // Attribute handling

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);

        switch (name) {
            case 'w':
                this._w = Number(newValue) || 60;
                if (this.container) this._applySize();
                break;
            case 'h':
                this._h = Number(newValue) || 60;
                if (this.container) this._applySize();
                break;
            case 'label':
                this._label = newValue ?? '';
                if (this.labelEl) this._applyLabel();
                break;
            case 'color':
                this._color = newValue ?? '#4466dd';
                if (this.container) this._applyVisuals();
                break;
            case 'border-width':
                this._borderWidth = Number(newValue) || 2;
                if (this.container) this._applyVisuals();
                break;
            case 'border-color':
                this._borderColor = newValue ?? '';
                if (this.container) this._applyVisuals();
                break;
            case 'shadow-size':
                this._shadowSize = Number(newValue) || 4;
                if (this.container) this._applyVisuals();
                break;
            case 'shadow-color':
                this._shadowColor = newValue ?? '';
                if (this.container) this._applyVisuals();
                break;
            case 'no-click':
                this._noClick = newValue !== null;
                break;
        }
    }
}
