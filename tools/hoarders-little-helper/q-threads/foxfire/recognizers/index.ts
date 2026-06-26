import type { ItemFields, RecognitionResult } from '../../interface';
import { KNOWN_TITLES, FOXFIRE_AUTHORS, FOXFIRE_KEYWORDS, FOXFIRE_CATEGORIES } from '../reference/seed';

export function recognize(item: ItemFields): RecognitionResult {
    const title    = (item.title    ?? '').toLowerCase();
    const author   = (item.author   ?? '').toLowerCase();
    const category = (item.category ?? '').toLowerCase();
    const notes    = (item.notes    ?? '').toLowerCase();
    const publisher = (item.publisher ?? '').toLowerCase();

    // Exact title match
    if (KNOWN_TITLES.has(title)) {
        const seed = KNOWN_TITLES.get(title)!;
        return {
            recognized:  true,
            confidence:  0.97,
            type:        seed.type,
            explanation: `"${item.title}" is a known Foxfire series title.`,
        };
    }

    // Title starts with "Foxfire"
    if (title.startsWith('foxfire')) {
        return {
            recognized:  true,
            confidence:  0.90,
            type:        'book',
            explanation: `Title begins with "Foxfire" — likely a Foxfire series volume.`,
        };
    }

    let score = 0;
    const reasons: string[] = [];

    // Known Foxfire author
    if (FOXFIRE_AUTHORS.has(author) || [...FOXFIRE_AUTHORS].some(a => author.includes(a))) {
        score += 0.40;
        reasons.push('known Foxfire author');
    }

    // Publisher signals
    const foxfirePublishers = ['anchor press', 'anchor books', 'doubleday', 'foxfire fund', 'universe books'];
    if (foxfirePublishers.some(p => publisher.includes(p))) {
        score += 0.15;
        reasons.push('Foxfire-associated publisher');
    }

    // Keyword hits across title + notes
    const text      = `${title} ${notes}`;
    const kwHits    = FOXFIRE_KEYWORDS.filter(kw => text.includes(kw));
    if (kwHits.length > 0) {
        score += Math.min(0.35, kwHits.length * 0.12);
        reasons.push(`keywords: ${kwHits.slice(0, 3).join(', ')}`);
    }

    // Category
    if (FOXFIRE_CATEGORIES.has(category)) {
        score += 0.10;
        reasons.push(`category "${category}" fits Foxfire domain`);
    }

    // Era: Foxfire series ran 1972–2004
    if (item.year && item.year >= 1970 && item.year <= 2010) {
        score += 0.08;
    }

    score = Math.max(0, Math.min(1, score));
    if (score < 0.20) return { recognized: false, confidence: score };

    return {
        recognized:  true,
        confidence:  score,
        explanation: reasons.join('; '),
    };
}
