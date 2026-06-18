import { RavelElement } from '../../../../common/RavelElement';

/**
 * A pixel-art style box with up to three concentric border rings and a
 * colored center panel that accepts slotted content.
 *
 * Each active ring is `pixel-size` px thick. A ring with no color set
 * (empty or absent attribute) collapses to zero thickness, so the
 * component degrades gracefully from 3 → 2 → 1 → 0 borders.
 *
 * ### Attributes
 * | Attribute    | Type   | Default   | Description                               |
 * |--------------|--------|-----------|-------------------------------------------|
 * | `w`          | number | 100       | Total box width in px                     |
 * | `h`          | number | 100       | Total box height in px                    |
 * | `x`          | number | 0         | Left offset when position: absolute       |
 * | `y`          | number | 0         | Top offset when position: absolute        |
 * | `color`      | string | `#ff0000` | Fill color of the center panel            |
 * | `border-1`   | string | `#000000` | Outermost ring color (empty = no ring)    |
 * | `border-2`   | string | `''`      | Middle ring color (empty = no ring)       |
 * | `border-3`   | string | `''`      | Innermost ring color (empty = no ring)    |
 * | `pixel-size` | number | 10        | Thickness of each active ring in px       |
 */
export class RavelBox extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        #container {
            position: absolute;
            box-sizing: border-box;
            cursor: pointer;
            user-select: none;
        }
        #b1, #b2, #b3, #center {
            width: 100%;
            height: 100%;
            box-sizing: border-box;
        }
        #center {
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }
    `;

    private static readonly componentHtml = `
        <div id="b1">
            <div id="b2">
                <div id="b3">
                    <div id="center"><slot></slot></div>
                </div>
            </div>
        </div>
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes,
            'w', 'h', 'x', 'y', 'color', 'border-1', 'border-2', 'border-3', 'pixel-size'];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _b1El!:     HTMLElement;
    private _b2El!:     HTMLElement;
    private _b3El!:     HTMLElement;
    private _centerEl!: HTMLElement;

    private _isReady = false;

    // ── Config ────────────────────────────────────────────────────────────────

    private _w:         number = 100;
    private _h:         number = 100;
    private _x:         number = 0;
    private _y:         number = 0;
    private _color:     string = '#ff0000';
    private _border1:   string = '#000000';
    private _border2:   string = '';
    private _border3:   string = '';
    private _pixelSize: number = 10;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelBox.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelBox.componentHtml;

        this._b1El     = this.container.querySelector<HTMLElement>('#b1')!;
        this._b2El     = this.container.querySelector<HTMLElement>('#b2')!;
        this._b3El     = this.container.querySelector<HTMLElement>('#b3')!;
        this._centerEl = this.container.querySelector<HTMLElement>('#center')!;
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;
        this._render();
    }

    protected teardown(): void {
        this._isReady = false;
        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        switch (name) {
            case 'w':          this._w         = Number(newValue) || this._w;         break;
            case 'h':          this._h         = Number(newValue) || this._h;         break;
            case 'x':          this._x         = Number(newValue) || 0;               break;
            case 'y':          this._y         = Number(newValue) || 0;               break;
            case 'color':      this._color     = newValue ?? this._color;             break;
            case 'border-1':   this._border1   = newValue ?? '';                      break;
            case 'border-2':   this._border2   = newValue ?? '';                      break;
            case 'border-3':   this._border3   = newValue ?? '';                      break;
            case 'pixel-size': this._pixelSize = Number(newValue) || this._pixelSize; break;
        }
        if (this._isReady) this._render();
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    private _render(): void {
        const p = this._pixelSize;

        this.container.style.left   = `${this._x}px`;
        this.container.style.top    = `${this._y}px`;
        this.container.style.width  = `${this._w}px`;
        this.container.style.height = `${this._h}px`;

        // Each ring: background color peeks through the padding gap.
        // An empty color collapses the ring (padding = 0).
        this._applyRing(this._b1El, this._border1, p);
        this._applyRing(this._b2El, this._border2, p);
        this._applyRing(this._b3El, this._border3, p);

        this._centerEl.style.background = this._color;
    }

    private _applyRing(el: HTMLElement, color: string, size: number): void {
        el.style.background = color || 'transparent';
        el.style.padding    = color ? `${size}px` : '0';
    }
}
