import { RavelElement } from '../../../../common/RavelElement';

export interface PhotoItem {
    id:      string;
    src:     string;
    alt?:    string;
    is_hero?: boolean;
}

/**
 * Horizontal scrollable strip of photo thumbnails with selection and hero marking.
 * Clicking selects; double-clicking marks a photo as hero.
 *
 * ### Attributes
 * | Attribute  | Type    | Default       | Description              |
 * |------------|---------|---------------|--------------------------|
 * | `photos`   | JSON    | `[]`          | Array of `PhotoItem`     |
 * | `selected` | number  | `0`           | Index of selected photo  |
 * | `channel`  | string  | `photo-strip` | Message channel          |
 *
 * ### Messages emitted (channel + DOM event)
 * | cmd        | content            | Trigger                |
 * |------------|--------------------|------------------------|
 * | `select`   | `{ index, id }`    | Photo clicked          |
 * | `set-hero` | `{ index, id }`    | Photo double-clicked   |
 *
 * ### Messages received (channel)
 * | cmd          | content       | Effect              |
 * |--------------|---------------|---------------------|
 * | `set-photos` | `PhotoItem[]` | Replace all photos  |
 * | `add-photo`  | `PhotoItem`   | Append a photo      |
 */
export class RavelPhotoStrip extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: block;
            --strip-accent: var(--ravel-accent, #FF4FB3);
            --thumb-size: 88px;
        }

        #strip {
            display: flex;
            flex-direction: row;
            gap: 6px;
            padding: 10px 12px;
            overflow-x: auto;
            scroll-behavior: smooth;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.10) transparent;
            align-items: center;
        }
        #strip::-webkit-scrollbar { height: 4px; }
        #strip::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.10);
            border-radius: 2px;
        }

        .thumb {
            position: relative;
            width:  var(--thumb-size);
            height: var(--thumb-size);
            flex-shrink: 0;
            border-radius: 5px;
            border: 2px solid transparent;
            overflow: hidden;
            cursor: pointer;
            background: rgba(255,255,255,0.05);
            transition: border-color 0.12s, box-shadow 0.12s;
            outline: none;
        }
        .thumb:focus-visible {
            outline: 2px solid var(--ravel-focus, #00F0FF);
            outline-offset: 1px;
        }
        .thumb:hover { border-color: rgba(255,255,255,0.20); }
        .thumb[aria-selected="true"] {
            border-color: var(--strip-accent);
            box-shadow: 0 0 0 2px rgba(255,79,179,0.30);
        }

        .thumb img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
            pointer-events: none;
            user-select: none;
        }

        /* Hero star badge */
        .hero-badge {
            position: absolute;
            top: 3px; right: 3px;
            font-size: 13px;
            line-height: 1;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7));
            pointer-events: none;
        }

        /* Empty state */
        .empty {
            display: flex;
            align-items: center;
            justify-content: center;
            width: var(--thumb-size);
            height: var(--thumb-size);
            border: 2px dashed rgba(255,255,255,0.12);
            border-radius: 5px;
            font-size: 28px;
            color: rgba(255,255,255,0.12);
            user-select: none;
            flex-shrink: 0;
        }
    `;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'photos', 'selected', 'channel',
        ];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _stripEl!: HTMLElement;

    // ── State ─────────────────────────────────────────────────────────────────

    private _photos:   PhotoItem[] = [];
    private _selected  = 0;
    private _channel   = 'photo-strip';

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelPhotoStrip.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = `
            <div id="strip" role="listbox" aria-label="Photos" aria-orientation="horizontal"></div>
        `;
        this._stripEl = this.container.querySelector<HTMLElement>('#strip')!;
    }

    protected setup(): void {
        super.setup();
        this.subscribe([this._channel]);
        this.addEventListener(this._channel, this._onChannelMessage);
        this._stripEl.addEventListener('keydown', this._onKeyDown);
        this._render();
    }

    protected teardown(): void {
        this.unsubscribe([this._channel]);
        this.removeEventListener(this._channel, this._onChannelMessage);
        this._stripEl.removeEventListener('keydown', this._onKeyDown);
        super.teardown();
    }

    // ── Attributes ────────────────────────────────────────────────────────────

    attributeChangedCallback(name: string, old: string | null, value: string | null): void {
        super.attributeChangedCallback(name, old, value);
        switch (name) {
            case 'photos':
                try { this._photos = value ? JSON.parse(value) : []; }
                catch { this._photos = []; }
                if (this._stripEl) this._render();
                break;
            case 'selected':
                this._selected = Math.max(0, parseInt(value ?? '0') || 0);
                if (this._stripEl) this._updateSelection();
                break;
            case 'channel':
                if (this._stripEl) {
                    this.unsubscribe([this._channel]);
                    this.removeEventListener(this._channel, this._onChannelMessage);
                }
                this._channel = value ?? 'photo-strip';
                if (this._stripEl) {
                    this.subscribe([this._channel]);
                    this.addEventListener(this._channel, this._onChannelMessage);
                }
                break;
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    setPhotos(photos: PhotoItem[]): void {
        this._photos   = photos;
        this._selected = 0;
        this._render();
    }

    addPhoto(photo: PhotoItem): void {
        this._photos.push(photo);
        this._render();
    }

    getSelected(): PhotoItem | null {
        return this._photos[this._selected] ?? null;
    }

    // ── Render ────────────────────────────────────────────────────────────────

    private _render(): void {
        if (!this._stripEl) return;
        this._stripEl.innerHTML = '';

        if (this._photos.length === 0) {
            const empty = document.createElement('div');
            empty.className   = 'empty';
            empty.textContent = '📷';
            empty.setAttribute('aria-label', 'No photos');
            this._stripEl.appendChild(empty);
            return;
        }

        this._photos.forEach((photo, i) => {
            const thumb = document.createElement('div');
            thumb.className = 'thumb';
            thumb.setAttribute('role', 'option');
            thumb.setAttribute('aria-selected', String(i === this._selected));
            thumb.setAttribute('aria-label', photo.alt ?? `Photo ${i + 1}${photo.is_hero ? ' (hero)' : ''}`);
            thumb.setAttribute('tabindex', i === this._selected ? '0' : '-1');
            thumb.dataset.index = String(i);

            const img = document.createElement('img');
            img.src = photo.src;
            img.alt = photo.alt ?? '';
            img.loading = 'lazy';
            thumb.appendChild(img);

            if (photo.is_hero) {
                const badge = document.createElement('span');
                badge.className   = 'hero-badge';
                badge.textContent = '⭐';
                badge.setAttribute('aria-hidden', 'true');
                thumb.appendChild(badge);
            }

            thumb.addEventListener('click', () => this._select(i));
            thumb.addEventListener('dblclick', () => this._setHero(i));
            this._stripEl.appendChild(thumb);
        });
    }

    // ── Selection ─────────────────────────────────────────────────────────────

    private _select(index: number): void {
        if (index === this._selected) return;
        this._selected = index;
        this._updateSelection();
        const photo = this._photos[index];
        const detail = { index, id: photo?.id ?? '' };
        this.sendMessage(this._channel, 'select', detail);
        this.broadcastMessage(this._channel, 'select', detail);
        this.dispatchEvent(new CustomEvent('select', { bubbles: true, composed: true, detail }));
    }

    private _setHero(index: number): void {
        this._photos.forEach(p => p.is_hero = false);
        if (this._photos[index]) this._photos[index].is_hero = true;
        this._render();
        const photo = this._photos[index];
        const detail = { index, id: photo?.id ?? '' };
        this.sendMessage(this._channel, 'set-hero', detail);
        this.broadcastMessage(this._channel, 'set-hero', detail);
        this.dispatchEvent(new CustomEvent('set-hero', { bubbles: true, composed: true, detail }));
    }

    private _updateSelection(): void {
        this._stripEl.querySelectorAll<HTMLElement>('.thumb').forEach((th, i) => {
            const sel = i === this._selected;
            th.setAttribute('aria-selected', String(sel));
            th.setAttribute('tabindex', sel ? '0' : '-1');
            if (sel) th.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        });
    }

    // ── Keyboard ──────────────────────────────────────────────────────────────

    private _onKeyDown = (e: KeyboardEvent): void => {
        const thumbs = Array.from(this._stripEl.querySelectorAll<HTMLElement>('.thumb'));
        if (!thumbs.length) return;

        let next = this._selected;
        if (e.key === 'ArrowRight') next = Math.min(this._photos.length - 1, next + 1);
        if (e.key === 'ArrowLeft')  next = Math.max(0, next - 1);
        if (e.key === 'Home')       next = 0;
        if (e.key === 'End')        next = this._photos.length - 1;

        if (next !== this._selected) {
            e.preventDefault();
            this._select(next);
            thumbs[next]?.focus();
        }

        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._setHero(this._selected);
        }
    };

    // ── Messages ──────────────────────────────────────────────────────────────

    private _onChannelMessage = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent).detail ?? {};
        if (cmd === 'set-photos') this.setPhotos(content as PhotoItem[]);
        if (cmd === 'add-photo')  this.addPhoto(content as PhotoItem);
    };
}
