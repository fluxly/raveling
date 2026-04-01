import { RavelMessenger } from './RavelMessenger';

/** The rendering/interaction mode for a {@link RavelElement}. */
export type RavelElementMode = 'inline' | 'factory' | 'physics';

/**
 * Abstract base class for all Raveling custom elements.
 *
 * Every Raveling component inherits the following capabilities from this class:
 *
 * - **Modes** — inline (default), factory (self-spawning), or physics (world-driven).
 *   `RavelDraggableElement` and `RavelPhysicsElement` extend this class for their modes.
 * - **Messaging** — pub/sub via {@link RavelMessenger}; window-level broadcasting.
 * - **Themeable** — receives CSS custom-property maps from `ravel-theme-broker`.
 * - **Signalable** — declares `signals-in` / `signals-out` attributes; emits via `ravel-signals-broker`.
 * - **Observable** — floating debug panel toggled by the `observable` attribute.
 * - **Dockable** — sends a dock request to any listening `ravel-dock` element.
 * - **Virtual Events** — named listeners independent of the DOM event system,
 *   with built-in factory-mode interception.
 * - **Accessible** — baseline WCAG AAA defaults applied on connect; subclasses refine.
 *
 * @extends HTMLElement
 */
export class RavelElement extends HTMLElement {
    static baseStyles = ``;
    static baseHtml = ``;

    // ── Position ──────────────────────────────────────────────────────────────

    /** Horizontal grid position set via the `x` attribute. */
    private x: number = 0;
    /** Vertical grid position set via the `y` attribute. */
    private y: number = 0;

    // ── Mode ──────────────────────────────────────────────────────────────────

    /** Current element mode. Defaults to `'inline'`. */
    private _mode: RavelElementMode = 'inline';
    /**
     * Whether this element is operating as a factory clone.
     * Factory mode mutes normal interactions and replaces them with self-spawning.
     * Toggled via the boolean `factory` attribute.
     */
    private _isFactory: boolean = false;

    // ── Messaging ─────────────────────────────────────────────────────────────

    /** Message names this element is currently subscribed to. */
    public observedMessages: string[] = [];

    // ── Theme ─────────────────────────────────────────────────────────────────

    /** The active theme name, set via the `theme` attribute. */
    private _theme: string = '';

    // ── Signals ───────────────────────────────────────────────────────────────

    /** Signal names this element accepts, parsed from the `signals-in` attribute. */
    private _signalsIn: string[] = [];
    /** Signal names this element can emit, parsed from the `signals-out` attribute. */
    private _signalsOut: string[] = [];

    // ── Observable ────────────────────────────────────────────────────────────

    /** Whether the debug/observability panel is currently active. */
    private _observable: boolean = false;
    /** The floating debug panel element, present only while `observable` is set. */
    private _debugPanel: HTMLElement | null = null;

    // ── Virtual Events ────────────────────────────────────────────────────────

    /** Registered virtual event handlers, keyed by event name. */
    private _virtualListeners: Map<string, ((detail: unknown) => void)[]> = new Map();

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Attributes observed by all Raveling elements.
     * Subclasses should spread this into their own `observedAttributes` getter:
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
            'aria-label', 'role',
        ];
    }

    constructor() {
        super();
    }

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    connectedCallback(): void {
        this._applyAccessibilityDefaults();
        this._registerWithBrokers();
    }

    disconnectedCallback(): void {
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
            case 'observable':
                this._observable = newValue !== null;
                this._observable ? this._mountDebugPanel() : this._removeDebugPanel();
                break;
            case 'aria-label':
            case 'role':
                // Passed through directly to the host element; handled by the browser.
                break;
        }
    }

    // ── Messaging ─────────────────────────────────────────────────────────────

    /**
     * Sends a targeted message through the {@link RavelMessenger} pub/sub system.
     * @param msg - The message name (event type).
     * @param cmd - A command string included in the event detail.
     * @param content - Arbitrary payload included in the event detail.
     */
    sendMessage(msg: string, cmd: string, content: unknown): void {
        RavelMessenger.sendMessage(msg, cmd, content);
    }

    /**
     * Dispatches a {@link CustomEvent} on the global `window` object,
     * bypassing the pub/sub subscription list.
     * @param msg - The event type name.
     * @param cmd - A command string included in the event detail.
     * @param content - Arbitrary payload included in the event detail.
     */
    broadcastMessage(msg: string, cmd: string, content: unknown): void {
        const evt = new CustomEvent(msg, { detail: { cmd, content } });
        window.dispatchEvent(evt);
    }

    /**
     * Subscribes this element to a list of message names via the messenger.
     * @param msgList - Message names to subscribe to.
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
     * @param msgList - Message names to unsubscribe from.
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
     * Spawns a copy of this element and inserts it immediately after this node.
     * The clone has the `factory` attribute removed so it behaves normally.
     * Subclasses may override to customise the spawned instance.
     * @returns The newly inserted element clone.
     */
    spawnCopy(): this {
        const clone = this.cloneNode(true) as this;
        clone.removeAttribute('factory');
        this.parentNode?.insertBefore(clone, this.nextSibling);
        return clone;
    }

    // ── Themeable ─────────────────────────────────────────────────────────────

    /**
     * Applies a map of CSS custom properties to this element's inline style.
     * Intended to be called by `ravel-theme-broker` when a theme is pushed.
     * @param themeData - CSS custom property names mapped to their values.
     */
    applyTheme(themeData: Record<string, string>): void {
        for (const [prop, value] of Object.entries(themeData)) {
            this.style.setProperty(prop, value);
        }
    }

    /**
     * Sends a theme request to `ravel-theme-broker` for the given theme name.
     */
    private _requestTheme(themeName: string): void {
        if (!themeName) return;
        RavelMessenger.sendMessage('ravel-theme-broker', 'request-theme', {
            element: this,
            theme: themeName,
        });
    }

    // ── Signalable ────────────────────────────────────────────────────────────

    /** Signal names this element accepts (declared via the `signals-in` attribute). */
    get signalsIn(): string[] {
        return [...this._signalsIn];
    }

    /** Signal names this element can emit (declared via the `signals-out` attribute). */
    get signalsOut(): string[] {
        return [...this._signalsOut];
    }

    /**
     * Emits a named signal through `ravel-signals-broker`.
     * @param name - The signal name. Should be listed in `signals-out`.
     * @param value - Arbitrary signal payload.
     */
    emitSignal(name: string, value: unknown): void {
        RavelMessenger.sendMessage('ravel-signals-broker', 'signal', {
            name,
            value,
            source: this,
        });
    }

    // ── Dockable ──────────────────────────────────────────────────────────────

    /**
     * Sends a dock request to any listening `ravel-dock` element.
     * The dock receives this element reference and minimises/captures it.
     */
    dock(): void {
        RavelMessenger.sendMessage('ravel-dock', 'dock-me', this);
    }

    // ── Observable / Debug Panel ──────────────────────────────────────────────

    /**
     * Mounts a floating, non-interactive debug panel next to this element
     * showing a live snapshot of its internal state.
     * Activated by setting the `observable` attribute on the element.
     */
    private _mountDebugPanel(): void {
        if (this._debugPanel) return;

        const panel = document.createElement('div');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-label', `Debug: ${this.tagName.toLowerCase()}`);
        panel.setAttribute('aria-modal', 'false');
        panel.style.cssText = [
            'position:absolute',
            'z-index:9999',
            'background:#1e1e2e',
            'color:#cdd6f4',
            'font:12px/1.5 monospace',
            'padding:8px 12px',
            'border:1px solid #45475a',
            'border-radius:6px',
            'pointer-events:none',
            'white-space:pre',
        ].join(';');

        panel.textContent = this._debugSnapshot();
        this._debugPanel = panel;
        document.body.appendChild(panel);
        this._positionDebugPanel();
    }

    /** Removes the debug panel from the DOM. */
    private _removeDebugPanel(): void {
        this._debugPanel?.remove();
        this._debugPanel = null;
    }

    /** Positions the debug panel below this element's bounding rect. */
    private _positionDebugPanel(): void {
        if (!this._debugPanel) return;
        const rect = this.getBoundingClientRect();
        this._debugPanel.style.top = `${rect.bottom + window.scrollY + 4}px`;
        this._debugPanel.style.left = `${rect.left + window.scrollX}px`;
    }

    /** Returns a formatted state snapshot for the debug panel. */
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
     * Virtual events mirror browser event names (`'click'`, `'drag-begin'`,
     * `'drag-end'`, etc.) but are dispatched through Raveling's internal system
     * rather than the DOM, allowing factory-mode interception and other
     * framework-level behaviour.
     *
     * @param event - Virtual event name.
     * @param handler - Callback receiving the event detail payload.
     */
    addVirtualListener(event: string, handler: (detail: unknown) => void): void {
        if (!this._virtualListeners.has(event)) {
            this._virtualListeners.set(event, []);
        }
        this._virtualListeners.get(event)!.push(handler);
    }

    /**
     * Removes a previously registered virtual event handler.
     * @param event - Virtual event name.
     * @param handler - The exact handler reference to remove.
     */
    removeVirtualListener(event: string, handler: (detail: unknown) => void): void {
        const handlers = this._virtualListeners.get(event);
        if (!handlers) return;
        const idx = handlers.indexOf(handler);
        if (idx !== -1) handlers.splice(idx, 1);
    }

    /**
     * Dispatches a virtual event to all registered handlers.
     *
     * In factory mode, interaction events (`'click'`, `'drag-begin'`,
     * `'pointerdown'`) are intercepted and replaced with {@link spawnCopy}
     * instead of reaching registered handlers.
     *
     * @param event - Virtual event name.
     * @param detail - Arbitrary payload passed to each handler.
     */
    dispatchVirtualEvent(event: string, detail: unknown): void {
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
     * Applies baseline accessibility attributes on connect if not already
     * provided by the author. Ensures every element has a role and is
     * keyboard-focusable by default (WCAG AAA).
     *
     * Subclasses should call `super.connectedCallback()` to preserve this.
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

    /**
     * Registers this element with framework brokers on connect.
     * Subscribes to theme-push events and, if signals are declared,
     * registers with `ravel-signals-broker`.
     */
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

    /**
     * Unregisters this element from all framework brokers on disconnect,
     * and clears all active message subscriptions.
     */
    private _unregisterFromBrokers(): void {
        RavelMessenger.unsubscribe('ravel-theme-broker:push', this);

        if (this._signalsIn.length > 0 || this._signalsOut.length > 0) {
            RavelMessenger.sendMessage('ravel-signals-broker', 'unregister', { element: this });
        }

        this.unsubscribe([...this.observedMessages]);
    }
}
