import { RavelMessenger } from './RavelMessenger';
import sharedStyles from './shared-styles';

/** The rendering/interaction mode for a {@link RavelElement}. */
export type RavelElementMode = 'inline' | 'draggable' | 'factory' | 'physics';

/**
 * observable level for the built-in debug panel and event logging.
 *
 * - `'off'`     — no debug output (default).
 * - `'events'`  — logs messages and virtual events to the console.
 * - `'state'`   — shows a floating panel with a live state snapshot.
 * - `'verbose'` — both events and state panel.
 */
export type RavelObservableLevel = 'off' | 'events' | 'state' | 'verbose';

/**
 * Abstract base class for all Raveling custom elements.
 *
 * Every Raveling component inherits the following capabilities:
 *
 * - **Lifecycle** — `initialize()` (once, on first connect) → `setup()` (every connect)
 *   → `teardown()` (every disconnect). Subclasses override these instead of the raw
 *   `connectedCallback` / `disconnectedCallback`.
 * - **Base container** — `initialize()` attaches an open Shadow DOM and stamps a
 *   `#container` div. Subclasses call `super.initialize()` then populate
 *   `this.container` with their own HTML.
 * - **Modes** — `'inline'` (default), `'draggable'`, `'factory'`, `'physics'`.
 *   Draggable and physics modes are handled by the base class; no subclass needed.
 * - **Messaging** — pub/sub via {@link RavelMessenger}; window-level broadcasting.
 * - **Themeable** — receives CSS custom-property maps from `ravel-theme-broker`.
 * - **Signalable** — `signals-in` / `signals-out` attributes; emits via `ravel-signals-broker`.
 * - **Observable** — `observable` attribute: `off | events | state | verbose`.
 * - **Dockable** — sends a dock request to any listening `ravel-dock` element.
 * - **Virtual Events** — named listeners with factory-mode interception.
 * - **Accessible** — baseline WCAG AAA defaults on first connect.
 *
 * @extends HTMLElement
 */
export class RavelElement extends HTMLElement {
    /**
     * Base CSS injected into every component's Shadow DOM, after `sharedStyles`.
     * Provides sensible defaults for `#container`. Override in subclasses to
     * extend or replace.
     */
    static baseStyles = `
        <style>
            :host { display: inline-block; box-sizing: border-box; }
            #container { position: relative; width: 100%; height: 100%; box-sizing: border-box; }
        </style>
    `;

    // ── Position ──────────────────────────────────────────────────────────────

    /** Horizontal position set via the `x` attribute. Subclasses may read this. */
    protected x: number = 0;
    /** Vertical position set via the `y` attribute. Subclasses may read this. */
    protected y: number = 0;

    // ── Base container ────────────────────────────────────────────────────────

    /**
     * The `#container` div inside this element's Shadow DOM.
     * Available after `initialize()` runs. Subclasses populate it with their HTML.
     */
    protected container!: HTMLElement;

    // ── Mode ──────────────────────────────────────────────────────────────────

    /** Current element mode. Defaults to `'inline'`. */
    private _mode: RavelElementMode = 'inline';
    /**
     * Whether factory mode is active. Mutes interactions and replaces them with
     * self-spawning. Toggled via the boolean `factory` attribute.
     */
    private _isFactory: boolean = false;

    // ── Messaging ─────────────────────────────────────────────────────────────

    /** Message names this element is currently subscribed to. */
    public observedMessages: string[] = [];

    // ── Theme ─────────────────────────────────────────────────────────────────

    /** Active theme name, set via the `theme` attribute. */
    private _theme: string = '';

    // ── Signals ───────────────────────────────────────────────────────────────

    /** Signal names this element accepts, parsed from `signals-in`. */
    private _signalsIn: string[] = [];
    /** Signal names this element can emit, parsed from `signals-out`. */
    private _signalsOut: string[] = [];

    // ── observable ─────────────────────────────────────────────────────────

    /** Current observable level. Defaults to `'off'`. */
    private _observable: RavelObservableLevel = 'off';
    /** Floating debug panel, present only when level is `'state'` or `'verbose'`. */
    private _debugPanel: HTMLElement | null = null;

    // ── Virtual Events ────────────────────────────────────────────────────────

    /** Registered virtual event handlers, keyed by event name. */
    private _virtualListeners: Map<string, ((detail: unknown) => void)[]> = new Map();

    // ── Drag state ────────────────────────────────────────────────────────────

    private _dragAnchorX = 0;
    private _dragAnchorY = 0;
    private _dragOriginX = 0;
    private _dragOriginY = 0;

    // ── Lifecycle guard ───────────────────────────────────────────────────────

    /** Ensures {@link initialize} runs exactly once. */
    private _initialized = false;

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
    static get baseObservedAttributes(): string[] {
        return [
            'x', 'y',
            'mode', 'factory',
            'theme',
            'signals-in', 'signals-out',
            'observable',
        ];
    }

    constructor() {
        super();
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
    protected initialize(): void {
        const shadow = this.attachShadow({ mode: 'open' });
        shadow.innerHTML = sharedStyles + (this.constructor as typeof RavelElement).baseStyles;
        const container = document.createElement('div');
        container.id = 'container';
        shadow.appendChild(container);
        this.container = container;
    }

    /**
     * Called every connect (after `initialize` on the first). Subscribe to
     * messages and bind event listeners here. Reverse everything in `teardown`.
     *
     * The base implementation enables draggable and physics mode infrastructure.
     * Subclasses must call `super.setup()`.
     */
    protected setup(): void {
        if (this._mode === 'draggable') {
            this.style.position = 'absolute';
            this.style.left = `${this.x}px`;
            this.style.top = `${this.y}px`;
            this.addEventListener('pointerdown', this._onDragPointerDown);
        }
        if (this._mode === 'physics' && this.id) {
            this.style.position = 'absolute';
            this.subscribe([this.id]);
            this.addEventListener(this.id, this._onPhysicsMessage);
        }
    }

    /**
     * Called every disconnect. Unsubscribe and remove listeners added in `setup`.
     *
     * The base implementation cleans up drag and physics listeners.
     * Subclasses must call `super.teardown()`.
     */
    protected teardown(): void {
        this.removeEventListener('pointerdown', this._onDragPointerDown);
        document.removeEventListener('pointermove', this._onDragPointerMove);
        document.removeEventListener('pointerup', this._onDragPointerUp);
        if (this._mode === 'physics' && this.id) {
            this.removeEventListener(this.id, this._onPhysicsMessage);
        }
    }

    connectedCallback(): void {
        if (!this._initialized) {
            this._initialized = true;
            this.initialize();
            this._applyAccessibilityDefaults();
        }
        this._registerWithBrokers();
        this.setup();
    }

    disconnectedCallback(): void {
        this.teardown();
        this._unregisterFromBrokers();
        this._removeDebugPanel();
    }

    attributeChangedCallback(
        name: string,
        oldValue: string | null,
        newValue: string | null
    ): void {
        switch (name) {
            case 'x':
                this.x = Number(newValue);
                break;
            case 'y':
                this.y = Number(newValue);
                break;
            case 'mode':
                this._mode = (newValue as RavelElementMode) ?? 'inline';
                break;
            case 'factory':
                this._isFactory = newValue !== null;
                break;
            case 'theme':
                this._theme = newValue ?? '';
                this._requestTheme(this._theme);
                break;
            case 'signals-in':
                this._signalsIn = newValue ? newValue.split(',').map(s => s.trim()) : [];
                break;
            case 'signals-out':
                this._signalsOut = newValue ? newValue.split(',').map(s => s.trim()) : [];
                break;
            case 'observable': {
                const level = (newValue ?? 'off') as RavelObservableLevel;
                this._observable = level;
                const showPanel = level === 'state' || level === 'verbose';
                showPanel ? this._mountDebugPanel() : this._removeDebugPanel();
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
    sendMessage(msg: string, cmd: string, content: unknown, version?: number): void {
        if (this._observable === 'events' || this._observable === 'verbose') {
            console.debug(`[${this.tagName.toLowerCase()}] sendMessage`, { msg, cmd, content, version });
        }
        RavelMessenger.sendMessage(msg, cmd, content, version);
    }

    /**
     * Dispatches a {@link CustomEvent} on the global `window`, bypassing the
     * pub/sub subscription list.
     */
    broadcastMessage(msg: string, cmd: string, content: unknown): void {
        if (this._observable === 'events' || this._observable === 'verbose') {
            console.debug(`[${this.tagName.toLowerCase()}] broadcastMessage`, { msg, cmd, content });
        }
        const evt = new CustomEvent(msg, { detail: { cmd, content } });
        window.dispatchEvent(evt);
    }

    /**
     * Subscribes this element to a list of message names via the messenger.
     */
    subscribe(msgList: string[]): void {
        for (const msg of msgList) {
            RavelMessenger.subscribe(msg, this);
            if (!this.observedMessages.includes(msg)) {
                this.observedMessages.push(msg);
            }
        }
    }

    /**
     * Unsubscribes this element from a list of message names.
     */
    unsubscribe(msgList: string[]): void {
        for (const msg of msgList) {
            RavelMessenger.unsubscribe(msg, this);
        }
        this.observedMessages = this.observedMessages.filter(m => !msgList.includes(m));
    }

    // ── Factory Mode ──────────────────────────────────────────────────────────

    /** `true` when this element is operating in factory (self-spawning) mode. */
    get isFactory(): boolean {
        return this._isFactory;
    }

    /**
     * Spawns a copy of this element immediately after this node.
     * The clone has `factory` removed so it behaves normally.
     * Subclasses may override to customise the spawned instance.
     */
    spawnCopy(): this {
        const clone = this.cloneNode(true) as this;
        clone.removeAttribute('factory');
        this.parentNode?.insertBefore(clone, this.nextSibling);
        return clone;
    }

    // ── Themeable ─────────────────────────────────────────────────────────────

    /**
     * Applies CSS custom properties to this element's inline style.
     * Called by `ravel-theme-broker` when a theme is pushed.
     */
    applyTheme(themeData: Record<string, string>): void {
        for (const [prop, value] of Object.entries(themeData)) {
            this.style.setProperty(prop, value);
        }
    }

    private _requestTheme(themeName: string): void {
        if (!themeName) return;
        RavelMessenger.sendMessage('ravel-theme-broker', 'request-theme', {
            element: this,
            theme: themeName,
        });
    }

    // ── Signalable ────────────────────────────────────────────────────────────

    /** Signal names this element accepts (from `signals-in`). */
    get signalsIn(): string[] { return [...this._signalsIn]; }

    /** Signal names this element can emit (from `signals-out`). */
    get signalsOut(): string[] { return [...this._signalsOut]; }

    /**
     * Emits a named signal through `ravel-signals-broker`.
     * @param name - Must be listed in `signals-out`.
     */
    emitSignal(name: string, value: unknown): void {
        RavelMessenger.sendMessage('ravel-signals-broker', 'signal', {
            name, value, source: this,
        });
    }

    // ── Dockable ──────────────────────────────────────────────────────────────

    /**
     * Sends a dock request to any listening `ravel-dock` element.
     */
    dock(): void {
        RavelMessenger.sendMessage('ravel-dock', 'dock-me', this);
    }

    // ── Draggable mode ────────────────────────────────────────────────────────

    private _onDragPointerDown = (e: PointerEvent): void => {
        e.preventDefault();
        this._dragAnchorX = e.clientX;
        this._dragAnchorY = e.clientY;
        this._dragOriginX = parseFloat(this.style.left) || this.x;
        this._dragOriginY = parseFloat(this.style.top) || this.y;
        document.addEventListener('pointermove', this._onDragPointerMove);
        document.addEventListener('pointerup', this._onDragPointerUp);
        this.dispatchVirtualEvent('drag-begin', { x: e.clientX, y: e.clientY });
    };

    private _onDragPointerMove = (e: PointerEvent): void => {
        e.preventDefault();
        this.x = this._dragOriginX + (e.clientX - this._dragAnchorX);
        this.y = this._dragOriginY + (e.clientY - this._dragAnchorY);
        this.style.left = `${this.x}px`;
        this.style.top = `${this.y}px`;
        this.dispatchVirtualEvent('drag-move', { x: this.x, y: this.y });
    };

    private _onDragPointerUp = (e: PointerEvent): void => {
        document.removeEventListener('pointermove', this._onDragPointerMove);
        document.removeEventListener('pointerup', this._onDragPointerUp);
        this.dispatchVirtualEvent('drag-end', { x: this.x, y: this.y });
    };

    // ── Physics mode ──────────────────────────────────────────────────────────

    /**
     * Handles position-update messages from a `ravel-physics-world`.
     * Expected message shape: `{ cmd: 'position', content: { x, y, angle? } }`.
     * The element must have an `id` to receive these.
     */
    private _onPhysicsMessage = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent).detail;
        if (cmd === 'position') {
            const pos = content as { x: number; y: number; angle?: number };
            this.x = pos.x;
            this.y = pos.y;
            this.style.left = `${this.x}px`;
            this.style.top = `${this.y}px`;
            if (pos.angle != null) {
                this.style.transform = `rotate(${pos.angle}rad)`;
            }
        }
    };

    // ── observable / Debug Panel ───────────────────────────────────────────

    private _mountDebugPanel(): void {
        if (this._debugPanel) return;
        const panel = document.createElement('div');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', `Debug: ${this.tagName.toLowerCase()}`);
        panel.setAttribute('aria-modal', 'false');
        panel.style.cssText = [
            'position:absolute',
            'z-index:9999',
            'background:var(--ravel-bg, #1e1e2e)',
            'color:var(--ravel-font, #cdd6f4)',
            'font:12px/1.5 var(--ravel-font-mono, monospace)',
            'padding:8px 12px',
            'border:1px solid var(--ravel-surface, #45475a)',
            'border-radius:6px',
            'pointer-events:none',
            'white-space:pre',
        ].join(';');
        panel.textContent = this._debugSnapshot();
        this._debugPanel = panel;
        document.body.appendChild(panel);
        this._positionDebugPanel();
    }

    private _removeDebugPanel(): void {
        this._debugPanel?.remove();
        this._debugPanel = null;
    }

    private _positionDebugPanel(): void {
        if (!this._debugPanel) return;
        const rect = this.getBoundingClientRect();
        this._debugPanel.style.top = `${rect.bottom + window.scrollY + 4}px`;
        this._debugPanel.style.left = `${rect.left + window.scrollX}px`;
    }

    private _debugSnapshot(): string {
        return [
            `<${this.tagName.toLowerCase()}>`,
            `  mode:        ${this._mode}`,
            `  factory:     ${this._isFactory}`,
            `  position:    x=${this.x} y=${this.y}`,
            `  theme:       ${this._theme || '(none)'}`,
            `  signals-in:  ${this._signalsIn.join(', ') || '(none)'}`,
            `  signals-out: ${this._signalsOut.join(', ') || '(none)'}`,
            `  subscribed:  ${this.observedMessages.join(', ') || '(none)'}`,
        ].join('\n');
    }

    // ── Virtual Events ────────────────────────────────────────────────────────

    /**
     * Registers a handler for a named virtual event.
     *
     * Virtual events (`'click'`, `'drag-begin'`, `'drag-move'`, `'drag-end'`, etc.)
     * are dispatched through Raveling's internal system rather than the DOM.
     * In factory mode, interaction events trigger {@link spawnCopy} instead.
     */
    addVirtualListener(event: string, handler: (detail: unknown) => void): void {
        if (!this._virtualListeners.has(event)) {
            this._virtualListeners.set(event, []);
        }
        this._virtualListeners.get(event)!.push(handler);
    }

    /** Removes a previously registered virtual event handler. */
    removeVirtualListener(event: string, handler: (detail: unknown) => void): void {
        const handlers = this._virtualListeners.get(event);
        if (!handlers) return;
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
    }

    /**
     * Dispatches a virtual event to all registered handlers.
     * In factory mode, interaction events are intercepted by {@link spawnCopy}.
     */
    dispatchVirtualEvent(event: string, detail: unknown): void {
        if (this._observable === 'events' || this._observable === 'verbose') {
            console.debug(`[${this.tagName.toLowerCase()}] virtualEvent:${event}`, detail);
        }
        const interactionEvents = ['click', 'drag-begin', 'pointerdown'];
        if (this._isFactory && interactionEvents.includes(event)) {
            this.spawnCopy();
            return;
        }
        const handlers = this._virtualListeners.get(event);
        if (!handlers) return;
        for (const handler of handlers) {
            handler(detail);
        }
    }

    // ── Accessibility ─────────────────────────────────────────────────────────

    /**
     * Applies baseline WCAG AAA defaults on first connect.
     * Sets `role="region"` and `tabindex="0"` if not already present.
     * Subclasses that need a different default role should set it in their
     * own `initialize()` before calling `super.initialize()`.
     */
    private _applyAccessibilityDefaults(): void {
        if (!this.hasAttribute('role')) {
            this.setAttribute('role', 'region');
        }
        if (!this.hasAttribute('tabindex')) {
            this.setAttribute('tabindex', '0');
        }
    }

    // ── Broker Registration ───────────────────────────────────────────────────

    private _registerWithBrokers(): void {
        RavelMessenger.subscribe('ravel-theme-broker:push', this);
        if (this._signalsIn.length > 0 || this._signalsOut.length > 0) {
            RavelMessenger.sendMessage('ravel-signals-broker', 'register', {
                element: this,
                signalsIn: this._signalsIn,
                signalsOut: this._signalsOut,
            });
        }
        if (this._theme) {
            this._requestTheme(this._theme);
        }
    }

    private _unregisterFromBrokers(): void {
        RavelMessenger.unsubscribe('ravel-theme-broker:push', this);
        if (this._signalsIn.length > 0 || this._signalsOut.length > 0) {
            RavelMessenger.sendMessage('ravel-signals-broker', 'unregister', { element: this });
        }
        this.unsubscribe([...this.observedMessages]);
    }
}
