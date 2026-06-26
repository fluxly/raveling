/**
 * Defines the <ravel-notebook> and <ravel-cell> custom elements.
 */

import { RavelNotebook } from './src/RavelNotebook';
import { RavelCell }     from './src/RavelCell';

customElements.define('ravel-notebook', RavelNotebook);
customElements.define('ravel-cell',     RavelCell);
