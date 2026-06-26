/**
 * Q-Thread interface — every domain knowledge bundle implements this.
 *
 * Q-Threads are little experts that contribute evidence, never truth.
 * All match-phase methods are optional; threads advertise capabilities
 * in their thread.json manifest.
 */

export type QThreadCapability =
    | 'recognition'
    | 'matching'
    | 'valuation'
    | 'related-items'
    | 'wishlist'
    | 'tags'
    | 'import';

export interface QThreadMetadata {
    id:           string;
    name:         string;
    version:      string;
    description:  string;
    capabilities: QThreadCapability[];
}

/** Subset of item fields that Q-Threads reason about. */
export interface ItemFields {
    title:     string | null;
    brand:     string | null;
    author:    string | null;
    publisher: string | null;
    category:  string | null;
    year:      number | null;
    condition: string | null;
    notes:     string | null;
}

/** A mention of a quiddity item in a source document. */
export interface QuidMention {
    publication: string;
    issue?:      string;
    page?:       string;
    section?:    string;
    snippet?:    string;
    confidence:  number;
}

/** A match between an inventory item and a Quiddity Database record. */
export interface QuidMatch {
    qid:          string;            // e.g. "QID-B-000183"
    confidence:   number;            // 0–1
    explanation:  string;
    fields:       Partial<ItemFields>; // proposed values for human review
    mentions:     QuidMention[];       // where this object appears in source docs
}

/** A reference to a related quiddity record. */
export interface QuidRef {
    qid:      string;
    name:     string;
    relation: string; // 'companion'|'sequel'|'related'|'same-series'|etc.
}

/** Price range estimate from a Q-Thread. */
export interface ValueEstimate {
    low:        number;
    expected:   number;
    optimistic: number;
    currency:   string;
    basis:      string; // human-readable explanation
}

/** Whether the thread recognizes this item as being in its domain. */
export interface RecognitionResult {
    recognized:   boolean;
    confidence:   number;
    type?:        string;  // e.g. 'book'|'tool'|'garment'
    explanation?: string;
}

/** Source document for the import phase. */
export interface QThreadSource {
    path:   string;
    type:   'pdf' | 'csv' | 'url' | 'json';
    title?: string;
}

/** Progress event yielded during import. */
export interface ImportProgress {
    status:     'processing' | 'done' | 'error';
    page?:      number;
    total?:     number;
    extracted?: number;
    message?:   string;
}

// ── The interface every Q-Thread must implement ────────────────────────────

export interface QThread {
    /** Returns the thread's static metadata. */
    metadata(): QThreadMetadata;

    // ── Match phase (all optional) ─────────────────────────────────────────

    /** Does this item belong to this thread's domain? */
    recognize?(item: ItemFields): Promise<RecognitionResult | null>;

    /** Find matching Quiddity records for this item. */
    match?(item: ItemFields): Promise<QuidMatch[]>;

    /** Return a human-readable explanation of the best match. */
    explain?(item: ItemFields): Promise<string>;

    /** Find related objects the collector might also want. */
    related?(item: ItemFields): Promise<QuidRef[]>;

    /** Estimate the item's value based on thread heuristics. */
    estimateValue?(item: ItemFields): Promise<ValueEstimate | null>;

    /** Suggest tags drawn from this thread's vocabulary. */
    tags?(item: ItemFields): Promise<string[]>;

    // ── Import phase (optional) ────────────────────────────────────────────

    /** Process a source document, yielding progress events. */
    import?(source: QThreadSource): AsyncGenerator<ImportProgress>;
}
