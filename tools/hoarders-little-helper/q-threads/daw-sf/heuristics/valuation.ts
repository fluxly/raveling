import type { ItemFields, ValueEstimate } from '../../interface';
import { KNOWN_TITLES } from '../reference/seed';

const CONDITIONS: Record<string, number> = {
    mint: 1.0, fine: 0.80, vg: 0.55, good: 0.30, fair: 0.12, poor: 0.04,
};

export function estimateValue(item: ItemFields): ValueEstimate | null {
    const title    = (item.title ?? '').toLowerCase();
    const condKey  = (item.condition ?? 'vg').toLowerCase();
    const condMult = CONDITIONS[condKey] ?? 0.30;

    // Specific overrides for collectible titles
    const OVERRIDES: Record<string, { low: number; expected: number; optimistic: number; note: string }> = {
        'QID-B-002001': { low: 20, expected: 60,  optimistic: 120, note: 'First DAW book ever published — highest collector premium.' },
        'QID-B-002003': { low: 10, expected: 30,  optimistic: 75,  note: 'Cherryh debut. First printing 1976.' },
        'QID-B-002004': { low: 8,  expected: 25,  optimistic: 60,  note: 'Hugo winner 1982. First printing premium.' },
        'QID-B-002006': { low: 12, expected: 35,  optimistic: 90,  note: 'Tanith Lee debut novel. Scarce in Fine.' },
        'QID-B-002008': { low: 8,  expected: 22,  optimistic: 70,  note: 'Night\'s Master — most collectible Flat Earth volume.' },
        'QID-B-002016': { low: 10, expected: 30,  optimistic: 80,  note: 'Tékumel novels are scarce in Fine; high demand from RPG collectors.' },
        'QID-B-002018': { low: 8,  expected: 20,  optimistic: 45,  note: 'Courtship Rite — Hugo nominee, undervalued.' },
        'QID-B-002014': { low: 8,  expected: 18,  optimistic: 45,  note: 'First DAW annual (UQ prefix); early number premium.' },
    };

    const seed = KNOWN_TITLES.get(title);
    if (seed && OVERRIDES[seed.qid]) {
        const o = OVERRIDES[seed.qid];
        return {
            low:        Math.max(1, Math.round(o.low        * condMult)),
            expected:   Math.max(2, Math.round(o.expected   * condMult)),
            optimistic: Math.max(3, Math.round(o.optimistic * condMult)),
            currency:   'USD',
            basis:      o.note,
        };
    }

    if (seed) {
        // Generic DAW first printing estimate
        const isEarly = seed.daw_number !== undefined && seed.daw_number <= 200;
        const base = isEarly
            ? { low: 6, expected: 18, optimistic: 45 }
            : { low: 3, expected: 10, optimistic: 25 };
        return {
            low:        Math.max(1, Math.round(base.low        * condMult)),
            expected:   Math.max(2, Math.round(base.expected   * condMult)),
            optimistic: Math.max(3, Math.round(base.optimistic * condMult)),
            currency:   'USD',
            basis:      `DAW Books first printing estimate for "${seed.canonical_name}" (${seed.year}). ${isEarly ? 'Early DAW number — collector premium applies.' : 'Mid-run DAW title.'}`,
        };
    }

    // Generic DAW paperback by publisher recognition
    if (_isDawBook(item)) {
        const base = _eraBase(item.year ?? 0);
        return {
            low:        Math.max(1, Math.round(base.low        * condMult)),
            expected:   Math.max(2, Math.round(base.expected   * condMult)),
            optimistic: Math.max(3, Math.round(base.optimistic * condMult)),
            currency:   'USD',
            basis:      `Generic DAW Books paperback estimate. Yellow-spine era (1972–1986) commands higher premiums than later printings.`,
        };
    }

    return null;
}

function _isDawBook(item: ItemFields): boolean {
    const text = `${item.title ?? ''} ${item.notes ?? ''} ${item.publisher ?? ''}`.toLowerCase();
    return text.includes('daw') || /\b(ue|uw|uq)\d{3,}/i.test(text);
}

function _eraBase(year: number): { low: number; expected: number; optimistic: number } {
    if (year >= 1972 && year <= 1979) return { low: 5, expected: 15, optimistic: 40 };
    if (year >= 1980 && year <= 1986) return { low: 4, expected: 10, optimistic: 28 };
    if (year >= 1987 && year <= 1995) return { low: 2, expected: 7,  optimistic: 18 };
    return { low: 1, expected: 4, optimistic: 12 };
}
