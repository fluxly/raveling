import type { ItemFields, RecognitionResult } from '../../interface';
import { KNOWN_TITLES, DAW_AUTHORS, DAW_KEYWORDS, DAW_CATEGORIES } from '../reference/seed';

export function recognize(item: ItemFields): RecognitionResult {
    const title     = (item.title     ?? '').toLowerCase();
    const author    = (item.author    ?? '').toLowerCase();
    const publisher = (item.publisher ?? '').toLowerCase();
    const category  = (item.category  ?? '').toLowerCase();
    const notes     = (item.notes     ?? '').toLowerCase();

    // Exact title
    if (KNOWN_TITLES.has(title)) {
        const seed = KNOWN_TITLES.get(title)!;
        return {
            recognized:  true,
            confidence:  0.97,
            type:        seed.type,
            explanation: `"${item.title}" is a known DAW Books title by ${seed.author}.`,
        };
    }

    let score = 0;
    const reasons: string[] = [];

    // Publisher is DAW Books — strongest signal
    if (publisher.includes('daw')) {
        score += 0.65;
        reasons.push('published by DAW Books');
    }

    // Known DAW author
    if (DAW_AUTHORS.has(author) || [...DAW_AUTHORS].some(a => author.includes(a.split(' ')[0]) && a.length > 3)) {
        score += 0.25;
        reasons.push('known DAW author');
    }

    // Notes contain DAW spine code (UE/UW/UQ/UJ/UO followed by digits)
    if (/\b(ue|uw|uq|uj|uo)\d{4}/i.test(notes)) {
        score += 0.45;
        reasons.push('DAW spine code in notes');
    }

    // DAW Book Collectors number in notes
    if (/daw\s*(book)?\s*(collector[s']?\s*)?#?\d+/i.test(notes)) {
        score += 0.40;
        reasons.push('DAW Collectors number in notes');
    }

    // Keyword hits
    const text   = `${title} ${notes}`;
    const kwHits = DAW_KEYWORDS.filter(kw => text.includes(kw));
    if (kwHits.length > 0) {
        score += Math.min(0.25, kwHits.length * 0.10);
        reasons.push(`keywords: ${kwHits.slice(0, 2).join(', ')}`);
    }

    // Category
    if (DAW_CATEGORIES.has(category)) {
        score += 0.05;
    }

    // Era: DAW founded 1972; yellow-spine era 1972–c.1986
    if (item.year) {
        if (item.year >= 1972 && item.year <= 1990) { score += 0.05; }
    }

    score = Math.max(0, Math.min(1, score));
    if (score < 0.20) return { recognized: false, confidence: score };

    return {
        recognized:  true,
        confidence:  score,
        explanation: reasons.join('; '),
    };
}
