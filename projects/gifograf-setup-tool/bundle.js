var f = Object.defineProperty;
var m = (o, r, t) => r in o ? f(o, r, { enumerable: !0, configurable: !0, writable: !0, value: t }) : o[r] = t;
var i = (o, r, t) => m(o, typeof r != "symbol" ? r + "" : r, t);
const l = {
  subscriptions: {},
  sendMessage(o, r, t, s = 1) {
    const e = { cmd: r, content: t, version: s }, n = new CustomEvent(o, { detail: e }), h = this.subscriptions[o];
    if (!(!h || h.length === 0))
      for (let u = 0; u < h.length; u++)
        h[u].dispatchEvent(n);
  },
  subscribe(o, r) {
    this.subscriptions[o] || (this.subscriptions[o] = []), this.subscriptions[o].push(r);
  },
  unsubscribe(o, r) {
    const t = this.subscriptions[o];
    if (!t) return;
    const s = t.indexOf(r);
    s !== -1 && t.splice(s, 1);
  }
}, x = `
<style>
@import url('https://fonts.googleapis.com/css2?family=Quantico:wght@400;500;700;900&display=swap');
</style>
`;
class d extends HTMLElement {
  constructor() {
    super();
    // ── Position ──────────────────────────────────────────────────────────────
    /** Horizontal position set via the `x` attribute. Subclasses may read this. */
    i(this, "x", 0);
    /** Vertical position set via the `y` attribute. Subclasses may read this. */
    i(this, "y", 0);
    // ── Base container ────────────────────────────────────────────────────────
    /**
     * The `#container` div inside this element's Shadow DOM.
     * Available after `initialize()` runs. Subclasses populate it with their HTML.
     */
    i(this, "container");
    // ── Mode ──────────────────────────────────────────────────────────────────
    /** Current element mode. Defaults to `'inline'`. */
    i(this, "_mode", "inline");
    /**
     * Whether factory mode is active. Mutes interactions and replaces them with
     * self-spawning. Toggled via the boolean `factory` attribute.
     */
    i(this, "_isFactory", !1);
    // ── Messaging ─────────────────────────────────────────────────────────────
    /** Message names this element is currently subscribed to. */
    i(this, "observedMessages", []);
    // ── Theme ─────────────────────────────────────────────────────────────────
    /** Active theme name, set via the `theme` attribute. */
    i(this, "_theme", "");
    // ── Signals ───────────────────────────────────────────────────────────────
    /** Signal names this element accepts, parsed from `signals-in`. */
    i(this, "_signalsIn", []);
    /** Signal names this element can emit, parsed from `signals-out`. */
    i(this, "_signalsOut", []);
    // ── observable ─────────────────────────────────────────────────────────
    /** Current observable level. Defaults to `'off'`. */
    i(this, "_observable", "off");
    /** Floating debug panel, present only when level is `'state'` or `'verbose'`. */
    i(this, "_debugPanel", null);
    // ── Virtual Events ────────────────────────────────────────────────────────
    /** Registered virtual event handlers, keyed by event name. */
    i(this, "_virtualListeners", /* @__PURE__ */ new Map());
    // ── Drag state ────────────────────────────────────────────────────────────
    i(this, "_dragAnchorX", 0);
    i(this, "_dragAnchorY", 0);
    i(this, "_dragOriginX", 0);
    i(this, "_dragOriginY", 0);
    // ── Lifecycle guard ───────────────────────────────────────────────────────
    /** Ensures {@link initialize} runs exactly once. */
    i(this, "_initialized", !1);
    // ── Draggable mode ────────────────────────────────────────────────────────
    i(this, "_onDragPointerDown", (t) => {
      t.preventDefault(), this._dragAnchorX = t.clientX, this._dragAnchorY = t.clientY, this._dragOriginX = parseFloat(this.style.left) || this.x, this._dragOriginY = parseFloat(this.style.top) || this.y, document.addEventListener("pointermove", this._onDragPointerMove), document.addEventListener("pointerup", this._onDragPointerUp), this.dispatchVirtualEvent("drag-begin", { x: t.clientX, y: t.clientY });
    });
    i(this, "_onDragPointerMove", (t) => {
      t.preventDefault(), this.x = this._dragOriginX + (t.clientX - this._dragAnchorX), this.y = this._dragOriginY + (t.clientY - this._dragAnchorY), this.style.left = `${this.x}px`, this.style.top = `${this.y}px`, this.dispatchVirtualEvent("drag-move", { x: this.x, y: this.y });
    });
    i(this, "_onDragPointerUp", (t) => {
      document.removeEventListener("pointermove", this._onDragPointerMove), document.removeEventListener("pointerup", this._onDragPointerUp), this.dispatchVirtualEvent("drag-end", { x: this.x, y: this.y });
    });
    // ── Physics mode ──────────────────────────────────────────────────────────
    /**
     * Handles position-update messages from a `ravel-physics-world`.
     * Expected message shape: `{ cmd: 'position', content: { x, y, angle? } }`.
     * The element must have an `id` to receive these.
     */
    i(this, "_onPhysicsMessage", (t) => {
      const { cmd: s, content: e } = t.detail;
      if (s === "position") {
        const n = e;
        this.x = n.x, this.y = n.y, this.style.left = `${this.x}px`, this.style.top = `${this.y}px`, n.angle != null && (this.style.transform = `rotate(${n.angle}rad)`);
      }
    });
  }
  // ─────────────────────────────────────────────────────────────────────────
  /**
   * Attributes observed by all Raveling elements.
   * Subclasses spread this into their own `observedAttributes`:
   * ```ts
   * static get observedAttributes() {
   *   return [...RavelElement.baseObservedAttributes, 'my-attr'];
   * }
   * ```
   */
  static get baseObservedAttributes() {
    return [
      "x",
      "y",
      "mode",
      "factory",
      "theme",
      "signals-in",
      "signals-out",
      "observable"
    ];
  }
  // ── Lifecycle ─────────────────────────────────────────────────────────────
  /**
   * Called once on first connect. Creates the open Shadow DOM, injects
   * `sharedStyles` + `baseStyles`, and stamps `<div id="container">`.
   * Subclasses call `super.initialize()` then inject their own styles and
   * HTML into `this.container`.
   *
   * ```ts
   * protected initialize(): void {
   *   super.initialize();
   *   const style = document.createElement('style');
   *   style.textContent = MyElement.localStyles;
   *   this.shadowRoot!.insertBefore(style, this.container);
   *   this.container.innerHTML = MyElement.componentHtml;
   * }
   * ```
   */
  initialize() {
    const t = this.attachShadow({ mode: "open" });
    t.innerHTML = x + this.constructor.baseStyles;
    const s = document.createElement("div");
    s.id = "container", t.appendChild(s), this.container = s;
  }
  /**
   * Called every connect (after `initialize` on the first). Subscribe to
   * messages and bind event listeners here. Reverse everything in `teardown`.
   *
   * The base implementation enables draggable and physics mode infrastructure.
   * Subclasses must call `super.setup()`.
   */
  setup() {
    this._mode === "draggable" && (this.style.position = "absolute", this.style.left = `${this.x}px`, this.style.top = `${this.y}px`, this.addEventListener("pointerdown", this._onDragPointerDown)), this._mode === "physics" && this.id && (this.style.position = "absolute", this.subscribe([this.id]), this.addEventListener(this.id, this._onPhysicsMessage));
  }
  /**
   * Called every disconnect. Unsubscribe and remove listeners added in `setup`.
   *
   * The base implementation cleans up drag and physics listeners.
   * Subclasses must call `super.teardown()`.
   */
  teardown() {
    this.removeEventListener("pointerdown", this._onDragPointerDown), document.removeEventListener("pointermove", this._onDragPointerMove), document.removeEventListener("pointerup", this._onDragPointerUp), this._mode === "physics" && this.id && this.removeEventListener(this.id, this._onPhysicsMessage);
  }
  connectedCallback() {
    this._initialized || (this._initialized = !0, this.initialize(), this._applyAccessibilityDefaults()), this._registerWithBrokers(), this.setup();
  }
  disconnectedCallback() {
    this.teardown(), this._unregisterFromBrokers(), this._removeDebugPanel();
  }
  attributeChangedCallback(t, s, e) {
    switch (t) {
      case "x":
        this.x = Number(e);
        break;
      case "y":
        this.y = Number(e);
        break;
      case "mode":
        this._mode = e ?? "inline";
        break;
      case "factory":
        this._isFactory = e !== null;
        break;
      case "theme":
        this._theme = e ?? "", this._requestTheme(this._theme);
        break;
      case "signals-in":
        this._signalsIn = e ? e.split(",").map((n) => n.trim()) : [];
        break;
      case "signals-out":
        this._signalsOut = e ? e.split(",").map((n) => n.trim()) : [];
        break;
      case "observable": {
        const n = e ?? "off";
        this._observable = n, n === "state" || n === "verbose" ? this._mountDebugPanel() : this._removeDebugPanel();
        break;
      }
    }
  }
  // ── Messaging ─────────────────────────────────────────────────────────────
  /**
   * Sends a targeted message through the {@link RavelMessenger} pub/sub system.
   * @param msg - The message name (event type).
   * @param cmd - A command string included in the event detail.
   * @param content - Arbitrary payload included in the event detail.
   * @param version - Protocol version. Defaults to {@link RAVEL_MESSAGE_VERSION}.
   */
  sendMessage(t, s, e, n) {
    (this._observable === "events" || this._observable === "verbose") && console.debug(`[${this.tagName.toLowerCase()}] sendMessage`, { msg: t, cmd: s, content: e, version: n }), l.sendMessage(t, s, e, n);
  }
  /**
   * Dispatches a {@link CustomEvent} on the global `window`, bypassing the
   * pub/sub subscription list.
   */
  broadcastMessage(t, s, e) {
    (this._observable === "events" || this._observable === "verbose") && console.debug(`[${this.tagName.toLowerCase()}] broadcastMessage`, { msg: t, cmd: s, content: e });
    const n = new CustomEvent(t, { detail: { cmd: s, content: e } });
    window.dispatchEvent(n);
  }
  /**
   * Subscribes this element to a list of message names via the messenger.
   */
  subscribe(t) {
    for (const s of t)
      l.subscribe(s, this), this.observedMessages.includes(s) || this.observedMessages.push(s);
  }
  /**
   * Unsubscribes this element from a list of message names.
   */
  unsubscribe(t) {
    for (const s of t)
      l.unsubscribe(s, this);
    this.observedMessages = this.observedMessages.filter((s) => !t.includes(s));
  }
  // ── Factory Mode ──────────────────────────────────────────────────────────
  /** `true` when this element is operating in factory (self-spawning) mode. */
  get isFactory() {
    return this._isFactory;
  }
  /**
   * Spawns a copy of this element immediately after this node.
   * The clone has `factory` removed so it behaves normally.
   * Subclasses may override to customise the spawned instance.
   */
  spawnCopy() {
    var s;
    const t = this.cloneNode(!0);
    return t.removeAttribute("factory"), (s = this.parentNode) == null || s.insertBefore(t, this.nextSibling), t;
  }
  // ── Themeable ─────────────────────────────────────────────────────────────
  /**
   * Applies CSS custom properties to this element's inline style.
   * Called by `ravel-theme-broker` when a theme is pushed.
   */
  applyTheme(t) {
    for (const [s, e] of Object.entries(t))
      this.style.setProperty(s, e);
  }
  _requestTheme(t) {
    t && l.sendMessage("ravel-theme-broker", "request-theme", {
      element: this,
      theme: t
    });
  }
  // ── Signalable ────────────────────────────────────────────────────────────
  /** Signal names this element accepts (from `signals-in`). */
  get signalsIn() {
    return [...this._signalsIn];
  }
  /** Signal names this element can emit (from `signals-out`). */
  get signalsOut() {
    return [...this._signalsOut];
  }
  /**
   * Emits a named signal through `ravel-signals-broker`.
   * @param name - Must be listed in `signals-out`.
   */
  emitSignal(t, s) {
    l.sendMessage("ravel-signals-broker", "signal", {
      name: t,
      value: s,
      source: this
    });
  }
  // ── Dockable ──────────────────────────────────────────────────────────────
  /**
   * Sends a dock request to any listening `ravel-dock` element.
   */
  dock() {
    l.sendMessage("ravel-dock", "dock-me", this);
  }
  // ── observable / Debug Panel ───────────────────────────────────────────
  _mountDebugPanel() {
    if (this._debugPanel) return;
    const t = document.createElement("div");
    t.setAttribute("role", "dialog"), t.setAttribute("aria-label", `Debug: ${this.tagName.toLowerCase()}`), t.setAttribute("aria-modal", "false"), t.style.cssText = [
      "position:absolute",
      "z-index:9999",
      "background:var(--ravel-bg, #1e1e2e)",
      "color:var(--ravel-font, #cdd6f4)",
      "font:12px/1.5 var(--ravel-font-mono, monospace)",
      "padding:8px 12px",
      "border:1px solid var(--ravel-surface, #45475a)",
      "border-radius:6px",
      "pointer-events:none",
      "white-space:pre"
    ].join(";"), t.textContent = this._debugSnapshot(), this._debugPanel = t, document.body.appendChild(t), this._positionDebugPanel();
  }
  _removeDebugPanel() {
    var t;
    (t = this._debugPanel) == null || t.remove(), this._debugPanel = null;
  }
  _positionDebugPanel() {
    if (!this._debugPanel) return;
    const t = this.getBoundingClientRect();
    this._debugPanel.style.top = `${t.bottom + window.scrollY + 4}px`, this._debugPanel.style.left = `${t.left + window.scrollX}px`;
  }
  _debugSnapshot() {
    return [
      `<${this.tagName.toLowerCase()}>`,
      `  mode:        ${this._mode}`,
      `  factory:     ${this._isFactory}`,
      `  position:    x=${this.x} y=${this.y}`,
      `  theme:       ${this._theme || "(none)"}`,
      `  signals-in:  ${this._signalsIn.join(", ") || "(none)"}`,
      `  signals-out: ${this._signalsOut.join(", ") || "(none)"}`,
      `  subscribed:  ${this.observedMessages.join(", ") || "(none)"}`
    ].join(`
`);
  }
  // ── Virtual Events ────────────────────────────────────────────────────────
  /**
   * Registers a handler for a named virtual event.
   *
   * Virtual events (`'click'`, `'drag-begin'`, `'drag-move'`, `'drag-end'`, etc.)
   * are dispatched through Raveling's internal system rather than the DOM.
   * In factory mode, interaction events trigger {@link spawnCopy} instead.
   */
  addVirtualListener(t, s) {
    this._virtualListeners.has(t) || this._virtualListeners.set(t, []), this._virtualListeners.get(t).push(s);
  }
  /** Removes a previously registered virtual event handler. */
  removeVirtualListener(t, s) {
    const e = this._virtualListeners.get(t);
    if (!e) return;
    const n = e.indexOf(s);
    n !== -1 && e.splice(n, 1);
  }
  /**
   * Dispatches a virtual event to all registered handlers.
   * In factory mode, interaction events are intercepted by {@link spawnCopy}.
   */
  dispatchVirtualEvent(t, s) {
    (this._observable === "events" || this._observable === "verbose") && console.debug(`[${this.tagName.toLowerCase()}] virtualEvent:${t}`, s);
    const e = ["click", "drag-begin", "pointerdown"];
    if (this._isFactory && e.includes(t)) {
      this.spawnCopy();
      return;
    }
    const n = this._virtualListeners.get(t);
    if (n)
      for (const h of n)
        h(s);
  }
  // ── Accessibility ─────────────────────────────────────────────────────────
  /**
   * Applies baseline WCAG AAA defaults on first connect.
   * Sets `role="region"` and `tabindex="0"` if not already present.
   * Subclasses that need a different default role should set it in their
   * own `initialize()` before calling `super.initialize()`.
   */
  _applyAccessibilityDefaults() {
    this.hasAttribute("role") || this.setAttribute("role", "region"), this.hasAttribute("tabindex") || this.setAttribute("tabindex", "0");
  }
  // ── Broker Registration ───────────────────────────────────────────────────
  _registerWithBrokers() {
    l.subscribe("ravel-theme-broker:push", this), (this._signalsIn.length > 0 || this._signalsOut.length > 0) && l.sendMessage("ravel-signals-broker", "register", {
      element: this,
      signalsIn: this._signalsIn,
      signalsOut: this._signalsOut
    }), this._theme && this._requestTheme(this._theme);
  }
  _unregisterFromBrokers() {
    l.unsubscribe("ravel-theme-broker:push", this), (this._signalsIn.length > 0 || this._signalsOut.length > 0) && l.sendMessage("ravel-signals-broker", "unregister", { element: this }), this.unsubscribe([...this.observedMessages]);
  }
}
/**
 * Base CSS injected into every component's Shadow DOM, after `sharedStyles`.
 * Provides sensible defaults for `#container`. Override in subclasses to
 * extend or replace.
 */
i(d, "baseStyles", `
        <style>
            :host { display: inline-block; box-sizing: border-box; }
            #container { position: relative; width: 100%; height: 100%; box-sizing: border-box; }
        </style>
    `);
const c = class c extends d {
  constructor() {
    super(...arguments);
    i(this, "_color", "#000000");
    i(this, "_textColor", "#ffffff");
    i(this, "_fontSize", "2rem");
    i(this, "_zIndex", 10);
  }
  static get observedAttributes() {
    return [
      ...d.baseObservedAttributes,
      "color",
      "text-color",
      "font-size",
      "z-index"
    ];
  }
  initialize() {
    super.initialize();
    const t = document.createElement("style");
    t.textContent = c.localStyles, this.shadowRoot.insertBefore(t, this.container), this.container.innerHTML = "<slot></slot>";
  }
  setup() {
    super.setup(), this._applyStyles(), this.style.zIndex = String(this._zIndex);
  }
  _applyStyles() {
    this.container.style.background = this._color, this.container.style.color = this._textColor, this.container.style.fontSize = this._fontSize;
  }
  attributeChangedCallback(t, s, e) {
    switch (super.attributeChangedCallback(t, s, e), t) {
      case "color":
        this._color = e ?? "#000000", this.container && this._applyStyles();
        break;
      case "text-color":
        this._textColor = e ?? "#ffffff", this.container && this._applyStyles();
        break;
      case "font-size":
        this._fontSize = e ?? "2rem", this.container && this._applyStyles();
        break;
      case "z-index":
        this._zIndex = Number(e) || 10, this.style.zIndex = String(this._zIndex);
        break;
    }
  }
};
i(c, "localStyles", `
        :host {
            position: absolute;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            box-sizing: border-box;
            z-index: 10;
        }
        #container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: #000000;
            color: #ffffff;
            font-size: 2rem;
        }
    `);
let p = c;
customElements.define("ravel-card", p);
const b = class b extends d {
  constructor() {
    super(...arguments);
    // Shadow DOM refs
    i(this, "slotEl");
    i(this, "navBarEl");
    i(this, "prevBtnEl");
    i(this, "nextBtnEl");
    i(this, "iconEl");
    i(this, "breadcrumbsEl");
    // State
    i(this, "_frames", []);
    i(this, "_index", 0);
    i(this, "_start", 0);
    i(this, "_icon", "");
    i(this, "_prevLabel", "←");
    i(this, "_nextLabel", "→");
    i(this, "_buttonColor", "");
    i(this, "_buttonTextColor", "");
    i(this, "_buttonRadius", 999);
    i(this, "_breadcrumbStyle", "dots");
    i(this, "_breadcrumbColor", "#ffffff");
    i(this, "_pillBottom", "8vh");
    i(this, "_pillWidth", "50%");
    // Navigation
    i(this, "_prev", () => {
      this._index <= 0 || (this._index--, this._update(), this._broadcastChange());
    });
    i(this, "_next", () => {
      this._index >= this._frames.length - 1 || (this._index++, this._update(), this._broadcastChange());
    });
    // Slot
    i(this, "_handleSlotChange", () => {
      this._frames = this.slotEl.assignedElements(), this._index = Math.max(0, Math.min(this._index, this._frames.length - 1)), this._update();
    });
  }
  static get observedAttributes() {
    return [
      ...d.baseObservedAttributes,
      "start",
      "index",
      "icon",
      "prev-label",
      "next-label",
      "button-color",
      "button-text-color",
      "button-radius",
      "breadcrumb-style",
      "breadcrumb-color",
      "pill-bottom",
      "pill-width"
    ];
  }
  // Lifecycle
  initialize() {
    super.initialize();
    const t = document.createElement("style");
    t.textContent = b.localStyles, this.shadowRoot.insertBefore(t, this.container);
    const s = document.createElement("div");
    s.id = "frame-area", this.slotEl = document.createElement("slot"), s.appendChild(this.slotEl), this.navBarEl = document.createElement("div"), this.navBarEl.id = "nav-bar", this.prevBtnEl = document.createElement("button"), this.prevBtnEl.id = "btn-prev", this.prevBtnEl.textContent = this._prevLabel;
    const e = document.createElement("div");
    e.id = "center", this.iconEl = document.createElement("div"), this.iconEl.id = "icon", this.breadcrumbsEl = document.createElement("div"), this.breadcrumbsEl.id = "breadcrumbs", e.appendChild(this.iconEl), e.appendChild(this.breadcrumbsEl), this.nextBtnEl = document.createElement("button"), this.nextBtnEl.id = "btn-next", this.nextBtnEl.textContent = this._nextLabel, this.navBarEl.appendChild(this.prevBtnEl), this.navBarEl.appendChild(e), this.navBarEl.appendChild(this.nextBtnEl), this.container.appendChild(s), this.container.appendChild(this.navBarEl);
  }
  setup() {
    super.setup(), this.slotEl.addEventListener("slotchange", this._handleSlotChange), this.prevBtnEl.addEventListener("click", this._prev), this.nextBtnEl.addEventListener("click", this._next);
  }
  teardown() {
    this.slotEl.removeEventListener("slotchange", this._handleSlotChange), this.prevBtnEl.removeEventListener("click", this._prev), this.nextBtnEl.removeEventListener("click", this._next), super.teardown();
  }
  _broadcastChange() {
    this.broadcastMessage("ravel-sequence", "change", {
      id: this.id,
      index: this._index,
      total: this._frames.length
    });
  }
  // Rendering
  _update() {
    this._frames.forEach((t, s) => {
      t.style.display = s === this._index ? "" : "none";
    }), this.prevBtnEl.disabled = this._index === 0, this.nextBtnEl.disabled = this._index >= this._frames.length - 1, this._renderBreadcrumbs();
  }
  _renderBreadcrumbs() {
    this.breadcrumbsEl.innerHTML = "";
    const t = this._frames.length;
    if (t !== 0)
      if (this._breadcrumbStyle === "numbers") {
        const s = document.createElement("span");
        s.className = "bc-numbers", s.style.color = this._breadcrumbColor, s.textContent = `${this._index + 1}  /  ${t}`, this.breadcrumbsEl.appendChild(s);
      } else
        for (let s = 0; s < t; s++) {
          const e = document.createElement("span");
          e.className = "bc-dot" + (s === this._index ? " active" : ""), e.style.background = this._breadcrumbColor, this.breadcrumbsEl.appendChild(e);
        }
  }
  _applyButtonStyles() {
    for (const t of [this.prevBtnEl, this.nextBtnEl])
      t.style.background = this._buttonColor || "", t.style.color = this._buttonTextColor || "", t.style.borderRadius = `${this._buttonRadius}px`;
  }
  // Attribute handling
  attributeChangedCallback(t, s, e) {
    switch (super.attributeChangedCallback(t, s, e), t) {
      case "start":
        this._start = Math.max(0, Number(e) || 0), this._index = this._start, this._frames.length && this._update();
        break;
      case "index": {
        const n = this._frames.length;
        this._index = Math.max(0, Math.min(Number(e) || 0, n ? n - 1 : 0)), n && this._update();
        break;
      }
      case "icon":
        this._icon = e ?? "", this.iconEl && (this.iconEl.textContent = this._icon);
        break;
      case "prev-label":
        this._prevLabel = e ?? "←", this.prevBtnEl && (this.prevBtnEl.textContent = this._prevLabel);
        break;
      case "next-label":
        this._nextLabel = e ?? "→", this.nextBtnEl && (this.nextBtnEl.textContent = this._nextLabel);
        break;
      case "button-color":
        this._buttonColor = e ?? "", this.prevBtnEl && this._applyButtonStyles();
        break;
      case "button-text-color":
        this._buttonTextColor = e ?? "", this.prevBtnEl && this._applyButtonStyles();
        break;
      case "button-radius":
        this._buttonRadius = Number(e) ?? 999, this.prevBtnEl && this._applyButtonStyles();
        break;
      case "breadcrumb-style":
        this._breadcrumbStyle = e === "numbers" ? "numbers" : "dots", this.breadcrumbsEl && this._renderBreadcrumbs();
        break;
      case "breadcrumb-color":
        this._breadcrumbColor = e ?? "#ffffff", this.breadcrumbsEl && this._renderBreadcrumbs();
        break;
      case "pill-bottom":
        this._pillBottom = e ?? "8vh", this.navBarEl && (this.navBarEl.style.bottom = this._pillBottom);
        break;
      case "pill-width":
        this._pillWidth = e ?? "50%", this.navBarEl && (this.navBarEl.style.width = this._pillWidth);
        break;
    }
  }
};
i(b, "localStyles", `
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
    `);
let _ = b;
customElements.define("ravel-sequence", _);
const a = class a extends d {
  constructor() {
    super(...arguments);
    i(this, "alertBoxEl");
    i(this, "messageEl");
    i(this, "buttonsEl");
    i(this, "progressEl");
    i(this, "_text", "");
    i(this, "_followup", "");
    i(this, "_color", "blue");
    i(this, "_buttons", []);
    i(this, "_interstitial", !1);
    i(this, "_timeout", 3e3);
    i(this, "_visible", !1);
    i(this, "_timeoutHandle", null);
    i(this, "_followupHandle", null);
    i(this, "_alternateHandle", null);
    i(this, "_showingFollowup", !1);
    i(this, "_handleMessage", (t) => {
      const { cmd: s, content: e } = t.detail ?? {};
      s === "show" ? (this._clearTimer(), (e == null ? void 0 : e.text) != null && (this._text = e.text), (e == null ? void 0 : e.followup) != null && (this._followup = e.followup), (e == null ? void 0 : e.color) != null && (this._color = e.color), (e == null ? void 0 : e.buttons) != null && (this._buttons = this._parseButtons(e.buttons)), (e == null ? void 0 : e.timeout) != null && (this._timeout = Number(e.timeout) || 3e3), this._interstitial = !!(e != null && e.interstitial), this._render(), this._setVisible(!0), this._interstitial && (this._startProgress(this._timeout), this._timeoutHandle = setTimeout(() => {
        this._setVisible(!1), this.broadcastMessage("ravel-alert", "dissolve", { id: this.id });
      }, this._timeout)), this._startFollowup()) : s === "hide" && this._setVisible(!1);
    });
  }
  static get observedAttributes() {
    return [
      ...d.baseObservedAttributes,
      "text",
      "followup",
      "color",
      "buttons",
      "timeout",
      "visible"
    ];
  }
  initialize() {
    super.initialize();
    const t = document.createElement("style");
    t.textContent = a.localStyles, this.shadowRoot.insertBefore(t, this.container), this.alertBoxEl = document.createElement("div"), this.alertBoxEl.id = "alert-box", this.messageEl = document.createElement("div"), this.messageEl.id = "message", this.buttonsEl = document.createElement("div"), this.buttonsEl.id = "buttons", this.progressEl = document.createElement("div"), this.progressEl.id = "progress", this.alertBoxEl.appendChild(this.messageEl), this.alertBoxEl.appendChild(this.buttonsEl), this.alertBoxEl.appendChild(this.progressEl), this.container.appendChild(this.alertBoxEl);
  }
  setup() {
    super.setup(), this._setVisible(this._visible, !1), window.addEventListener("ravel-alert", this._handleMessage);
  }
  teardown() {
    this._clearTimer(), window.removeEventListener("ravel-alert", this._handleMessage), super.teardown();
  }
  // Clears all active timers and resets followup state.
  _clearTimer() {
    this._timeoutHandle !== null && (clearTimeout(this._timeoutHandle), this._timeoutHandle = null), this._followupHandle !== null && (clearTimeout(this._followupHandle), this._followupHandle = null), this._alternateHandle !== null && (clearInterval(this._alternateHandle), this._alternateHandle = null), this._showingFollowup = !1;
  }
  // Fades the message out, swaps text, fades back in.
  _fadeMessage(t) {
    this.messageEl.style.opacity = "0", setTimeout(() => {
      this.messageEl.textContent = t, this.messageEl.style.opacity = "1";
    }, 280);
  }
  // Starts the followup alternation cycle if a followup message is set.
  _startFollowup() {
    this._followup && (this._followupHandle = setTimeout(() => {
      this._showingFollowup = !0, this._fadeMessage(this._followup), this._alternateHandle = setInterval(() => {
        this._showingFollowup = !this._showingFollowup, this._fadeMessage(this._showingFollowup ? this._followup : this._text);
      }, a.FOLLOWUP_INTERVAL_MS);
    }, a.FOLLOWUP_DELAY_MS));
  }
  _startProgress(t) {
    this.progressEl.style.animation = "none", this.progressEl.offsetWidth, this.progressEl.style.animation = `ra-progress ${t}ms linear forwards`;
  }
  _parseButtons(t) {
    return Array.isArray(t) ? t : typeof t == "string" ? t.split(",").map((s) => s.trim()).filter(Boolean) : [];
  }
  _setVisible(t, s = !0) {
    t || this._clearTimer(), this._visible = t, s || (this.style.transition = "none"), t ? (this.style.opacity = "1", this.style.pointerEvents = "auto", this.style.transform = "translateX(-50%) translateY(0)") : (this.style.opacity = "0", this.style.pointerEvents = "none", this.style.transform = "translateX(-50%) translateY(16px)"), s || requestAnimationFrame(() => {
      this.style.transition = "";
    });
  }
  _render() {
    if (this.messageEl.textContent = this._text, this.messageEl.style.opacity = "1", this.alertBoxEl.style.background = a.COLOR_BG[this._color] ?? a.COLOR_BG.blue, this.buttonsEl.style.display = this._interstitial ? "none" : "flex", this.buttonsEl.innerHTML = "", !this._interstitial)
      for (const t of this._buttons) {
        const s = document.createElement("button");
        s.textContent = t === "ok" ? "OK" : t.charAt(0).toUpperCase() + t.slice(1), (t === "ok" || t === "continue") && s.classList.add("primary"), s.addEventListener("click", () => this._onButton(t)), this.buttonsEl.appendChild(s);
      }
    this.progressEl.style.display = this._interstitial ? "block" : "none";
  }
  _onButton(t) {
    this.broadcastMessage("ravel-alert", "response", { id: this.id, button: t }), this._setVisible(!1);
  }
  attributeChangedCallback(t, s, e) {
    switch (super.attributeChangedCallback(t, s, e), t) {
      case "text":
        this._text = e ?? "", this.messageEl && !this._showingFollowup && (this.messageEl.textContent = this._text);
        break;
      case "followup":
        this._followup = e ?? "";
        break;
      case "color":
        this._color = e ?? "blue", this.alertBoxEl && (this.alertBoxEl.style.background = a.COLOR_BG[this._color] ?? a.COLOR_BG.blue);
        break;
      case "buttons":
        this._buttons = this._parseButtons(e ?? ""), this.buttonsEl && this._render();
        break;
      case "timeout":
        this._timeout = Number(e) || 3e3;
        break;
      case "visible":
        this._setVisible(e !== null);
        break;
    }
  }
};
i(a, "localStyles", `
        :host {
            position: fixed;
            bottom: 22vh;
            left: 50%;
            width: 60vw;
            z-index: 9999;
            transition: opacity 0.22s ease, transform 0.22s ease;
        }
        #alert-box {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 22px;
            padding: 30px 44px;
            border-radius: 32px;
            overflow: hidden;
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.12);
            box-sizing: border-box;
            text-align: center;
        }
        #message {
            font-size: 1.6rem;
            font-weight: 400;
            color: #ffffff;
            line-height: 1.45;
            letter-spacing: 0.2px;
            font-family: 'Segoe UI', system-ui, sans-serif;
            transition: opacity 0.28s ease;
        }
        #buttons {
            display: flex;
            gap: 14px;
            justify-content: center;
        }
        #buttons button {
            border: none;
            border-radius: 999px;
            padding: 10px 32px;
            font-size: 1rem;
            cursor: pointer;
            font-family: inherit;
            background: rgba(255, 255, 255, 0.15);
            color: rgba(255, 255, 255, 0.8);
            letter-spacing: 0.4px;
            transition: background 0.15s;
        }
        #buttons button:hover {
            background: rgba(255, 255, 255, 0.26);
        }
        #buttons button.primary {
            background: rgba(255, 255, 255, 0.26);
            color: #ffffff;
            font-weight: 500;
        }
        #buttons button.primary:hover {
            background: rgba(255, 255, 255, 0.38);
        }
        #progress {
            position: absolute;
            bottom: 0;
            left: 0;
            height: 3px;
            width: 100%;
            background: rgba(255, 255, 255, 0.45);
            transform-origin: left center;
            display: none;
        }
        @keyframes ra-progress {
            from { transform: scaleX(1); }
            to   { transform: scaleX(0); }
        }
    `), i(a, "COLOR_BG", {
  red: "rgba(214, 28,  28,  0.93)",
  yellow: "rgba(196, 138, 0,   0.93)",
  green: "rgba(22,  160, 70,  0.93)",
  blue: "rgba(24,  72,  218, 0.93)"
}), i(a, "FOLLOWUP_DELAY_MS", 5e3), i(a, "FOLLOWUP_INTERVAL_MS", 5e3);
let g = a;
customElements.define("ravel-alert", g);
