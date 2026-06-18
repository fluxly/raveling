/* global Blockly loaded via <script> tag — not an npm package */
declare const Blockly: any;

import { RavelElement } from '../../../../common/RavelElement';

/**
 * Embeds a Blockly visual programming workspace inside a Raveling element.
 * Blockly must be loaded as a global script before this element is defined.
 *
 * ### Attributes
 * Inherits all base attributes (`mode`, `observable`, `signals-in`, etc.).
 * No component-specific attributes yet — toolbox contents are configured via JS.
 *
 * ### Public API
 * | Member         | Description                                      |
 * |----------------|--------------------------------------------------|
 * | `workspace`    | The underlying `Blockly.WorkspaceSvg` instance   |
 * | `getCode()`    | Generate JS from workspace (requires JS generator) |
 * | `clear()`      | Clear all blocks from the workspace              |
 */
export class RavelBlockly extends RavelElement {

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes];
    }

    private _workspace:         any                   = null;
    private _blocklyContainer:  HTMLDivElement | null = null;
    private _resizeObserver:    ResizeObserver | null = null;

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    protected initialize(): void {
        super.initialize();

        // Slot lets light-DOM children (the Blockly container) render through
        // the shadow DOM, while global CSS from document.head still applies.
        this.container.innerHTML = '<slot></slot>';

        // Blockly needs a block-level, positioned element.
        // Only set defaults if the author hasn't supplied explicit values.
        if (!this.style.display)   this.style.display   = 'block';
        if (!this.style.width)     this.style.width     = '100%';
        if (!this.style.height)    this.style.height    = '100%';
        if (!this.style.position)  this.style.position  = 'relative';

        // Blockly container lives in light DOM so its SVG is reachable by
        // Blockly's global CSS injection and positioned overlays.
        const bc = document.createElement('div');
        bc.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
        this.appendChild(bc);
        this._blocklyContainer = bc;
    }

    protected setup(): void {
        super.setup();

        if (!this._blocklyContainer) return;

        // Preserve workspace across disconnect/reconnect (blocks survive).
        if (!this._workspace) {
            this._workspace = Blockly.inject(this._blocklyContainer, {
                toolbox:            this._buildToolbox(),
                theme:              Blockly.Themes.Zelos,
                renderer:           'zelos',
                horizontalLayout:   true,
                toolboxPosition:    'end',
                scrollbars:         false,
                trashcan:           false,
            });
        }

        this._resizeObserver = new ResizeObserver(() => {
            if (this._workspace) Blockly.svgResize(this._workspace);
        });
        this._resizeObserver.observe(this);
    }

    protected teardown(): void {
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        // Workspace is intentionally preserved so blocks survive reconnection.
        super.teardown();
    }

    // ── Public API ────────────────────────────────────────────────────────────

    get workspace(): any { return this._workspace; }

    getCode(): string {
        if (!this._workspace || !Blockly.JavaScript) return '';
        return Blockly.JavaScript.workspaceToCode(this._workspace);
    }

    clear(): void {
        if (this._workspace) this._workspace.clear();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private _buildToolbox() {
        return {
            kind: 'flyoutToolbox',
            contents: [
                { kind: 'block', type: 'controls_if' },
                { kind: 'block', type: 'logic_compare' },
                { kind: 'block', type: 'math_number' },
                { kind: 'block', type: 'text' },
                { kind: 'block', type: 'text_print' },
            ],
        };
    }
}
