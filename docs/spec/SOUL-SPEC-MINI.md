# SOUL-SPEC-MINI: Raveling Web Component Design System

> Compact seed document for an AI agent building Raveling components in partnership with a human. Read this before touching code. When rules conflict, the order below is the priority order.

---

## What Raveling Is

Raveling is a vanilla TypeScript Web Component design system for building music apps, interactive tools, and games — for everyone, from curious beginners to seasoned developers. It is expressive and joyful by design. Components look like instruments, not form fields. The aesthetic is deliberate: pixel art, glowing LEDs, knobs, cranks, Quantico monospace. Do not sand this smooth.

---

## Principles (in priority order)

**1. Accessibility First.** AAA WCAG is the goal. Keyboard nav, ARIA roles, visible focus, 44×44px touch targets, no color-only meaning, reduced-motion respect. Accessibility cannot be retrofitted — it goes in on the first commit.

**2. Bare Maximum.** Do the most with the least (Buckminster Fuller). Every API surface, line of code, and dependency must earn its place. Complexity for cleverness is a defect.

**3. Joy and Color.** Components should make people smile. Vibrant, expressive color. Easter eggs welcome. "An unprofessional tool for pros."

**4. Human In the Loop.** One component at a time. Contract before code. No checkpoint skipped without human sign-off. When ambiguous, ask — don't guess.

**5. Do No Harm.** Camera, microphone, and biometric components require explicit user consent. Never facilitate surveillance or manipulation.

---

## Hard Requirements

- **TypeScript, strict mode.** No JavaScript, no frameworks (no React, Lit, Vue, etc.).
- **Everything a Web Component.** `customElements.define()` for every UI element.
- **Shadow DOM, mode `open`.** All styles scoped inside. Global styles via CSS custom property tokens only.
- **Brokers are DOM elements.** `<ravel-message-broker>`, `<ravel-theme-broker>` etc. live in the HTML, not as global singletons or module imports.
- **Deploy at any scale.** Each component must work with a single `<script>` import. No component may require the full system to function.
- **No new dependencies without human approval.** Prefer vetted libraries (Tone.js, Blockly, p5.js, LiquidFun) over reinventing wheels, but the bar for adding something new is high.

---

## Before Writing Any Component

Agree with the human on:
1. Name and one-sentence purpose
2. HTML attributes — name, type, default, description
3. Messages emitted and messages received — channel name, payload shape `{ cmd, content, version }`
4. Accessibility contract — ARIA role, keyboard behavior, live region if needed
5. Visual intent — rough sketch or reference to an existing component

Then read at least two existing components before writing code.

---

## Component Structure

```
ravel-component-name/
├── ravel-component-name.ts     # entry point, calls customElements.define()
├── src/RavelingComponentName.ts   # class implementation
└── doc/                        # one-paragraph description + prompt notes
```

Lifecycle: `constructor` → `initialize()` → `connectedCallback` → `setup()` → `disconnectedCallback` → `teardown()`. Setup subscribes to messages and binds events. Teardown reverses all of it.

---

## Messaging

Pub/sub via `<ravel-message-broker>`. Message shape: `{ cmd: string, content: unknown, version: number }`. Components subscribe in `setup()`, unsubscribe in `teardown()`. Never use global event listeners that outlive the component.

---

## Theme Tokens

Reference `--ravel-*` custom properties. Never hardcode colors. Common tokens: `--ravel-bg`, `--ravel-surface`, `--ravel-accent`, `--ravel-focus`, `--ravel-glow-color`, `--ravel-font`. Do not introduce new tokens without human review.

---

## Observability

All components support `observability="off | events | state | verbose"`. Default is `off`. When enabled, the component logs and/or visualizes its internal behavior.

---

## Definition of Done

- TypeScript compiles cleanly (strict)
- Accessibility contract fully implemented
- Renders correctly in isolation
- Messaging contract works as specified
- One-paragraph doc entry written

---

## Failure Policy

If a requirement cannot be met: do not guess, do not silently skip it. Surface the conflict, explain the constraint, and wait for human input.

---

## The Spirit

Raveling components should feel like **instruments, not widgets**. When uncertain, ask: *does this increase clarity, accessibility, and joy for everyone?*
