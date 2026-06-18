import { RavelElement } from '../../../../common/RavelElement';

/**
 * A 3-column grid layout container for slotted children.
 *
 * The name comes from *nona* (nine) — the canonical use is nine children
 * arranged in a 3 × 3 grid. Rows grow automatically if more children are added.
 * Nonagrams may be nested — slot a `<ravel-nonagram>` as one of the nine children
 * and use `scale` to shrink it to cell size.
 *
 * ### Attributes
 * | Attribute | Type   | Default | Description                                          |
 * |-----------|--------|---------|------------------------------------------------------|
 * | `gap`     | string | `5px`   | CSS gap between cells                                |
 * | `scale`   | number | `1`     | CSS zoom factor — shrinks render AND layout footprint|
 */
export class RavelNonagram extends RavelElement {

    private static readonly localStyles = `
        :host {
            display: block;
            box-sizing: border-box;
        }
        #container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 5px;
        }
    `;

    static get observedAttributes(): string[] {
        return [...RavelElement.baseObservedAttributes, 'gap', 'scale'];
    }

    private _gap   = '5px';
    private _scale = 1;

    protected initialize(): void {
        super.initialize();

        const style = document.createElement('style');
        style.textContent = RavelNonagram.localStyles;
        this.shadowRoot!.insertBefore(style, this.container);

        this.container.appendChild(document.createElement('slot'));
    }

    protected setup(): void {
        super.setup();
        this.container.style.gap = this._gap;
        this._applyScale();
    }

    protected teardown(): void {
        super.teardown();
    }

    private _applyScale(): void {
        this.style.zoom = this._scale !== 1 ? String(this._scale) : '';
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        switch (name) {
            case 'gap':
                this._gap = newValue ?? '5px';
                if (this.container) this.container.style.gap = this._gap;
                break;
            case 'scale':
                this._scale = parseFloat(newValue ?? '1') || 1;
                this._applyScale();
                break;
        }
    }
}
