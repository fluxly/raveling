import { RavelElement } from '../../../../common/RavelElement';

type BloopSource = 'bloopnet' | 'at' | 'rss';

const SOURCE_BADGE: Record<BloopSource, string> = {
    bloopnet: 'BN',
    at:       'AT',
    rss:      'RSS',
};

/**
 * A compact expandable message card representing a single "bloop" post.
 * Metadata is aligned with AT Protocol field conventions.
 *
 * ### Attributes
 * | Attribute   | Type                     | Default | Description                           |
 * |-------------|--------------------------|---------|---------------------------------------|
 * | `feed`      | string                   | —       | Parent feed channel name              |
 * | `bloop-id`  | string                   | —       | Unique post ID (AT uri / cid / guid)  |
 * | `author`    | string                   | —       | Display name (AT displayName)         |
 * | `handle`    | string                   | —       | @handle or feed URL                   |
 * | `avatar`    | string                   | —       | Emoji or image URL                    |
 * | `text`      | string                   | —       | Short post text                       |
 * | `timestamp` | string                   | —       | ISO 8601 datetime                     |
 * | `source`    | bloopnet \| at \| rss    | —       | Source platform; drives accent color  |
 * | `expanded`  | boolean                  | false   | Show full text and slotted content    |
 *
 * ### Messages received (on `[feed]` channel)
 * | cmd        | content             | Effect                               |
 * |------------|---------------------|--------------------------------------|
 * | `expand`   | `{ bloopId }`       | Expand if bloopId matches            |
 * | `collapse` | `{ bloopId }`       | Collapse if bloopId matches          |
 *
 * ### Messages broadcast (window-level, on `[feed]` channel)
 * | cmd        | content             | Trigger                              |
 * |------------|---------------------|--------------------------------------|
 * | `expanded` | `{ bloopId }`       | User expands the card                |
 * | `collapsed`| `{ bloopId }`       | User collapses the card              |
 */
export class RavelBloopCard extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: block;
            box-sizing: border-box;
        }

        #container {
            display: flex;
            gap: 12px;
            padding: 12px 14px 12px 12px;
            background: #1c1c1c;
            border-left: 3px solid rgba(102, 102, 102, 0.22);
            border-bottom: 1px solid rgba(102, 102, 102, 0.12);
            cursor: pointer;
            transition: background 0.12s;
            position: relative;
            user-select: none;
        }
        #container:hover { background: #222222; }

        :host([source="bloopnet"]) #container { border-left-color: #20C8D8; }
        :host([source="at"])       #container { border-left-color: #0085ff; }
        :host([source="rss"])      #container { border-left-color: #FE6810; }

        /* ── Avatar ──────────────────────────────────────────── */
        #avatar-col { flex-shrink: 0; width: 40px; }
        #avatar-wrap {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            background: #2a2a2a;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            overflow: hidden;
            flex-shrink: 0;
        }
        #avatar-wrap img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        /* ── Content ─────────────────────────────────────────── */
        #content-col { flex: 1; min-width: 0; }

        #meta-row {
            display: flex;
            align-items: baseline;
            gap: 6px;
            flex-wrap: wrap;
            margin-bottom: 4px;
            padding-right: 24px;
        }
        #author-name {
            font-family: 'Quantico', monospace, sans-serif;
            font-size: 0.875rem;
            font-weight: 700;
            color: #ffffff;
            white-space: nowrap;
        }
        #handle-text {
            font-family: 'Quantico', monospace, sans-serif;
            font-size: 0.78rem;
            color: #555555;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 160px;
        }
        #ts-text {
            font-family: 'Quantico', monospace, sans-serif;
            font-size: 0.78rem;
            color: #484848;
            white-space: nowrap;
        }
        .sep {
            font-size: 0.78rem;
            color: #383838;
        }
        #source-badge {
            font-family: 'Silkscreen', monospace;
            font-size: 0.6rem;
            padding: 1px 4px;
            border-radius: 3px;
            border: 1px solid currentColor;
            white-space: nowrap;
            flex-shrink: 0;
            line-height: 1.6;
        }
        :host([source="bloopnet"]) #source-badge { color: #20C8D8; }
        :host([source="at"])       #source-badge { color: #0085ff; }
        :host([source="rss"])      #source-badge { color: #FE6810; }
        #source-badge:empty        { display: none; }

        /* ── Blurb (headline in collapsed view) ─────────────── */
        #blurb-text {
            margin: 0 0 3px 0;
            font-family: 'Quantico', monospace, sans-serif;
            font-size: 0.875rem;
            font-weight: 700;
            color: #e8e8e8;
            line-height: 1.4;
            word-break: break-word;
        }
        #blurb-text:empty { display: none; }

        /* ── Body text ────────────────────────────────────────── */
        #text-body {
            margin: 0;
            font-family: 'Quantico', monospace, sans-serif;
            font-size: 0.9rem;
            line-height: 1.55;
            color: #c0c0c0;
            word-break: break-word;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        :host([expanded]) #text-body {
            display: block;
            overflow: visible;
        }

        /* ── Expandable slot area ─────────────────────────────── */
        #expanded-area {
            display: grid;
            grid-template-rows: 0fr;
            transition: grid-template-rows 0.22s ease;
        }
        :host([expanded]) #expanded-area {
            grid-template-rows: 1fr;
        }
        #expanded-inner { overflow: hidden; }
        #slot-wrap {
            padding-top: 8px;
            font-family: 'Quantico', monospace, sans-serif;
            font-size: 0.9rem;
            color: #c0c0c0;
            line-height: 1.55;
        }
        #slot-wrap:empty { display: none; }

        /* ── Toggle chevron ───────────────────────────────────── */
        #toggle-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: transparent;
            border: none;
            cursor: pointer;
            color: #3a3a3a;
            font-size: 14px;
            padding: 2px 5px;
            border-radius: 3px;
            line-height: 1;
            transition: color 0.12s, background 0.12s;
        }
        #toggle-btn:hover { color: #888888; background: rgba(255,255,255,0.05); }
        #toggle-btn:focus-visible {
            outline: 2px solid var(--ravel-focus, #20C8D8);
            outline-offset: 2px;
        }
        #chevron {
            display: inline-block;
            transition: transform 0.22s ease;
        }
        :host([expanded]) #chevron { transform: rotate(180deg); }
    `;

    private static readonly componentHtml = `
        <div id="avatar-col">
            <div id="avatar-wrap"></div>
        </div>
        <div id="content-col">
            <div id="meta-row">
                <span id="author-name"></span>
                <span id="handle-text"></span>
                <span class="sep" id="sep-ts" hidden>·</span>
                <span id="ts-text"></span>
                <span id="source-badge"></span>
            </div>
            <p id="blurb-text"></p>
            <p id="text-body"></p>
            <div id="expanded-area">
                <div id="expanded-inner">
                    <div id="slot-wrap"><slot></slot></div>
                </div>
            </div>
        </div>
        <button id="toggle-btn" type="button" aria-expanded="false" aria-label="Expand bloop">
            <span id="chevron" aria-hidden="true">▾</span>
        </button>
    `;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'feed', 'bloop-id',
            'author', 'handle', 'avatar', 'text', 'timestamp', 'source',
            'expanded', 'blurb',
        ];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _avatarWrap!: HTMLElement;
    private _authorEl!:   HTMLElement;
    private _handleEl!:   HTMLElement;
    private _sepTs!:      HTMLElement;
    private _tsEl!:       HTMLElement;
    private _badgeEl!:    HTMLElement;
    private _blurbEl!:    HTMLElement;
    private _textEl!:     HTMLElement;
    private _toggleBtn!:  HTMLButtonElement;

    // ── State ─────────────────────────────────────────────────────────────────

    private _feed      = '';
    private _bloopId   = '';
    private _author    = '';
    private _handle    = '';
    private _avatar    = '';
    private _blurb     = '';
    private _text      = '';
    private _timestamp = '';
    private _source    = '';
    private _expanded  = false;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelBloopCard.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.setAttribute('role', 'article');
        this.container.innerHTML = RavelBloopCard.componentHtml;

        this._avatarWrap = this.container.querySelector<HTMLElement>('#avatar-wrap')!;
        this._authorEl   = this.container.querySelector<HTMLElement>('#author-name')!;
        this._handleEl   = this.container.querySelector<HTMLElement>('#handle-text')!;
        this._sepTs      = this.container.querySelector<HTMLElement>('#sep-ts')!;
        this._tsEl       = this.container.querySelector<HTMLElement>('#ts-text')!;
        this._badgeEl    = this.container.querySelector<HTMLElement>('#source-badge')!;
        this._blurbEl    = this.container.querySelector<HTMLElement>('#blurb-text')!;
        this._textEl     = this.container.querySelector<HTMLElement>('#text-body')!;
        this._toggleBtn  = this.container.querySelector<HTMLButtonElement>('#toggle-btn')!;

        // Attribute callbacks fire before connectedCallback — render accumulated state now
        this._renderAvatar();
        this._renderMeta();
        this._renderBlurb();
        this._renderText();
        this._renderExpanded();
    }

    protected setup(): void {
        super.setup();
        if (this._feed) {
            this.subscribe([this._feed]);
            this.addEventListener(this._feed, this._onMessage);
        }
        this.container.addEventListener('click', this._onCardClick);
        // Prevent slot content clicks from bubbling up to the card toggle
        this.container.querySelector('#expanded-inner')
            ?.addEventListener('click', (e) => e.stopPropagation());
    }

    protected teardown(): void {
        if (this._feed) {
            this.unsubscribe([this._feed]);
            this.removeEventListener(this._feed, this._onMessage);
        }
        this.container.removeEventListener('click', this._onCardClick);
        super.teardown();
    }

    // ── Rendering ─────────────────────────────────────────────────────────────

    private _renderAvatar(): void {
        const src = this._avatar;
        this._avatarWrap.innerHTML = '';
        if (src && (src.startsWith('http') || src.startsWith('/') || src.startsWith('data:'))) {
            const img = document.createElement('img');
            img.src = src;
            img.alt = '';
            this._avatarWrap.appendChild(img);
        } else if (src) {
            this._avatarWrap.textContent = src;
        } else {
            this._avatarWrap.appendChild(this._generateInitialsAvatar(this._author));
        }
    }

    private _generateInitialsAvatar(author: string): HTMLElement {
        const words    = (author || '?').trim().split(/\s+/);
        const initials = words.length >= 2
            ? (words[0][0] + words[words.length - 1][0]).toUpperCase()
            : words[0].slice(0, 2).toUpperCase();
        const div = document.createElement('div');
        div.textContent = initials;
        Object.assign(div.style, {
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: this._authorColor(author),
            color: '#ffffff',
            fontFamily: "'Quantico', monospace, sans-serif",
            fontWeight: '700',
            fontSize: '0.875rem',
            borderRadius: '8px',
            userSelect: 'none',
        });
        return div;
    }

    private _authorColor(author: string): string {
        let hash = 0;
        for (let i = 0; i < author.length; i++) {
            hash = (hash * 31 + author.charCodeAt(i)) >>> 0;
        }
        return `hsl(${hash % 360}, 45%, 32%)`;
    }

    private _renderBlurb(): void {
        this._blurbEl.textContent = this._blurb;
    }

    private _renderMeta(): void {
        this._authorEl.textContent = this._author;
        this._handleEl.textContent = this._formatHandle(this._handle);
        const ts = this._formatTimestamp(this._timestamp);
        this._tsEl.textContent     = ts;
        this._sepTs.hidden         = !ts;
        this._badgeEl.textContent  = SOURCE_BADGE[this._source as BloopSource] ?? '';
    }

    private _renderText(): void {
        this._textEl.textContent = this._text;
    }

    private _renderExpanded(): void {
        this._toggleBtn.setAttribute('aria-expanded', String(this._expanded));
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private _formatHandle(handle: string): string {
        if (!handle) return '';
        if (handle.startsWith('@')) return handle;
        if (handle.startsWith('http')) {
            try { return new URL(handle).hostname; } catch { /* fall through */ }
        }
        return `@${handle}`;
    }

    private _formatTimestamp(iso: string): string {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return iso;
        const diff = Date.now() - d.getTime();
        const secs  = Math.floor(diff / 1000);
        if (secs < 60)   return 'just now';
        const mins  = Math.floor(secs  / 60);
        if (mins < 60)   return `${mins}m`;
        const hours = Math.floor(mins  / 60);
        if (hours < 24)  return `${hours}h`;
        const days  = Math.floor(hours / 24);
        if (days < 30)   return `${days}d`;
        return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    }

    // ── Interaction ───────────────────────────────────────────────────────────

    private _onCardClick = (): void => {
        this._toggle();
    };

    private _toggle(): void {
        const nowExpanded = !this._expanded;
        if (nowExpanded) {
            this.setAttribute('expanded', '');
        } else {
            this.removeAttribute('expanded');
        }
        if (this._feed) {
            this.broadcastMessage(
                this._feed,
                nowExpanded ? 'expanded' : 'collapsed',
                { bloopId: this._bloopId },
            );
        }
    }

    // ── Messages ──────────────────────────────────────────────────────────────

    private _onMessage = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent<{ cmd: string; content: unknown }>).detail ?? {};
        const id = (content as { bloopId?: string })?.bloopId;
        if (id && id !== this._bloopId) return;

        if (cmd === 'expand'   && !this._expanded) this.setAttribute('expanded', '');
        if (cmd === 'collapse' &&  this._expanded) this.removeAttribute('expanded');
    };

    // ── Attribute handling ────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);

        switch (name) {
            case 'feed':
                if (this.container && oldValue && oldValue !== newValue) {
                    this.unsubscribe([oldValue]);
                    this.removeEventListener(oldValue, this._onMessage);
                }
                this._feed = newValue ?? '';
                if (this.container && this._feed) {
                    this.subscribe([this._feed]);
                    this.addEventListener(this._feed, this._onMessage);
                }
                break;
            case 'bloop-id':   this._bloopId   = newValue ?? ''; break;
            case 'author':
                this._author = newValue ?? '';
                if (this._authorEl)  this._renderMeta();
                if (this._avatarWrap && !this._avatar) this._renderAvatar();
                break;
            case 'handle':     this._handle    = newValue ?? ''; if (this._handleEl)  this._renderMeta();   break;
            case 'avatar':     this._avatar    = newValue ?? ''; if (this._avatarWrap) this._renderAvatar(); break;
            case 'blurb':      this._blurb     = newValue ?? ''; if (this._blurbEl)   this._renderBlurb();  break;
            case 'text':       this._text      = newValue ?? ''; if (this._textEl)    this._renderText();   break;
            case 'timestamp':  this._timestamp = newValue ?? ''; if (this._tsEl)      this._renderMeta();   break;
            case 'source':     this._source    = newValue ?? ''; if (this._badgeEl)   this._renderMeta();   break;
            case 'expanded':
                this._expanded = newValue !== null;
                if (this._toggleBtn) this._renderExpanded();
                break;
        }
    }
}
