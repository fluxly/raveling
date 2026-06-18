import { RavelElement } from '../../../../common/RavelElement';

// ── Minimal p5 types (p5 is loaded as a global <script>, not an npm package) ──

interface P5Instance {
    remove():                                   void;
    createCanvas(w: number, h: number):         void;
    resizeCanvas(w: number, h: number):         void;
    canvas:  HTMLCanvasElement | null;
    width:   number;
    height:  number;
    [key: string]: unknown;
}

type P5Constructor = new (
    sketch:    (p: P5Instance) => void,
    container: HTMLElement
) => P5Instance;

/**
 * Runs a p5.js sketch fetched from a URL inside the component's Shadow DOM.
 *
 * p5 must be loaded globally (e.g. `<script src="p5.min.js">`) **before**
 * this element is registered.
 *
 * External sketches should use **instance mode** — assign onto `p`:
 * ```js
 * p.setup = () => { p.createCanvas(p.RAVEL_W, p.RAVEL_H); };
 * p.draw  = () => { p.background(0); };
 * ```
 *
 * ### Attributes
 * | Attribute     | Type    | Default | Description                                            |
 * |---------------|---------|---------|--------------------------------------------------------|
 * | `src`         | string  | `''`    | URL of the p5 sketch file to fetch and run             |
 * | `w`           | number  | `300`   | Canvas width in px                                     |
 * | `h`           | number  | `150`   | Canvas height in px                                    |
 * | `autostart`   | `1\|0`  | `1`     | Auto-run sketch on connect / src change                |
 * | `sandbox`     | `1\|0`  | `1`     | Shadow `window`/`document` inside `new Function` scope |
 *
 * ### Events dispatched
 * | Event             | detail                        |
 * |-------------------|-------------------------------|
 * | `ravelp5:loaded`  | `{ src: string }`             |
 * | `ravelp5:error`   | `{ src: string, error: string }` |
 */
export class RavelP5Canvas extends RavelElement {

    // ── Styles ────────────────────────────────────────────────────────────────

    private static readonly localStyles = `
        :host {
            display: block;
            box-sizing: border-box;
        }
        #container {
            position: relative;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
        }
        .mount {
            position: relative;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
        }
        canvas {
            display: block;
        }
    `;

    private static readonly componentHtml = `
        <div class="mount" part="mount"></div>
    `;

    // ── Observed attributes ───────────────────────────────────────────────────

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'src', 'autostart', 'sandbox'];
    }

    // ── DOM refs ──────────────────────────────────────────────────────────────

    private _mountEl!: HTMLElement;

    // ── State ─────────────────────────────────────────────────────────────────

    private _isReady  = false;
    private _p5:       P5Instance | null = null;
    private _abort:    AbortController | null = null;
    private _runToken = 0;   // incremented on each reload; detects superseded fetches

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelP5Canvas.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelP5Canvas.componentHtml;
        this._mountEl = this.container.querySelector<HTMLElement>('.mount')!;
    }

    protected setup(): void {
        super.setup();
        this._isReady = true;

        const autostart = this._shouldAutostart();
        if (autostart) this.reload();
    }

    protected teardown(): void {
        this._isReady = false;
        this._destroyInstance();
        this._abortFetch();
        super.teardown();
    }

    // ── Attribute changes ─────────────────────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (oldValue === newValue || !this._isReady) return;

        if (name === 'w' || name === 'h') {
            this._applySizeToRunningSketch();
            return;
        }

        if (name === 'src' || name === 'sandbox' || name === 'autostart') {
            if (this._shouldAutostart()) this.reload();
        }
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /** Fetch `src`, compile, and run the sketch. Safe to call multiple times. */
    async reload(): Promise<void> {
        const src = (this.getAttribute('src') ?? '').trim();
        if (!src || !this._isReady) return;

        const P5 = this._p5Constructor();
        if (!P5) return;

        const myToken = ++this._runToken;

        this._abortFetch();
        this._destroyInstance();
        this._clearMount();

        this._abort = new AbortController();

        try {
            const res = await fetch(src, { signal: this._abort.signal, cache: 'no-store' });
            if (!res.ok) throw new Error(`fetch "${src}" failed: ${res.status} ${res.statusText}`);
            const text = await res.text();

            if (myToken !== this._runToken) return; // superseded by a newer reload()

            const sketchFn = this._compileSketch(text, src);
            this._p5 = new P5(sketchFn, this._mountEl);

            this.dispatchEvent(new CustomEvent('ravelp5:loaded', {
                bubbles: true, composed: true, detail: { src },
            }));
        } catch (err) {
            if ((err as Error)?.name === 'AbortError') return;
            const message = err instanceof Error ? err.message : String(err);
            console.error('[ravel-p5-canvas]', message);
            this.dispatchEvent(new CustomEvent('ravelp5:error', {
                bubbles: true, composed: true, detail: { src, error: message },
            }));
        }
    }

    /** Stop the current sketch and clean up. */
    stop(): void {
        this._destroyInstance();
        this._abortFetch();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private _shouldAutostart(): boolean {
        const a = this.getAttribute('autostart');
        return a === null || a !== '0';
    }

    private _desiredSize(): { w: number; h: number } {
        const wAttr = this.getAttribute('w');
        const hAttr = this.getAttribute('h');
        const w = Number(wAttr);
        const h = Number(hAttr);
        return {
            w: Number.isFinite(w) && w > 0 ? w : 300,
            h: Number.isFinite(h) && h > 0 ? h : 150,
        };
    }

    private _applySizeToRunningSketch(): void {
        if (!this._p5) return;
        const { w, h } = this._desiredSize();
        if (typeof this._p5.resizeCanvas === 'function') {
            try { this._p5.resizeCanvas(w, h); } catch { /* no canvas yet */ }
        }
        this.style.width  = `${w}px`;
        this.style.height = `${h}px`;
    }

    private _abortFetch(): void {
        if (this._abort) {
            try { this._abort.abort(); } catch { /* already aborted */ }
            this._abort = null;
        }
    }

    private _clearMount(): void {
        if (this._mountEl) this._mountEl.innerHTML = '';
    }

    private _destroyInstance(): void {
        if (this._p5) {
            try { this._p5.remove(); } catch (e) {
                console.warn('[ravel-p5-canvas] p5.remove() failed:', e);
            }
            this._p5 = null;
        }
    }

    private _p5Constructor(): P5Constructor | null {
        const p5 = (window as unknown as { p5?: P5Constructor }).p5;
        if (!p5) {
            console.warn('[ravel-p5-canvas] p5 not found on window — add <script src="p5.min.js"> before this element.');
            return null;
        }
        return p5;
    }

    private _compileSketch(
        sourceText: string,
        srcLabel = 'p5-sketch.js'
    ): (p: P5Instance) => void {
        const sandboxAttr = this.getAttribute('sandbox');
        const sandbox     = sandboxAttr === null || sandboxAttr !== '0';

        const makeSketch = (p: P5Instance): void => {
            const { w, h } = this._desiredSize();
            p['__RAVEL_W__'] = w;
            p['__RAVEL_H__'] = h;

            Object.defineProperty(p, 'RAVEL_W', { get: () => this._desiredSize().w, configurable: true });
            Object.defineProperty(p, 'RAVEL_H', { get: () => this._desiredSize().h, configurable: true });

            try {
                const preamble = sandbox
                    ? `"use strict"; const window=undefined,document=undefined,globalThis=undefined,self=undefined;`
                    : `"use strict";`;

                const body = `${preamble}\n// --- ${srcLabel} ---\n${sourceText}`;
                const fn = new Function('p', body) as (p: P5Instance) => void;
                fn(p);
            } catch (e) {
                console.error('[ravel-p5-canvas] Error evaluating sketch:', e);
                throw e;
            }

            // Wrap setup to guarantee canvas exists at the right size
            const userSetup = p['setup'] as (() => void) | undefined;
            p['setup'] = (): void => {
                userSetup?.();
                const { w: sw, h: sh } = this._desiredSize();
                if (!p.canvas) {
                    p.createCanvas(sw, sh);
                } else if (p.width !== sw || p.height !== sh) {
                    try { p.resizeCanvas(sw, sh); } catch { /* sketch may not be ready */ }
                }
                requestAnimationFrame(() => {
                    if (p.canvas) {
                        p.canvas.style.display     = 'block';
                        p.canvas.style.visibility  = 'visible';
                    }
                });
            };
        };

        return makeSketch;
    }
}
