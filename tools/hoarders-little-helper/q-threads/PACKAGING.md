# Q-Thread Packaging Spec

A Q-Thread is a self-contained domain knowledge bundle. This document describes
the canonical structure so threads can be distributed, installed, and loaded
without modifying the HLH core.

---

## Directory Layout

```
q-threads/<thread-id>/
├── thread.json          Required — manifest (see schema below)
├── index.ts             Required — implements QThread interface, exports default instance
├── recognizers/
│   └── index.ts         recognize(item) → RecognitionResult
├── matchers/
│   └── index.ts         match(item) → QuidMatch[]
├── heuristics/
│   └── valuation.ts     estimateValue(item) → ValueEstimate | null
└── reference/
    └── seed.ts          Embedded reference data; QID constants; derived lookup maps
```

Additional subdirectories (e.g. `importers/`, `tests/`) are allowed and ignored
by the loader.

---

## `thread.json` Schema

```json
{
  "id":           "kebab-case-unique-id",
  "name":         "Human-Readable Name",
  "version":      "1.0.0",
  "description":  "One sentence describing the domain.",
  "capabilities": ["recognition", "matching", "valuation", "related-items", "tags", "import"]
}
```

**`id`** must be globally unique and stable. Once published, do not change it —
the DB uses it as a foreign key in `research_events` and `qthread_registry`.

**`capabilities`** must accurately list only the methods the thread implements.
The registry uses this to skip threads that don't support a requested operation.

---

## QID Namespacing

QIDs must be globally unique across all threads. Use the format:

```
QID-<type-letter>-<range-start>-<6-digit-number>
```

**Type letters:**

| Letter | Type       |
|--------|------------|
| B      | Book       |
| M      | Magazine   |
| T      | Tool       |
| G      | Garment    |
| R      | Record     |
| F      | Film       |
| C      | Company    |
| P      | Person     |

**Allocated ranges (do not overlap):**

| Range               | Thread            |
|---------------------|-------------------|
| QID-M-000001–000099 | Whole Earth       |
| QID-B-000001–000999 | Whole Earth       |
| QID-T-000001–000099 | Whole Earth       |
| QID-B-001001–001999 | Foxfire           |
| QID-B-002001–002999 | DAW Science Fiction |
| QID-G-000001–000999 | Vintage Clothing  |
| QID-B-003001–003999 | (next book thread)|
| QID-*-100001+       | Community threads |

---

## `index.ts` Contract

```typescript
import type { QThread } from '../interface';
// ... imports

export class MyThread implements QThread {
    metadata(): QThreadMetadata { ... }

    // Implement only capabilities listed in thread.json:
    async recognize?(item: ItemFields): Promise<RecognitionResult | null>
    async match?(item: ItemFields): Promise<QuidMatch[]>
    async tags?(item: ItemFields): Promise<string[]>
    async related?(item: ItemFields): Promise<QuidRef[]>
    async estimateValue?(item: ItemFields): Promise<ValueEstimate | null>
    async import?(source: QThreadSource): AsyncGenerator<ImportProgress>
}

export default new MyThread();   // singleton — required
```

The registry calls `import('<thread>/index').then(m => m.default)`. The
default export must be a fully constructed `QThread` instance.

---

## Seeding

Threads that ship embedded reference data should seed the Quiddity DB on first
use, not at install time. The pattern:

```typescript
let _seeded = false;

async function ensureSeeded(): Promise<void> {
    if (_seeded) return;
    _seeded = true;
    const existing = await getQuiddityItem('<first-qid-in-seed>');
    if (existing) return;
    for (const item of SEED_ITEMS) { await upsertQuiddityItem(...); }
}
```

Call `ensureSeeded()` at the top of every public method.

**The in-memory `_seeded` flag** prevents double-seeding within a session.
**The `getQuiddityItem` check** prevents re-seeding across sessions.

---

## Registration

To add a thread to HLH, add one line to `KNOWN_THREADS` in
`app/src/services/qthread-registry.ts`:

```typescript
['my-thread-id', () => import('../../../q-threads/my-thread-id/index').then(m => m.default)],
```

The registry handles enable/disable state via the `qthread_registry` DB table.
Threads are enabled by default on first discovery.

---

## Distribution (zip format)

A thread can be distributed as a zip file containing the directory tree above.
The installer should:

1. Unzip to `q-threads/<thread-id>/`
2. Add the `KNOWN_THREADS` entry (or auto-discover from a manifest registry)
3. Rebuild the app bundle

A future auto-discovery mechanism will scan `q-threads/*/thread.json` and
register threads without manual code changes.

---

## Constraints

- **No network access** in match/recognize/tags/estimateValue. These run on
  every item save and must be fast and offline-capable.
- **Import phase** may make network/AI calls, but must yield `ImportProgress`
  events and handle errors gracefully.
- **No new npm packages** without human approval. Threads must be pure
  TypeScript with no runtime dependencies outside the HLH module graph.
- **QIDs are permanent.** Once a QID is in the Quiddity DB, it cannot be
  renumbered. Deprecate by adding a `notes` entry, not by deletion.
