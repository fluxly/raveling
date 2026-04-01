# Raveling Next-Generation Web Component Design System

> This [ SOUL-SPEC ] document is intended to seed the skills that guide an AI agent and human collaborator in building the next generation of the Raveling Web Component design system. It describes the existing system, distills its philosophy into actionable design decisions, and provides the conceptual and technical framework for what comes next.

---

## 1. What Raveling Is

Raveling is a **Web Component design system**. It is an expressive, joyful, accessibility-first toolkit for everyone — from first-time coders and curious students to seasoned developers, musicians, educators, artists, and tinkerers. The design philosophy places human needs and delight at the center, regardless of technical background.

The existing system (`Ravel-2`) contains approximately 60 active custom elements spanning:
- **Base infrastructure** — message brokering, signal routing, stream abstractions
- **UI controls** — buttons, sliders, rotary pots, switches, cranks, toggle arrays
- **Visualization** — LEDs, LCD displays, waveform visualizers, isometric grids
- **Media** — audio recording, field recording, playlist management, QR scanning
- **Creative coding** — p5.js integration, Blockly visual programming, physics worlds
- **Content** — RSS cards, nonogram puzzles, scrapbooks
- **Bespoke instruments** — cryptid-themed synthesizers that demonstrate the system in use

Each component is a self-contained Web Component with shadow DOM, built with vanilla TypeScript/JavaScript, styled internally, and communicating via a pub/sub message broker.

---

## 2. The SOUL: Governing Philosophy

The SOUL.md document defines three tiers of principle. The next-generation system must honor all of them, in priority order.

### A. Core Principals (highest weight)

**1. Human-Centered, Accessibility First**
AAA WCAG compliance is the goal. Accessibility is nearly impossible to retrofit — it must be designed in from the first line. Every interactive element needs keyboard navigation, focus indicators, ARIA roles, screen reader labels, sufficient color contrast, and touch targets sized for real human fingers.

**2. Strive for the Bare Maximum**
Buckminster Fuller's principle: achieve the most with the least. Not minimalism for aesthetics, but efficiency as a form of respect. Every API surface, every dependency, every line of code should be there because it earns its place. Cleverness for its own sake is a red flag.

**3. Joy and Color**
Susan Kare's pixel bitmaps on the original Macintosh. Easter eggs. Tiny silly tools. Vibrant, expressive color. This system should make people smile. "An unprofessional tool for pros" — it doesn't have to look like Figma or Linear. It should look like something a curious person made with love.

**4. Human In the Loop**
The architecture should reduce cognitive debt for human collaborators, not increase it. When an agent (human or AI) picks up this codebase, the structure should be legible, the components individually comprehensible, and the conventions so consistent that reading one component teaches you how to read all of them.

**5. Asimov's Laws**
Every software project should ask: who can this harm, and how do we prevent that? The system should not facilitate surveillance, manipulation, or harm. Components that touch camera, microphone, or biometric input must handle consent and user safety explicitly.

### B. Core Requirements (structural constraints)

**1. Plain Vanilla TypeScript**
No React, Vue, Svelte, Lit, HTMX, or any other framework. TypeScript for type safety and tooling, but no framework abstractions. The goal is components that work anywhere a browser runs, for decades, with no lock-in. "Vanilla as the goal of an ascetic mystic wandering wizard" — not penny-pinching, but principled.

**2. Everything a Web Component**
Every piece of UI is a `customElements.define()`-registered HTML element. Components should degrade gracefully when their collaborating elements aren't present — no crashes, just silence.

**3. Brokers as First-Class Web Components**
The message broker, theme broker, and any future broker (auth? sync? analytics?) should exist as HTML elements on the page, not as global singletons or module-level imports. `<ravel-message-broker>` in the DOM. This makes them visible, replaceable, and debuggable.

**4. Encapsulated**
Minimize inheritance depth. Components should need only one base class (or none) in addition to ravel-element. A well-curated minimal base is acceptable; deep class hierarchies are not.

**5. Deploy at Any Scale**
A developer should be able to drop in a single `<ravel-button>` without loading sixty other components. Tree-shaking, module isolation, and component-level entry points are not optional.

**6. Themes**
Every component is individually themable via attributes or CSS custom properties. Group theming should work via a `<ravel-theme-broker>`. Color should be expressive, vibrant, and controllable — not just "primary/secondary/accent."

**7. Observability**
Components should be able to expose their internal state, log their events, and visualize their behavior — all via HTML attributes. `observability="verbose"` on a component should make it talk. This is a first-class debugging and learning tool.

### C. Core Guidelines (recommended practices)

**1. Literate Programming**
Prompts, specs, and human-readable descriptions are part of the development artifact. Code comments should be sufficient for an LLM to reason about the component's intent and constraints. Every non-trivial component should have a `doc/` directory.

**2. Low Dependencies, But Leverage Vetted Libraries**
Do not reinvent wheels. The bar for a new dependency is: does a battle-tested library do this substantially better than we can? If yes, use it. If no, write it in vanilla TS. Dependencies must not break encapsulation or modularity.

**3. Pen and Paper, Stones and Sticks**
Computer vision-aided non-digital input is a design goal. The system should support turning physical objects — paper, pebbles, gestures — into UI events. This is speculative but should inform API design: components should be able to receive input from non-pointer sources.

**4. Alternative Displays**
Components should account for unusual output surfaces — e-ink, pixel LED arrays, projection mapping, audio-only interfaces, non-traditional interfaces. Not every component will run on every surface, but the architecture should not assume a standard 1080p LCD monitor.

---

## 3. The Existing System: What Works

These patterns from previous generation `Ravel-2` are worth preserving and formalizing in the next generation:

### Component File Structure
```
ravel-component-name/
├── ravel-component-name.js       # Entry point, imports and calls define()
├── src/
│   └── RavelingComponentName.js    # Main class implementation
├── doc/                         # Prose documentation + prompt notes
├── sandbox/                     # Standalone demo HTML
└── tests/                       # Unit tests
```

### Class Structure Pattern
```typescript
export class RavelingComponentName extends RavelingElement {
    static get localStyles(): string { return `<style>...</style>`; }
    static get html(): string { return `<div id="container">...</div>`; }
    static get observedAttributes() {
        return [...super.baseObservedAttributes, 'custom-attr'];
    }

    constructor() {
        super();
        const template = document.createElement('template');
        template.innerHTML = globalStyles + this.constructor.localStyles + this.constructor.html;
        this.attachShadow({ mode: 'open' });
        this.shadowRoot!.appendChild(template.content.cloneNode(true));
        this.initialize();
    }

    initialize() { /* set defaults */ }
    connectedCallback() { this.setup(); }
    disconnectedCallback() { this.teardown(); }

    setup = () => { /* subscribe, bind events */ }
    teardown = () => { /* unsubscribe, remove events */ }

    attributeChangedCallback(name: string, _old: string, newValue: string) {
        super.attributeChangedCallback(name, _old, newValue);
        // handle custom attributes
    }
}

customElements.define('ravel-component-name', RavelingComponentName);
```

### Messaging Pattern
The `RavelingMessages` pub/sub broker decouples components. Components subscribe to named channels and dispatch events with `{ cmd, content }` detail objects. This pattern should be preserved and extended (not replaced) in the next generation.

### Value Mapping
Input controls use a consistent `map(normalizedValue: number): number` function that respects `min`, `max`, and `step` attributes. This should be extracted into a shared utility.

### Asset Path Resolution
`RavelingComponentPath.js` provides a webpack-aware but also runtime-fallback path resolver for component assets. This pattern is important for deploy-at-any-scale.

---

## 4. What the Next Generation Should Improve

### 4.1 TypeScript Throughout
The current system is JavaScript with JSDoc type hints in some places. The next generation should be full TypeScript from the start, with strict mode enabled. This reduces cognitive debt for future contributors.

### 4.2 Formal Component Interface
Every component should declare, in a machine-readable way:
- What attributes it accepts (name, type, default, description)
- What messages it emits (channel name, payload shape)
- What messages it listens to (channel name, expected payload)
- What ARIA roles and properties it implements

This metadata enables tooling, documentation generation, and LLM-assisted composition.

### 4.3 A Real Theme System
CSS custom properties should be the primary theming mechanism, with the `<ravel-theme-broker>` setting them at the `:host` or document level. A theme should be expressible as a JSON object that maps semantic tokens (e.g., `--ravel-accent`, `--ravel-surface`, `--ravel-glow-color`) to values. Components should reference tokens, not hardcoded hex values.

### 4.4 Accessibility Baked In
The next generation should adopt a "no exceptions" policy:
- Every interactive element is keyboard-navigable
- Focus rings are always visible (never `outline: none` without a replacement)
- Touch targets meet 44×44px minimum
- Color is never the sole carrier of information
- Reduced motion media query is always respected
- Every control that emits a value also accepts an ARIA `aria-valuenow` / `aria-valuetext` pattern

### 4.5 Storybook or Equivalent
Each component should ship with a story/demo that:
- Shows all attribute combinations
- Is self-contained (no external setup)
- Passes axe-core accessibility audit
- Renders in isolation and in composition

### 4.6 Event Schema Versioning
The messaging system should include a version field in message payloads so that evolving component APIs don't silently break integrations.

### 4.7 Formal Observability Protocol
The `observability` attribute should have a well-defined vocabulary:
- `off` — no logging
- `events` — log dispatched/received messages
- `state` — visualize internal state changes
- `verbose` — everything

### 4.8 Component Manifest
Each component should ship a `manifest.json` (or TypeScript-extracted equivalent) describing its contract. This enables:
- Auto-generated documentation
- LLM-assisted composition ("which component should I use for X?")
- Compatibility checking at build time

---

## 5. Architecture of the Next-Generation System

### Layer 1: Core Infrastructure
- `<ravel-message-broker>` — pub/sub event routing, singleton, first-class DOM element
- `<ravel-theme-broker>` — CSS custom property token distribution
- `<ravel-observability-broker>` — aggregates component logs, visualizes activity
- `RavelingElement` — minimal abstract base class (shadow DOM setup, message integration, ARIA base)

### Layer 2: Primitives
Stateless or near-stateless display elements:
- `<ravel-led>` — single indicator light
- `<ravel-label>` — styled text label
- `<ravel-icon>` — emoji or bitmap icon
- `<ravel-signal>` — status indicator

### Layer 3: Controls
Interactive input elements, each with full keyboard, pointer, and virtual input support:
- `<ravel-button>` — press action
- `<ravel-toggle>` — binary state
- `<ravel-slider>` — linear range value
- `<ravel-pot>` — rotary range value (knob)
- `<ravel-crank>` — continuous rotation input
- `<ravel-xy-pad>` — two-dimensional input

### Layer 4: Displays
Read-only visualization components:
- `<ravel-visualizer>` — waveform / spectrum
- `<ravel-lcd>` — character display
- `<ravel-led-array>` — matrix of LEDs
- `<ravel-meter>` — level/value meter

### Layer 5: Assemblies
Composite components that coordinate groups of primitives:
- `<ravel-assembly>` — collapsible panel container
- `<ravel-dock>` — floating component docking grid
- `<ravel-control-bar>` — horizontal strip of controls
- `<ravel-toy>` — named, iconized app container

### Layer 6: Domain Components
Feature-complete components that integrate external libraries:
- `<ravel-p5-canvas>` — p5.js creative coding
- `<ravel-blockly>` — visual programming
- `<ravel-physics-world>` — 2D physics
- `<ravel-qr-reader>` — QR code scanning
- Synth/audio components

### Layer 7: Brokers and Bridges
Non-visual coordination components:
- `<ravel-message-bridge>` — route messages across DOM boundaries
- `<ravel-sound-engine>` — centralized audio context management
- `<ravel-sync-broker>` — CRDT-based shared state (Yjs/Automerge)

---

## 6. Building Incrementally: A Human-AI Partnership Model

This system should be built in close collaboration between a human and an AI agent. The following principles govern that partnership:

### 6.1 One Component at a Time
Each work session should produce one complete, tested, documented component. Not a scaffold — a finished component that passes its own tests and accessibility audit before the next one starts.

### 6.2 The Component Contract First
Before writing any implementation, the agent and human should agree on:
1. The component's name and what it does (one sentence)
2. Its HTML attributes and their types
3. The messages it emits and the messages it listens to
4. Its accessibility contract (role, keyboard behavior, ARIA properties)
5. Its visual design (rough ASCII sketch or reference to existing component)

### 6.3 Review Checkpoints
The human reviews:
- The component contract before implementation begins
- The component implementation before it is merged
- The component in a browser before it is documented

The agent should not proceed past a checkpoint without human sign-off.

### 6.4 Literate Development
Every component should be accompanied by a short doc entry (one paragraph) that explains what the component is for, why it exists, and what makes it unusual or interesting. This is the "prompt" that will allow future agents to understand and extend the system.

### 6.5 The Agent's Responsibilities
When building a component, the agent should:
- Read SOUL.md and this document before starting (looking for alignment; do not re-read if already loaded)
- Read at least two structurally similar existing components for pattern reference
- Write TypeScript, not JavaScript
- Include ARIA roles and keyboard handling from the first commit
- Run an accessibility check (axe-core or equivalent) if available; otherwise note it as a required follow-up
- Keep shadow DOM styles scoped and CSS custom property tokens consistent with the theme system
- Never add a dependency without flagging it for human review

### 6.6 The Human's Responsibilities
The human should:
- Define the goal for each session clearly (one component or one improvement)
- Provide the visual design intent (even a rough sketch or reference)
- Make architectural decisions when the agent encounters ambiguity
- Review and merge, never rubber-stamp
- Update this document when the architecture evolves

---

## 7. Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Custom element tag | `ravel-<noun>` or `ravel-<adjective>-<noun>` | `ravel-pot`, `ravel-led-array` |
| TypeScript class | `Raveling<PascalCase>` | `RavelingPot`, `RavelingLedArray` |
| CSS custom property | `--ravel-<token>` | `--ravel-accent`, `--ravel-surface` |
| Message channel | `<element-id>` or `Raveling:<topic>` | `my-pot-1`, `Raveling:tempo` |
| Attribute names | kebab-case | `signal-out`, `pixel-size`, `show-controls` |
| File names | match element name | `ravel-pot.ts`, `RavelingPot.ts` |

---

## 8. Theme Token Vocabulary (Starter Set)

These CSS custom properties should be defined by `<ravel-theme-broker>` and consumed by all components:

```css
/* Surface colors */
--ravel-bg:           #1a1a2e;   /* Primary background */
--ravel-surface:      #16213e;   /* Raised surface */
--ravel-surface-high: #0f3460;   /* Elevated surface */

/* Accent and interactive */
--ravel-accent:       #e94560;   /* Primary accent */
--ravel-accent-dim:   #7a2030;   /* Dimmed accent */
--ravel-focus:        #00d4ff;   /* Focus ring color */

/* Semantic */
--ravel-on-bg:        #ffffff;   /* Text on background */
--ravel-on-surface:   #dddddd;   /* Text on surface */
--ravel-on-accent:    #ffffff;   /* Text on accent */

/* LED / glow */
--ravel-glow-color:   #e94560;
--ravel-glow-radius:  6px;

/* Pixel art border (current system's aesthetic) */
--ravel-border-dark:  #000000;
--ravel-border-light: #aaaaaa;

/* Typography */
--ravel-font:         'Quantico', monospace;
--ravel-font-size-sm: 10px;
--ravel-font-size-md: 14px;
--ravel-font-size-lg: 18px;

/* Spacing */
--ravel-space-xs: 2px;
--ravel-space-sm: 4px;
--ravel-space-md: 8px;
--ravel-space-lg: 16px;
```

---

## 9. Accessibility Requirements Per Component Type

### Interactive Controls (button, slider, pot, toggle, crank)
- `role` set appropriately (`button`, `slider`, `checkbox`, etc.)
- `aria-label` or `aria-labelledby` always present
- `aria-valuenow`, `aria-valuemin`, `aria-valuemax` for range controls
- Full keyboard operation: Enter/Space for activation, Arrow keys for value change
- Focus visible via `--ravel-focus` outline
- Touch target ≥ 44×44 CSS pixels
- Pointer and keyboard events produce identical outcomes

### Display / Visualization Components
- `role="img"` with `aria-label` describing the current state
- Live regions (`aria-live="polite"`) for values that update in real time
- Color is never the sole carrier of meaning (shape, text, or pattern redundancy)

### Container / Assembly Components
- Landmark roles where appropriate (`region`, `main`, `complementary`)
- `aria-label` on landmark regions
- Focusable children must be reachable via Tab
- Collapsible sections use `aria-expanded`

### Audio Components
- All audio is user-initiated or clearly disclosed
- Mute and volume controls are always accessible
- Visual feedback accompanies any audio feedback

---

## 10. The Spirit of the System

Raveling is for the person who wants to build a synthesizer that runs in a browser tab, or a generative art tool that responds to QR codes, or a nonogram puzzle that plays a melody when solved. It is for teachers, musicians, game designers, and artists who know enough JavaScript to be dangerous but don't want to become framework experts.

The aesthetic is deliberate: pixel art, Quantico monospace, glowing LEDs, cranks and knobs. It looks like something a hobbyist built with love. That is not an accident — it is the design. The next generation should amplify this character, not sand it smooth.

---

*This document is a living specification. Update it as the architecture evolves. It is both a design document and a prompt — written to be read by humans and understood by AI agents equally.*
