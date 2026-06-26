import { RavelSignalCollector } from './src/RavelSignalCollector';

customElements.define('ravel-signal-collector', RavelSignalCollector);

// Minimal data-carrier element — no UI, just holds icon + value attributes.
customElements.define('ravel-signal', class RavelSignal extends HTMLElement {
    static get observedAttributes() { return ['icon', 'value']; }
    get icon(): string { return this.getAttribute('icon') ?? ''; }
    get signalValue(): string | null { return this.getAttribute('value'); }
});
