/**
 * Valuation heuristics for Whole Earth Catalog items.
 *
 * These are rough collector-market estimates, not guarantees.
 * Factors: item type, condition, edition, year.
 */

import type { ItemFields }    from '../../interface';
import type { ValueEstimate } from '../../interface';
import { KNOWN_TITLES }       from '../reference/seed';

const CONDITIONS: Record<string, number> = {
    mint:  1.0,
    fine:  0.8,
    vg:    0.55,
    good:  0.35,
    fair:  0.15,
    poor:  0.05,
};

export function estimateValue(item: ItemFields): ValueEstimate | null {
    const title    = (item.title ?? '').toLowerCase();
    const seed     = KNOWN_TITLES.get(title);
    if (!seed) return null;

    const conditionKey  = (item.condition ?? 'good').toLowerCase();
    const conditionMult = CONDITIONS[conditionKey] ?? 0.35;

    // ── Base prices by type + QID ─────────────────────────────────────────────
    const base = _basePrice(seed.qid, seed.type);
    if (!base) return null;

    const low        = Math.round(base.low  * conditionMult);
    const expected   = Math.round(base.expected * conditionMult);
    const optimistic = Math.round(base.optimistic * conditionMult);

    return {
        low:        Math.max(1, low),
        expected:   Math.max(2, expected),
        optimistic: Math.max(3, optimistic),
        currency:   'USD',
        basis:      _basisText(seed.canonical_name, item.condition ?? 'good', seed.condition_notes),
    };
}

type BaseRange = { low: number; expected: number; optimistic: number };

function _basePrice(qid: string, type: string): BaseRange | null {
    // Known QID overrides
    const OVERRIDES: Record<string, BaseRange> = {
        'QID-M-000001': { low: 50,  expected: 200, optimistic: 600  },  // WEC Fall 1968 First
        'QID-M-000002': { low: 10,  expected: 30,  optimistic: 80   },  // Last WEC 1971
        'QID-M-000003': { low: 8,   expected: 18,  optimistic: 45   },  // Updated Last
        'QID-M-000004': { low: 5,   expected: 15,  optimistic: 30   },  // Essential
        'QID-B-000015': { low: 80,  expected: 400, optimistic: 3500 },  // Dune first ed
        'QID-B-000009': { low: 5,   expected: 20,  optimistic: 60   },  // VW Alive
        'QID-B-000006': { low: 15,  expected: 40,  optimistic: 100  },  // Shelter
        'QID-B-000007': { low: 15,  expected: 45,  optimistic: 110  },  // Domebook Two
    };

    if (OVERRIDES[qid]) return OVERRIDES[qid];

    // Defaults by type
    switch (type) {
        case 'book':     return { low: 5,  expected: 20,  optimistic: 60 };
        case 'magazine': return { low: 8,  expected: 25,  optimistic: 80 };
        case 'tool':     return { low: 10, expected: 35,  optimistic: 90 };
        default:         return null;
    }
}

function _basisText(name: string, condition: string, notes?: string): string {
    const base = `Whole Earth Catalog collectibles market estimate for "${name}" in ${condition} condition.`;
    return notes ? `${base} ${notes}` : base;
}
