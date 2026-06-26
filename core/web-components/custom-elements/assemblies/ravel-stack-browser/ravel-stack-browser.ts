import { RavelStackBrowser } from './src/RavelStackBrowser';

customElements.define('ravel-stack-browser', RavelStackBrowser);

customElements.define('ravel-stack', class RavelStack extends HTMLElement {
    static get observedAttributes() { return ['id', 'label', 'icon', 'count']; }
});
