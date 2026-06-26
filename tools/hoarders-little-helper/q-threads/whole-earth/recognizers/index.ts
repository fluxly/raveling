/**
 * Recognizer — decides if an inventory item belongs to the Whole Earth domain.
 *
 * Returns a confidence 0–1. 0.0 means definitely not WEC. 1.0 means dead
 * certainty (e.g. exact QID in the catalog). In practice we return 0.3–0.9.
 */

import type { ItemFields } from '../../interface';
import type { RecognitionResult } from '../../interface';
import { KNOWN_AUTHORS, KNOWN_TITLES, WEC_KEYWORDS, WEC_CATEGORIES } from '../reference/seed';

export function recognize(item: ItemFields): RecognitionResult {
    const title     = (item.title     ?? '').toLowerCase();
    const author    = (item.author    ?? '').toLowerCase();
    const category  = (item.category  ?? '').toLowerCase();
    const notes     = (item.notes     ?? '').toLowerCase();
    const publisher = (item.publisher ?? '').toLowerCase();
    const year      = item.year ?? null;

    let score       = 0;
    const reasons: string[] = [];

    // ── Exact title match ─────────────────────────────────────────────────────
    if (KNOWN_TITLES.has(title)) {
        return {
            recognized:  true,
            confidence:  0.95,
            type:        KNOWN_TITLES.get(title)!.type,
            explanation: `"${item.title}" is a known Whole Earth Catalog item.`,
        };
    }

    // ── Known author ──────────────────────────────────────────────────────────
    const authorMatch = KNOWN_AUTHORS.has(author) || [...KNOWN_AUTHORS].some(a => author.includes(a));
    if (authorMatch) { score += 0.35; reasons.push('known WEC author'); }

    // ── WEC keyword in title, notes, or publisher ──────────────────────────────
    const combinedText = `${title} ${notes} ${publisher}`;
    const keywordHits  = WEC_KEYWORDS.filter(kw => combinedText.includes(kw));
    if (keywordHits.length > 0) {
        score += Math.min(0.30, keywordHits.length * 0.10);
        reasons.push(`WEC keyword(s): ${keywordHits.slice(0, 3).join(', ')}`);
    }

    // ── Category heuristic ────────────────────────────────────────────────────
    if (WEC_CATEGORIES.has(category)) {
        score += 0.10;
        reasons.push(`category "${category}" fits WEC domain`);
    }

    // ── Date heuristic — WEC covered items mostly 1960–1985 ───────────────────
    if (year !== null) {
        if (year >= 1960 && year <= 1985) {
            score += 0.10;
            reasons.push(`publication year ${year} in WEC era (1960–1985)`);
        } else if (year < 1960 || year > 1995) {
            // Very unlikely to be in WEC
            score -= 0.15;
        }
    }

    // ── Publisher heuristic ────────────────────────────────────────────────────
    const wecPublishers = ['portola institute', 'shelter publications', 'john muir publications',
        'point foundation', 'random house', 'pantheon'];
    if (wecPublishers.some(p => publisher.includes(p))) {
        score += 0.15;
        reasons.push('publisher associated with WEC');
    }

    score = Math.max(0, Math.min(1, score));

    if (score < 0.20) {
        return { recognized: false, confidence: score };
    }

    return {
        recognized:  true,
        confidence:  score,
        type:        WEC_CATEGORIES.has(category) ? category : undefined,
        explanation: reasons.join('; '),
    };
}
