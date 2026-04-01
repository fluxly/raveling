# Raveling AI

A TypeScript web components framework for building themeable, accessible, and messageable UI elements.

## Architecture

Components extend `RavelElement`, a base class that provides:

- **Messaging** — pub/sub communication via `RavelMessenger`
- **Broadcasting** — window-level custom events
- **Positioning** — shared `x`/`y` observed attributes

Components are grouped into categories under `core/web-components/custom-elements/`:

| Category | Description |
|---|---|
| `artifacts` | Persistent, data-bearing elements |
| `assemblies` | Composite elements composed of other Ravel elements |
| `ballyhoo` | Decorative and presentational elements |
| `gadgets` | Interactive, functional elements |
| `gidgets` | Small utility widgets |
| `toys` | Experimental or demo elements |

## Development Setup

```bash
npm install
```

## Scripts

| Command | Description |
|---|---|
| `npm run build` | Build the framework to `dist/` |
| `npm run dev` | Build in watch mode |
| `npm run typecheck` | Type-check without emitting files |

## Build Output

Vite builds to `dist/` in two forms:

**Full framework bundle**
```
dist/ravel.js
```

**Individual component categories**
```
dist/components/artifacts.js
dist/components/assemblies.js
dist/components/ballyhoo.js
dist/components/gadgets.js
dist/components/gidgets.js
dist/components/toys.js
```

TypeScript declarations (`.d.ts`) are generated alongside each output file.

## Usage

Import the full framework:
```ts
import 'Raveling';
```

Or import a specific component category:
```ts
import 'Raveling/components/gadgets';
```

## Extending RavelElement

```ts
import { RavelElement } from 'Raveling';

export class MyWidget extends RavelElement {
  connectedCallback() {
    this.subscribe(['some-message']);
  }

  disconnectedCallback() {
    this.unsubscribe(['some-message']);
  }
}

customElements.define('my-widget', MyWidget);
```
