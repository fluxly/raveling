import { RavelElement } from '../../../../common/RavelElement';

/**
 * A full-viewport navigable stack. Slotted children are the frames; only one
 * is visible at a time. A floating pill in the bottom portion of the viewport
 * holds prev / next buttons and optional breadcrumbs / icon.
 *
 * ### Attributes
 * | Attribute           | Type               | Default     | Description                            |
 * |---------------------|--------------------|-------------|----------------------------------------|
 * | `start`             | number             | `0`         | Frame index shown on first connect     |
 * | `index`             | number             | —           | Jump to a frame programmatically       |
 * | `icon`              | string             | `''`        | Text / emoji shown in the pill centre  |
 * | `prev-label`        | string             | `←`         | Prev button label                      |
 * | `next-label`        | string             | `→`         | Next button label                      |
 * | `button-color`      | string             | —           | Button bg (defaults to semi-white)     |
 * | `button-text-color` | string             | —           | Button text (defaults to semi-white)   |
 * | `button-radius`     | number             | `999`       | Button border-radius in px             |
 * | `breadcrumb-style`  | `dots` \| `numbers`| `dots`      | Breadcrumb display style               |
 * | `breadcrumb-color`  | string             | `#ffffff`   | Active indicator / number text color   |
 * | `pill-bottom`       | string             | `8vh`       | CSS bottom offset of the pill          |
 * | `pill-width`        | string             | `50%`       | CSS width of the pill                  |
 *
 * ### Messages broadcast (on `'ravel-sequence'` channel)
 * | cmd      | content                    | Trigger          |
 * |----------|----------------------------|------------------|
 * | `change` | `{ id, index, total }`     | Frame navigation |
 */
export class RavelSequence extends RavelElement {

    private static readonly localStyles = `
        :host {
            position: absolute;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            box-sizing: border-box;
            overflow: hidden;
        }
        #container {
            position: relative;
            width: 100%;
            height: 100%;
        }
        #frame-area {
            position: absolute;
            inset: 0;
        }
        ::slotted(*) {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
        }
        #nav-bar {
            position: absolute;
            bottom: 8vh;
            left: 50%;
            transform: translateX(-50%);
            width: 50%;
            min-width: 300px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 10px 20px;
            background: rgba(0, 0, 0, 0.42);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-sizing: border-box;
            z-index: 20;
        }
        #center {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 6px;
            min-width: 0;
        }
        #icon {
            font-size: 1.3rem;
            line-height: 1;
            opacity: 0.65;
        }
        #icon:empty { display: none; }
        #breadcrumbs {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }
        .bc-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            transition: transform 0.15s, opacity 0.15s;
            opacity: 0.3;
        }
        .bc-dot.active {
            opacity: 0.85;
            transform: scale(1.5);
        }
        .bc-numbers {
            font-size: 0.8rem;
            font-family: 'Quantico', monospace, sans-serif;
            letter-spacing: 2px;
            opacity: 0.6;
        }
        #nav-bar button {
            flex-shrink: 0;
            border: none;
            border-radius: 999px;
            padding: 7px 20px;
            font-size: 1rem;
            cursor: pointer;
            font-family: inherit;
            background: rgba(255, 255, 255, 0.14);
            color: rgba(255, 255, 255, 0.65);
            transition: filter 0.1s, opacity 0.15s;
        }
        #nav-bar button:not(:disabled):hover { filter: brightness(1.35); }
        #nav-bar button:disabled { opacity: 0.18; cursor: default; }
    `;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'start', 'index', 'icon',
            'prev-label', 'next-label',
            'button-color', 'button-text-color', 'button-radius',
            'breadcrumb-style', 'breadcrumb-color',
            'pill-bottom', 'pill-width',
        ];
    }

    // Shadow DOM refs

    private slotEl!: HTMLSlotElement;
    private navBarEl!: HTMLElement;
    private prevBtnEl!: HTMLButtonElement;
    private nextBtnEl!: HTMLButtonElement;
    private iconEl!: HTMLElement;
    private breadcrumbsEl!: HTMLElement;

    // State

    private _frames: HTMLElement[] = [];
    private _index  = 0;
    private _start  = 0;

    private _icon             = '';
    private _prevLabel        = '←';
    private _nextLabel        = '→';
    private _buttonColor      = '';
    private _buttonTextColor  = '';
    private _buttonRadius     = 999;
    private _breadcrumbStyle: 'dots' | 'numbers' = 'dots';
    private _breadcrumbColor  = '#ffffff';
    private _pillBottom       = '8vh';
    private _pillWidth        = '50%';

    // Lifecycle

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelSequence.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        const frameArea = document.createElement('div');
        frameArea.id = 'frame-area';
        this.slotEl = document.createElement('slot');
        frameArea.appendChild(this.slotEl);

        this.navBarEl = document.createElement('div');
        this.navBarEl.id = 'nav-bar';

        this.prevBtnEl = document.createElement('button');
        this.prevBtnEl.id = 'btn-prev';
        this.prevBtnEl.textContent = this._prevLabel;

        const centerEl = document.createElement('div');
        centerEl.id = 'center';

        this.iconEl = document.createElement('div');
        this.iconEl.id = 'icon';

        this.breadcrumbsEl = document.createElement('div');
        this.breadcrumbsEl.id = 'breadcrumbs';

        centerEl.appendChild(this.iconEl);
        centerEl.appendChild(this.breadcrumbsEl);

        this.nextBtnEl = document.createElement('button');
        this.nextBtnEl.id = 'btn-next';
        this.nextBtnEl.textContent = this._nextLabel;

        this.navBarEl.appendChild(this.prevBtnEl);
        this.navBarEl.appendChild(centerEl);
        this.navBarEl.appendChild(this.nextBtnEl);

        this.container.appendChild(frameArea);
        this.container.appendChild(this.navBarEl);
    }

    protected setup(): void {
        super.setup();
        this.slotEl.addEventListener('slotchange', this._handleSlotChange);
        this.prevBtnEl.addEventListener('click', this._prev);
        this.nextBtnEl.addEventListener('click', this._next);
    }

    protected teardown(): void {
        this.slotEl.removeEventListener('slotchange', this._handleSlotChange);
        this.prevBtnEl.removeEventListener('click', this._prev);
        this.nextBtnEl.removeEventListener('click', this._next);
        super.teardown();
    }

    // Navigation

    private _prev = (): void => {
        if (this._index <= 0) return;
        this._index--;
        this._update();
        this._broadcastChange();
    };

    private _next = (): void => {
        if (this._index >= this._frames.length - 1) return;
        this._index++;
        this._update();
        this._broadcastChange();
    };

    private _broadcastChange(): void {
        this.broadcastMessage('ravel-sequence', 'change', {
            id: this.id, index: this._index, total: this._frames.length,
        });
    }

    // Slot

    private _handleSlotChange = (): void => {
        this._frames = this.slotEl.assignedElements() as HTMLElement[];
        this._index  = Math.max(0, Math.min(this._index, this._frames.length - 1));
        this._update();
    };

    // Rendering

    private _update(): void {
        this._frames.forEach((el, i) => {
            el.style.display = i === this._index ? '' : 'none';
        });
        this.prevBtnEl.disabled = this._index === 0;
        this.nextBtnEl.disabled = this._index >= this._frames.length - 1;
        this._renderBreadcrumbs();
    }

    private _renderBreadcrumbs(): void {
        this.breadcrumbsEl.innerHTML = '';
        const n = this._frames.length;
        if (n === 0) return;

        if (this._breadcrumbStyle === 'numbers') {
            const span = document.createElement('span');
            span.className = 'bc-numbers';
            span.style.color = this._breadcrumbColor;
            span.textContent = `${this._index + 1}  /  ${n}`;
            this.breadcrumbsEl.appendChild(span);
        } else {
            for (let i = 0; i < n; i++) {
                const dot = document.createElement('span');
                dot.className = 'bc-dot' + (i === this._index ? ' active' : '');
                dot.style.background = this._breadcrumbColor;
                this.breadcrumbsEl.appendChild(dot);
            }
        }
    }

    private _applyButtonStyles(): void {
        for (const btn of [this.prevBtnEl, this.nextBtnEl]) {
            btn.style.background   = this._buttonColor   || '';
            btn.style.color        = this._buttonTextColor || '';
            btn.style.borderRadius = `${this._buttonRadius}px`;
        }
    }

    // Attribute handling

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);

        switch (name) {
            case 'start':
                this._start = Math.max(0, Number(newValue) || 0);
                this._index = this._start;
                if (this._frames.length) this._update();
                break;
            case 'index': {
                const n = this._frames.length;
                this._index = Math.max(0, Math.min(Number(newValue) || 0, n ? n - 1 : 0));
                if (n) this._update();
                break;
            }
            case 'icon':
                this._icon = newValue ?? '';
                if (this.iconEl) this.iconEl.textContent = this._icon;
                break;
            case 'prev-label':
                this._prevLabel = newValue ?? '←';
                if (this.prevBtnEl) this.prevBtnEl.textContent = this._prevLabel;
                break;
            case 'next-label':
                this._nextLabel = newValue ?? '→';
                if (this.nextBtnEl) this.nextBtnEl.textContent = this._nextLabel;
                break;
            case 'button-color':
                this._buttonColor = newValue ?? '';
                if (this.prevBtnEl) this._applyButtonStyles();
                break;
            case 'button-text-color':
                this._buttonTextColor = newValue ?? '';
                if (this.prevBtnEl) this._applyButtonStyles();
                break;
            case 'button-radius':
                this._buttonRadius = Number(newValue) ?? 999;
                if (this.prevBtnEl) this._applyButtonStyles();
                break;
            case 'breadcrumb-style':
                this._breadcrumbStyle = newValue === 'numbers' ? 'numbers' : 'dots';
                if (this.breadcrumbsEl) this._renderBreadcrumbs();
                break;
            case 'breadcrumb-color':
                this._breadcrumbColor = newValue ?? '#ffffff';
                if (this.breadcrumbsEl) this._renderBreadcrumbs();
                break;
            case 'pill-bottom':
                this._pillBottom = newValue ?? '8vh';
                if (this.navBarEl) this.navBarEl.style.bottom = this._pillBottom;
                break;
            case 'pill-width':
                this._pillWidth = newValue ?? '50%';
                if (this.navBarEl) this.navBarEl.style.width = this._pillWidth;
                break;
        }
    }
}
