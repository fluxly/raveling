import { RavelElement } from '../../../../common/RavelElement';

/**
 * A 3-column grid layout container for slotted children.
 *
 * The name comes from *nona* (nine) — the canonical use is nine children
 * arranged in a 3 × 3 grid. Rows grow automatically if more children are added.
 *
 * ### Attributes
 * | Attribute | Type   | Default | Description          |
 * |-----------|--------|---------|----------------------|
 * | `gap`     | string | `5px`   | CSS gap between cells |
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
        return [...RavelElement.baseObservedAttributes, 'gap'];
    }

    private _gap = '5px';

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
    }

    protected teardown(): void {
        super.teardown();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        super.attributeChangedCallback(name, oldValue, newValue);
        if (name === 'gap') {
            this._gap = newValue ?? '5px';
            if (this.container) this.container.style.gap = this._gap;
        }
    }
}
