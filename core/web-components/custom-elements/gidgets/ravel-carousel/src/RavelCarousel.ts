import { RavelElement } from '../../../../common/RavelElement';

/**
 * A horizontally-scrolling carousel with optional snap and arrow nav buttons.
 * Slotted children are laid out in a single flex row; scroll-snap aligns to
 * the start of each child.
 *
 * ### Attributes
 * | Attribute   | Type              | Default      | Description                             |
 * |-------------|-------------------|--------------|-----------------------------------------|
 * | `page-size` | `viewport` \| number | `viewport` | Pixels to scroll per arrow click      |
 * | `snap`      | `1 \| 0`          | `1`          | Enable scroll-snap                      |
 * | `arrows`    | `1 \| 0`          | `1`          | Show prev/next arrow buttons            |
 *
 * ### CSS custom properties
 * | Property        | Default               | Description                    |
 * |-----------------|-----------------------|--------------------------------|
 * | `--gap`         | `12px`                | Gap between items              |
 * | `--pad`         | `12px`                | Horizontal padding inside wrap |
 * | `--btn-size`    | `44px`                | Arrow button diameter          |
 * | `--btn-bg`      | `rgba(0,0,0,0.55)`    | Arrow button background        |
 * | `--btn-fg`      | `#ffffff`             | Arrow button icon color        |
 * | `--btn-radius`  | `999px`               | Arrow button border-radius     |
 * | `--fade-width`  | `28px`                | Edge-fade width                |
 */
export class RavelCarousel extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: block;
            --gap:         12px;
            --pad:         12px;
            --btn-size:    44px;
            --btn-bg:      rgba(0,0,0,0.55);
            --btn-fg:      #ffffff;
            --btn-radius:  999px;
            --fade-width:  28px;
            position: relative;
            box-sizing: border-box;
        }
        .wrap {
            position: relative;
            box-sizing: border-box;
            padding: var(--pad);
        }
        .viewport {
            position: relative;
            overflow-x: auto;
            overflow-y: hidden;
            -webkit-overflow-scrolling: touch;
            scroll-behavior: smooth;
            scrollbar-width: none;
            scroll-snap-type: x mandatory;
            overscroll-behavior-x: contain;
        }
        .viewport::-webkit-scrollbar { display: none; }
        .viewport[data-snap="0"] { scroll-snap-type: none; }
        .track {
            display: flex;
            gap: var(--gap);
            align-items: center;
            width: max-content;
            min-width: 100%;
            box-sizing: border-box;
        }
        ::slotted(*) {
            flex: 0 0 auto;
            scroll-snap-align: start;
        }
        /* Arrow buttons */
        button.nav {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: var(--btn-size);
            height: var(--btn-size);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: var(--btn-radius);
            background: var(--btn-bg);
            color: var(--btn-fg);
            font-family: 'Silkscreen', monospace;
            font-size: 20px;
            cursor: pointer;
            display: grid;
            place-items: center;
            z-index: 2;
            padding: 0;
            user-select: none;
            -webkit-tap-highlight-color: transparent;
            transition: background 120ms, opacity 120ms;
            backdrop-filter: blur(4px);
        }
        button.nav:hover:not([disabled]) {
            background: rgba(0,0,0,0.75);
            border-color: rgba(255,255,255,0.4);
        }
        button.nav[disabled] {
            opacity: 0.25;
            cursor: default;
        }
        button.prev { left:  calc(var(--pad) * 0.5); }
        button.next { right: calc(var(--pad) * 0.5); }
        /* Edge fades */
        .fade {
            position: absolute;
            top: 0; bottom: 0;
            width: var(--fade-width);
            pointer-events: none;
            z-index: 1;
            transition: opacity 200ms;
        }
        .fade.left {
            left: var(--pad);
            background: linear-gradient(to right, rgba(0,0,0,0.3), transparent);
        }
        .fade.right {
            right: var(--pad);
            background: linear-gradient(to left,  rgba(0,0,0,0.3), transparent);
        }
        @media (prefers-reduced-motion: reduce) {
            .viewport { scroll-behavior: auto; }
        }
    `;

    private static readonly componentHtml = `
        <div class="wrap">
            <button class="nav prev" part="prev" aria-label="Scroll left"  type="button">
                <span aria-hidden="true">‹</span>
            </button>
            <button class="nav next" part="next" aria-label="Scroll right" type="button">
                <span aria-hidden="true">›</span>
            </button>

            <div class="fade left"  part="fade-left"></div>
            <div class="fade right" part="fade-right"></div>

            <div class="viewport" part="viewport">
                <div class="track" part="track">
                    <slot></slot>
                </div>
            </div>
        </div>
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'page-size', 'snap', 'arrows'];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _viewportEl!: HTMLElement;
    private _prevEl!:     HTMLButtonElement;
    private _nextEl!:     HTMLButtonElement;
    private _slotEl!:     HTMLSlotElement;
    private _leftFadeEl!: HTMLElement;
    private _rightFadeEl!: HTMLElement;

    private _isReady = false;
    private _ro:      ResizeObserver | null = null;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelCarousel.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelCarousel.componentHtml;

        this._viewportEl  = this.container.querySelector<HTMLElement>('.viewport')!;
        this._prevEl      = this.container.querySelector<HTMLButtonElement>('.prev')!;
        this._nextEl      = this.container.querySelector<HTMLButtonElement>('.next')!;
        this._slotEl      = this.container.querySelector<HTMLSlotElement>('slot')!;
        this._leftFadeEl  = this.container.querySelector<HTMLElement>('.fade.left')!;
        this._rightFadeEl = this.container.querySelector<HTMLElement>('.fade.right')!;
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;

        this._prevEl.addEventListener('click',        this._onPrev);
        this._nextEl.addEventListener('click',        this._onNext);
        this._viewportEl.addEventListener('scroll',   this._updateNavState, { passive: true });
        this._slotEl.addEventListener('slotchange',   this._updateNavState);

        this._ro = new ResizeObserver(this._updateNavState);
        this._ro.observe(this._viewportEl);

        this._applyAttributes();
        this._updateNavState();
    }

    protected teardown(): void {
        this._isReady = false;

        this._prevEl.removeEventListener('click',      this._onPrev);
        this._nextEl.removeEventListener('click',      this._onNext);
        this._viewportEl.removeEventListener('scroll', this._updateNavState);
        this._slotEl.removeEventListener('slotchange', this._updateNavState);

        this._ro?.disconnect();
        this._ro = null;

        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (oldValue === newValue) return;
        if (name === 'page-size' || name === 'snap' || name === 'arrows') {
            if (this._isReady) {
                this._applyAttributes();
                this._updateNavState();
            }
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    scrollByPage(direction: 1 | -1): void {
        if (!this._viewportEl) return;
        const left = this._viewportEl.scrollLeft + direction * this._pageSize();
        this._viewportEl.scrollTo({ left });
    }

    scrollToIndex(index: number): void {
        const items = this._slottedItems();
        items[index]?.scrollIntoView({ inline: 'start', block: 'nearest' });
    }

    // ── Event handlers (arrow properties — auto-bound) ────────────────────────

    private _onPrev = (): void => this.scrollByPage(-1);
    private _onNext = (): void => this.scrollByPage(1);

    private _updateNavState = (): void => {
        if (!this._isReady) return;

        const maxScroll = this._viewportEl.scrollWidth - this._viewportEl.clientWidth;
        const tol       = 1;
        const atStart   = this._viewportEl.scrollLeft <= tol;
        const atEnd     = this._viewportEl.scrollLeft >= maxScroll - tol;
        const canScroll = maxScroll > tol;

        this._prevEl.disabled = !canScroll || atStart;
        this._nextEl.disabled = !canScroll || atEnd;

        this._leftFadeEl.style.opacity  = canScroll && !atStart ? '1' : '0';
        this._rightFadeEl.style.opacity = canScroll && !atEnd   ? '1' : '0';
    };

    // ── Helpers ───────────────────────────────────────────────────────────────

    private _applyAttributes(): void {
        if (!this._isReady) return;

        const snap    = this.getAttribute('snap');
        const snapOn  = snap == null || snap !== '0';
        this._viewportEl.dataset['snap'] = snapOn ? '1' : '0';

        const arrows   = this.getAttribute('arrows');
        const arrowsOn = arrows == null || arrows !== '0';
        this._prevEl.style.display = arrowsOn ? '' : 'none';
        this._nextEl.style.display = arrowsOn ? '' : 'none';
    }

    private _pageSize(): number {
        const attr = (this.getAttribute('page-size') ?? 'viewport').trim();
        if (attr === 'viewport') return this._viewportEl.clientWidth;
        const n = Number(attr);
        return Number.isFinite(n) && n > 0 ? n : this._viewportEl.clientWidth;
    }

    private _slottedItems(): Element[] {
        return (this._slotEl?.assignedElements({ flatten: true }) ?? [])
            .filter(n => n.nodeType === Node.ELEMENT_NODE);
    }
}
