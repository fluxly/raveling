import type { ItemFields, QuidMatch } from '../../interface';
import { searchQuiddityItems } from '../../../app/src/db/index';
import { KNOWN_TITLES } from '../reference/seed';

export async function match(item: ItemFields): Promise<QuidMatch[]> {
    const title  = (item.title ?? '').toLowerCase().trim();
    const author = (item.author ?? '').toLowerCase().trim();

    // Exact title match in seed
    const exact = KNOWN_TITLES.get(title);
    if (exact) {
        return [{
            qid:         exact.qid,
            confidence:  0.93,
            explanation: `Exact match: "${exact.canonical_name}" by ${exact.author} (${exact.year}).`,
            fields: {
                title:     exact.canonical_name,
                author:    exact.author,
                publisher: exact.publisher,
                year:      exact.year,
                category:  'folk craft',
            },
            mentions: [],
        }];
    }

    // DB search
    const query   = [item.title, item.author].filter(Boolean).join(' ');
    if (!query.trim()) return [];

    const results = await searchQuiddityItems(query, 10);
    const matches: QuidMatch[] = [];

    for (const r of results) {
        const name  = r.canonical_name.toLowerCase();
        const score = _score(title, author, name);
        if (score < 0.35) continue;

        matches.push({
            qid:         r.qid,
            confidence:  score,
            explanation: `Foxfire DB match: "${r.canonical_name}"`,
            fields: { title: r.canonical_name, category: 'folk craft' },
            mentions: [],
        });
    }

    return matches.sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

function _score(queryTitle: string, queryAuthor: string, candidateName: string): number {
    if (candidateName.includes(queryTitle) || queryTitle.includes(candidateName)) return 0.80;
    const qWords = queryTitle.split(/\s+/).filter(w => w.length > 3);
    const cWords = candidateName.split(/\s+/);
    const hits   = qWords.filter(w => cWords.some(c => c.includes(w))).length;
    let score    = hits / Math.max(qWords.length, 1) * 0.70;
    if (queryAuthor && candidateName.includes(queryAuthor)) score += 0.15;
    return Math.min(1, score);
}
