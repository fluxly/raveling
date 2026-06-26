import type { ItemFields, ValueEstimate } from '../../interface';
import { KNOWN_TITLES } from '../reference/seed';

const CONDITIONS: Record<string, number> = {
    mint: 1.0, fine: 0.80, vg: 0.55, good: 0.35, fair: 0.15, poor: 0.05,
};

export function estimateValue(item: ItemFields): ValueEstimate | null {
    const title    = (item.title ?? '').toLowerCase();
    const condKey  = (item.condition ?? 'good').toLowerCase();
    const condMult = CONDITIONS[condKey] ?? 0.35;

    const seed = KNOWN_TITLES.get(title);
    if (!seed) {
        // Generic Foxfire-adjacent folk craft book
        if (_isFoxfireAdjacent(item)) {
            return {
                low:        Math.round(3  * condMult),
                expected:   Math.round(12 * condMult),
                optimistic: Math.round(35 * condMult),
                currency:   'USD',
                basis:      'Generic folk craft / Appalachian collectible estimate.',
            };
        }
        return null;
    }

    const base = _basePrice(seed.qid, seed.series_number);

    return {
        low:        Math.max(1, Math.round(base.low        * condMult)),
        expected:   Math.max(2, Math.round(base.expected   * condMult)),
        optimistic: Math.max(3, Math.round(base.optimistic * condMult)),
        currency:   'USD',
        basis:      seed.condition_notes ?? `Foxfire series collector market estimate for "${seed.canonical_name}" in ${item.condition ?? 'good'} condition.`,
    };
}

type Range = { low: number; expected: number; optimistic: number };

function _basePrice(qid: string, seriesNum?: number): Range {
    // Specific overrides
    const OVERRIDES: Record<string, Range> = {
        'QID-B-001001': { low: 15,  expected: 45,  optimistic: 120 },  // Foxfire 1 — most collectible
        'QID-B-001008': { low: 10,  expected: 28,  optimistic: 60  },  // Foxfire 8 — pottery demand
        'QID-B-001013': { low: 40,  expected: 90,  optimistic: 150 },  // Possum Living — genuinely scarce
    };
    if (OVERRIDES[qid]) return OVERRIDES[qid];

    // Series number tiers
    if (seriesNum !== undefined) {
        if (seriesNum <= 3)  return { low: 8,  expected: 20, optimistic: 55 };
        if (seriesNum <= 6)  return { low: 5,  expected: 12, optimistic: 30 };
        if (seriesNum <= 9)  return { low: 4,  expected: 10, optimistic: 22 };
        return                      { low: 3,  expected: 8,  optimistic: 15 };
    }

    return { low: 4, expected: 12, optimistic: 30 };
}

function _isFoxfireAdjacent(item: ItemFields): boolean {
    const text = `${item.title ?? ''} ${item.notes ?? ''} ${item.category ?? ''}`.toLowerCase();
    return ['foxfire', 'appalachian', 'folk craft', 'homesteading', 'traditional skills',
            'possum', 'moonshine', 'log cabin', 'dulcimer', 'banjo'].some(kw => text.includes(kw));
}
