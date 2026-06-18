import { RavelElement } from '../../../base/ravel-element/src/RavelElement.js';
import globalStyles from '../../../../common/global-styles.js';
import  { RavelMessages }  from '../../../../../modules/RavelMessages.js';

export class RavelP5Canvas extends RavelElement {
  static get localStyles() {
    return `
      <style>
        :host{
          display:block;
          box-sizing:border-box;
        }
        .wrap{
          position:relative;
          width:100%;
          height:100%;
          box-sizing:border-box;
        }
        .mount{
          position:relative;
          width:100%;
          height:100%;
          box-sizing:border-box;
        }
        canvas{
          display:block;
          visibility: visible;
        }
      </style>
    `;
  }

  static get html() {
    return `
      <div class="wrap">
        <div class="mount" part="mount"></div>
      </div>
    `;
  }

  static get observedAttributes() {
    return [
      ...super.baseObservedAttributes,
      "src",
      "autostart",
      "sandbox" // "1" default; "0" allows external script to touch window (not recommended)
    ];
  }

  constructor() {
    super();
    const template = document.createElement("template");
    template.innerHTML = globalStyles + this.constructor.localStyles + this.constructor.html;
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(template.content.cloneNode(true));
    this.initialize();
  }

  connectedCallback() {
    this.setup();
  }

  disconnectedCallback() {
    this.teardown();
  }

  initialize() {
    this.rows = 1;
    this.cols = 1;

    this._p5 = null;
    this._abort = null;
    this._srcText = null;

    this._runToken = 0; // prevents race conditions when src changes quickly
  }

  setup = () => {
    this.$mount = this.shadowRoot.querySelector(".mount");

    // Auto-run unless autostart="0"
    const autostartAttr = this.getAttribute("autostart");
    const autostart = autostartAttr == null ? true : autostartAttr !== "0";
    if (autostart) this.reload();
  };

  teardown = () => {
    this.destroyInstance();
    this.abortFetch();
  };

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback(name, oldValue, newValue);
    if (oldValue === newValue) return;

    if (name === "w" || name === "h") {
      // Resize p5 if running
      this.applySizeToRunningSketch();
      return;
    }

    if (name === "src" || name === "sandbox" || name === "autostart") {
      const autostartAttr = this.getAttribute("autostart");
      const autostart = autostartAttr == null ? true : autostartAttr !== "0";
      if (autostart) this.reload();
    }
  }

  // ------- Public API -------
  async reload() {
    const src = (this.getAttribute("src") || "").trim();
    if (!src) return;

    if (!window.p5) {
      console.warn("[Ravelp5Embed] p5 not found on window. Import p5 globally first.");
      return;
    }

    const myToken = ++this._runToken;

    this.abortFetch();
    this.destroyInstance();
    this.clearMount();

    this._abort = new AbortController();

    try {
      const res = await fetch(src, { signal: this._abort.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to fetch "${src}": ${res.status} ${res.statusText}`);
      const text = await res.text();

      if (myToken !== this._runToken) return; // superseded
      this._srcText = text;

      const sketchFn = this.compileSketch(text, src);
      if (!sketchFn) return;

      // Create p5 instance and mount it
      this._p5 = new window.p5(sketchFn, this.$mount);

      // Ensure initial sizing even if sketch doesn't call createCanvas
      // (Many sketches do createCanvas in setup, but we enforce if missing.)
      //this.ensureCanvasSize();

      this.dispatchEvent(
        new CustomEvent("ravelp5:loaded", {
          bubbles: true,
          composed: true,
          detail: { src }
        })
      );
    } catch (err) {
      if (err?.name === "AbortError") return;
      console.error("[Ravelp5Embed]", err);

      this.dispatchEvent(
        new CustomEvent("ravelp5:error", {
          bubbles: true,
          composed: true,
          detail: { src, error: String(err?.message || err) }
        })
      );
    }
  }

  stop() {
    this.destroyInstance();
    this.abortFetch();
  }

  // ------- Internals -------
  abortFetch() {
    if (this._abort) {
      try { this._abort.abort(); } catch {}
      this._abort = null;
    }
  }

  clearMount() {
    if (!this.$mount) return;
    this.$mount.innerHTML = "";
  }

  destroyInstance() {
    if (this._p5) {
      try {
        // p5 instance mode cleanup
        this._p5.remove();
      } catch (e) {
        console.warn("[Ravelp5Embed] p5 remove() failed:", e);
      }
      this._p5 = null;
    }
  }

  getDesiredSize() {
    // Default: 300x150 if not provided
    const wAttr = this.getAttribute("w");
    const hAttr = this.getAttribute("h");

    const w = Number(wAttr);
    const h = Number(hAttr);

    return {
      w: Number.isFinite(w) && w > 0 ? w : 300,
      h: Number.isFinite(h) && h > 0 ? h : 150
    };
  }

  applySizeToRunningSketch() {
    if (!this._p5) return;
    const { w, h } = this.getDesiredSize();

    // If the sketch created a canvas, resize it.
    // p5.resizeCanvas exists in instance mode after canvas created.
    if (typeof this._p5.resizeCanvas === "function") {
      try { this._p5.resizeCanvas(w, h); } catch {}
    }

    // Also ensure the host element has explicit pixel sizing
    this.style.width = `${w}px`;
    this.style.height = `${h}px`;
  }

  ensureCanvasSize() {
    const { w, h } = this.getDesiredSize();

    // Set host size so layout is predictable
    this.style.width = `${w}px`;
    this.style.height = `${h}px`;

    // If the sketch didn't create a canvas, try to create one.
    // (Some sketches rely on default canvas creation; many don't.)
    try {
      if (this._p5 && !this._p5.canvas && typeof this._p5.createCanvas === "function") {
        this._p5.createCanvas(w, h);
        if (this._p5.canvas && this.$mount) this.$mount.appendChild(this._p5.canvas);
      } else if (this._p5 && this._p5.canvas && typeof this._p5.resizeCanvas === "function") {
        this._p5.resizeCanvas(w, h);
      }
    } catch (e) {
      // If the sketch does something unusual, don't hard-fail
      console.warn("[Ravelp5Embed] ensureCanvasSize warning:", e);
    }
  }

  compileSketch(sourceText, srcLabel = "p5-sketch.js") {
    const sandboxAttr = this.getAttribute("sandbox");
    const sandbox = sandboxAttr == null ? true : sandboxAttr !== "0";

    // We run the fetched script in "instance mode".
    // The fetched script is expected to *attach* setup/draw/etc onto `p`
    // or define functions in a way we can bind onto `p`.
    //
    // Recommended external sketch pattern:
    //   p.setup = () => { p.createCanvas(p.width, p.height); ... }
    //   p.draw  = () => { ... }
    //
    // If the external script uses global mode (setup(), draw() without p.),
    // this wrapper will still try to map them if possible, but instance-mode
    // is the reliable approach.

    const makeSketch = (p) => {
      // Provide desired size to the sketch
      const { w, h } = this.getDesiredSize();
      p.__RAVEL_W__ = w;
      p.__RAVEL_H__ = h;

      // Helpful defaults: expose width/height before createCanvas via getters
      // (p5 sets p.width/p.height after createCanvas; we provide fallbacks.)
      Object.defineProperty(p, "RAVEL_W", { get: () => this.getDesiredSize().w });
      Object.defineProperty(p, "RAVEL_H", { get: () => this.getDesiredSize().h });

      // Execute the external code with `p` in scope.
      // sandbox=true: isolate from window by shadowing common globals.
      try {
        if (sandbox) {
          const fn = new Function(
            "p",
            `"use strict";
             const window = undefined;
             const document = undefined;
             const globalThis = undefined;
             const self = undefined;
             // --- begin external sketch: ${srcLabel} ---
             ${sourceText}
             // --- end external sketch ---
            `
          );
          fn(p);
        } else {
          // Not sandboxed: external code can access window/document as usual
          const fn = new Function(
            "p",
            `"use strict";
             // --- begin external sketch: ${srcLabel} ---
             ${sourceText}
             // --- end external sketch ---
            `
          );
          fn(p);
        }
      } catch (e) {
        console.error("[Ravelp5Embed] Error evaluating sketch:", e);
        throw e;
      }

      // If the external script used global-mode style functions, try to adopt them.
      // (This only works if the external code defined them on `p`, or as locals returned somehow.
      // We can only reliably pick up things assigned onto `p`.)
      if (!p.setup) {
        // If they didn't define setup, create a minimal one
        p.setup = () => {
          p.createCanvas(this.getDesiredSize().w, this.getDesiredSize().h);
        };
      } else {
        // Ensure canvas exists at correct size if they forgot
        const userSetup = p.setup;
        p.setup = () => {
          userSetup?.();

          const { w, h } = this.getDesiredSize();

          // If they never created a canvas, create one once.
          if (!p.canvas) {
            p.createCanvas(w, h);
          } else if (typeof p.resizeCanvas === "function") {
            // Resize only if needed
            if (p.width !== w || p.height !== h) {
              p.resizeCanvas(w, h);
            }
          }

          // 🔧 Force visibility once
          requestAnimationFrame(() => {
            if (p.canvas) {
              p.canvas.style.visibility = "visible";
              p.canvas.style.display = "block";
              p.canvas.style.opacity = "1";
            }
          });
        };
      }
    };

    return makeSketch;
  }
}
