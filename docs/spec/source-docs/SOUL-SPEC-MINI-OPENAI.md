# SOUL-SPEC-MINI.md

## Purpose

This document defines the **minimum operational rules** for building
Raveling components. It is optimized for AI agents and humans
working together.

------------------------------------------------------------------------

## Core Principles (MUST)

-   **Accessibility First**\
    Every interactive element must support keyboard, ARIA roles, focus
    visibility, and adequate touch targets.

-   **Human-Centered & Joyful**\
    Components should be expressive, tactile, and visually engaging
    (color, motion, metaphor).

-   **Bare Maximum**\
    Keep implementations minimal and purposeful. Avoid unnecessary
    complexity or dependencies.

-   **Human Legibility**\
    Code and structure must be easy to read and understand. One
    component should teach the pattern.

-   **Safety & Consent**\
    Any camera, microphone, or biometric interaction must be explicit
    and user-controlled.

------------------------------------------------------------------------

## Core Requirements (MUST)

-   **TypeScript Only**

-   **Web Components Only** (`customElements.define`)

-   **Shadow DOM Encapsulation**

-   **No Frameworks**

-   **Broker-Based Messaging** Components communicate via DOM-based
    brokers (no global singletons).

-   **Deploy at Any Scale** Each component must work independently.

------------------------------------------------------------------------

## Component Workflow

Before implementation:

1.  Define:
    -   Purpose (one sentence)
    -   Attributes (name, type, default)
    -   Messages (emit + listen)
    -   Accessibility contract
    -   Visual intent
2.  Read:
    -   This document
    -   At least two similar components

------------------------------------------------------------------------

## Implementation Rules

-   Write TypeScript (strict mode)
-   Include ARIA + keyboard support from the start
-   Keep styles scoped in shadow DOM
-   Use existing CSS custom properties (no new tokens without review)
-   Do not add dependencies without human approval

------------------------------------------------------------------------

## Accessibility Contract

Interactive components MUST: - Be keyboard operable (Tab, Enter/Space,
arrows where applicable) - Include ARIA roles and labels - Maintain
visible focus state - Meet 44×44px touch targets

Display components MUST: - Provide descriptive `aria-label` - Not rely
on color alone

------------------------------------------------------------------------

## Messaging Pattern

-   Use pub/sub via message broker
-   Message shape: `{ cmd, content, version }`

------------------------------------------------------------------------

## observable

Support attribute:

-   `observable="off | events | state | verbose"`

Components should expose internal behavior when enabled.

------------------------------------------------------------------------

## Definition of Done

A component is DONE when:

-   TypeScript compiles cleanly
-   Accessibility contract is satisfied
-   Renders in isolation
-   Messaging works as expected
-   Documentation exists

------------------------------------------------------------------------

## Failure Policy

If a requirement cannot be met:

-   Do not guess
-   Emit a warning
-   Request human input

------------------------------------------------------------------------

## Spirit

Raveling components should feel like **instruments, not widgets**.

When in doubt: → Does this increase clarity, accessibility, and joy?
