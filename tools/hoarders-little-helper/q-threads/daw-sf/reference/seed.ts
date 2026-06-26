/**
 * Seed data for the DAW Science Fiction Q-Thread.
 *
 * DAW Books was founded in 1971 by Donald A. Wollheim (former Ace Books editor)
 * with his wife Elsie and daughter Betsy Wollheim. The first DAW title shipped
 * in 1972. DAW pioneered the mass-market SF paperback and was the debut publisher
 * for many major genre authors.
 *
 * Collector markers:
 *   - Spine number: UE (75¢–$2.95 era), later UW, UJ, UO prefixes
 *   - DAW Book Collectors number on copyright page
 *   - Yellow spine (early era, 1972–c.1986)
 *   - "DAW BOOKS, INC." publisher credit
 *   - First printing: "First DAW Printing, Month Year"
 *
 * This seed covers the most collectible/significant early DAW titles.
 */

export interface DawSeedItem {
    qid:            string;
    type:           'book';
    canonical_name: string;
    subtitle?:      string;
    author:         string;
    publisher:      string;
    year:           number;
    daw_number?:    number;   // DAW Book Collectors number
    daw_code?:      string;   // spine code, e.g. "UE1101"
    series?:        string;
    series_number?: number;
    tags:           string[];
    description:    string;
    condition_notes?: string;
}

export const SEED_ITEMS: DawSeedItem[] = [

    // ── Andre Norton (prolific DAW author, DAW's cornerstone) ─────────────────

    {
        qid:            'QID-B-002001',
        type:           'book',
        canonical_name: 'Spell of the Witch World',
        author:         'Andre Norton',
        publisher:      'DAW Books',
        year:           1972,
        daw_number:     1,
        daw_code:       'UE1101',
        tags:           ['daw books', 'andre norton', 'witch world', 'science fantasy', 'first daw book'],
        description:    'The first book ever published by DAW Books. Three Witch World novellas. A landmark in DAW history and highly sought by collectors of both Norton and DAW firsts.',
        condition_notes: 'First DAW book (collectors #1). Fine/VG+: $40–$120. Must have unclipped spine and tight binding.',
    },
    {
        qid:            'QID-B-002002',
        type:           'book',
        canonical_name: 'Here Abide Monsters',
        author:         'Andre Norton',
        publisher:      'DAW Books',
        year:           1973,
        daw_number:     22,
        daw_code:       'UQ1049',
        tags:           ['daw books', 'andre norton', 'science fantasy'],
        description:    'Norton\'s story of people trapped in a parallel dimension of Arthurian legend. Early DAW quarter number.',
    },

    // ── C.J. Cherryh (DAW debut author, multiple Hugo wins) ───────────────────

    {
        qid:            'QID-B-002003',
        type:           'book',
        canonical_name: 'Gate of Ivrel',
        subtitle:       'The Morgaine Saga Book 1',
        author:         'C.J. Cherryh',
        publisher:      'DAW Books',
        year:           1976,
        daw_number:     138,
        daw_code:       'UW1321',
        series:         'Morgaine Saga',
        series_number:  1,
        tags:           ['daw books', 'cj cherryh', 'morgaine', 'science fantasy', 'debut novel'],
        description:    'C.J. Cherryh\'s debut novel. An outsider\'s contract to destroy the Gates haunting his world. Launched one of the most important SF careers of the 1970s–80s.',
        condition_notes: 'First printing (DAW #138, 1976) is the key collector\'s edition. Fine: $25–$75.',
    },
    {
        qid:            'QID-B-002004',
        type:           'book',
        canonical_name: 'Downbelow Station',
        author:         'C.J. Cherryh',
        publisher:      'DAW Books',
        year:           1981,
        daw_number:     440,
        daw_code:       'UE1715',
        series:         'Alliance-Union Universe',
        tags:           ['daw books', 'cj cherryh', 'alliance-union', 'hard sf', 'hugo winner', 'space opera'],
        description:    'Winner of the 1982 Hugo Award for Best Novel. Cherryh\'s most acclaimed work, depicting the political fall of a space station during interstellar war.',
        condition_notes: 'First DAW printing (1981). Hugo winners command collector premium. Fine: $20–$60.',
    },
    {
        qid:            'QID-B-002005',
        type:           'book',
        canonical_name: 'Serpent\'s Reach',
        author:         'C.J. Cherryh',
        publisher:      'DAW Books',
        year:           1980,
        daw_number:     367,
        daw_code:       'UE1529',
        series:         'Alliance-Union Universe',
        tags:           ['daw books', 'cj cherryh', 'alliance-union', 'hard sf'],
        description:    'A woman and the insectoid mri inhabit an isolated star system, until outsiders threaten the balance. One of Cherryh\'s most atmospheric early works.',
    },

    // ── Tanith Lee (debut with DAW) ────────────────────────────────────────────

    {
        qid:            'QID-B-002006',
        type:           'book',
        canonical_name: 'The Birthgrave',
        author:         'Tanith Lee',
        publisher:      'DAW Books',
        year:           1975,
        daw_number:     117,
        daw_code:       'UW1198',
        series:         'Birthgrave Trilogy',
        series_number:  1,
        tags:           ['daw books', 'tanith lee', 'sword and sorcery', 'debut novel', 'feminist fantasy'],
        description:    'Tanith Lee\'s debut novel. An amnesiac goddess awakens in a volcano. Rich, baroque prose. DAW championed Lee when no other publisher would.',
        condition_notes: 'First DAW printing is scarce in Fine condition. VG+: $20–$55, Fine: $40–$90.',
    },
    {
        qid:            'QID-B-002007',
        type:           'book',
        canonical_name: 'Don\'t Bite the Sun',
        author:         'Tanith Lee',
        publisher:      'DAW Books',
        year:           1976,
        daw_number:     150,
        daw_code:       'UW1342',
        series:         'Biting the Sun',
        series_number:  1,
        tags:           ['daw books', 'tanith lee', 'science fiction', 'hedonist future', 'feminist sf'],
        description:    'Set in a far-future city of pleasure-seeking immortals. Companion volume: Drinking Sapphire Wine. Often bound together in later omnibus editions.',
    },
    {
        qid:            'QID-B-002008',
        type:           'book',
        canonical_name: 'Night\'s Master',
        subtitle:       'Tales from the Flat Earth, Book 1',
        author:         'Tanith Lee',
        publisher:      'DAW Books',
        year:           1978,
        daw_number:     281,
        daw_code:       'UW1404',
        series:         'Tales from the Flat Earth',
        series_number:  1,
        tags:           ['daw books', 'tanith lee', 'flat earth', 'fantasy', 'arabian nights', 'lord of darkness'],
        description:    'The first in Lee\'s five-volume Flat Earth series, in the tradition of the Arabian Nights. Ozmo, the Lord of Darkness Below the Earth, schemes and loves across generations.',
        condition_notes: 'Most collectible of the Flat Earth series. Fine first: $25–$70.',
    },

    // ── Michael Moorcock ──────────────────────────────────────────────────────

    {
        qid:            'QID-B-002009',
        type:           'book',
        canonical_name: 'Elric of Melniboné',
        author:         'Michael Moorcock',
        publisher:      'DAW Books',
        year:           1976,
        daw_number:     197,
        daw_code:       'UW1356',
        series:         'Elric',
        series_number:  1,
        tags:           ['daw books', 'michael moorcock', 'elric', 'sword and sorcery', 'eternal champion', 'multiverse'],
        description:    'The DAW first edition of the Elric saga\'s "proper" beginning (chronologically). The albino emperor of a dying empire wields the soul-drinking sword Stormbringer.',
        condition_notes: 'DAW firsts of the Moorcock titles are common but condition-sensitive. Fine: $15–$40.',
    },
    {
        qid:            'QID-B-002010',
        type:           'book',
        canonical_name: 'The Eternal Champion',
        author:         'Michael Moorcock',
        publisher:      'DAW Books',
        year:           1970,
        tags:           ['daw books', 'michael moorcock', 'eternal champion', 'multiverse', 'science fantasy'],
        description:    'The ur-text of Moorcock\'s Multiverse — John Daker awakens as the Eternal Champion across all incarnations. DAW collected and repackaged Moorcock\'s work throughout the 1970s.',
    },

    // ── Jack Vance ────────────────────────────────────────────────────────────

    {
        qid:            'QID-B-002011',
        type:           'book',
        canonical_name: 'The Face',
        subtitle:       'Demon Princes, Book 4',
        author:         'Jack Vance',
        publisher:      'DAW Books',
        year:           1979,
        daw_number:     321,
        daw_code:       'UE1498',
        series:         'Demon Princes',
        series_number:  4,
        tags:           ['daw books', 'jack vance', 'demon princes', 'science fiction', 'revenge narrative', 'vance prose'],
        description:    'Fourth in Vance\'s five-volume revenge saga. Kirth Gersen pursues Lens Larque across the desolate Kotzash. Vance\'s prose at its most lapidary.',
    },
    {
        qid:            'QID-B-002012',
        type:           'book',
        canonical_name: 'The Book of Dreams',
        subtitle:       'Demon Princes, Book 5',
        author:         'Jack Vance',
        publisher:      'DAW Books',
        year:           1981,
        daw_number:     432,
        daw_code:       'UE1698',
        series:         'Demon Princes',
        series_number:  5,
        tags:           ['daw books', 'jack vance', 'demon princes', 'science fiction', 'series conclusion'],
        description:    'The conclusion of the Demon Princes saga. Kirth Gersen confronts Howard Alan Treesong. One of the most satisfying revenge narratives in SF.',
        condition_notes: 'Complete Demon Princes set in matching condition commands a premium. Individual volumes: $8–$25.',
    },

    // ── Donald A. Wollheim anthologies ─────────────────────────────────────────

    {
        qid:            'QID-B-002013',
        type:           'book',
        canonical_name: 'The DAW Science Fiction Reader',
        author:         'Donald A. Wollheim',
        publisher:      'DAW Books',
        year:           1976,
        daw_number:     163,
        daw_code:       'UW1345',
        tags:           ['daw books', 'donald wollheim', 'anthology', 'science fiction', 'daw history'],
        description:    'Wollheim\'s own retrospective anthology of DAW\'s first years. A snapshot of the house\'s founding vision and its authors.',
    },
    {
        qid:            'QID-B-002014',
        type:           'book',
        canonical_name: 'The 1972 Annual World\'s Best SF',
        author:         'Donald A. Wollheim',
        publisher:      'DAW Books',
        year:           1972,
        daw_number:     6,
        daw_code:       'UQ1005',
        series:         'Annual World\'s Best SF',
        series_number:  1,
        tags:           ['daw books', 'donald wollheim', 'best of', 'anthology', 'year\'s best sf'],
        description:    'The first in DAW\'s long-running Year\'s Best SF series, edited by Wollheim. Collecting the best short fiction of 1971. Early issue with UQ (quarter) prefix.',
        condition_notes: 'First DAW annual. Fine copies: $15–$45. Later annuals: $3–$10.',
    },

    // ── Marion Zimmer Bradley ──────────────────────────────────────────────────

    {
        qid:            'QID-B-002015',
        type:           'book',
        canonical_name: 'The Shattered Chain',
        subtitle:       'A Darkover Novel',
        author:         'Marion Zimmer Bradley',
        publisher:      'DAW Books',
        year:           1976,
        daw_number:     191,
        daw_code:       'UW1327',
        series:         'Darkover',
        tags:           ['daw books', 'marion zimmer bradley', 'darkover', 'science fantasy', 'feminist sf'],
        description:    'One of the key Darkover novels — the Free Amazons of Darkover and a woman rescued from a chieri lord. MZB published extensively with DAW across the 1970s–80s.',
    },

    // ── M.A.R. Barker (Tékumel) ───────────────────────────────────────────────

    {
        qid:            'QID-B-002016',
        type:           'book',
        canonical_name: 'Man of Gold',
        subtitle:       'A Novel of Tékumel',
        author:         'M.A.R. Barker',
        publisher:      'DAW Books',
        year:           1984,
        daw_number:     581,
        daw_code:       'UE1940',
        tags:           ['daw books', 'mar barker', 'tekumel', 'empire of the petal throne', 'constructed world', 'rpg'],
        description:    'The first novel set in Tékumel, Barker\'s extraordinarily detailed constructed world (predating Tolkien in development). Mridotl the necromancer seeks the Man of Gold. Beloved by world-building enthusiasts.',
        condition_notes: 'Scarce in Fine. VG+: $20–$50, Fine: $35–$80.',
    },

    // ── Early numbers / yellow-spine era ──────────────────────────────────────

    {
        qid:            'QID-B-002017',
        type:           'book',
        canonical_name: 'Hunters of Gor',
        subtitle:       'Gor Series, Book 8',
        author:         'John Norman',
        publisher:      'DAW Books',
        year:           1974,
        daw_number:     81,
        daw_code:       'UW1102',
        series:         'Gor',
        series_number:  8,
        tags:           ['daw books', 'john norman', 'gor', 'sword and planet', 'controversial sf'],
        description:    'DAW published the Gor series from book 7 onward. Controversial for its content; culturally significant for the Gor subculture. Low collector value but historically notable.',
    },
    {
        qid:            'QID-B-002018',
        type:           'book',
        canonical_name: 'Courtship Rite',
        author:         'Donald Kingsbury',
        publisher:      'DAW Books',
        year:           1982,
        daw_number:     468,
        daw_code:       'UE1764',
        tags:           ['daw books', 'donald kingsbury', 'science fiction', 'hard sf', 'anthropology sf', 'hugo nominee'],
        description:    'Hugo Award nominee. A deeply realized alien society on a resource-scarce world faces reproductive crisis. One of DAW\'s most underrated publications.',
        condition_notes: 'Undervalued but scarce in Fine. First printing: $15–$40.',
    },
    {
        qid:            'QID-B-002019',
        type:           'book',
        canonical_name: 'The Inheritor',
        author:         'Marion Zimmer Bradley',
        publisher:      'DAW Books',
        year:           1984,
        daw_number:     576,
        daw_code:       'UE1928',
        tags:           ['daw books', 'marion zimmer bradley', 'occult', 'paranormal'],
        description:    'Non-Darkover MZB. A pianist inherits a house haunted by a musical ghost. Bradley\'s occult fiction for DAW.',
    },
    {
        qid:            'QID-B-002020',
        type:           'book',
        canonical_name: 'The Anubis Murders',
        author:         'Gary Gygax',
        publisher:      'DAW Books',
        year:           1992,
        daw_number:     862,
        tags:           ['daw books', 'gary gygax', 'fantasy mystery', 'dungeons and dragons', 'rpg author'],
        description:    'D&D co-creator Gary Gygax\'s Magister Setne Inhetep mystery series. Historically notable for Gygax\'s association with the RPG hobby.',
    },
];

// ── Derived lookup structures ──────────────────────────────────────────────────

export const KNOWN_TITLES = new Map<string, DawSeedItem>(
    SEED_ITEMS.map(s => [s.canonical_name.toLowerCase(), s])
);

export const DAW_AUTHORS = new Set(
    SEED_ITEMS.map(s => s.author.toLowerCase())
);

export const DAW_KEYWORDS = [
    'daw books', 'daw sf', 'donald wollheim', 'betsy wollheim', 'science fiction',
    'science fantasy', 'sword and sorcery', 'witch world', 'darkover', 'elric',
    'demon princes', 'flat earth', 'morgaine', 'alliance-union', 'eternal champion',
    'multiverse', 'tekumel', 'petal throne', 'gor', 'yellow spine',
    'ue1', 'uw1', 'uq1',   // DAW spine codes as text
];

export const DAW_CATEGORIES = new Set([
    'science fiction', 'fantasy', 'science fantasy', 'sf', 'speculative fiction',
    'sword and sorcery', 'space opera',
]);

export const ALL_TAGS = new Set(SEED_ITEMS.flatMap(s => s.tags));
