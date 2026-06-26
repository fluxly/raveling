import { RavelElement } from '../../../../common/RavelElement';

/**
 * Tag input with autocomplete, keyboard navigation, and chip display.
 *
 * ### Attributes
 * | Attribute     | Type   | Default      | Description                         |
 * |---------------|--------|--------------|-------------------------------------|
 * | `tags`        | JSON   | `[]`         | Initial set of tag strings          |
 * | `placeholder` | string | `Add tag…`   | Input placeholder                   |
 * | `channel`     | string | `tag-editor` | Message channel                     |
 *
 * ### Public methods
 * | Method                       | Description                    |
 * |------------------------------|--------------------------------|
 * | `getTags(): string[]`        | Returns current tag list       |
 * | `setTags(tags: string[])`    | Replace all tags               |
 * | `setSuggestions(s: string[])`| Set autocomplete candidates    |
 *
 * ### Events emitted (bubbles + composed)
 * | Event        | detail               | Trigger           |
 * |--------------|----------------------|-------------------|
 * | `tag-change` | `{ tags: string[] }` | Any add / remove  |
 *
 * ### Messages emitted (channel)
 * | cmd           | content              | Trigger           |
 * |---------------|----------------------|-------------------|
 * | `tag-change`  | `{ tags: string[] }` | Any add / remove  |
 *
 * ### Messages received (channel)
 * | cmd             | content            | Effect                       |
 * |-----------------|--------------------|------------------------------|
 * | `set-tags`      | `string[]`         | Replace current tags         |
 * | `set-suggestions`| `string[]`        | Update autocomplete list     |
 */
export class RavelTagEditor extends RavelElement {

    private _tags:             string[] = [];
    private _suggestions:      string[] = [];
    private _activeSuggestion  = -1;

    // Shadow DOM refs (set in initialize, stable for element lifetime)
    private _chipsEl!:  HTMLElement;
    private _inputEl!:  HTMLInputElement;
    private _listEl!:   HTMLElement;

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: block;
            --tag-accent: var(--ravel-accent, #FF4FB3);
            --tag-focus:  var(--ravel-focus,  #00F0FF);
            --tag-font:   var(--ravel-font, 'Quantico', monospace);
        }

        #editor {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 6px;
            background: #0e0e12;
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 6px;
            padding: 8px 10px;
            min-height: 44px;
            cursor: text;
            position: relative;
            transition: border-color 0.12s;
        }
        #editor:focus-within {
            border-color: rgba(0,240,255,0.4);
            outline: none;
        }

        /* ── Chips ── */
        .chip {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            background: rgba(255,79,179,0.18);
            border: 1px solid rgba(255,79,179,0.35);
            border-radius: 12px;
            padding: 3px 10px 3px 12px;
            font-family: var(--tag-font);
            font-size: 11px;
            color: rgba(255,255,255,0.85);
            white-space: nowrap;
            max-width: 200px;
        }
        .chip-label {
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .chip-remove {
            appearance: none;
            background: none;
            border: none;
            color: rgba(255,79,179,0.65);
            cursor: pointer;
            padding: 0;
            line-height: 1;
            font-size: 13px;
            display: flex;
            align-items: center;
            border-radius: 50%;
            min-width: 18px;
            min-height: 18px;
            justify-content: center;
            transition: color 0.1s, background 0.1s;
        }
        .chip-remove:hover {
            color: rgba(255,79,179,1);
            background: rgba(255,79,179,0.15);
        }
        .chip-remove:focus-visible {
            outline: 2px solid var(--tag-focus);
            outline-offset: 1px;
        }

        /* ── Input ── */
        #input-wrap {
            position: relative;
            flex: 1;
            min-width: 100px;
        }
        #tag-input {
            background: transparent;
            border: none;
            outline: none;
            color: rgba(255,255,255,0.85);
            font-family: var(--tag-font);
            font-size: 12px;
            width: 100%;
            min-height: 28px;
            caret-color: var(--tag-focus);
        }
        #tag-input::placeholder { color: rgba(255,255,255,0.22); }

        /* ── Suggestions ── */
        #suggestions {
            position: absolute;
            top: calc(100% + 4px);
            left: 0;
            min-width: 180px;
            max-width: 320px;
            max-height: 220px;
            overflow-y: auto;
            background: #1a1a22;
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 6px;
            padding: 4px 0;
            margin: 0;
            list-style: none;
            z-index: 100;
            scrollbar-width: thin;
            scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        #suggestions li {
            padding: 8px 14px;
            font-family: var(--tag-font);
            font-size: 12px;
            color: rgba(255,255,255,0.7);
            cursor: pointer;
            transition: background 0.08s, color 0.08s;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        #suggestions li:hover,
        #suggestions li[aria-selected="true"] {
            background: rgba(255,79,179,0.15);
            color: #fff;
        }
        #suggestions li mark {
            background: transparent;
            color: var(--tag-accent);
            font-weight: bold;
        }
    `;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        this._container.innerHTML = `
            <style>${RavelTagEditor.localStyles}</style>
            <div id="editor" part="editor" aria-label="Tags">
                <div id="chips" aria-live="polite" aria-label="Current tags"></div>
                <div id="input-wrap">
                    <input id="tag-input" type="text"
                           role="combobox"
                           aria-expanded="false"
                           aria-autocomplete="list"
                           aria-haspopup="listbox"
                           aria-controls="suggestions"
                           autocomplete="off" />
                    <ul id="suggestions" role="listbox" aria-label="Tag suggestions" hidden></ul>
                </div>
            </div>
        `;

        this._chipsEl = this._container.querySelector('#chips')!;
        this._inputEl = this._container.querySelector<HTMLInputElement>('#tag-input')!;
        this._listEl  = this._container.querySelector('#suggestions')!;

        this._bindInputEvents();
    }

    private _onChannelMessage = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent).detail ?? {};
        if (cmd === 'set-tags' && Array.isArray(content)) {
            this.setTags(content as string[]);
        } else if (cmd === 'set-suggestions' && Array.isArray(content)) {
            this.setSuggestions(content as string[]);
        }
    };

    protected setup(): void {
        super.setup();

        // Parse initial tags from attribute
        const raw = this.getAttribute('tags') ?? '[]';
        try { this._tags = JSON.parse(raw); } catch { this._tags = []; }

        const ph = this.getAttribute('placeholder') ?? 'Add tag…';
        this._inputEl.placeholder = ph;

        const channel = this.getAttribute('channel') ?? 'tag-editor';
        this.subscribe([channel]);
        this.addEventListener(channel, this._onChannelMessage);
        this._renderChips();
    }

    protected teardown(): void {
        const channel = this.getAttribute('channel') ?? 'tag-editor';
        this.unsubscribe([channel]);
        this.removeEventListener(channel, this._onChannelMessage);
        super.teardown();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    getTags(): string[] { return [...this._tags]; }

    setTags(tags: string[]): void {
        this._tags = [...tags];
        this._renderChips();
    }

    setSuggestions(suggestions: string[]): void {
        this._suggestions = [...suggestions];
        this._updateSuggestions();
    }

    // ── Internal ──────────────────────────────────────────────────────────────

    private _bindInputEvents(): void {
        const input = this._inputEl;
        const list  = this._listEl;
        const editor = this._container.querySelector<HTMLElement>('#editor')!;

        // Clicking the editor area focuses the input
        editor.addEventListener('click', (e) => {
            if (e.target === editor || e.target === this._chipsEl) {
                input.focus();
            }
        });

        input.addEventListener('input', () => this._updateSuggestions());

        input.addEventListener('keydown', (e: KeyboardEvent) => {
            switch (e.key) {
                case 'Enter':
                    e.preventDefault();
                    if (this._activeSuggestion >= 0) {
                        const items = list.querySelectorAll('li');
                        if (items[this._activeSuggestion]) {
                            this._addTag(items[this._activeSuggestion].dataset.tag ?? '');
                        }
                    } else {
                        this._addTag(input.value.trim());
                    }
                    break;
                case 'Backspace':
                    if (input.value === '' && this._tags.length > 0) {
                        this._removeTag(this._tags[this._tags.length - 1]);
                    }
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this._moveActive(1);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this._moveActive(-1);
                    break;
                case 'Escape':
                    this._hideSuggestions();
                    break;
                case ',':
                case 'Tab':
                    if (input.value.trim()) {
                        e.preventDefault();
                        this._addTag(input.value.trim().replace(/,$/, ''));
                    }
                    break;
            }
        });

        input.addEventListener('blur', () => {
            // Short delay so click on suggestion fires first
            setTimeout(() => this._hideSuggestions(), 150);
        });

        input.addEventListener('focus', () => this._updateSuggestions());

        list.addEventListener('click', (e: MouseEvent) => {
            const li = (e.target as HTMLElement).closest('li');
            if (li?.dataset.tag) {
                this._addTag(li.dataset.tag);
                input.focus();
            }
        });
    }

    private _addTag(tag: string): void {
        const normalized = tag.trim().toLowerCase().replace(/\s+/g, ' ');
        if (!normalized || this._tags.includes(normalized)) {
            this._inputEl.value = '';
            this._hideSuggestions();
            return;
        }
        this._tags = [...this._tags, normalized];
        this._inputEl.value = '';
        this._activeSuggestion = -1;
        this._renderChips();
        this._hideSuggestions();
        this._emit();
    }

    private _removeTag(tag: string): void {
        this._tags = this._tags.filter(t => t !== tag);
        this._renderChips();
        this._emit();
    }

    private _renderChips(): void {
        this._chipsEl.innerHTML = this._tags.map(tag => `
            <span class="chip" role="listitem">
                <span class="chip-label">${_esc(tag)}</span>
                <button class="chip-remove" type="button"
                        aria-label="Remove tag ${_esc(tag)}"
                        data-tag="${_esc(tag)}">×</button>
            </span>
        `).join('');

        this._chipsEl.querySelectorAll<HTMLButtonElement>('.chip-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._removeTag(btn.dataset.tag ?? '');
                this._inputEl.focus();
            });
        });
    }

    private _updateSuggestions(): void {
        const q = this._inputEl.value.trim().toLowerCase();
        const available = this._suggestions.filter(s =>
            !this._tags.includes(s) &&
            (q === '' || s.toLowerCase().includes(q))
        );

        if (available.length === 0 || !document.activeElement) {
            this._hideSuggestions();
            return;
        }

        this._activeSuggestion = -1;
        this._listEl.innerHTML = available.slice(0, 20).map((s, i) => {
            const highlighted = q ? s.replace(
                new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'),
                '<mark>$1</mark>'
            ) : _esc(s);
            return `<li role="option" aria-selected="false" data-tag="${_esc(s)}"
                        id="suggestion-${i}">${highlighted}</li>`;
        }).join('');

        this._listEl.hidden = false;
        this._inputEl.setAttribute('aria-expanded', 'true');
    }

    private _hideSuggestions(): void {
        this._listEl.hidden = true;
        this._listEl.innerHTML = '';
        this._activeSuggestion = -1;
        this._inputEl.setAttribute('aria-expanded', 'false');
        this._inputEl.removeAttribute('aria-activedescendant');
    }

    private _moveActive(delta: number): void {
        const items = this._listEl.querySelectorAll<HTMLElement>('li');
        if (items.length === 0) return;

        items[this._activeSuggestion]?.setAttribute('aria-selected', 'false');
        this._activeSuggestion = Math.max(0, Math.min(
            items.length - 1,
            this._activeSuggestion + delta
        ));
        items[this._activeSuggestion].setAttribute('aria-selected', 'true');
        items[this._activeSuggestion].scrollIntoView({ block: 'nearest' });
        this._inputEl.setAttribute(
            'aria-activedescendant',
            items[this._activeSuggestion].id
        );
    }

    private _emit(): void {
        const payload = { tags: [...this._tags] };
        const channel = this.getAttribute('channel') ?? 'tag-editor';
        this.sendMessage(channel, 'tag-change', payload);
        this.dispatchEvent(new CustomEvent('tag-change', {
            bubbles: true, composed: true, detail: payload,
        }));
    }
}

function _esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}
