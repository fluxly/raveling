import type { ItemFields, QuidMatch } from '../../interface';
import { searchQuiddityItems } from '../../../app/src/db/index';
import { KNOWN_TITLES } from '../reference/seed';

export async function match(item: ItemFields): Promise<QuidMatch[]> {
    const title  = (item.title  ?? '').toLowerCase().trim();
    const author = (item.author ?? '').toLowerCase().trim();

    // Exact title match
    const exact = KNOWN_TITLES.get(title);
    if (exact) {
        const fields: Partial<ItemFields> = {
            title:     exact.canonical_name,
            author:    exact.author,
            publisher: 'DAW Books',
            year:      exact.year,
            category:  'science fiction',
        };
        const explanation = [
            `DAW Books title: "${exact.canonical_name}" by ${exact.author} (${exact.year}).`,
            exact.daw_code ? `Spine code: ${exact.daw_code}.` : '',
            exact.daw_number ? `DAW Collectors #${exact.daw_number}.` : '',
        ].filter(Boolean).join(' ');

        return [{ qid: exact.qid, confidence: 0.95, explanation, fields, mentions: [] }];
    }

    // DB fuzzy search
    const query = [item.title, item.author].filter(Boolean).join(' ');
    if (!query.trim()) return [];

    const results = await searchQuiddityItems(query, 10);
    const matches: QuidMatch[] = [];

    for (const r of results) {
        const name  = r.canonical_name.toLowerCase();
        const score = _score(title, author, name);
        if (score < 0.30) continue;

        matches.push({
            qid:         r.qid,
            confidence:  score,
            explanation: `DAW SF DB match: "${r.canonical_name}"`,
            fields:      { title: r.canonical_name, publisher: 'DAW Books', category: 'science fiction' },
            mentions:    [],
        });
    }

    return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

function _score(queryTitle: string, queryAuthor: string, candidateName: string): number {
    if (candidateName === queryTitle) return 0.90;
    if (candidateName.includes(queryTitle) || queryTitle.includes(candidateName)) return 0.78;
    const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'in']);
    const qWords = queryTitle.split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
    const cWords = new Set(candidateName.split(/\s+/));
    const hits   = qWords.filter(w => [...cWords].some(c => c.includes(w))).length;
    let score    = (hits / Math.max(qWords.length, 1)) * 0.65;
    if (queryAuthor && candidateName.includes(queryAuthor.split(' ')[1] ?? queryAuthor)) score += 0.15;
    return Math.min(1, score);
}
