import { RavelElement } from '../../../../common/RavelElement';

/**
 * A single note block on a piano-roll-style UI.
 *
 * ### Attributes
 * | Attribute    | Type    | Default   | Description                                    |
 * |--------------|---------|-----------|------------------------------------------------|
 * | `length`     | number  | `4`       | Duration in musical units                      |
 * | `unit-width` | number  | `50`      | Pixels per unit (controls display width)       |
 * | `h`          | number  | `40`      | Height in px (ignored when `docked`)           |
 * | `x`          | number  | `0`       | Left position in px                            |
 * | `y`          | number  | `0`       | Top position in px                             |
 * | `label`      | string  | `''`      | Text displayed in the center area              |
 * | `color`      | string  | `#4488ff` | Background color of the note                   |
 * | `selected`   | boolean | `false`   | Highlights the note with a focus outline       |
 * | `docked`     | boolean | `false`   | When true, height fills 100% of the parent     |
 * | `no-click`   | boolean | `false`   | Disables all pointer interaction               |
 * | `quantum`    | number  | `1`       | Snap step size in units used while scaling     |
 *
 * ### Interaction zones
 * - **Left / right handles** — `ew-resize` drag to scale the note length.
 *   The left handle also shifts the x position so the right edge stays fixed.
 * - **Center area** — click to toggle selected; drag beyond threshold to move.
 *   On drag, broadcasts `{ cmd: 'undock', content: this }` on the `'ravel-perf'`
 *   channel (`'ravel-roll-perf'`) so a parent dock container can respond.
 *
 * ### Messages received (on `this.id` channel)
 * | cmd        | Behaviour               |
 * |------------|-------------------------|
 * | `select`   | Sets selected state     |
 * | `unselect` | Clears selected state   |
 */
export class RavelRollPerf extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: block;
            box-sizing: border-box;
        }
        #container {
            display: flex;
            width: 100%;
            height: 100%;
            overflow: hidden;
            user-select: none;
            box-sizing: border-box;
        }
        #left-handle, #right-handle {
            width: 8px;
            flex-shrink: 0;
            cursor: ew-resize;
            background: rgba(255, 255, 255, 0.18);
            transition: background 0.1s;
        }
        #left-handle:hover, #right-handle:hover {
            background: rgba(255, 255, 255, 0.35);
        }
        #center-area {
            flex: 1;
            cursor: grab;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            min-width: 0;
            padding: 0 4px;
        }
        #center-area.grabbing {
            cursor: grabbing;
        }
        #label {
            font-size: 11px;
            font-family: 'Quantico', monospace, sans-serif;
            color: rgba(255, 255, 255, 0.9);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            pointer-events: none;
        }
    `;

    private static readonly componentHtml = `
        <div id="left-handle"></div>
        <div id="center-area">
            <div id="label"></div>
        </div>
        <div id="right-handle"></div>
    `;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'length', 'unit-width', 'h', 'label', 'color', 'no-click', 'selected', 'docked', 'quantum',
        ];
    }

    // Shadow DOM refs

    private labelEl!: HTMLElement;
    private centerArea!: HTMLElement;
    private leftHandle!: HTMLElement;
    private rightHandle!: HTMLElement;

    // State

    private _length = 4;
    private _unitWidth = 50;
    private _height = 40;
    private _label = '';
    private _color = '#4488ff';
    private _noClick = false;
    private _selected = false;
    private _docked = false;
    private _quantum = 1;

    // Scale interaction

    private _scaleMode: 'left' | 'right' | null = null;
    private _scaleAnchorX = 0;
    private _scaleStartLength = 0;
    private _scaleStartLeft = 0;

    // Center drag / select interaction

    private _centerAnchorX = 0;
    private _centerAnchorY = 0;
    private _centerStartLeft = 0;
    private _centerStartTop = 0;
    private _dragActive = false;
    private static readonly DRAG_THRESHOLD = 5;

    // Lifecycle

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelRollPerf.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelRollPerf.componentHtml;
        this.labelEl    = this.container.querySelector<HTMLElement>('#label')!;
        this.centerArea = this.container.querySelector<HTMLElement>('#center-area')!;
        this.leftHandle = this.container.querySelector<HTMLElement>('#left-handle')!;
        this.rightHandle= this.container.querySelector<HTMLElement>('#right-handle')!;
    }

    protected setup(): void {
        super.setup();

        if (this.id) {
            this.subscribe([this.id]);
            this.addEventListener(this.id, this.handleMessage);
        }

        this.style.position = 'absolute';
        if (!this._docked) {
            this.style.left = `${this.x}px`;
            this.style.top  = `${this.y}px`;
        }

        this._applyDimensions();
        this._applyColor();
        this._applyLabel();
        this._applySelected();

        if (!this._noClick) {
            this.leftHandle.addEventListener('pointerdown',  this.handleLeftDown);
            this.rightHandle.addEventListener('pointerdown', this.handleRightDown);
            this.centerArea.addEventListener('pointerdown',  this.handleCenterDown);
        }
    }

    protected teardown(): void {
        if (this.id) {
            this.unsubscribe([this.id]);
            this.removeEventListener(this.id, this.handleMessage);
        }
        this.leftHandle?.removeEventListener('pointerdown',  this.handleLeftDown);
        this.rightHandle?.removeEventListener('pointerdown', this.handleRightDown);
        this.centerArea?.removeEventListener('pointerdown',  this.handleCenterDown);
        document.removeEventListener('pointermove', this.handleScaleMove);
        document.removeEventListener('pointerup',   this.handleScaleUp);
        document.removeEventListener('pointermove', this.handleCenterMove);
        document.removeEventListener('pointerup',   this.handleCenterUp);
        super.teardown();
    }

    // Dimension / style helpers

    private _applyDimensions(): void {
        this.style.width  = `${this._length * this._unitWidth}px`;
        this.style.height = this._docked ? '100%' : `${this._height}px`;
    }

    private _applyColor(): void {
        const alpha = this._selected ? 1.0 : 0.5;
        this.container.style.backgroundColor = this._toRgba(this._color, alpha);
    }

    private _toRgba(hex: string, alpha: number): string {
        const h = hex.replace('#', '');
        const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
        const r = parseInt(full.slice(0, 2), 16);
        const g = parseInt(full.slice(2, 4), 16);
        const b = parseInt(full.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    private _applyLabel(): void {
        if (this.labelEl) this.labelEl.textContent = this._label;
    }

    private _applySelected(): void {
        this._applyColor();
    }

    // Scale — left handle

    private handleLeftDown = (e: PointerEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        this._scaleMode        = 'left';
        this._scaleAnchorX     = e.clientX;
        this._scaleStartLength = this._length;
        this._scaleStartLeft   = parseFloat(this.style.left) || this.x;
        document.addEventListener('pointermove', this.handleScaleMove);
        document.addEventListener('pointerup',   this.handleScaleUp);
    };

    // Scale — right handle

    private handleRightDown = (e: PointerEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        this._scaleMode        = 'right';
        this._scaleAnchorX     = e.clientX;
        this._scaleStartLength = this._length;
        document.addEventListener('pointermove', this.handleScaleMove);
        document.addEventListener('pointerup',   this.handleScaleUp);
    };

    private handleScaleMove = (e: PointerEvent): void => {
        e.preventDefault();
        const dx = e.clientX - this._scaleAnchorX;

        if (this._scaleMode === 'right') {
            this._length = this._snap(this._scaleStartLength + dx / this._unitWidth);
            this._applyDimensions();
        } else if (this._scaleMode === 'left') {
            const newLength = this._snap(this._scaleStartLength - dx / this._unitWidth);
            // keep right edge fixed: shift left position by the length change
            const lengthDelta = this._scaleStartLength - newLength;
            this._length = newLength;
            this.x = this._scaleStartLeft + lengthDelta * this._unitWidth;
            this.style.left = `${this.x}px`;
            this._applyDimensions();
        }
    };

    /** Rounds a raw length to the nearest quantum step, clamped to a minimum of one quantum. */
    private _snap(rawLength: number): number {
        const q = this._quantum;
        return Math.max(q, Math.round(rawLength / q) * q);
    }

    private handleScaleUp = (): void => {
        this._scaleMode = null;
        document.removeEventListener('pointermove', this.handleScaleMove);
        document.removeEventListener('pointerup',   this.handleScaleUp);
    };

    // Center — drag / select

    private handleCenterDown = (e: PointerEvent): void => {
        e.preventDefault();
        e.stopPropagation();
        this._dragActive      = false;
        this._centerAnchorX   = e.clientX;
        this._centerAnchorY   = e.clientY;
        this._centerStartLeft = parseFloat(this.style.left) || this.x;
        this._centerStartTop  = parseFloat(this.style.top)  || this.y;
        this.centerArea.classList.add('grabbing');
        document.addEventListener('pointermove', this.handleCenterMove);
        document.addEventListener('pointerup',   this.handleCenterUp);
    };

    private handleCenterMove = (e: PointerEvent): void => {
        e.preventDefault();
        const dx = e.clientX - this._centerAnchorX;
        const dy = e.clientY - this._centerAnchorY;

        if (!this._dragActive && Math.hypot(dx, dy) > RavelRollPerf.DRAG_THRESHOLD) {
            this._dragActive = true;
            this.broadcastMessage('ravel-roll-perf', 'undock', this);
        }

        if (this._dragActive) {
            this.style.left = `${this._centerStartLeft + dx}px`;
            this.style.top  = `${this._centerStartTop  + dy}px`;
        }
    };

    private handleCenterUp = (): void => {
        this.centerArea.classList.remove('grabbing');
        document.removeEventListener('pointermove', this.handleCenterMove);
        document.removeEventListener('pointerup',   this.handleCenterUp);

        if (!this._dragActive) {
            // drive through attribute so external setAttribute/removeAttribute stays in sync
            if (this.hasAttribute('selected')) {
                this.removeAttribute('selected');
            } else {
                this.setAttribute('selected', '');
            }
        }
        this._dragActive = false;
    };

    // Message handling

    private handleMessage = (e: Event): void => {
        e.preventDefault();
        const { cmd } = (e as CustomEvent).detail;
        switch (cmd) {
            case 'select':
                this._selected = true;
                this._applySelected();
                break;
            case 'unselect':
                this._selected = false;
                this._applySelected();
                break;
            case 'quantize':
                this._length = this._snap(this._length);
                this._applyDimensions();
                break;
        }
    };

    // Attribute handling

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);

        if ((name === 'x' || name === 'y') && this.style.position && !this._docked) {
            this.style.left = `${this.x}px`;
            this.style.top  = `${this.y}px`;
        }

        switch (name) {
            case 'length':
                this._length = Math.max(1, Number(newValue) || 4);
                if (this.container) this._applyDimensions();
                break;
            case 'unit-width':
                this._unitWidth = Number(newValue) || 50;
                if (this.container) this._applyDimensions();
                break;
            case 'h':
                this._height = Number(newValue) || 40;
                if (this.container) this._applyDimensions();
                break;
            case 'label':
                this._label = newValue ?? '';
                if (this.labelEl) this._applyLabel();
                break;
            case 'color':
                this._color = newValue ?? '#4488ff';
                if (this.container) this._applyColor();
                break;
            case 'no-click':
                this._noClick = newValue !== null;
                break;
            case 'selected':
                this._selected = newValue !== null;
                if (this.container) this._applySelected();
                break;
            case 'docked':
                this._docked = newValue !== null;
                if (this.container) this._applyDimensions();
                break;
            case 'quantum':
                this._quantum = Math.max(Number(newValue) || 1, 0.001);
                break;
        }
    }
}
