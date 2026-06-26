/**
 * Seed data for the Whole Earth Q-Thread.
 *
 * These are real objects reviewed across the Whole Earth Catalog family
 * (Fall 1968 through The Essential Whole Earth Catalog 1986).
 * Data drawn from publicly documented catalog reviews.
 *
 * Categories mirror WEC's own sections:
 *   whole-systems · shelter · craft · communications · community
 *   nomadics · learning · food · environment · tools
 */

export interface SeedItem {
    qid:           string;
    type:          'book' | 'tool' | 'magazine' | 'record' | 'film';
    canonical_name: string;
    subtitle?:      string;
    author?:        string;
    publisher?:     string;
    year?:          number;
    edition?:       string;
    isbn?:          string;
    wec_section:    string;
    wec_issues:     string[];   // which catalog issues reviewed it
    tags:           string[];
    description?:   string;
    condition_notes?: string;   // valuation guidance per condition
}

export const SEED_ITEMS: SeedItem[] = [

    // ── Whole Earth publications themselves ────────────────────────────────

    {
        qid:            'QID-M-000001',
        type:           'magazine',
        canonical_name: 'Whole Earth Catalog',
        subtitle:       'Fall 1968 — First Edition',
        author:         'Stewart Brand',
        publisher:      'Portola Institute',
        year:           1968,
        wec_section:    'whole-systems',
        wec_issues:     ['fall-1968'],
        tags:           ['whole earth catalog', 'stewart brand', 'counterculture', 'first edition'],
        description:    'The original Fall 1968 Whole Earth Catalog. Self-described as "an evaluation and access device." Established the format: item, image, price, availability, and a review.',
        condition_notes: 'First editions in any condition are rare. Fine/mint copies trade for $200–$600.',
    },
    {
        qid:            'QID-M-000002',
        type:           'magazine',
        canonical_name: 'The Last Whole Earth Catalog',
        subtitle:       'June 1971',
        author:         'Stewart Brand',
        publisher:      'Portola Institute',
        year:           1971,
        wec_section:    'whole-systems',
        wec_issues:     ['last-1971'],
        tags:           ['whole earth catalog', 'stewart brand', 'counterculture'],
        description:    'The most iconic issue. Won the National Book Award in 1972. Over a million copies sold. Large format (11×14"). Heavy.',
        condition_notes: 'Very common in Good/VG. Fine or better is uncommon. $15–$60 depending on condition.',
    },
    {
        qid:            'QID-M-000003',
        type:           'magazine',
        canonical_name: 'The Updated Last Whole Earth Catalog',
        subtitle:       '1974',
        author:         'Stewart Brand',
        publisher:      'Random House',
        year:           1974,
        wec_section:    'whole-systems',
        wec_issues:     ['updated-last-1974'],
        tags:           ['whole earth catalog', 'stewart brand'],
        condition_notes: 'Common. $10–$40 depending on condition.',
    },
    {
        qid:            'QID-M-000004',
        type:           'magazine',
        canonical_name: 'The Essential Whole Earth Catalog',
        subtitle:       'Access to Tools and Ideas',
        author:         'Stewart Brand',
        publisher:      'Doubleday',
        year:           1986,
        wec_section:    'whole-systems',
        wec_issues:     ['essential-1986'],
        tags:           ['whole earth catalog', 'stewart brand', '1980s'],
        condition_notes: 'Easy to find. $10–$30.',
    },

    // ── Whole Systems books ────────────────────────────────────────────────

    {
        qid:            'QID-B-000001',
        type:           'book',
        canonical_name: 'Operating Manual for Spaceship Earth',
        author:         'R. Buckminster Fuller',
        publisher:      'Southern Illinois University Press',
        year:           1969,
        wec_section:    'whole-systems',
        wec_issues:     ['fall-1968', 'last-1971'],
        tags:           ['buckminster fuller', 'systems thinking', 'ecology', 'design'],
        description:    'Fuller\'s most accessible work. The "spaceship earth" metaphor for planetary resource limits.',
        condition_notes: 'Common paperback. First hardcover editions more collectible. $5–$40.',
    },
    {
        qid:            'QID-B-000002',
        type:           'book',
        canonical_name: 'The Whole Earth Epilog',
        subtitle:       'Access to Tools',
        author:         'Stewart Brand',
        publisher:      'Penguin',
        year:           1974,
        wec_section:    'whole-systems',
        wec_issues:     ['epilog-1974'],
        tags:           ['whole earth catalog', 'counterculture'],
        condition_notes: 'Common paperback. $5–$20.',
    },
    {
        qid:            'QID-B-000003',
        type:           'book',
        canonical_name: 'Tools for Conviviality',
        author:         'Ivan Illich',
        publisher:      'Harper & Row',
        year:           1973,
        wec_section:    'whole-systems',
        wec_issues:     ['last-1971', 'updated-last-1974'],
        tags:           ['ivan illich', 'appropriate technology', 'counterculture', 'philosophy'],
        description:    'Illich\'s argument that modern tools have become counterproductive. Major influence on the WEC worldview.',
        condition_notes: 'Paperback editions common. $8–$25.',
    },
    {
        qid:            'QID-B-000004',
        type:           'book',
        canonical_name: 'Small Is Beautiful',
        subtitle:       'Economics as if People Mattered',
        author:         'E.F. Schumacher',
        publisher:      'Blond & Briggs',
        year:           1973,
        wec_section:    'whole-systems',
        wec_issues:     ['updated-last-1974', 'essential-1986'],
        tags:           ['schumacher', 'appropriate technology', 'economics', 'ecology'],
        description:    'The book that put "appropriate technology" into mainstream vocabulary.',
        condition_notes: 'First UK Blond & Briggs edition more sought-after. $10–$60 for firsts.',
    },
    {
        qid:            'QID-B-000005',
        type:           'book',
        canonical_name: 'Design for the Real World',
        subtitle:       'Human Ecology and Social Change',
        author:         'Victor Papanek',
        publisher:      'Pantheon Books',
        year:           1971,
        wec_section:    'whole-systems',
        wec_issues:     ['last-1971', 'updated-last-1974'],
        tags:           ['victor papanek', 'design', 'appropriate technology', 'social design'],
        description:    'Papanek\'s polemic for socially responsible design. First banned by the American designers\' organization.',
        condition_notes: '$10–$35.',
    },

    // ── Shelter ────────────────────────────────────────────────────────────

    {
        qid:            'QID-B-000006',
        type:           'book',
        canonical_name: 'Shelter',
        author:         'Lloyd Kahn',
        publisher:      'Shelter Publications',
        year:           1973,
        wec_section:    'shelter',
        wec_issues:     ['updated-last-1974'],
        tags:           ['lloyd kahn', 'shelter', 'vernacular architecture', 'owner-built'],
        description:    'The definitive survey of human shelter worldwide. Thousands of photographs. Huge format.',
        condition_notes: 'Paperback only. Heavy. Common in Good, VG harder to find. $20–$75.',
    },
    {
        qid:            'QID-B-000007',
        type:           'book',
        canonical_name: 'Domebook Two',
        author:         'Lloyd Kahn',
        publisher:      'Pacific Domes',
        year:           1971,
        wec_section:    'shelter',
        wec_issues:     ['last-1971'],
        tags:           ['lloyd kahn', 'dome', 'geodesic', 'shelter', 'self-build'],
        description:    'Instructions and inspiration for building geodesic domes. Sequel to Domebook One (1970).',
        condition_notes: 'Scarcer than Shelter. Fine copies $30–$90.',
    },
    {
        qid:            'QID-B-000008',
        type:           'book',
        canonical_name: 'Nomadic Furniture',
        author:         'James Hennessey',
        publisher:      'Pantheon Books',
        year:           1973,
        wec_section:    'shelter',
        wec_issues:     ['updated-last-1974'],
        tags:           ['furniture', 'diy', 'nomadic', 'design', 'cardboard furniture'],
        description:    'Designs for portable, disposable, and demountable furniture — much of it cardboard.',
        condition_notes: '$10–$35.',
    },

    // ── Craft & Industry ───────────────────────────────────────────────────

    {
        qid:            'QID-B-000009',
        type:           'book',
        canonical_name: 'How to Keep Your Volkswagen Alive',
        subtitle:       'A Manual of Step-by-Step Procedures for the Compleat Idiot',
        author:         'John Muir',
        publisher:      'John Muir Publications',
        year:           1969,
        wec_section:    'craft',
        wec_issues:     ['fall-1968', 'last-1971', 'updated-last-1974'],
        tags:           ['volkswagen', 'vw', 'beetle', 'repair', 'maintenance', 'counterculture'],
        description:    'One of the most recommended books in the WEC. Warm, funny, and actually useful. Went through many editions.',
        condition_notes: 'Later printings are common and cheap. Earlier printings or first editions are more collectible. $5–$40.',
    },
    {
        qid:            'QID-B-000010',
        type:           'book',
        canonical_name: 'The Foxfire Book',
        subtitle:       'Hog Dressing, Log Cabin Building, Mountain Crafts and Foods...',
        author:         'Eliot Wigginton',
        publisher:      'Doubleday',
        year:           1972,
        wec_section:    'craft',
        wec_issues:     ['updated-last-1974'],
        tags:           ['foxfire', 'appalachia', 'crafts', 'folklore', 'self-sufficiency'],
        description:    'Appalachian crafts and traditions documented by high school students. Spawned a series.',
        condition_notes: 'The first book is most collectible. $10–$40 for fine first edition.',
    },

    // ── Food ──────────────────────────────────────────────────────────────

    {
        qid:            'QID-B-000011',
        type:           'book',
        canonical_name: 'Stalking the Wild Asparagus',
        author:         'Euell Gibbons',
        publisher:      'David McKay Company',
        year:           1962,
        wec_section:    'food',
        wec_issues:     ['fall-1968', 'last-1971'],
        tags:           ['euell gibbons', 'foraging', 'wild food', 'nature'],
        description:    'The original modern foraging guide. Euell Gibbons is the patron saint of wild food.',
        condition_notes: 'First edition (1962) is the collectible one. $15–$60 for firsts in good condition.',
    },
    {
        qid:            'QID-B-000012',
        type:           'book',
        canonical_name: 'Diet for a Small Planet',
        author:         'Frances Moore Lappé',
        publisher:      'Ballantine Books',
        year:           1971,
        wec_section:    'food',
        wec_issues:     ['last-1971', 'updated-last-1974'],
        tags:           ['vegetarian', 'food politics', 'ecology', 'protein combining'],
        description:    'The book that made protein combining a household concept and planted millions of vegetable gardens.',
        condition_notes: 'Common. $5–$20.',
    },

    // ── Nomadics ──────────────────────────────────────────────────────────

    {
        qid:            'QID-B-000013',
        type:           'book',
        canonical_name: 'Mountaineering: The Freedom of the Hills',
        subtitle:       '3rd Edition',
        author:         'The Mountaineers',
        publisher:      'The Mountaineers',
        year:           1974,
        wec_section:    'nomadics',
        wec_issues:     ['updated-last-1974'],
        tags:           ['mountaineering', 'climbing', 'outdoors', 'backpacking'],
        description:    'The definitive guide to mountaineering. Multiple editions, all reviewed in WEC.',
        condition_notes: '$8–$30.',
    },

    // ── Learning ──────────────────────────────────────────────────────────

    {
        qid:            'QID-B-000014',
        type:           'book',
        canonical_name: 'Deschooling Society',
        author:         'Ivan Illich',
        publisher:      'Harper & Row',
        year:           1971,
        wec_section:    'learning',
        wec_issues:     ['last-1971'],
        tags:           ['ivan illich', 'education', 'counterculture', 'unschooling'],
        description:    'Illich\'s argument for dismantling compulsory schooling. Deeply influential in WEC circles.',
        condition_notes: '$8–$25.',
    },
    {
        qid:            'QID-B-000015',
        type:           'book',
        canonical_name: 'Dune',
        author:         'Frank Herbert',
        publisher:      'Chilton Books',
        year:           1965,
        wec_section:    'whole-systems',
        wec_issues:     ['fall-1968'],
        tags:           ['frank herbert', 'science fiction', 'ecology', 'systems thinking', 'first edition'],
        description:    'Stewart Brand reviewed Dune in the first Whole Earth Catalog as essential systems-thinking. A rare SF crossover into the catalog.',
        condition_notes: 'First Chilton hardcover (1965) is highly collectible. $500–$3000+ depending on condition and DJ.',
    },

    // ── Tools ─────────────────────────────────────────────────────────────

    {
        qid:            'QID-T-000001',
        type:           'tool',
        canonical_name: 'Mora Knife',
        subtitle:       'Classic No. 1 / No. 2',
        publisher:      'Mora of Sweden (Frosts Knivfabrik)',
        wec_section:    'craft',
        wec_issues:     ['last-1971', 'updated-last-1974'],
        tags:           ['knife', 'mora', 'sweden', 'craft knife', 'carving', 'laminated steel'],
        description:    'The iconic Swedish carbon steel knife. Recommended throughout WEC for carving, camp work, and general use. Laminated steel with wooden handle.',
        condition_notes: 'These are tools, not artifacts. Used examples in working condition $10–$40. Unused old stock with original wrapper $20–$60.',
    },
    {
        qid:            'QID-T-000002',
        type:           'tool',
        canonical_name: 'Optimus 111B Camp Stove',
        publisher:      'Optimus',
        wec_section:    'nomadics',
        wec_issues:     ['last-1971'],
        tags:           ['camp stove', 'optimus', 'backpacking', 'primus', 'white gas'],
        description:    'The brass-bodied white gas stove that WEC recommended above all others. Self-pressurizing. Swedish made. Extremely durable.',
        condition_notes: 'Works in any condition if functioning. $30–$100 depending on condition and original case.',
    },
    {
        qid:            'QID-T-000003',
        type:           'tool',
        canonical_name: 'Silva Ranger Compass',
        publisher:      'Silva',
        wec_section:    'nomadics',
        wec_issues:     ['last-1971', 'updated-last-1974'],
        tags:           ['compass', 'silva', 'navigation', 'orienteering', 'backpacking'],
        description:    'The liquid-filled baseplate compass. WEC recommended for its accuracy and map-use sightline.',
        condition_notes: '$15–$50 depending on age and condition. Original box adds value.',
    },
];

// ── Lookup maps (built once at module load) ───────────────────────────────────

/** All known WEC author names, lowercased. Used by recognize(). */
export const KNOWN_AUTHORS = new Set(
    SEED_ITEMS
        .filter(i => i.author)
        .map(i => i.author!.toLowerCase())
);

/** All known WEC canonical titles, lowercased. */
export const KNOWN_TITLES = new Map(
    SEED_ITEMS.map(i => [i.canonical_name.toLowerCase(), i])
);

/** All WEC tags flattened into a Set. */
export const ALL_TAGS = new Set(
    SEED_ITEMS.flatMap(i => i.tags)
);

/** WEC subject keywords — used in recognize() to guess domain membership. */
export const WEC_KEYWORDS = [
    'whole earth', 'whole systems', 'buckminster', 'fuller',
    'appropriate technology', 'counterculture', 'ecology', 'geodesic',
    'self-sufficiency', 'homestead', 'commune', 'back to the land',
    'organic', 'nomadic', 'shelter', 'foraging', 'wild food',
    'llano', 'portola', 'stewart brand',
];

/** Categories that WEC typically covered. */
export const WEC_CATEGORIES = new Set([
    'book', 'books', 'tool', 'tools', 'magazine', 'catalog',
    'pamphlet', 'manual', 'guide',
]);
