/**
 * hlh-inbox-card — shows one unassigned photo in the Inbox triage grid.
 *
 * Attributes
 *   photo-id   string  — DB photo id
 *   thumb-src  string  — asset:// URL for the 160×160 thumbnail
 *   filename   string  — display name (original filename)
 *   is-blurry  boolean — present if blur detection flagged the image
 *
 * Events dispatched (bubbles + composed)
 *   hlh-create-item  detail: { photoId: string }
 *   hlh-discard      detail: { photoId: string }
 */
class HlhInboxCard extends HTMLElement {
    private _shadow: ShadowRoot;

    constructor() {
        super();
        this._shadow = this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes(): string[] {
        return ['photo-id', 'thumb-src', 'filename', 'is-blurry'];
    }

    connectedCallback():    void { this._render(); }
    attributeChangedCallback(): void { this._render(); }

    private _render(): void {
        const photoId  = this.getAttribute('photo-id') ?? '';
        const thumbSrc = this.getAttribute('thumb-src') ?? '';
        const filename = this.getAttribute('filename')  ?? 'Unnamed';
        const isBlurry = this.hasAttribute('is-blurry');

        this._shadow.innerHTML = `
            <style>
                :host { display: block; }
                .card {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 8px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    transition: border-color 0.12s;
                }
                .card:hover { border-color: rgba(255,79,179,0.35); }
                @media (prefers-reduced-motion: reduce) { .card { transition: none; } }
                .thumb-wrap {
                    width: 100%;
                    aspect-ratio: 1;
                    background: #111;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .thumb {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }
                .thumb-missing {
                    font-size: 2rem;
                    color: rgba(255,255,255,0.2);
                }
                .meta {
                    padding: 10px 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .filename {
                    font-family: Quantico, monospace;
                    font-size: 0.75rem;
                    color: rgba(255,255,255,0.65);
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .blurry-warn {
                    font-family: Quantico, monospace;
                    font-size: 0.68rem;
                    color: #FFA500;
                }
                .actions {
                    display: flex;
                    gap: 6px;
                    padding: 0 12px 12px;
                }
                button {
                    flex: 1;
                    font-family: Silkscreen, monospace;
                    font-size: 0.68rem;
                    padding: 8px 4px;
                    border-radius: 4px;
                    border: 1px solid;
                    cursor: pointer;
                    min-height: 44px;
                    line-height: 1.2;
                }
                .btn-create {
                    background: rgba(255,79,179,0.15);
                    border-color: rgba(255,79,179,0.4);
                    color: #fff;
                }
                .btn-create:hover { background: rgba(255,79,179,0.28); }
                .btn-discard {
                    background: rgba(255,255,255,0.04);
                    border-color: rgba(255,255,255,0.15);
                    color: rgba(255,255,255,0.45);
                }
                .btn-discard:hover {
                    background: rgba(255,60,60,0.12);
                    border-color: rgba(255,80,80,0.35);
                    color: rgba(255,255,255,0.7);
                }
                button:focus-visible {
                    outline: 2px solid #00F0FF;
                    outline-offset: 2px;
                }
            </style>
            <div class="card">
                <div class="thumb-wrap">
                    ${thumbSrc
                        ? `<img class="thumb" src="${thumbSrc}" alt="${filename}" loading="lazy" />`
                        : `<span class="thumb-missing" aria-hidden="true">📷</span>`
                    }
                </div>
                <div class="meta">
                    <div class="filename" title="${filename}">${filename}</div>
                    ${isBlurry ? '<div class="blurry-warn">⚠️ Possibly blurry</div>' : ''}
                </div>
                <div class="actions">
                    <button class="btn-create" type="button"
                            aria-label="Create catalog item from ${filename}">
                        Create Item
                    </button>
                    <button class="btn-discard" type="button"
                            aria-label="Discard ${filename}">
                        Discard
                    </button>
                </div>
            </div>
        `;

        this._shadow.querySelector('.btn-create')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('hlh-create-item', {
                bubbles: true, composed: true,
                detail: { photoId },
            }));
        });

        this._shadow.querySelector('.btn-discard')?.addEventListener('click', () => {
            this.dispatchEvent(new CustomEvent('hlh-discard', {
                bubbles: true, composed: true,
                detail: { photoId },
            }));
        });
    }
}

customElements.define('hlh-inbox-card', HlhInboxCard);
