import type { ItemFields, ValueEstimate } from '../../interface';
import { VINTAGE_MARKERS } from '../reference/seed';

const CONDITIONS: Record<string, number> = {
    mint: 1.0, fine: 0.80, vg: 0.55, good: 0.30, fair: 0.12, poor: 0.04,
};

export function estimateValue(item: ItemFields): ValueEstimate | null {
    const text     = `${item.title ?? ''} ${item.notes ?? ''} ${item.brand ?? ''} ${item.category ?? ''}`.toLowerCase();
    const brand    = (item.brand    ?? '').toLowerCase();
    const condKey  = (item.condition ?? 'vg').toLowerCase();
    const condMult = CONDITIONS[condKey] ?? 0.30;
    const year     = item.year;

    // Must be a recognizable clothing item
    const markerCount = VINTAGE_MARKERS.filter(m => text.includes(m)).length;
    const isClothing  = text.includes('denim') || text.includes('jean') || text.includes('coat') ||
                        text.includes('shirt') || text.includes('jacket') || text.includes('trouser') ||
                        text.includes('clothing') || text.includes('garment') || text.includes('dress') ||
                        item.category?.toLowerCase().includes('cloth') || markerCount > 0;
    if (!isClothing) return null;

    const base = _basePrice(text, brand, year);
    if (!base) return null;

    // Deadstock premium
    const isDeadstock = text.includes('deadstock') || text.includes('new old stock') || text.includes('nos ');
    const deadMult    = isDeadstock ? 2.5 : 1.0;

    return {
        low:        Math.max(5,  Math.round(base.low        * condMult * deadMult)),
        expected:   Math.max(10, Math.round(base.expected   * condMult * deadMult)),
        optimistic: Math.max(15, Math.round(base.optimistic * condMult * deadMult)),
        currency:   'USD',
        basis:      _basis(text, brand, year, isDeadstock),
    };
}

type Range = { low: number; expected: number; optimistic: number };

function _basePrice(text: string, brand: string, year: number | null): Range | null {
    // Big E Levi's — highest tier
    if ((brand.includes('levi') || text.includes('levi')) && text.includes('big e')) {
        return { low: 120, expected: 350, optimistic: 900 };
    }
    if ((brand.includes('levi') || text.includes('levi')) && text.includes('selvedge')) {
        return { low: 60, expected: 180, optimistic: 500 };
    }
    if ((brand.includes('levi') || text.includes('levi')) && text.includes('501')) {
        if (year && year < 1972) return { low: 50, expected: 140, optimistic: 400 };
        if (year && year < 1984) return { low: 30, expected: 80,  optimistic: 200 };
        return { low: 15, expected: 45, optimistic: 100 };
    }
    if (brand.includes('levi') || text.includes('levi')) {
        return { low: 15, expected: 40, optimistic: 120 };
    }

    // Lee
    if (brand.includes(' lee') || text.includes(' lee ') || brand === 'lee') {
        if (text.includes('101') || text.includes('cowboy')) return { low: 50, expected: 130, optimistic: 350 };
        return { low: 20, expected: 55, optimistic: 140 };
    }

    // Wrangler
    if (brand.includes('wrangler') || text.includes('wrangler')) {
        return { low: 15, expected: 40, optimistic: 100 };
    }

    // Carhartt vintage
    if (brand.includes('carhartt') || text.includes('carhartt')) {
        if (text.includes('chore') || text.includes('duck')) return { low: 60, expected: 160, optimistic: 380 };
        return { low: 30, expected: 80, optimistic: 200 };
    }

    // Pendleton wool
    if (brand.includes('pendleton') || text.includes('pendleton')) {
        if (text.includes('robe') || text.includes('blanket')) return { low: 60, expected: 140, optimistic: 320 };
        return { low: 30, expected: 75, optimistic: 200 };
    }

    // Generic vintage with strong markers
    if (text.includes('selvedge') || text.includes('big e') || text.includes('union label')) {
        return { low: 25, expected: 70, optimistic: 200 };
    }

    // Generic vintage clothing
    const markerCount = VINTAGE_MARKERS.filter(m => text.includes(m)).length;
    if (markerCount >= 2) return { low: 15, expected: 40, optimistic: 120 };
    if (markerCount === 1) return { low: 8,  expected: 22, optimistic: 65 };

    return { low: 5, expected: 15, optimistic: 45 };
}

function _basis(text: string, brand: string, year: number | null, isDeadstock: boolean): string {
    const parts: string[] = ['Vintage clothing market estimate'];
    if (brand) parts.push(`brand: ${brand}`);
    if (year)  parts.push(`circa ${year}`);
    if (text.includes('big e'))   parts.push('Big E premium applied');
    if (text.includes('selvedge') || text.includes('selvage')) parts.push('selvedge denim premium');
    if (isDeadstock) parts.push('deadstock multiplier (×2.5)');
    parts.push('Condition drives the final price significantly for vintage denim and workwear.');
    return parts.join('. ') + '.';
}
