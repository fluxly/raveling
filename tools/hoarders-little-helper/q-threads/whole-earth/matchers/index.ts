/**
 * Matcher — searches the Quiddity DB for WEC records that match an inventory item.
 *
 * Strategy:
 *   1. Exact title match  → confidence 0.92
 *   2. Title + author     → confidence 0.85
 *   3. Fuzzy title        → confidence 0.50–0.75 depending on token overlap
 *   4. Author-only        → confidence 0.35
 */

import type { ItemFields } from '../../interface';
import type { QuidMatch }   from '../../interface';
import { searchQuiddityItems, type QuiddityItemRow } from '../../../app/src/db/index';

export async function match(item: ItemFields): Promise<QuidMatch[]> {
    const title    = (item.title    ?? '').trim();
    const author   = (item.author   ?? '').trim();
    const year     = item.year;
    const results: QuidMatch[] = [];
    const seen     = new Set<string>();

    // ── 1. Search by title ────────────────────────────────────────────────────
    if (title) {
        const rows = await searchQuiddityItems(title, 10);
        for (const row of rows) {
            if (seen.has(row.qid)) continue;
            seen.add(row.qid);

            const confidence = _scoreMatch(row, item);
            if (confidence < 0.30) continue;

            results.push(_buildMatch(row, item, confidence));
        }
    }

    // ── 2. Author-only fallback if title search was empty ─────────────────────
    if (results.length === 0 && author) {
        const rows = await searchQuiddityItems(author, 10);
        for (const row of rows) {
            if (seen.has(row.qid)) continue;
            seen.add(row.qid);

            const confidence = _scoreMatch(row, item) * 0.6;
            if (confidence < 0.20) continue;

            results.push(_buildMatch(row, item, confidence));
        }
    }

    return results.sort((a, b) => b.confidence - a.confidence);
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function _scoreMatch(row: QuiddityItemRow, item: ItemFields): number {
    const dbTitle   = row.canonical_name.toLowerCase();
    const itemTitle = (item.title ?? '').toLowerCase();

    if (!itemTitle) return 0;

    // Exact
    if (dbTitle === itemTitle) return 0.92;

    // Substring
    if (dbTitle.includes(itemTitle) || itemTitle.includes(dbTitle)) return 0.78;

    // Token overlap
    const dbTokens   = new Set(_tokenize(dbTitle));
    const itemTokens = _tokenize(itemTitle);
    const overlap    = itemTokens.filter(t => dbTokens.has(t)).length;
    const maxLen     = Math.max(dbTokens.size, itemTokens.length);
    const tokenScore = maxLen > 0 ? overlap / maxLen : 0;

    return tokenScore * 0.70;
}

function _buildMatch(row: QuiddityItemRow, item: ItemFields, confidence: number): QuidMatch {
    const explanation = _buildExplanation(row, confidence);
    const fields      = _proposeFields(row, item);

    return {
        qid:         row.qid,
        confidence,
        explanation,
        fields,
        mentions:    [],  // populated by importer phase
    };
}

function _buildExplanation(row: QuiddityItemRow, confidence: number): string {
    const pct = Math.round(confidence * 100);
    return `Matches "${row.canonical_name}" (${row.qid}) with ${pct}% confidence — Whole Earth Catalog item`;
}

function _proposeFields(row: QuiddityItemRow, item: ItemFields): Partial<ItemFields> {
    const proposed: Partial<ItemFields> = {};

    if (!item.title  && row.canonical_name) proposed.title     = row.canonical_name;
    if (!item.notes  && row.description)    proposed.notes     = row.description;

    return proposed;
}

function _tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2 && !STOP_WORDS.has(t));
}

const STOP_WORDS = new Set([
    'the', 'and', 'for', 'with', 'that', 'this', 'from', 'how', 'its',
    'into', 'over', 'your', 'our', 'their', 'has', 'been', 'are', 'was',
    'not', 'all', 'one', 'can', 'will', 'more', 'about', 'also',
]);
