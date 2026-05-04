import { RavelElement } from '../../../../common/RavelElement';

/** Serializable snapshot of a single perf as stored by the track. */
export interface PerfSnapshot {
    id: string;
    label: string;
    color: string;
    start: number;   // timeline position in units
    length: number;  // duration in units
    quantum: number;
}

/** Serializable state of the whole track, returned by {@link RavelRollTrack.getState}. */
export interface TrackState {
    id: string;
    label: string;
    unitWidth: number;
    quantum: number;
    perfs: PerfSnapshot[];
}

/** Live model entry — internal to the track. */
interface PerfEntry {
    element: HTMLElement;
    startUnit: number;
}

/**
 * A horizontal timeline lane that contains and manages {@link RavelRollPerf} elements.
 *
 * Perfs can be placed in two ways:
 * - **Slotted** — declared as light-DOM children in HTML. The track reads each
 *   perf's `x` attribute as a unit position and quantizes + positions it on connect.
 * - **Dropped** — when a perf broadcasts `undock`, every track tracks the drag.
 *   The track whose bounds contain the pointer on release docks the perf.
 *
 * When docked, the track owns the perf's pixel layout:
 * - `left = startUnit × unitWidth`
 * - `top = 0`, `height = 100%` (via the `docked` attribute on the perf)
 * - `unit-width` and `quantum` on the perf are kept in sync with the track
 *
 * ### Attributes
 * | Attribute    | Type   | Default | Description                                         |
 * |--------------|--------|---------|-----------------------------------------------------|
 * | `unit-width` | number | `60`    | Pixels per unit                                     |
 * | `quantum`    | number | `1`     | Snap step size in units                             |
 * | `h`          | number | `40`    | Track height in px                                  |
 * | `label`      | string | `''`    | Track name                                          |
 * | `tick`       | number | `1`     | Minor tick interval in units; `0` disables all ticks |
 * | `tick-mul`   | number | `4`     | Major tick = every `tick × tick-mul` units          |
 *
 * ### CSS custom properties
 * | Property              | Default                      | Description            |
 * |-----------------------|------------------------------|------------------------|
 * | `--ravel-tick-minor`  | `rgba(255,255,255,0.07)`     | Minor tick line color  |
 * | `--ravel-tick-major`  | `rgba(255,255,255,0.18)`     | Major tick line color  |
 *
 * ### Messages broadcast (on `'ravel-roll-track'` channel)
 * | cmd            | content              | Trigger                      |
 * |----------------|----------------------|------------------------------|
 * | `state-change` | {@link TrackState}   | perf docked, undocked, moved |
 *
 * ### Public API
 * - `getState(): TrackState` — current serializable snapshot
 * - `dockPerf(perf, unitPos)` — programmatically dock a perf element
 */
export class RavelRollTrack extends RavelElement {

    // All connected track instances — used to find the drop target on release.
    private static readonly _instances = new Set<RavelRollTrack>();

    // Active drag state, set when one of our perfs broadcasts undock.
    private static _drag: {
        perf: HTMLElement;
        sourceTrack: RavelRollTrack;
        sourceUnit: number;
    } | null = null;

    // Single document-level pointerup handler, registered only during a drag.
    private static readonly _handleDrop = (e: PointerEvent): void => {
        document.removeEventListener('pointerup', RavelRollTrack._handleDrop);

        const drag = RavelRollTrack._drag;
        if (!drag) return;
        RavelRollTrack._drag = null;

        // Find which connected track contains the release point.
        let target: RavelRollTrack | null = null;
        for (const track of RavelRollTrack._instances) {
            const r = track.getBoundingClientRect();
            if (e.clientX >= r.left && e.clientX <= r.right &&
                e.clientY >= r.top  && e.clientY <= r.bottom) {
                target = track;
                break;
            }
        }

        if (target) {
            const r       = target.getBoundingClientRect();
            const rawUnit = (e.clientX - r.left) / target._unitWidth;
            const unitPos = target._quantize(rawUnit);
            target._dockPerf(drag.perf, unitPos);
        } else {
            // Pointer released outside any track — restore to origin.
            drag.sourceTrack._dockPerf(drag.perf, drag.sourceUnit);
        }
    };

    private static readonly localStyles = `
        :host {
            display: block;
            position: relative;
            width: 100%;
            box-sizing: border-box;
            overflow: visible;
        }
        #container {
            width: 100%;
            height: 100%;
            position: relative;
            overflow: visible;
            box-sizing: border-box;
            background: var(--ravel-track-bg, rgba(255, 255, 255, 0.04));
            border-bottom: 1px solid var(--ravel-track-border, rgba(255, 255, 255, 0.08));
        }
        #ticks {
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 0;
        }
        #track-label {
            position: absolute;
            top: 50%;
            right: 6px;
            transform: translateY(-50%);
            font-size: 10px;
            font-family: 'Quantico', monospace, sans-serif;
            color: rgba(255, 255, 255, 0.25);
            pointer-events: none;
            z-index: 1;
        }
    `;

    private static readonly componentHtml = `
        <div id="ticks"></div>
        <div id="track-label"></div>
        <slot></slot>
    `;

    static get observedAttributes(): string[] {
        return [
            ...RavelElement.baseObservedAttributes,
            'unit-width', 'quantum', 'h', 'label', 'tick', 'tick-mul',
        ];
    }

    // Shadow DOM refs

    private ticksEl!: HTMLElement;
    private trackLabel!: HTMLElement;
    private slotEl!: HTMLSlotElement;

    // State

    private _unitWidth = 60;
    private _quantum = 1;
    private _height = 40;
    private _label = '';
    private _tick = 1;
    private _tickMul = 4;

    // Internal model

    private _perfs: PerfEntry[] = [];

    // Lifecycle

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelRollTrack.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.innerHTML = RavelRollTrack.componentHtml;
        this.ticksEl    = this.container.querySelector<HTMLElement>('#ticks')!;
        this.trackLabel = this.container.querySelector<HTMLElement>('#track-label')!;
        this.slotEl     = this.container.querySelector<HTMLSlotElement>('slot')!;
    }

    protected setup(): void {
        super.setup();

        RavelRollTrack._instances.add(this);

        this.style.height = `${this._height}px`;
        this._applyLabel();
        this._renderTicks();

        this.slotEl.addEventListener('slotchange', this.handleSlotChange);
        window.addEventListener('ravel-roll-perf', this.handlePerfBroadcast);
    }

    protected teardown(): void {
        RavelRollTrack._instances.delete(this);
        this.slotEl.removeEventListener('slotchange', this.handleSlotChange);
        window.removeEventListener('ravel-roll-perf', this.handlePerfBroadcast);
        super.teardown();
    }

    // ── Public API ────────────────────────────────────────────

    /** Current serializable snapshot of the track and all its perfs. */
    getState(): TrackState {
        return {
            id:        this.id,
            label:     this._label,
            unitWidth: this._unitWidth,
            quantum:   this._quantum,
            perfs: this._perfs.map(entry => {
                const el = entry.element;
                // Compute current unit position from live pixel left.
                const pixelLeft = parseFloat(el.style.left) || 0;
                const startUnit = this._quantize(pixelLeft / this._unitWidth);
                return {
                    id:     el.id || '',
                    label:  el.getAttribute('label')  ?? '',
                    color:  el.getAttribute('color')  ?? '#4488ff',
                    start:  startUnit,
                    length: parseFloat(el.getAttribute('length') ?? '1') || 1,
                    quantum: this._quantum,
                };
            }),
        };
    }

    /**
     * Programmatically dock a `ravel-roll-perf` element at a given unit position.
     * The element is adopted as a light-DOM child if it isn't already.
     */
    dockPerf(perf: HTMLElement, unitPos: number): void {
        this._dockPerf(perf, unitPos);
    }

    // ── Slot handling ─────────────────────────────────────────

    private handleSlotChange = (): void => {
        const slotted = this.slotEl.assignedElements() as HTMLElement[];
        // Rebuild model from current slot contents.
        this._perfs = [];

        for (const el of slotted) {
            if (el.tagName.toLowerCase() !== 'ravel-roll-perf') continue;
            // x attribute is treated as unit position when slotted.
            const unitPos = this._quantize(parseFloat(el.getAttribute('x') ?? '0') || 0);
            this._initPerf(el, unitPos);
            this._perfs.push({ element: el, startUnit: unitPos });
        }

        this._broadcastState();
    };

    // ── Drag / drop ───────────────────────────────────────────

    private handlePerfBroadcast = (e: Event): void => {
        const { cmd, content } = (e as CustomEvent).detail;
        if (cmd !== 'undock') return;

        const perf = content as HTMLElement;
        const idx = this._perfs.findIndex(p => p.element === perf);
        if (idx === -1) return; // not our perf

        const sourceUnit = this._perfs[idx].startUnit;
        this._perfs.splice(idx, 1);
        this._broadcastState();

        // Stay in source track's DOM so the perf's coordinate space doesn't change
        // and handleCenterMove keeps tracking the pointer without a jump.
        // z-index is global here because :host has no integer z-index (no stacking context).
        perf.style.zIndex = '9999';

        RavelRollTrack._drag = { perf, sourceTrack: this, sourceUnit };
        document.addEventListener('pointerup', RavelRollTrack._handleDrop);
    };

    // ── Internal helpers ──────────────────────────────────────

    private _dockPerf(perf: HTMLElement, unitPos: number): void {
        // Adopt into light DOM if not already our child.
        if (perf.parentElement !== (this as HTMLElement)) {
            this.appendChild(perf);
        }

        this._initPerf(perf, unitPos);

        const existing = this._perfs.find(p => p.element === perf);
        if (existing) {
            existing.startUnit = unitPos;
        } else {
            this._perfs.push({ element: perf, startUnit: unitPos });
        }

        this._broadcastState();
    }

    /** Set all track-managed attributes and pixel position on a perf element. */
    private _initPerf(perf: HTMLElement, unitPos: number): void {
        perf.setAttribute('docked',     '');
        perf.setAttribute('unit-width', String(this._unitWidth));
        perf.setAttribute('quantum',    String(this._quantum));
        perf.setAttribute('x',          String(unitPos));
        perf.style.left   = `${unitPos * this._unitWidth}px`;
        perf.style.top    = '0px';
        perf.style.zIndex = '';
    }

    private _relayout(): void {
        for (const entry of this._perfs) {
            entry.element.setAttribute('unit-width', String(this._unitWidth));
            entry.element.style.left = `${entry.startUnit * this._unitWidth}px`;
        }
    }

    private _syncQuantum(): void {
        for (const entry of this._perfs) {
            entry.element.setAttribute('quantum', String(this._quantum));
        }
    }

    private _quantize(value: number): number {
        const q = this._quantum;
        return Math.max(0, Math.floor(value / q) * q);
    }

    private _applyLabel(): void {
        if (this.trackLabel) this.trackLabel.textContent = this._label;
    }

    private _renderTicks(): void {
        if (!this.ticksEl) return;
        if (this._tick <= 0) {
            this.ticksEl.style.backgroundImage = 'none';
            return;
        }
        const minorPx = this._tick * this._unitWidth;
        const minorGrad = `repeating-linear-gradient(to right,`
            + ` transparent 0px,`
            + ` transparent ${minorPx - 1}px,`
            + ` var(--ravel-tick-minor, rgba(255,255,255,0.07)) ${minorPx - 1}px,`
            + ` var(--ravel-tick-minor, rgba(255,255,255,0.07)) ${minorPx}px)`;

        if (this._tickMul > 1) {
            const majorPx = minorPx * this._tickMul;
            const majorGrad = `repeating-linear-gradient(to right,`
                + ` transparent 0px,`
                + ` transparent ${majorPx - 1}px,`
                + ` var(--ravel-tick-major, rgba(255,255,255,0.18)) ${majorPx - 1}px,`
                + ` var(--ravel-tick-major, rgba(255,255,255,0.18)) ${majorPx}px)`;
            // Major is listed first so it paints on top of minor at shared positions.
            this.ticksEl.style.backgroundImage = `${majorGrad}, ${minorGrad}`;
        } else {
            this.ticksEl.style.backgroundImage = minorGrad;
        }
    }

    private _broadcastState(): void {
        this.broadcastMessage('ravel-roll-track', 'state-change', this.getState());
    }

    // ── Attribute handling ────────────────────────────────────

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);

        switch (name) {
            case 'unit-width':
                this._unitWidth = Number(newValue) || 60;
                if (this.container) { this._relayout(); this._renderTicks(); }
                break;
            case 'quantum':
                this._quantum = Math.max(Number(newValue) || 1, 0.001);
                if (this.container) this._syncQuantum();
                break;
            case 'h':
                this._height = Number(newValue) || 40;
                this.style.height = `${this._height}px`;
                break;
            case 'label':
                this._label = newValue ?? '';
                if (this.trackLabel) this._applyLabel();
                break;
            case 'tick':
                this._tick = Number(newValue) ?? 1;
                if (this.ticksEl) this._renderTicks();
                break;
            case 'tick-mul':
                this._tickMul = Math.max(1, Number(newValue) || 4);
                if (this.ticksEl) this._renderTicks();
                break;
        }
    }
}
