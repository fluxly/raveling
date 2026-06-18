import { RavelElement } from '../../../../common/RavelElement';

/**
 * A glowing circular avatar for the Ravel physics world.
 * Displays an emoji (default 🐹) or an embedded SVG, with an optional
 * speech-bubble hint. Positioned absolutely via `x`/`y` attributes or
 * the `transform()` method (called by `ravel-physics-world` each frame).
 *
 * ### Attributes
 * | Attribute         | Type    | Default   | Description                                 |
 * |-------------------|---------|-----------|---------------------------------------------|
 * | `icon`            | string  | `'🐹'`    | Emoji or text displayed inside the circle   |
 * | `size`            | number  | `50`      | Diameter in px                              |
 * | `x`               | number  | `0`       | Horizontal centre position in px            |
 * | `y`               | number  | `0`       | Vertical centre position in px              |
 * | `angle`           | number  | `0`       | Rotation in **degrees** (static attr only)  |
 * | `color`           | string  | —         | Hex fill + glow color                       |
 * | `show-hint`       | boolean | `false`   | Show the speech-bubble hint                 |
 * | `use-svg`         | boolean | `false`   | Replace emoji with the embedded Fluxum SVG  |
 *
 * ### Public API
 * `transform(x, y, angleRad)` — update position + rotation from physics engine
 */
export class RavelFluxum extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: block;
        }

        #container {
            position: absolute;
            border-radius: 50%;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: default;
            user-select: none;
            /* width / height / top / left set by JS */
        }

        #icon {
            font-size: inherit;
            line-height: 1;
            pointer-events: none;
        }

        #icon svg {
            display: block;
        }

        /* ── Speech bubble ──────────────────────────────────── */
        #bubble-container {
            position: absolute;
            bottom: calc(100% + 6px);
            left: 50%;
            transform: translateX(-50%);
            display: none;
            flex-direction: column;
            align-items: center;
        }

        #bubble-container.visible {
            display: flex;
        }

        #bubble {
            font-family: 'Silkscreen', monospace;
            font-size: 11px;
            color: #ffffff;
            background: rgba(0,0,0,0.78);
            padding: 5px 10px;
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            white-space: nowrap;
            backdrop-filter: blur(4px);
        }

        #bubble-stem {
            width: 0;
            height: 0;
            border-left:  5px solid transparent;
            border-right: 5px solid transparent;
            border-top:   6px solid rgba(255,255,255,0.2);
        }
    `;

    private static readonly componentHtml = `
        <div id="icon">🐹</div>
        <div id="bubble-container" part="bubble">
            <div id="bubble">Hello! 🐹</div>
            <div id="bubble-stem"></div>
        </div>
    `;

    // ── Embedded SVG ─────────────────────────────────────────────────────────

    private static readonly svgTemplate = `<svg
        id="fluxum-svg"
        width="100%" height="100%"
        viewBox="0 0 52.724949 52.725464"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(-12.903449,-37.37456)">
        <g transform="translate(-17.797518,-48.498237)">
        <path id="fluxum-background-1"
            style="opacity:0.7;fill:#f01400;fill-opacity:1;stroke-width:0.347006"
            d="M 46.273661,85.872795 V 101.446 H 30.700968 v 21.57957 h 15.572693 v 15.57269 H 67.853223 V 123.02557 H 83.425916 V 101.446 H 67.853223 V 85.872795 Z" />
        <path id="fluxum-background-2"
            style="opacity:1;fill:#f01500;fill-opacity:1;stroke-width:0.37625"
            d="m -91.100899,41.156661 h -5.228105 v -5.116484 h -31.813046 v 5.116484 h -5.2281 v 31.813045 h 5.2281 v 5.117001 h 31.813046 v -5.117001 h 5.228105 z"
            transform="rotate(-90)" />
        <g transform="translate(-13.793077,-67.630569)">
        <path style="fill:#ffffff;fill-opacity:1;stroke-width:0.352777"
            d="m 76.418075,164.62716 v 1.72393 h -1.946652 v 1.50171 h -2.001945 v 14.68283 h 2.001945 v 1.50172 h 1.946652 v 1.72444 h 8.676473 v -1.72444 h 1.946651 v -1.50172 h 2.001945 V 167.8528 h -2.001945 v -1.50171 h -1.946651 v -1.72393 z" />
        <path style="fill:#ffffff;fill-opacity:1;stroke-width:0.352425"
            d="m 54.838513,168.52046 v 2.27997 h -1.723926 v 13.01471 h 1.723926 v 2.27996 h 10.567314 v -2.27996 h 1.723926 v -13.01471 h -1.723926 v -2.27997 z" />
        <rect style="fill:#000000;fill-opacity:1;stroke-width:0.352777"
            width="6.0066624" height="8.7875252" x="56.729588" y="173.19209" />
        <rect style="fill:#000000;fill-opacity:1;stroke-width:0.352777"
            width="9.0099936" height="10.567276" x="76.084389" y="170.85617" />
        </g></g></g>
    </svg>`;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes,
            'icon', 'size', 'angle', 'show-hint', 'color', 'use-svg'];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _iconEl!:         HTMLElement;
    private _bubbleContainer!: HTMLElement;

    // ── State ─────────────────────────────────────────────────────────────────

    private _isReady    = false;
    private _icon       = '🐹';
    private _size       = 50;
    private _angle      = 0;     // degrees (from attribute); transform() uses radians
    private _color      = '';
    private _useSvg     = false;
    private _showHint   = false;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelFluxum.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelFluxum.componentHtml;

        this._iconEl          = this.container.querySelector<HTMLElement>('#icon')!;
        this._bubbleContainer = this.container.querySelector<HTMLElement>('#bubble-container')!;
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;

        this._applyAll();
    }

    protected teardown(): void {
        this._isReady = false;
        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (oldValue === newValue) return;

        switch (name) {
            case 'icon':
                this._icon = newValue ?? '🐹';
                if (this._isReady) this._applyIcon();
                break;
            case 'size': {
                const n = Number(newValue);
                this._size = Number.isFinite(n) && n > 0 ? n : 50;
                if (this._isReady) this._applyTransform();
                break;
            }
            case 'angle': {
                const n = Number(newValue);
                this._angle = Number.isFinite(n) ? n : 0;
                if (this._isReady) this._applyTransform();
                break;
            }
            case 'color':
                this._color = newValue ?? '';
                if (this._isReady) this._applyColor();
                break;
            case 'show-hint':
                this._showHint = newValue !== null;
                if (this._isReady) this._applyHint();
                break;
            case 'use-svg':
                this._useSvg = newValue !== null;
                if (this._isReady) this._applyIcon();
                break;
            case 'x':
            case 'y':
                // base class already updated this.x / this.y
                if (this._isReady) this._applyTransform();
                break;
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Update position and rotation — called by `ravel-physics-world` each frame.
     * @param x     Horizontal centre in px
     * @param y     Vertical centre in px
     * @param angle Rotation in **radians**
     */
    transform(x: number, y: number, angle: number): void {
        // Update base class x/y so they stay in sync
        this.x = x;
        this.y = y;

        this.container.style.left      = `${x - this._size / 2}px`;
        this.container.style.top       = `${y - this._size / 2}px`;
        this.container.style.transform = `rotate(${angle}rad)`;

        this._bubbleContainer.style.left = `${x}px`;
        this._bubbleContainer.style.top  = `${y - this._size - 60}px`;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private _applyAll(): void {
        this._applyTransform();
        this._applyColor();
        this._applyIcon();
        this._applyHint();
    }

    private _applyTransform(): void {
        this.container.style.width     = `${this._size}px`;
        this.container.style.height    = `${this._size}px`;
        this.container.style.left      = `${this.x - this._size / 2}px`;
        this.container.style.top       = `${this.y - this._size / 2}px`;
        this.container.style.transform = `rotate(${this._angle}deg)`;
        this._iconEl.style.fontSize    = `${this._size * 0.6}px`;
        this._iconEl.style.lineHeight  = '1';
    }

    private _applyColor(): void {
        if (!this._color) {
            this.container.style.backgroundColor = '';
            this.container.style.boxShadow       = '';
            return;
        }
        const rgba = RavelFluxum._hexToRgba(this._color, 0.5);
        this.container.style.backgroundColor = rgba;
        this.container.style.boxShadow       = `0 0 20px 20px ${rgba}`;
    }

    private _applyIcon(): void {
        if (this._useSvg) {
            this._iconEl.innerHTML = RavelFluxum.svgTemplate;
            const svg = this._iconEl.querySelector<SVGElement>('#fluxum-svg');
            if (svg) {
                svg.style.width  = `${this._size}px`;
                svg.style.height = `${this._size}px`;
            }
            if (this._color) {
                const rgba = RavelFluxum._hexToRgba(this._color, 1);
                this._iconEl.querySelector<SVGPathElement>('#fluxum-background-1')?.style.setProperty('fill', rgba);
                this._iconEl.querySelector<SVGPathElement>('#fluxum-background-2')?.style.setProperty('fill', rgba);
            }
        } else {
            this._iconEl.textContent = this._icon;
        }
    }

    private _applyHint(): void {
        this._bubbleContainer.classList.toggle('visible', this._showHint);
    }

    private static _hexToRgba(hex: string, alpha: number): string {
        const h    = hex.replace('#', '');
        const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
        const r    = parseInt(full.slice(0, 2), 16);
        const g    = parseInt(full.slice(2, 4), 16);
        const b    = parseInt(full.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
}
