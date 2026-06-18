import { RavelElement } from '../../../../common/RavelElement';

/**
 * A clickable thumbnail card that opens a full-screen reader overlay.
 * The reader fetches and displays an HTML document from `src`, or opens
 * an external URL when `external-link` is set.
 *
 * ### Attributes
 * | Attribute       | Type    | Default | Description                                      |
 * |-----------------|---------|---------|--------------------------------------------------|
 * | `icon`          | string  | `''`    | Thumbnail image URL                              |
 * | `src`           | string  | `''`    | URL of HTML content to load in the reader        |
 * | `label`         | string  | `''`    | Accessible label for the card                    |
 * | `anchor`        | string  | `''`    | ID for external open/close messaging             |
 * | `max-width`     | number  | —       | Maximum card width in px                         |
 * | `external-link` | string  | `''`    | If set, click opens this URL instead of reader   |
 *
 * ### Messages received (on `'scrapbook'` channel)
 * | cmd     | content          | Effect                                |
 * |---------|------------------|---------------------------------------|
 * | `open`  | anchor string    | Opens the reader if anchor matches    |
 * | `close` | anchor string    | Closes the reader if anchor matches   |
 */
export class RavelScrapbook extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: inline-block;
            font-family: inherit;
            user-select: none;
            touch-action: none;
        }

        /* ── Thumbnail card ───────────────────────────────── */
        #card {
            border: 10px solid rgba(255,255,255,0.80);
            border-radius: 20px;
            overflow: hidden;
            cursor: pointer;
            outline: none;
            background: #303030;
            width: 200px;
            height: 200px;
            position: relative;
            box-sizing: border-box;
        }
        #card:focus {
            outline: 5px solid #A7FF00;
            outline-offset: 3px;
        }
        #icon {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
        #icon[src=""] { display: none; }
        #placeholder {
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            background: linear-gradient(135deg, #2a2a2a, #181818);
            font-size: 3.5em;
        }
        #card.has-icon #placeholder { display: none; }

        /* ── Full-screen overlay blocker ──────────────────── */
        #blocker {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.6);
            z-index: 9998;
        }

        /* ── Reader panel ─────────────────────────────────── */
        #reader {
            display: none;
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 90vw;
            max-width: 1000px;
            height: 90vh;
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 0 0 10px rgba(255,255,255,0.4);
            z-index: 9999;
            overflow: hidden;
            padding-top: 40px;
            box-sizing: border-box;
        }
        #reader-content {
            font-family: 'Quantico', Quantico, sans-serif;
            font-size: 14pt;
            line-height: 1.45;
            height: 100%;
            overflow-y: scroll;
            overscroll-behavior: none;
            display: flex;
            flex-direction: column;
            align-items: center;
            box-sizing: border-box;
        }
        #reader-content:focus { outline: none; }

        /* ── Close button ─────────────────────────────────── */
        #close {
            position: absolute;
            top: 14px;
            right: 16px;
            width: 44px;
            height: 44px;
            border: none;
            background: #ffffff;
            border-radius: 50%;
            cursor: pointer;
            font-size: 1.1em;
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1;
            box-shadow: 0 2px 8px rgba(0,0,0,0.18);
            color: #303030;
        }
        #close:focus {
            outline: 5px solid #A7FF00;
            background: #ffff00;
        }

        /* ── Loading state ────────────────────────────────── */
        #loading {
            display: flex;
            justify-content: center;
            align-items: center;
            font-size: 96px;
            min-height: 200px;
        }

        /* ── Injected scrapbook content styles ────────────── */
        #reader-content .featured-image,
        #reader-content .double-border {
            max-width: 800px;
            border: 10px solid #ffff00;
            box-shadow: 0 0 0 10px #ff0000;
            border-radius: 24px;
            margin: 10px;
        }
        #reader-content .featured-image-wrapper { margin-top: 20px; }
        #reader-content .date-header {
            display: inline-block;
            font-weight: 900;
            font-size: 24pt;
            line-height: 24pt;
            color: #ffffff;
            background-color: #ff0000;
            padding: 5px 20px;
            position: relative;
            top: -10px;
            border-bottom-left-radius: 10px;
            border-bottom-right-radius: 10px;
        }
        #reader-content h1 {
            width: 90%;
            text-align: center;
            font-weight: 900;
            font-size: 28pt;
            line-height: 1.1;
        }
        #reader-content .image-caption {
            margin-right: -18px;
            font-size: 8pt;
            display: inline-block;
            writing-mode: vertical-rl;
            text-orientation: sideways;
        }
        #reader-content p,
        #reader-content ul,
        #reader-content ol {
            width: 90%;
            max-width: 840px;
            margin: 10px auto;
        }
        #reader-content a:focus { outline: 5px solid #ffff00; background-color: #ffff00; }
        #reader-content .medium-img        { width: 600px; }
        #reader-content .medium-small-img  { width: 300px; }
        #reader-content .small-img         { width: 125px; }
        #reader-content .full-width        { width: 90%; }
        #reader-content .footer {
            width: 100%;
            min-height: 100px;
        }
        #reader-content .caption-box {
            margin-top: 10px;
            padding: 20px;
            border: 1px dotted #444444;
            background: #ffffef;
        }
        #reader-content .resource-collection { max-width: 90%; }
        #reader-content iframe { max-width: 100%; }

        @media (max-width: 600px) {
            #reader-content {
                font-size: 12pt;
                padding-top: 60px;
            }
            #reader-content .featured-image { max-width: 300px; }
            #reader-content .medium-img         { width: 200px; }
            #reader-content .medium-small-img   { width: 100px; }
            #reader-content .small-img          { width: 50px; }
            #reader-content h1 { font-size: 24pt; }
            #reader-content iframe { max-width: 300px; }
        }
    `;

    private static readonly componentHtml = `
        <div id="blocker" aria-hidden="true"></div>
        <div id="card" tabindex="0" role="button">
            <img id="icon" alt="">
            <div id="placeholder" aria-hidden="true">🧶</div>
        </div>
        <div id="reader" role="dialog" aria-modal="true" tabindex="-1" hidden>
            <div id="reader-content" tabindex="0">
                <div id="loading">🧶</div>
            </div>
            <button id="close" type="button" aria-label="Close">✕</button>
        </div>
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes,
            'icon', 'src', 'max-width', 'anchor', 'label', 'external-link'];
    }

    // ── DOM refs (prefixed _ to avoid collision with base class `container`) ──

    private _cardEl!:          HTMLElement;
    private _iconEl!:          HTMLImageElement;
    private _readerEl!:        HTMLElement;
    private _readerContentEl!: HTMLElement;
    private _blockerEl!:       HTMLElement;
    private _closeEl!:         HTMLButtonElement;

    private _isReady = false;

    // ── Component state ───────────────────────────────────────────────────────

    private _icon:         string  = '';
    private _src:          string  = '';
    private _label:        string  = '';
    private _anchor:       string  = '';
    private _maxWidth:     number  = 0;
    private _externalLink: string  = '';
    private _readerOpen:   boolean = false;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelScrapbook.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelScrapbook.componentHtml;

        this._cardEl          = this.container.querySelector<HTMLElement>('#card')!;
        this._iconEl          = this.container.querySelector<HTMLImageElement>('#icon')!;
        this._readerEl        = this.container.querySelector<HTMLElement>('#reader')!;
        this._readerContentEl = this.container.querySelector<HTMLElement>('#reader-content')!;
        this._blockerEl       = this.container.querySelector<HTMLElement>('#blocker')!;
        this._closeEl         = this.container.querySelector<HTMLButtonElement>('#close')!;
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;

        this._cardEl.addEventListener('click',   this._handleClick);
        this._cardEl.addEventListener('keydown', this._handleKeyDown);
        this._closeEl.addEventListener('click',  this._handleClick);
        this._closeEl.addEventListener('keydown', this._handleKeyDown);
        this._blockerEl.addEventListener('click', this._handleClick);
        window.addEventListener('scrapbook',     this._handleExternalMessage as EventListener);

        this._syncUi();
    }

    protected teardown(): void {
        this._isReady = false;

        window.removeEventListener('scrapbook', this._handleExternalMessage as EventListener);

        this._cardEl.removeEventListener('click',   this._handleClick);
        this._cardEl.removeEventListener('keydown', this._handleKeyDown);
        this._closeEl.removeEventListener('click',  this._handleClick);
        this._closeEl.removeEventListener('keydown', this._handleKeyDown);
        this._blockerEl.removeEventListener('click', this._handleClick);

        if (this._readerOpen) this._closeReader();

        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);

        switch (name) {
            case 'icon':          this._icon         = newValue ?? ''; break;
            case 'src':           this._src          = newValue ?? ''; break;
            case 'label':         this._label        = newValue ?? ''; break;
            case 'anchor':        this._anchor       = newValue ?? ''; break;
            case 'external-link': this._externalLink = newValue ?? ''; break;
            case 'max-width': {
                const n = parseInt(newValue ?? '', 10);
                this._maxWidth = isNaN(n) ? 0 : n;
                break;
            }
        }
        if (this._isReady) this._syncUi();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    open():  void { if (!this._readerOpen) this._openReader(); }
    close(): void { if (this._readerOpen)  this._closeReader(); }

    // ── Event handlers ────────────────────────────────────────────────────────

    private _handleClick = (evt: Event): void => {
        evt.preventDefault();
        evt.stopPropagation();
        if (evt.currentTarget === this._blockerEl || evt.currentTarget === this._closeEl) {
            this._closeReader();
            return;
        }
        if (this._externalLink) {
            window.open(this._externalLink, '_blank', 'noopener,noreferrer');
            return;
        }
        this._readerOpen ? this._closeReader() : this._openReader();
    };

    private _handleKeyDown = (evt: KeyboardEvent): void => {
        // Tab forward from close button → close reader
        if (evt.currentTarget === this._closeEl && evt.key === 'Tab' && !evt.shiftKey) {
            evt.preventDefault();
            evt.stopPropagation();
            this._closeReader();
            return;
        }
        // Shift-Tab back on card while reader is open → trap focus
        if (this._readerOpen && evt.currentTarget === this._cardEl && evt.key === 'Tab' && evt.shiftKey) {
            evt.preventDefault();
            evt.stopPropagation();
            return;
        }
        if (evt.key !== 'Enter' && evt.key !== ' ') return;
        evt.preventDefault();
        evt.stopPropagation();
        if (this._externalLink) {
            window.open(this._externalLink, '_blank', 'noopener,noreferrer');
            return;
        }
        this._readerOpen ? this._closeReader() : this._openReader();
    };

    private _handleExternalMessage = (evt: CustomEvent): void => {
        if (!this._anchor || !evt.detail?.content) return;
        if (evt.detail.cmd === 'open' && evt.detail.content === this._anchor) {
            this.scrollIntoView({ behavior: 'smooth', block: 'start' });
            this.focus();
            this._openReader();
        }
        if (evt.detail.cmd === 'close' && evt.detail.content === this._anchor) {
            this._closeReader();
        }
    };

    // ── Reader open / close ───────────────────────────────────────────────────

    private _openReader(): void {
        this._readerOpen = true;
        this._readerEl.hidden = false;
        this._readerEl.style.display = 'block';
        this._blockerEl.style.display = 'block';
        this._cardEl.classList.add('selected');
        document.body.style.overflow = 'hidden';
        this._fetchContent();
    }

    private _closeReader(): void {
        this._readerOpen = false;
        this._readerEl.hidden = true;
        this._readerEl.style.display = 'none';
        this._blockerEl.style.display = 'none';
        this._readerContentEl.innerHTML = '<div id="loading">🧶</div>';
        this._cardEl.classList.remove('selected');
        document.body.style.overflow = '';
        this._cardEl.focus();
    }

    private async _fetchContent(): Promise<void> {
        if (!this._src) return;
        try {
            const res  = await fetch(this._src, {
                method: 'GET',
                headers: { 'pragma': 'no-cache', 'cache-control': 'no-cache' },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const html = await res.text();
            this._readerContentEl.innerHTML = html;
            this._readerContentEl.focus();
        } catch {
            this._readerContentEl.innerHTML =
                '<p style="padding:40px;color:#cc0000">Could not load content.</p>';
        }
    }

    // ── UI sync ───────────────────────────────────────────────────────────────

    private _syncUi(): void {
        if (!this._isReady) return;

        // Icon
        if (this._icon) {
            this._iconEl.src = this._icon;
            this._iconEl.alt = this._label || '';
            this._cardEl.classList.add('has-icon');
        } else {
            this._iconEl.src = '';
            this._cardEl.classList.remove('has-icon');
        }

        // Label → ARIA
        const label = this._label || (this._anchor ? `scrapbook: ${this._anchor}` : 'scrapbook');
        this._cardEl.setAttribute('aria-label', label);

        // Max width
        this._cardEl.style.maxWidth = this._maxWidth > 0 ? `${this._maxWidth}px` : '';

        // External link hint
        if (this._externalLink) {
            this._cardEl.setAttribute('aria-description', 'Opens in new tab');
        } else {
            this._cardEl.removeAttribute('aria-description');
        }
    }
}
