/**
 * QThreadRegistry — discovers, registers, and runs Q-Threads.
 *
 * Q-Threads are ES modules that implement the QThread interface. They are
 * registered at startup via KNOWN_THREADS (populated as threads are added).
 * The registry persists enabled/disabled state in the DB.
 *
 * The run-match pipeline:
 *   1. For each enabled thread: call recognize() — skip if not in domain
 *   2. For recognized threads: call match(), tags(), estimateValue()
 *   3. Store each result as a research_event (JSON payload)
 *   4. Return all QuidMatch arrays merged by confidence
 */

import type { QThread, QuidMatch, ItemFields } from '../../../q-threads/interface';
import {
    listQthreads, upsertQthread, setQthreadEnabled,
    insertResearchEvent, listResearchEventsForItem,
    type QThreadRegistryRow, type ResearchEventRow,
} from '../db/index';

// ── Static registry — add new threads here as they are built ─────────────────
// Key = thread ID, value = async factory (lazy import).
type ThreadFactory = () => Promise<QThread>;
const KNOWN_THREADS = new Map<string, ThreadFactory>([
    ['whole-earth',       () => import('../../../q-threads/whole-earth/index').then(m => m.default)],
    ['foxfire',           () => import('../../../q-threads/foxfire/index').then(m => m.default)],
    ['daw-sf',            () => import('../../../q-threads/daw-sf/index').then(m => m.default)],
    ['vintage-clothing',  () => import('../../../q-threads/vintage-clothing/index').then(m => m.default)],
]);

// ── Evidence record stored as research_event.result (JSON) ───────────────────
export interface ThreadEvidence {
    threadId:  string;
    matches:   QuidMatch[];
    tags:      string[];
    valueEstimate: null | {
        low: number; expected: number; optimistic: number;
        currency: string; basis: string;
    };
}

export class QThreadRegistry {
    private _instances = new Map<string, QThread>();
    private _rows      = new Map<string, QThreadRegistryRow>();
    private static _instance: QThreadRegistry | null = null;

    static get(): QThreadRegistry {
        if (!QThreadRegistry._instance) QThreadRegistry._instance = new QThreadRegistry();
        return QThreadRegistry._instance;
    }

    /** Load DB state + instantiate enabled threads. Call once at app startup. */
    async init(): Promise<void> {
        const rows = await listQthreads();
        for (const row of rows) this._rows.set(row.id, row);

        // Register any KNOWN_THREADS not yet in the DB.
        for (const [id, factory] of KNOWN_THREADS) {
            if (this._rows.has(id)) continue;
            const thread = await factory();
            const meta   = thread.metadata();
            const row: QThreadRegistryRow = {
                id:       meta.id,
                name:     meta.name,
                version:  meta.version,
                path:     id,
                enabled:  1,
                priority: 0,
            };
            await upsertQthread(row);
            this._rows.set(id, row);
            this._instances.set(id, thread);
        }

        // Lazy-load instances for enabled known threads.
        for (const [id, row] of this._rows) {
            if (!row.enabled) continue;
            if (this._instances.has(id)) continue;
            const factory = KNOWN_THREADS.get(id);
            if (!factory) continue;
            this._instances.set(id, await factory());
        }
    }

    /** Return all registered threads (from DB). */
    getRows(): QThreadRegistryRow[] {
        return [...this._rows.values()];
    }

    /** Enable or disable a thread by ID. */
    async setEnabled(id: string, enabled: boolean): Promise<void> {
        await setQthreadEnabled(id, enabled);
        const row = this._rows.get(id);
        if (row) this._rows.set(id, { ...row, enabled: enabled ? 1 : 0 });

        if (enabled && !this._instances.has(id)) {
            const factory = KNOWN_THREADS.get(id);
            if (factory) this._instances.set(id, await factory());
        } else if (!enabled) {
            this._instances.delete(id);
        }
    }

    /**
     * Run all enabled threads against an item.
     * Stores one research_event per thread that produced results.
     * Returns the merged, confidence-sorted QuidMatch array.
     */
    async runMatch(itemId: string, fields: ItemFields): Promise<QuidMatch[]> {
        const allMatches: QuidMatch[] = [];

        for (const [id, thread] of this._instances) {
            const row = this._rows.get(id);
            if (!row?.enabled) continue;

            try {
                // Recognition gate
                if (thread.recognize) {
                    const rec = await thread.recognize(fields);
                    if (!rec?.recognized) continue;
                }

                const matches        = thread.match        ? await thread.match(fields)        : [];
                const tags           = thread.tags         ? await thread.tags(fields)         : [];
                const valueEstimate  = thread.estimateValue ? await thread.estimateValue(fields) : null;

                if (matches.length === 0 && tags.length === 0) continue;

                const evidence: ThreadEvidence = { threadId: id, matches, tags, valueEstimate };

                await insertResearchEvent({
                    id:          crypto.randomUUID(),
                    item_id:     itemId,
                    service:     'qthread',
                    provider:    id,
                    cmd:         'match',
                    result:      JSON.stringify(evidence),
                    confidence:  matches[0]?.confidence ?? null,
                    source:      null,
                    approved_at: null,
                });

                allMatches.push(...matches);
            } catch (err) {
                console.error(`[QThread:${id}] error during match:`, err);
            }
        }

        return allMatches.sort((a, b) => b.confidence - a.confidence);
    }

    /** Load all stored evidence records for an item. */
    async loadEvidence(itemId: string): Promise<ResearchEventRow[]> {
        return listResearchEventsForItem(itemId);
    }
}

export const registry = QThreadRegistry.get();
