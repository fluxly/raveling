import type {
    QThread, QThreadMetadata, ItemFields,
    RecognitionResult, QuidMatch, ValueEstimate,
} from '../interface';
import { upsertQuiddityItem, getQuiddityItem, type QuiddityItemRow } from '../../app/src/db/index';
import { recognize as _recognize }  from './recognizers/index';
import { match     as _match }      from './matchers/index';
import { estimateValue as _estimate } from './heuristics/valuation';
import { SEED_ITEMS, ALL_TAGS, VINTAGE_MARKERS } from './reference/seed';
import MANIFEST from './thread.json';

let _seeded = false;

async function ensureSeeded(): Promise<void> {
    if (_seeded) return;
    _seeded = true;
    const existing = await getQuiddityItem('QID-G-000001');
    if (existing) return;
    for (const item of SEED_ITEMS) {
        const row: Omit<QuiddityItemRow, 'created_at' | 'updated_at'> = {
            id:             crypto.randomUUID(),
            qid:            item.qid,
            type:           item.type,
            canonical_name: item.canonical_name,
            subtitle:       null,
            description:    item.description ?? null,
            notes:          item.condition_notes ?? null,
        };
        await upsertQuiddityItem(row);
    }
}

export class VintageClothingThread implements QThread {

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
        const text    = `${item.title ?? ''} ${item.notes ?? ''} ${item.brand ?? ''}`.toLowerCase();

        // Always include clothing-level tags
        result.add('vintage clothing');
        result.add('american made');

        // Brand-specific tags
        const brandMap: Record<string, string[]> = {
            "levi's": ['levis', 'denim', '501'],
            'levis':  ['levis', 'denim', '501'],
            'lee':    ['lee', 'denim', 'workwear'],
            'wrangler': ['wrangler', 'denim', 'western wear'],
            'carhartt': ['carhartt', 'workwear', 'duck canvas'],
            'pendleton': ['pendleton', 'wool', 'western wear'],
        };
        const brand = (item.brand ?? '').toLowerCase();
        for (const [k, tags] of Object.entries(brandMap)) {
            if (brand.includes(k) || text.includes(k)) tags.forEach(t => result.add(t));
        }

        // Era marker tags
        if (text.includes('selvedge') || text.includes('selvage')) result.add('selvedge denim');
        if (text.includes('big e'))    result.add('big e');
        if (text.includes('union label') || text.includes('ilgwu')) result.add('union made');
        if (text.includes('deadstock') || text.includes('nos ')) result.add('deadstock');

        // Marker keywords → tags
        for (const m of VINTAGE_MARKERS) {
            if (text.includes(m) && m.length > 4) result.add(m);
        }

        // Era tags
        const year = item.year;
        if (year) {
            if (year < 1950)       result.add('pre-1950');
            else if (year < 1960)  result.add('1950s');
            else if (year < 1970)  result.add('1960s');
            else if (year < 1980)  result.add('1970s');
            else if (year < 1990)  result.add('1980s');
        }

        // Any ALL_TAGS that appear in the text
        for (const tag of ALL_TAGS) {
            if (text.includes(tag.toLowerCase())) result.add(tag);
        }

        return [...result];
    }

    async estimateValue(item: ItemFields): Promise<ValueEstimate | null> {
        await ensureSeeded();
        return _estimate(item);
    }
}

export default new VintageClothingThread();
