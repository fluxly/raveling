import type {
    QThread, QThreadMetadata, ItemFields,
    RecognitionResult, QuidMatch, QuidRef, ValueEstimate,
} from '../interface';
import { upsertQuiddityItem, getQuiddityItem, type QuiddityItemRow } from '../../app/src/db/index';
import { recognize as _recognize }  from './recognizers/index';
import { match     as _match }      from './matchers/index';
import { estimateValue as _estimate } from './heuristics/valuation';
import { SEED_ITEMS, KNOWN_TITLES, DAW_AUTHORS, ALL_TAGS } from './reference/seed';
import MANIFEST from './thread.json';

let _seeded = false;

async function ensureSeeded(): Promise<void> {
    if (_seeded) return;
    _seeded = true;
    const existing = await getQuiddityItem('QID-B-002001');
    if (existing) return;
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

export class DawSfThread implements QThread {

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
        const result  = new Set<string>();
        const title   = (item.title ?? '').toLowerCase();
        const seed    = KNOWN_TITLES.get(title);

        if (seed) {
            seed.tags.forEach(t => result.add(t));
            if (seed.series) result.add(seed.series.toLowerCase());
        } else {
            result.add('daw books');
            result.add('science fiction');
            const author = (item.author ?? '').toLowerCase();
            if (DAW_AUTHORS.has(author)) result.add(author);
            const text = `${item.title ?? ''} ${item.notes ?? ''}`.toLowerCase();
            for (const tag of ALL_TAGS) {
                if (text.includes(tag.toLowerCase())) result.add(tag);
            }
        }

        return [...result];
    }

    async related(item: ItemFields): Promise<QuidRef[]> {
        await ensureSeeded();
        const title  = (item.title ?? '').toLowerCase();
        const seed   = KNOWN_TITLES.get(title);
        if (!seed) return [];

        const related: QuidRef[] = [];

        // Other books in the same series
        if (seed.series) {
            SEED_ITEMS
                .filter(s => s.series === seed.series && s.qid !== seed.qid)
                .slice(0, 3)
                .forEach(s => related.push({ qid: s.qid, name: s.canonical_name, relation: 'same-series' }));
        }

        // Other books by the same author
        SEED_ITEMS
            .filter(s => s.author === seed.author && s.qid !== seed.qid && !related.some(r => r.qid === s.qid))
            .slice(0, 2)
            .forEach(s => related.push({ qid: s.qid, name: s.canonical_name, relation: 'same-author' }));

        return related.slice(0, 5);
    }

    async estimateValue(item: ItemFields): Promise<ValueEstimate | null> {
        await ensureSeeded();
        return _estimate(item);
    }
}

export default new DawSfThread();
