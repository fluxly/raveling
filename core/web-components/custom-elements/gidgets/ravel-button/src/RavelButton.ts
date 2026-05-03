import { RavelElement } from '../../../../common/RavelElement';

/**
 * Pixel-art pushbutton. Renders a chunky bordered button whose face color and
 * pixel border size are configurable. Supports pointer-driven value calculation
 * (override {@link calculateValue}), virtual click/drag/release messages,
 * and select/unselect highlight via the messaging system.
 *
 * ### Attributes
 * | Attribute    | Type    | Default   | Description                              |
 * |--------------|---------|-----------|------------------------------------------|
 * | `w`          | number  | `50`      | Button width in px                       |
 * | `h`          | number  | `50`      | Button height in px                      |
 * | `x`          | number  | `0`       | Left position of `#container` (px)       |
 * | `y`          | number  | `0`       | Top position of `#container` (px)        |
 * | `color`      | string  | `#ff0000` | Face color (`background-color`)          |
 * | `pixel-size` | number  | `20`      | Border-pixel thickness in px             |
 * | `margin`     | number  | `0`       | Inner margin between border and face     |
 * | `image`      | string  | —         | URL for an optional button face image    |
 * | `value`      | number  | `0`       | Current value (read/write)               |
 * | `no-click`   | boolean | `false`   | Disables pointer interaction             |
 * | `show-feedback` | boolean | `false` | Reserved for subclass feedback logic    |
 * | `signal-out` | string  | —         | Signal name emitted on value change      |
 *
 * ### Messages received (on `this.id` channel)
 * | cmd              | content                      | Behaviour                     |
 * |------------------|------------------------------|-------------------------------|
 * | `select`         | —                            | Highlights sensor yellow       |
 * | `unselect`       | —                            | Clears sensor highlight        |
 * | `virtual-click`  | `{ offsetX, offsetY }`       | Simulates a pointer-down       |
 * | `virtual-drag`   | `{ x, y }`                   | Simulates pointer-move         |
 * | `virtual-release`| —                            | Simulates pointer-up           |
 */
export class RavelButton extends RavelElement {

    // ── Pixel-art styles ──────────────────────────────────────────────────────

    private static readonly localStyles = `
        #container {
            position: absolute;
            cursor: pointer;
            user-select: none;
            display: flex;
            justify-content: center;
            align-items: center;
        }
        #button-background {
            position: absolute;
            width: 100%;
            height: 100%;
        }
        #sensor {
            position: absolute;
            border-radius: 24px;
            background-color: transparent;
        }
        .pixelArt {
            position: absolute;
        }
        .dark-pixel  { background-color: var(--ravel-button-dark,   #000000); }
        .light-pixel { background-color: var(--ravel-button-light,  #888888); }
        #shadow      { opacity: 0.5; background-color: var(--ravel-button-dark, #000000); }
        #button-image img {
            margin-left: 20%;
            margin-top: 15%;
            width: 60%;
            height: 60%;
        }
        @keyframes pulse {
            to { transform: scale(0.8); }
        }
        .pulse {
            display: inline-block;
            transform: perspective(1px) translateZ(0);
            animation: pulse 0.1s linear infinite alternate;
        }
    `;

    // ── Component HTML (inner content of #container) ──────────────────────────

    private static readonly componentHtml = `
        <div id="sensor"></div>
        <div id="button-background">
            <div id="top-side"    class="dark-pixel pixelArt"></div>
            <div id="left-side"   class="dark-pixel pixelArt"></div>
            <div id="right-side"  class="dark-pixel pixelArt"></div>
            <div id="bottom-side" class="dark-pixel pixelArt"></div>
            <div id="center"      class="light-pixel pixelArt">
                <div id="button-image"></div>
            </div>
            <div id="shadow" class="pixelArt"></div>
        </div>
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'w', 'h', 'image', 'color', 'pixel-size', 'margin',
            'value', 'no-click', 'show-feedback', 'signal-out',
        ];
    }

    // ── Shadow DOM refs ───────────────────────────────────────────────────────

    private sensor!: HTMLElement;
    private center!: HTMLElement;
    private buttonImage!: HTMLElement;

    // ── State ─────────────────────────────────────────────────────────────────

    private width = 50;
    private height = 50;
    /** Pixel-border thickness. Controls the 3-D bevel and shadow depth. */
    private pixelSize = 20;
    /** Gap between the pixel border and the center face area. */
    private margin = 0;
    /** Optional face image URL. */
    private image: string | null = null;
    /** Face color applied as `background-color` on `#center`. */
    private color = '#ff0000';
    /** Current value. Subclasses compute this in {@link calculateValue}. */
    protected value = 0;
    /** When `true`, pointer interaction is disabled. */
    private noClick = false;
    /** Reserved for subclass feedback rendering. */
    protected showFeedback = false;
    /** Signal name emitted when {@link value} changes. Maps to `signals-out`. */
    private signalOut = '';
    /** Pointer offset for virtual drag events. */
    private offsetX = 0;
    private offsetY = 0;
    /**
     * Maximum inner width available for value mapping.
     * Set by {@link buildButton}; read by subclasses in {@link calculateValue}.
     */
    protected innerMax = 0;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize(); // attaches shadow, creates #container

        const style = document.createElement('style');
        style.textContent = RavelButton.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelButton.componentHtml;
        this.sensor      = this.container.querySelector<HTMLElement>('#sensor')!;
        this.center      = this.container.querySelector<HTMLElement>('#center')!;
        this.buttonImage = this.container.querySelector<HTMLElement>('#button-image')!;
    }

    protected setup(): void {
        super.setup();

        // Subscribe to direct messages addressed to this element by ID.
        if (this.id) {
            this.subscribe([this.id]);
            this.addEventListener(this.id, this.handleMessage);
        }

        this.container.style.left   = `${this.x}px`;
        this.container.style.top    = `${this.y}px`;
        this.container.style.width  = `${this.width}px`;
        this.container.style.height = `${this.height}px`;

        this.buildButton();

        this.sensor.style.width  = `${this.width  + this.pixelSize * 2}px`;
        this.sensor.style.height = `${this.height + this.pixelSize * 2}px`;

        if (this.image) {
            this.buttonImage.innerHTML = `<img src="${this.image}" alt=""/>`;
        }

        this.center.style.backgroundColor = this.color;

        if (!this.noClick) {
            this.addEventListener('pointerdown', this.handlePointerDown);
        }

        this.broadcastMessage('register-sensor', this.id, this.container);
    }

    protected teardown(): void {
        if (this.id) {
            this.unsubscribe([this.id]);
            this.removeEventListener(this.id, this.handleMessage);
        }
        if (!this.noClick) {
            this.removeEventListener('pointerdown', this.handlePointerDown);
        }
        document.removeEventListener('pointermove', this.handlePointerMove);
        document.removeEventListener('pointerup',   this.handlePointerUp);
        document.removeEventListener('pointerleave', this.handlePointerUp);
        this.broadcastMessage('unregister-sensor', this.id, null);
        super.teardown();
    }

    // ── Pointer interaction ───────────────────────────────────────────────────

    private handlePointerDown = (e: PointerEvent): void => {
        e.preventDefault();
        this.calculateValue(e.clientX, e.clientY);
        this.triggerPulse();
        document.addEventListener('pointermove',  this.handlePointerMove);
        document.addEventListener('pointerup',    this.handlePointerUp);
        document.addEventListener('pointerleave', this.handlePointerUp);
    };

    private handlePointerMove = (e: PointerEvent): void => {
        e.preventDefault();
        this.calculateValue(e.clientX + this.offsetX, e.clientY + this.offsetY);
    };

    private handlePointerUp = (): void => {
        document.removeEventListener('pointermove',  this.handlePointerMove);
        document.removeEventListener('pointerup',    this.handlePointerUp);
        document.removeEventListener('pointerleave', this.handlePointerUp);
    };

    // ── Message handling ──────────────────────────────────────────────────────

    private handleMessage = (e: Event): void => {
        e.preventDefault();
        const { cmd, content } = (e as CustomEvent).detail;

        switch (cmd) {
            case 'select':
                this.sensor.style.backgroundColor = 'var(--ravel-focus, rgba(255,255,0,0.5))';
                break;

            case 'unselect':
                this.sensor.style.backgroundColor = 'transparent';
                break;

            case 'virtual-click': {
                const c = (content ?? {}) as { offsetX?: number; offsetY?: number };
                this.offsetX = Number(c.offsetX ?? 0);
                this.offsetY = Number(c.offsetY ?? 0);
                const rect = this.container.getBoundingClientRect();
                this.triggerPulse();
                document.addEventListener('pointermove',  this.handlePointerMove);
                document.addEventListener('pointerup',    this.handlePointerUp);
                document.addEventListener('pointerleave', this.handlePointerUp);
                break;
            }

            case 'virtual-drag': {
                const c = (content ?? {}) as { x?: number; y?: number };
                this.calculateValue(Number(c.x ?? 0), Number(c.y ?? 0));
                break;
            }

            case 'virtual-release':
                this.offsetX = 0;
                this.offsetY = 0;
                this.handlePointerUp();
                break;
        }
    };


    /** Plays the short scale-pulse animation on `#container`. */
    private triggerPulse(): void {
        this.container.classList.add('pulse');
        setTimeout(() => this.container.classList.remove('pulse'), 200);
    }

    /**
     * Computes and applies all pixel-art sub-element dimensions and positions.
     * Called in {@link setup} whenever the button is connected.
     */
    private buildButton(): void {
        const innerW  = this.width  - this.pixelSize * 2;
        const innerH  = this.height - this.pixelSize * 2;
        const centerW = innerW - this.margin * 2;
        this.innerMax = centerW - this.margin;

        this.setPixelDimensions('top-side',    innerW,           this.pixelSize);
        this.setPixelDimensions('left-side',   this.pixelSize,   innerH);
        this.setPixelDimensions('bottom-side', innerW,           this.pixelSize);
        this.setPixelDimensions('right-side',  this.pixelSize,   innerH);
        this.setPixelDimensions('center',      centerW,          innerH);
        this.setPixelDimensions('shadow',      innerW,           this.pixelSize);

        this.setPixelPosition('top-side',    this.pixelSize,           0);
        this.setPixelPosition('left-side',   0,                        this.pixelSize);
        this.setPixelPosition('bottom-side', this.pixelSize,           innerH + this.pixelSize);
        this.setPixelPosition('right-side',  innerW + this.pixelSize,  this.pixelSize);
        this.setPixelPosition('center',      this.margin + this.pixelSize, this.pixelSize);
        this.setPixelPosition('shadow',      this.pixelSize,           innerH);
    }

    private setPixelDimensions(id: string, w: number, h: number): void {
        const el = this.container.querySelector<HTMLElement>(`#${id}`);
        if (el) { el.style.width = `${w}px`; el.style.height = `${h}px`; }
    }

    private setPixelPosition(id: string, x: number, y: number): void {
        const el = this.container.querySelector<HTMLElement>(`#${id}`);
        if (el) { el.style.left = `${x}px`; el.style.top = `${y}px`; }
    }

    // ── Attribute handling ────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);

        // Reactively update container position if already in the DOM.
        if ((name === 'x' || name === 'y') && this.container) {
            this.container.style.left = `${this.x}px`;
            this.container.style.top  = `${this.y}px`;
        }

        switch (name) {
            case 'w':            this.width     = Number(newValue);        break;
            case 'h':            this.height    = Number(newValue);        break;
            case 'image':        this.image     = newValue;                break;
            case 'color':        this.color     = newValue ?? '#ff0000';   break;
            case 'pixel-size':   this.pixelSize = Number(newValue);        break;
            case 'margin':       this.margin    = Number(newValue);        break;
            case 'value':        this.value     = Number(newValue);        break;
            case 'no-click':     this.noClick   = newValue !== null;       break;
            case 'show-feedback':this.showFeedback = newValue !== null;    break;
            case 'signal-out':   this.signalOut = newValue ?? '';          break;
        }
    }
}
