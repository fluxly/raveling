import type { ItemFields, RecognitionResult } from '../../interface';
import { CLOTHING_CATEGORIES, VINTAGE_MARKERS } from '../reference/seed';

export function recognize(item: ItemFields): RecognitionResult {
    const title    = (item.title    ?? '').toLowerCase();
    const category = (item.category ?? '').toLowerCase();
    const notes    = (item.notes    ?? '').toLowerCase();
    const brand    = (item.brand    ?? '').toLowerCase();

    const text = `${title} ${notes} ${brand}`;

    let score = 0;
    const reasons: string[] = [];

    // Category match — primary signal
    if (CLOTHING_CATEGORIES.has(category)) {
        score += 0.30;
        reasons.push(`clothing category: "${category}"`);
    } else {
        // Check if category contains any clothing word
        const catMatch = [...CLOTHING_CATEGORIES].find(c => category.includes(c));
        if (catMatch) { score += 0.20; reasons.push(`category contains "${catMatch}"`); }
    }

    // Vintage markers in text — the real signal
    const markerHits = VINTAGE_MARKERS.filter(m => text.includes(m));
    if (markerHits.length > 0) {
        score += Math.min(0.60, markerHits.length * 0.15);
        reasons.push(`vintage markers: ${markerHits.slice(0, 3).join(', ')}`);
    }

    // Known vintage brands
    const vintageBrands = ["levi's", 'levis', 'lee', 'wrangler', 'carhartt', 'pendleton',
                           'big smith', 'key imperial', 'oshkosh', 'hercules', 'headlight'];
    const brandMatch = vintageBrands.find(b => brand.includes(b) || title.includes(b));
    if (brandMatch) {
        score += 0.20;
        reasons.push(`known vintage brand: "${brandMatch}"`);
    }

    // Era hint from year
    if (item.year !== null && item.year !== undefined) {
        if (item.year < 1980) { score += 0.10; reasons.push(`year ${item.year} (pre-1980)`); }
    }

    score = Math.max(0, Math.min(1, score));
    if (score < 0.15) return { recognized: false, confidence: score };

    return {
        recognized:  true,
        confidence:  score,
        type:        'garment',
        explanation: reasons.join('; '),
    };
}
