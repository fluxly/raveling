# Hoarder's Little Helper — Plan of Attack

## Framing

The monorepo already builds `core/` → `dist/bundle.js`. The app treats that
built bundle as its distribution import (`@raveling/components`), never touching
source files inside `core/` directly. New generic components get added to
`core/web-components/custom-elements/` and flow through the normal build.
App-specific components live inside the tool directory.

---

## Repository Layout

```
/tools/hoarders-little-helper/
    spec.txt
    plan.md                         ← this file
    q-threads.txt                   ← Q-Thread architecture spec
    app/                            ← Tauri v2 desktop application
        src-tauri/
            Cargo.toml
            tauri.conf.json
            src/
                main.rs
                commands/
                    db.rs
                    import.rs       ← photo import, thumbnail, phash
        src/                        ← TypeScript frontend
            stacks/
                inbox/
                items/
                collections/
                quiddity/           ← NEW (Phase 4)
                listings/
                sold/
                reports/
                settings/
            components/
                hlh-item-card/
                hlh-inbox-card/
                hlh-marketplace-preview/
                hlh-collection-match/
                hlh-quiddity-panel/  ← NEW (Phase 4) evidence display per item
            services/
                db.ts
                import-service.ts
                catalog-service.ts
                description-service.ts
                tag-service.ts
                valuation-service.ts
                research-service.ts
                qthread-registry.ts  ← NEW (Phase 4)
            router.ts
            main.ts
        index.html
        vite.config.ts
        package.json
    q-threads/                      ← NEW (Phase 4) — domain knowledge bundles
        interface.ts                ← QThread TypeScript interface
        registry.ts                 ← loads installed threads, runs match()
        whole-earth/                ← NEW (Phase 5) — first Q-Thread
            thread.json
            index.ts
            recognizers/
            matchers/
            heuristics/
            valuation/
            reference/
            tests/
        foxfire/                    ← future
        vintage-clothing/           ← future
        leica/                      ← future
    plugins/                        ← marketplace plugin implementations
        interface.ts
        shopify/
        abebooks/
        csv/
        stubs/

/backend/
    ai-service/                     ← LLM provider abstraction (Node.js/TS)
        providers/
            anthropic.ts
            openai.ts
        cache.ts
        index.ts
    research-service/
        sources/
        index.ts

/core/web-components/custom-elements/
    gidgets/
        ravel-tag-editor/           ← DONE (Phase 3)
        ravel-confidence-pill/      ← NEW (Phase 4)
        ravel-checklist/            ← NEW (Phase 8)
        ravel-price-range/          ← NEW (Phase 9)
        ravel-abp-button/           ← NEW (Phase 8)
    assemblies/
        ravel-photo-strip/          ← DONE (Phase 2)
        ravel-field-grid/           ← DONE (Phase 2)
        ravel-stack-browser/        ← DONE (Phase 1)
        ravel-job-monitor/          ← NEW (Phase 4)
        ravel-research-log/         ← NEW (Phase 5)
```

---

## Core vs App-Specific Components

**Goes in `core/`** — generic enough to be useful in any Raveling app:

| Component | Purpose |
|---|---|
| `ravel-stack-browser` | HyperCard-style stack/tab navigation |
| `ravel-photo-strip` | Horizontal scrollable photo row with selection |
| `ravel-field-grid` | Labeled field grid for structured data display |
| `ravel-tag-editor` | Tag input with autocomplete, add/remove |
| `ravel-confidence-pill` | Colored pill showing AI/thread confidence (0–1) |
| `ravel-checklist` | Rule list with pass/warn/fail per item |
| `ravel-abp-button` | Large action button, enabled only when checklist passes |
| `ravel-price-range` | Three-value price display (low / expected / optimistic) |
| `ravel-job-monitor` | Background job queue with status and progress |
| `ravel-research-log` | Timestamped log of Q-Thread evidence events with source + confidence |

**Stays in `tools/hoarders-little-helper/app/src/components/`** — HLH-specific:

| Component | Why app-specific |
|---|---|
| `hlh-item-card` | Full item editing card; domain model is HLH-specific |
| `hlh-inbox-card` | Import/triage view for a single incoming photo batch |
| `hlh-quiddity-panel` | Shows Q-Thread evidence for one item (confidence pills + research log) |
| `hlh-marketplace-preview` | Renders live marketplace templates |
| `hlh-collection-match` | Shows scored collection matches |

---

## Q-Thread Architecture

### What Q-Threads Are

A **Q-Thread** is a weaveable bundle of domain knowledge that teaches HLH the
essential nature (*quiddity*) of a collecting domain — "Whole Earth", "Vintage
Clothing", "Leica Cameras", etc. They are little experts that contribute
evidence, never ownership.

Every Q-Thread answers:
- What is this object?
- Why do I think that?
- How confident am I?
- Why might collectors care?
- What related objects exist?
- How should this affect valuation?

### Architecture Flow

```
Source Documents (PDFs, CSVs, web pages)
        │
        ▼
Q-Thread Importers           (import phase — populates Quiddity DB)
        │
        ▼
Quiddity Database            (permanent, shared, never duplicated)
        │
        ▼
Inventory Matcher            (match phase — runs when items are saved)
        │
        ▼
Research Engine              (combines evidence from all threads)
        │
        ▼
Valuation + Descriptions + Publishing (ABP)
```

The **Quiddity Database is permanent**. Inventory is transient.
Items reference Quiddity records; they never duplicate them.

### Q-Thread Lifecycle

**Import phase** — processes source documents once to populate the Quiddity DB:
1. User points a thread at a source (PDF, folder, URL)
2. Thread importers run (Claude Vision for PDFs, parsers for structured data)
3. Extracted objects are normalized and deduplicated into `quiddity_items`
4. Source appearances become `quiddity_mentions`

**Match phase** — runs automatically when inventory items are created/saved:
1. `qthread-registry.ts` asks every enabled thread: `recognize()`, `match()`
2. Each thread searches the Quiddity DB and returns evidence (not truth)
3. Evidence is stored in `research_events` with `service = thread.id`
4. Human approves or rejects proposed field values
5. The `hlh-quiddity-panel` displays evidence in the item detail view

### Q-Thread Directory Structure

```
q-threads/whole-earth/
    thread.json        ← manifest: id, name, version, capabilities
    index.ts           ← implements QThread interface
    recognizers/       ← visual/textual pattern matchers
    matchers/          ← Quiddity DB search strategies
    heuristics/        ← scoring and confidence rules
    valuation/         ← price estimation logic
    reference/         ← embedded reference data (ISBNs, catalog numbers, etc.)
    tests/             ← unit tests per recognizer/matcher
```

### Q-Thread Interface

```typescript
interface QThread {
    metadata(): QThreadMetadata;

    // Match phase — all optional, advertised via thread.json capabilities
    recognize(item: ItemRow): Promise<RecognitionResult | null>;
    match(item: ItemRow): Promise<QuidMatch[]>;
    explain(item: ItemRow): Promise<string>;
    related(item: ItemRow): Promise<QuidRef[]>;
    estimateValue(item: ItemRow): Promise<ValueEstimate | null>;
    tags(item: ItemRow): Promise<string[]>;

    // Import phase
    import(source: QThreadSource): AsyncGenerator<ImportProgress>;
}

interface QuidMatch {
    qid:        string;           // e.g. "QID-B-000183"
    confidence: number;           // 0–1
    explanation: string;
    fields:     Partial<ItemRow>; // proposed field values for human review
    mentions:   QuidMention[];    // where this object appears in source docs
}

interface QThreadMetadata {
    id:           string;
    name:         string;
    version:      string;
    description:  string;
    capabilities: string[];       // 'recognition'|'matching'|'valuation'|etc.
}
```

### Quiddity IDs

```
QID-B-000001   Book
QID-T-000128   Tool
QID-C-000052   Company
QID-P-000983   Person
QID-M-000017   Magazine
QID-R-000055   Record
```

---

## Database Schema (complete)

```sql
-- ── Inventory (transient, user-owned) ────────────────────────

CREATE TABLE items (
    id          TEXT PRIMARY KEY,
    title       TEXT,
    brand       TEXT,
    author      TEXT,
    publisher   TEXT,
    category    TEXT,
    year        INTEGER,
    materials   TEXT,            -- JSON array
    dimensions  TEXT,            -- JSON object {w,h,d,unit}
    condition   TEXT,            -- 'poor'|'fair'|'good'|'vg'|'fine'|'mint'
    notes       TEXT,
    qid         TEXT,            -- approved Quiddity match (foreign key to quiddity_items.qid)
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    deleted_at  TEXT
);

CREATE TABLE photos (
    id          TEXT PRIMARY KEY,
    item_id     TEXT REFERENCES items(id),
    original    TEXT NOT NULL,
    thumbnail   TEXT,
    medium      TEXT,
    phash       TEXT,
    is_hero     INTEGER DEFAULT 0,
    is_blurry   INTEGER DEFAULT 0,
    sort_order  INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL
);

CREATE TABLE tags (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL UNIQUE,
    color TEXT
);

CREATE TABLE item_tags (
    item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
    tag_id  TEXT REFERENCES tags(id)  ON DELETE CASCADE,
    PRIMARY KEY (item_id, tag_id)
);

-- research_events stores all Q-Thread evidence + AI results
CREATE TABLE research_events (
    id          TEXT PRIMARY KEY,
    item_id     TEXT REFERENCES items(id),
    service     TEXT NOT NULL,      -- thread id e.g. 'whole-earth', or 'vision'|'ocr'
    provider    TEXT,               -- 'anthropic'|'openai'|'local'
    cmd         TEXT NOT NULL,      -- 'recognize'|'match'|'explain'|'value'
    result      TEXT,               -- JSON (QuidMatch[] or raw AI response)
    confidence  REAL,
    source      TEXT,               -- e.g. "Last Whole Earth Catalog p.241"
    approved_at TEXT,               -- NULL = pending human review
    created_at  TEXT NOT NULL
);

CREATE TABLE listings (
    id           TEXT PRIMARY KEY,
    item_id      TEXT REFERENCES items(id),
    marketplace  TEXT NOT NULL,
    status       TEXT DEFAULT 'draft',
    payload      TEXT,
    remote_id    TEXT,
    published_at TEXT,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL
);

CREATE TABLE collections (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    color       TEXT DEFAULT '#FF4FB3',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE collection_items (
    collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
    item_id       TEXT REFERENCES items(id)       ON DELETE CASCADE,
    added_at      TEXT NOT NULL,
    PRIMARY KEY (collection_id, item_id)
);

CREATE TABLE settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE items_fts USING fts5(
    id UNINDEXED, title, brand, author, publisher, notes,
    content='items', content_rowid='rowid'
);

-- ── Quiddity Database (permanent, shared) ────────────────────

CREATE TABLE quiddity_items (
    id             TEXT PRIMARY KEY,
    qid            TEXT UNIQUE NOT NULL,  -- e.g. QID-B-000183
    type           TEXT NOT NULL,         -- 'book'|'tool'|'company'|'person'|'magazine'|'record'|...
    canonical_name TEXT NOT NULL,
    subtitle       TEXT,
    description    TEXT,
    notes          TEXT,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
);

CREATE TABLE quiddity_aliases (
    id         TEXT PRIMARY KEY,
    quid_id    TEXT NOT NULL REFERENCES quiddity_items(id) ON DELETE CASCADE,
    alias      TEXT NOT NULL,
    source     TEXT              -- which thread added this alias
);

CREATE TABLE quiddity_people (
    id         TEXT PRIMARY KEY,
    quid_id    TEXT NOT NULL REFERENCES quiddity_items(id) ON DELETE CASCADE,
    role       TEXT NOT NULL,   -- 'author'|'designer'|'editor'|'manufacturer'|'publisher'
    name       TEXT NOT NULL,
    person_qid TEXT             -- QID of the person if they have their own record
);

CREATE TABLE quiddity_publications (
    id          TEXT PRIMARY KEY,
    quid_id     TEXT NOT NULL REFERENCES quiddity_items(id) ON DELETE CASCADE,
    publisher   TEXT,
    edition     TEXT,
    year        INTEGER,
    isbn        TEXT,
    open_lib_id TEXT,
    oclc        TEXT
);

-- Every place a quiddity object appears in a source document
CREATE TABLE quiddity_mentions (
    id          TEXT PRIMARY KEY,
    quid_id     TEXT NOT NULL REFERENCES quiddity_items(id) ON DELETE CASCADE,
    source_id   TEXT NOT NULL REFERENCES quiddity_sources(id),
    publication TEXT,
    issue       TEXT,
    page        TEXT,
    section     TEXT,
    snippet     TEXT,           -- verbatim text from source
    confidence  REAL,
    thread_id   TEXT NOT NULL   -- which Q-Thread created this mention
);

-- Imported source documents
CREATE TABLE quiddity_sources (
    id          TEXT PRIMARY KEY,
    thread_id   TEXT NOT NULL,
    path        TEXT,           -- local path or URL
    title       TEXT,
    imported_at TEXT NOT NULL,
    page_count  INTEGER,
    status      TEXT DEFAULT 'pending'  -- 'pending'|'processing'|'done'|'error'
);

-- Wishlist references — point to QIDs, never duplicate metadata
CREATE TABLE wishlists (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    thread_id  TEXT,            -- which Q-Thread this wishlist relates to
    created_at TEXT NOT NULL
);

CREATE TABLE wishlist_items (
    wishlist_id TEXT REFERENCES wishlists(id) ON DELETE CASCADE,
    qid         TEXT NOT NULL,  -- references quiddity_items.qid
    added_at    TEXT NOT NULL,
    notes       TEXT,
    PRIMARY KEY (wishlist_id, qid)
);

-- Installed Q-Threads
CREATE TABLE qthread_registry (
    id       TEXT PRIMARY KEY,  -- e.g. 'whole-earth'
    name     TEXT NOT NULL,
    version  TEXT NOT NULL,
    path     TEXT NOT NULL,     -- path to the thread directory
    enabled  INTEGER DEFAULT 1,
    priority INTEGER DEFAULT 0  -- higher = runs first
);
```

---

## Technology Decisions

| Concern | Choice | Rationale |
|---|---|---|
| Shell | Tauri v2 | Native FS access, secure IPC, SQLite via plugin |
| Language | TypeScript (strict) | Matches Raveling constraint |
| Database | SQLite via `tauri-plugin-sql` | Local-first; survives API death |
| Image processing | Rust `image` crate | Fast, no system deps |
| Perceptual hash | Rust `img_hash` crate | Needed for dedup |
| Q-Thread runtime | TypeScript in-process | No sidecar; threads run in the Tauri frontend layer |
| Q-Thread import | Claude Vision + structured JSON | PDF → Claude → Quiddity records |
| LLM | Provider abstraction in `backend/ai-service` | Start with Anthropic; swap freely |
| Evidence model | Each thread returns evidence; Research Engine merges | No thread owns truth |
| Marketplace plugins | TS interface + plugin registry | Shopify, AbeBooks, CSV first |
| Data location | `~/Library/Application Support/HoardersLittleHelper/` | Mac convention |

---

## Service Architecture

**Q-Thread Registry** (`src/services/qthread-registry.ts`):
- Loads all threads from `qthread_registry` DB table at startup
- Exposes `runMatch(item)` → calls every enabled thread's `recognize()` + `match()`
- Results stored as `research_events` rows
- Runs in-process (no HTTP, no sidecar)

**AI Service** (`backend/ai-service/`):
- Provider abstraction for Claude/OpenAI calls
- All responses cached in SQLite keyed on (provider, model, prompt hash)
- Used by Q-Thread importers (Claude Vision) and description generation

**Research Engine** (in-process TS):
- Merges evidence from multiple threads
- Computes combined confidence
- Proposes field values for human review

---

## Marketplace Plugin Interface

```typescript
interface MarketplacePlugin {
    id: string;
    name: string;
    validate(item: Item, listing: Listing): ChecklistResult[];
    preview(item: Item, listing: Listing): string;        // HTML
    publish(item: Item, listing: Listing): Promise<string>;
    update(remoteId: string, listing: Listing): Promise<void>;
    delete(remoteId: string): Promise<void>;
    sync(remoteId: string): Promise<Partial<Listing>>;
}
```

---

## Implementation Phases

### Phase 1 — Skeleton ✅ DONE
- Tauri v2 scaffold + Vite + TypeScript
- `ravel-stack-browser` in core
- SQLite + migration runner
- Stub stacks

### Phase 2 — Import & Cards ✅ DONE
- Photo import (Tauri file dialog → Rust → thumbnail/phash)
- `ravel-photo-strip` + `ravel-field-grid` in core
- `hlh-item-card` + `hlh-inbox-card` in app
- Inbox → Items flow

### Phase 3 — Catalog & Tags ✅ DONE
- `ravel-tag-editor` in core (autocomplete, keyboard nav, ARIA)
- Tags + item_tags DB helpers + FTS5 triggers
- Collections (create, browse, add/remove items)
- Items stack: FTS5 search, tag chips on tiles
- `hlh-item-card` updated with tag editor

### Phase 4 — Q-Thread Foundation
- **Quiddity DB migration**: all quiddity_* tables + qthread_registry + wishlists
- Add `qid` column to `items` table
- **`QThread` TypeScript interface** (`q-threads/interface.ts`)
- **`QThreadRegistry`** class (`src/services/qthread-registry.ts`): load, enable/disable, runMatch()
- **Quiddity stack** shell UI: Q-Thread Browser (installed threads), Quiddity Browser (searchable QID records), Wishlist tab, Import Queue tab
- **`ravel-confidence-pill`** in core: colored pill 0–1 with label
- **`ravel-job-monitor`** in core: background job queue with progress
- **`hlh-quiddity-panel`** in app: shows Q-Thread evidence on item detail (confidence pills + source list)
- Wire `runMatch()` call into item save flow → results appear in panel
- Human approval flow: Q-Thread proposes fields → user accepts or rejects per-field

### Phase 5 — Whole Earth Q-Thread
- `q-threads/whole-earth/thread.json` manifest
- Claude Vision importer: PDF → per-page structured JSON → object extraction
- Normalization: dedup against existing QIDs, resolve people/publications
- Mention creation: `quiddity_mentions` rows per page reference
- `recognize(item)` — visual/textual pattern matching against known Whole Earth items
- `match(item)` — search `quiddity_items` by title/author/year fuzzy match
- `explain(item)` — returns source snippet + page reference
- `related(item)` — other items mentioned in same catalog sections
- `estimateValue(item)` — based on condition heuristics from reference data
- `tags(item)` — suggests tags from Whole Earth categories
- Register thread in `qthread_registry` at first run
- Whole Earth import UI in Quiddity stack Import Queue tab

### Phase 6 — AI Vision & OCR
- `backend/ai-service` with Anthropic provider + SQLite cache
- Vision service: classify category from item photos (feeds recognize())
- OCR service: extract ISBN, UPC, labels, dates from photos
- `ravel-research-log` in core: timestamped evidence log with thread + confidence
- research_events display in `hlh-quiddity-panel`
- Results proposed to user for per-field approval

### Phase 7 — Descriptions & Research Log
- Description service: short title, long title, description, SEO summary, condition notes
- Marketplace-specific description variants
- `ravel-research-log` wired into item detail

### Phase 8 — Publishing Pipeline
- `ravel-checklist` + `ravel-abp-button` in core
- `plugins/interface.ts` MarketplacePlugin interface
- CSV export plugin (fully working)
- Shopify plugin
- AbeBooks plugin
- Stub plugins: eBay, Etsy, Facebook
- Listings stack + `hlh-marketplace-preview`

### Phase 9 — Valuation
- `ravel-price-range` in core
- Valuation service: comparable listings + sold prices → low/expected/optimistic
- `backend/research-service` (eBay completed, etc.)
- Q-Thread `estimateValue()` results feed into valuation
- Collection matcher: score items against saved collections
- `hlh-collection-match`

### Phase 10 — Additional Q-Threads
- Foxfire Q-Thread (Appalachian crafts, skills, material culture)
- Vintage Clothing Q-Thread (labels, construction, era markers)
- One more domain chosen by user
- Q-Thread packaging spec (distributable as .zip or npm package)

### Phase 11 — Additional Marketplaces
- eBay plugin (full)
- Etsy plugin (full)
- Additional connectors as needed

### Phase 12 — Polish
- Keyboard shortcuts
- Undo/redo
- History log (item lifecycle view)
- Performance: lazy loading, virtual scroll for large collections
- Reduced-motion support
- Full accessibility audit

---

## Decisions

1. **Backend process model**: Direct HTTP calls + in-process Q-Thread runtime. No sidecar processes.
2. **OCR**: Claude vision first; Tesseract as offline fallback in a later phase.
3. **Library location**: User-chosen (Lightroom-style). First-run wizard picks or creates a library folder.
4. **Q-Thread runtime**: TypeScript in-process (not a separate process). Threads are imported as ES modules.
5. **Evidence model**: No Q-Thread returns "truth." Each returns evidence with confidence. Research Engine merges. Human approves.
6. **Wishlists**: Reference Quiddity IDs only, never duplicate metadata. Separate from inventory Collections.
7. **Quiddity Database**: Permanent and shared. Separate migration track from inventory schema.
