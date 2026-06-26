/**
 * Whole Earth Q-Thread
 *
 * Teaches HLH the domain of the Whole Earth Catalog family (1968–1986):
 * the books, tools, and resources reviewed by Stewart Brand and collaborators.
 *
 * Capabilities: recognition, matching, valuation, related-items, tags
 *
 * On first use: automatically seeds the Quiddity Database from embedded
 * reference data. No network access, no PDF import required for basic function.
 */

import type {
    QThread, QThreadMetadata, ItemFields,
    RecognitionResult, QuidMatch, QuidRef, ValueEstimate,
} from '../interface';

import {
    upsertQuiddityItem, searchQuiddityItems, getQuiddityItem,
    type QuiddityItemRow,
} from '../../app/src/db/index';

import { recognize as _recognize }    from './recognizers/index';
import { match     as _match }        from './matchers/index';
import { estimateValue as _estimate } from './heuristics/valuation';
import { SEED_ITEMS, KNOWN_TITLES, ALL_TAGS } from './reference/seed';

import MANIFEST from './thread.json';

// ── Seeding state (in-memory guard — don't hit the DB twice per session) ──────
let _seeded = false;

async function ensureSeeded(): Promise<void> {
    if (_seeded) return;
    _seeded = true;  // set eagerly to prevent concurrent double-seed

    // Check if seed data already exists by looking up the first item.
    const existing = await getQuiddityItem('QID-M-000001');
    if (existing) return;  // already seeded

    for (const item of SEED_ITEMS) {
        const row: Omit<QuiddityItemRow, 'created_at' | 'updated_at'> = {
            id:             crypto.randomUUID(),
            qid:            item.qid,
            type:           item.type,
            canonical_name: item.canonical_name,
            subtitle:       item.subtitle ?? null,
            description:    item.description ?? null,
            notes:          item.condition_notes ?? null,
        };
        await upsertQuiddityItem(row);
    }
}

// ── WEC section → tags map ─────────────────────────────────────────────────────
const SECTION_TAGS: Record<string, string[]> = {
    'whole-systems': ['whole earth', 'systems thinking', 'ecology'],
    'shelter':       ['shelter', 'owner-built', 'vernacular architecture'],
    'craft':         ['craft', 'tools', 'making'],
    'nomadics':      ['backpacking', 'travel', 'outdoors'],
    'food':          ['food', 'foraging', 'self-sufficiency'],
    'learning':      ['education', 'alternative education'],
    'community':     ['commune', 'community'],
    'communications':['communications', 'media'],
    'environment':   ['environment', 'ecology'],
};

// ── QThread implementation ─────────────────────────────────────────────────────

export class WholeEarthThread implements QThread {

    metadata(): QThreadMetadata {
        return {
            id:           MANIFEST.id,
            name:         MANIFEST.name,
            version:      MANIFEST.version,
            description:  MANIFEST.description,
            capabilities: MANIFEST.capabilities as QThreadMetadata['capabilities'],
        };
    }

    async recognize(item: ItemFields): Promise<RecognitionResult | null> {
        await ensureSeeded();
        return _recognize(item);
    }

    async match(item: ItemFields): Promise<QuidMatch[]> {
        await ensureSeeded();
        return _match(item);
    }

    async tags(item: ItemFields): Promise<string[]> {
        await ensureSeeded();
        const result = new Set<string>();

        // Tags from the exact seed record if found
        const title = (item.title ?? '').toLowerCase();
        const seed  = KNOWN_TITLES.get(title);
        if (seed) {
            seed.tags.forEach(t => result.add(t));
            const sectionTags = SECTION_TAGS[seed.wec_section] ?? [];
            sectionTags.forEach(t => result.add(t));
            result.add('whole earth catalog');
        } else {
            // Generic match — suggest whole-earth tags that appear in the item text
            const text = `${item.title ?? ''} ${item.notes ?? ''} ${item.author ?? ''}`.toLowerCase();
            for (const tag of ALL_TAGS) {
                if (text.includes(tag)) result.add(tag);
            }
        }

        return [...result];
    }

    async related(item: ItemFields): Promise<QuidRef[]> {
        await ensureSeeded();
        const title = (item.title ?? '').toLowerCase();
        const seed  = KNOWN_TITLES.get(title);
        if (!seed) return [];

        // Items in the same WEC section are "related"
        const sameSection = SEED_ITEMS.filter(s =>
            s.wec_section === seed.wec_section &&
            s.qid !== seed.qid
        );

        return sameSection.slice(0, 5).map(s => ({
            qid:      s.qid,
            name:     s.canonical_name,
            relation: 'same-wec-section',
        }));
    }

    async estimateValue(item: ItemFields): Promise<ValueEstimate | null> {
        await ensureSeeded();
        return _estimate(item);
    }
}

// Default export — what KNOWN_THREADS instantiates
export default new WholeEarthThread();
