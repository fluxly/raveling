import type { ItemFields, QuidMatch } from '../../interface';
import { searchQuiddityItems } from '../../../app/src/db/index';
import { SEED_ITEMS, VINTAGE_MARKERS } from '../reference/seed';

export async function match(item: ItemFields): Promise<QuidMatch[]> {
    const text  = `${item.title ?? ''} ${item.notes ?? ''} ${item.brand ?? ''} ${item.category ?? ''}`.toLowerCase();
    const brand = (item.brand ?? '').toLowerCase();
    const year  = item.year;

    const matches: QuidMatch[] = [];

    // Score each seed type against the item's markers
    for (const seedType of SEED_ITEMS) {
        const score = _scoreType(seedType, text, brand, year);
        if (score < 0.25) continue;

        matches.push({
            qid:         seedType.qid,
            confidence:  score,
            explanation: `Matched garment type: "${seedType.canonical_name}" (${seedType.era_start}–${seedType.era_end === 9999 ? 'present' : seedType.era_end}). Markers: ${seedType.markers.slice(0, 2).join('; ')}.`,
            fields: {
                category: 'vintage clothing',
                year:     year ?? _midpoint(seedType.era_start, seedType.era_end),
            },
            mentions: [],
        });
    }

    // Also do a DB text search for any other quiddity items
    const query = [item.title, item.brand].filter(Boolean).join(' ');
    if (query.trim()) {
        const results = await searchQuiddityItems(query, 5);
        for (const r of results) {
            if (matches.some(m => m.qid === r.qid)) continue;
            if (r.type !== 'garment') continue;
            matches.push({
                qid:         r.qid,
                confidence:  0.35,
                explanation: `DB match: "${r.canonical_name}"`,
                fields:      { category: 'vintage clothing' },
                mentions:    [],
            });
        }
    }

    return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 4);
}

function _scoreType(
    seed: typeof SEED_ITEMS[0],
    text: string,
    brand: string,
    year: number | null,
): number {
    let score = 0;

    // Brand match
    if (seed.brand && brand.toLowerCase().includes(seed.brand.toLowerCase().split(' ')[0])) {
        score += 0.40;
    }
    if (seed.brand && text.includes(seed.brand.toLowerCase())) {
        score += 0.20;
    }

    // Year in range
    if (year !== null) {
        if (year >= seed.era_start && year <= Math.min(seed.era_end, 9998)) {
            score += 0.20;
        } else if (Math.abs(year - seed.era_start) <= 5 || Math.abs(year - seed.era_end) <= 5) {
            score += 0.08;
        }
    }

    // Marker keyword hits
    const markerHits = VINTAGE_MARKERS.filter(m => text.includes(m));
    const seedTags   = seed.tags.filter(t => text.includes(t.toLowerCase()));

    score += Math.min(0.30, markerHits.length * 0.08);
    score += Math.min(0.20, seedTags.length   * 0.06);

    // Specific seed tag match
    if (seed.canonical_name.toLowerCase().split(' ').some(w => w.length > 3 && text.includes(w))) {
        score += 0.10;
    }

    return Math.min(1, score);
}

function _midpoint(start: number, end: number): number {
    const safeEnd = Math.min(end, new Date().getFullYear());
    return Math.round((start + safeEnd) / 2);
}
