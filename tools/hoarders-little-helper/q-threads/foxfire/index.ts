import type {
    QThread, QThreadMetadata, ItemFields,
    RecognitionResult, QuidMatch, QuidRef, ValueEstimate,
} from '../interface';
import { upsertQuiddityItem, getQuiddityItem, type QuiddityItemRow } from '../../app/src/db/index';
import { recognize as _recognize }  from './recognizers/index';
import { match     as _match }      from './matchers/index';
import { estimateValue as _estimate } from './heuristics/valuation';
import { SEED_ITEMS, KNOWN_TITLES, ALL_TAGS, FOXFIRE_KEYWORDS } from './reference/seed';
import MANIFEST from './thread.json';

let _seeded = false;

async function ensureSeeded(): Promise<void> {
    if (_seeded) return;
    _seeded = true;
    const existing = await getQuiddityItem('QID-B-001001');
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

export class FoxfireThread implements QThread {

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
        const title  = (item.title ?? '').toLowerCase();
        const seed   = KNOWN_TITLES.get(title);

        if (seed) {
            seed.tags.forEach(t => result.add(t));
        } else {
            const text = `${item.title ?? ''} ${item.notes ?? ''}`.toLowerCase();
            for (const kw of FOXFIRE_KEYWORDS) {
                if (text.includes(kw)) result.add(kw);
            }
            for (const tag of ALL_TAGS) {
                if (text.includes(tag.toLowerCase())) result.add(tag);
            }
        }

        return [...result];
    }

    async related(item: ItemFields): Promise<QuidRef[]> {
        await ensureSeeded();
        const title = (item.title ?? '').toLowerCase();
        const seed  = KNOWN_TITLES.get(title);
        if (!seed?.series_number) return [];

        // Neighbors in the series
        return SEED_ITEMS
            .filter(s => s.series === seed.series && s.qid !== seed.qid)
            .slice(0, 4)
            .map(s => ({ qid: s.qid, name: s.canonical_name, relation: 'foxfire-series' }));
    }

    async estimateValue(item: ItemFields): Promise<ValueEstimate | null> {
        await ensureSeeded();
        return _estimate(item);
    }
}

export default new FoxfireThread();
