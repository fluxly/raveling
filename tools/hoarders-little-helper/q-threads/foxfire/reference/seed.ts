/**
 * Seed data for the Foxfire Q-Thread.
 *
 * The Foxfire series (1972–2004) documents Appalachian folk skills and crafts
 * gathered by high school students in Rabun County, Georgia under teacher
 * Eliot Wigginton. Published by Anchor Press/Doubleday and later Anchor Books.
 *
 * Also includes key companion volumes in the folk-skills tradition.
 */

export interface FoxfireSeedItem {
    qid:            string;
    type:           'book';
    canonical_name: string;
    subtitle?:      string;
    author:         string;
    publisher:      string;
    year:           number;
    isbn?:          string;
    series?:        string;
    series_number?: number;
    tags:           string[];
    description:    string;
    condition_notes?: string;
}

export const SEED_ITEMS: FoxfireSeedItem[] = [
    {
        qid:            'QID-B-001001',
        type:           'book',
        canonical_name: 'The Foxfire Book',
        subtitle:       'Hog Dressing, Log Cabin Building, Mountain Crafts and Foods, Planting by the Signs, Snake Lore, Hunting Tales, Faith Healing, Moonshining, and Other Affairs of Plain Living',
        author:         'Eliot Wigginton',
        publisher:      'Anchor Press',
        year:           1972,
        isbn:           '9780385073530',
        series:         'Foxfire',
        series_number:  1,
        tags:           ['foxfire', 'appalachian', 'folk craft', 'homesteading', 'traditional skills', 'moonshining', 'log cabin'],
        description:    'The first and most collectible Foxfire volume. Documented Appalachian folk skills including log cabin building, hog butchering, moonshine distilling, and mountain crafts. The hardcover first edition is the most sought after.',
        condition_notes: 'First edition hardcover (Anchor Press, 1972) in Fine/VG: $30–$120. Later printings: $5–$20 depending on condition.',
    },
    {
        qid:            'QID-B-001002',
        type:           'book',
        canonical_name: 'Foxfire 2',
        subtitle:       'Ghost Stories, Spring Wild Plant Foods, Spinning and Weaving, Midwifing, Burial Customs, Corn Shuckin\'s, Wagon Making, and More Affairs of Plain Living',
        author:         'Eliot Wigginton',
        publisher:      'Anchor Press',
        year:           1973,
        isbn:           '9780385024334',
        series:         'Foxfire',
        series_number:  2,
        tags:           ['foxfire', 'appalachian', 'folk craft', 'spinning', 'weaving', 'ghost stories', 'traditional skills'],
        description:    'The second volume covers ghost stories, wild plant foraging, spinning and weaving, midwifery, and more Appalachian traditions.',
        condition_notes: 'First printing in Fine: $15–$50. Good reading copies: $3–$10.',
    },
    {
        qid:            'QID-B-001003',
        type:           'book',
        canonical_name: 'Foxfire 3',
        subtitle:       'Animal Care, Banjos and Dulcimers, Hide Tanning, Summer and Fall Wild Plant Foods, Book Accounts, Lidded Baskets and More Affairs of Plain Living',
        author:         'Eliot Wigginton',
        publisher:      'Anchor Press',
        year:           1975,
        isbn:           '9780385005715',
        series:         'Foxfire',
        series_number:  3,
        tags:           ['foxfire', 'appalachian', 'banjo', 'dulcimer', 'basketry', 'hide tanning', 'traditional skills'],
        description:    'Covers instrument making (banjos and dulcimers), basketry, hide tanning, and animal husbandry. The instrument-making sections are particularly well-regarded.',
    },
    {
        qid:            'QID-B-001004',
        type:           'book',
        canonical_name: 'Foxfire 4',
        subtitle:       'Water Systems, Fiddle Making, Logging, Gardening, Sassafras Tea, Wood Carving and Other Affairs of Just Plain Living',
        author:         'Eliot Wigginton',
        publisher:      'Anchor Press',
        year:           1977,
        isbn:           '9780385122627',
        series:         'Foxfire',
        series_number:  4,
        tags:           ['foxfire', 'appalachian', 'fiddle making', 'wood carving', 'logging', 'traditional skills'],
        description:    'Fiddle making, water systems, logging, and wood carving. Highly valued by folk musicians for the fiddle-making content.',
    },
    {
        qid:            'QID-B-001005',
        type:           'book',
        canonical_name: 'Foxfire 5',
        subtitle:       'Ironmaking, Blacksmithing, Flintlock Rifles, Bear Hunting and Other Affairs of Plain Living',
        author:         'Eliot Wigginton',
        publisher:      'Anchor Press',
        year:           1979,
        isbn:           '9780385151252',
        series:         'Foxfire',
        series_number:  5,
        tags:           ['foxfire', 'appalachian', 'blacksmithing', 'ironwork', 'flintlock', 'traditional skills'],
        description:    'Ironmaking and blacksmithing, flintlock rifle construction, and bear hunting traditions. Popular with craftspeople and living history enthusiasts.',
    },
    {
        qid:            'QID-B-001006',
        type:           'book',
        canonical_name: 'Foxfire 6',
        subtitle:       'Shoemaking, 100 Toys and Games, Gourd Banjos and Songbows, Our Belief, and Other Affairs of Just Plain Living',
        author:         'Eliot Wigginton',
        publisher:      'Anchor Press',
        year:           1980,
        isbn:           '9780385153270',
        series:         'Foxfire',
        series_number:  6,
        tags:           ['foxfire', 'appalachian', 'shoemaking', 'toys', 'folk music', 'traditional skills'],
        description:    'Shoemaking, traditional toys and games, gourd instruments, and Appalachian religious traditions.',
    },
    {
        qid:            'QID-B-001007',
        type:           'book',
        canonical_name: 'Foxfire 7',
        subtitle:       'Ministers, Church Members Discuss Baptism, Communion, Snake Handling, Singing, Dancing, Faith Healing, Avoidance, the Holiness Church, and Other Beliefs and Practices',
        author:         'Eliot Wigginton',
        publisher:      'Anchor Press',
        year:           1982,
        isbn:           '9780385174251',
        series:         'Foxfire',
        series_number:  7,
        tags:           ['foxfire', 'appalachian', 'religion', 'snake handling', 'faith healing', 'holiness church'],
        description:    'A deep dive into Appalachian religious traditions including Holiness churches, snake handling, and faith healing. Less practical-skills content, more cultural documentation.',
    },
    {
        qid:            'QID-B-001008',
        type:           'book',
        canonical_name: 'Foxfire 8',
        subtitle:       'Southern Folk Pottery from Pug Mills, Ash Glaze, and Groundhog Kilns to Face Jugs, Melon Bowls, and Roosters',
        author:         'Eliot Wigginton',
        publisher:      'Anchor Books',
        year:           1984,
        isbn:           '9780385180740',
        series:         'Foxfire',
        series_number:  8,
        tags:           ['foxfire', 'appalachian', 'pottery', 'folk pottery', 'face jugs', 'traditional skills'],
        description:    'Entirely devoted to Southern folk pottery — pug mills, ash glazes, groundhog kilns, and the famous face jug tradition. Essential reference for collectors of Appalachian pottery.',
        condition_notes: 'Higher demand from pottery collectors. VG+ copies: $15–$40.',
    },
    {
        qid:            'QID-B-001009',
        type:           'book',
        canonical_name: 'Foxfire 9',
        subtitle:       'General Stores, the Jud Nelson Wagon, a Praying Rock, a Catawba Indian Potter, Haint Tales, Quilting, Snake Canes, Wagon Roads, and Other Affairs of Plain Living',
        author:         'Eliot Wigginton',
        publisher:      'Anchor Books',
        year:           1986,
        isbn:           '9780385243087',
        series:         'Foxfire',
        series_number:  9,
        tags:           ['foxfire', 'appalachian', 'quilting', 'general stores', 'traditional skills', 'folk tales'],
        description:    'General stores, quilting, Catawba Indian pottery, and ghost tales. The quilting section is particularly useful.',
    },
    {
        qid:            'QID-B-001010',
        type:           'book',
        canonical_name: 'Foxfire 10',
        subtitle:       'Railroad Lore, Boardinghouses, Depression-era Appalachia, Chair Making, Whittling, and Snake Cane Carving',
        author:         'Eliot Wigginton',
        publisher:      'Anchor Books',
        year:           1993,
        isbn:           '9780385468077',
        series:         'Foxfire',
        series_number:  10,
        tags:           ['foxfire', 'appalachian', 'chair making', 'whittling', 'railroad', 'depression era'],
        description:    'Covers railroad history, Depression-era life, chair making, and wood carving. Later volumes are less scarce.',
    },
    {
        qid:            'QID-B-001011',
        type:           'book',
        canonical_name: 'Foxfire 11',
        subtitle:       'The Old Home Place, Wild Plant Uses, Preserving and Cooking Food, Sorghum, and Moonshine',
        author:         'Foxfire Fund',
        publisher:      'Anchor Books',
        year:           1999,
        isbn:           '9780385468084',
        series:         'Foxfire',
        series_number:  11,
        tags:           ['foxfire', 'appalachian', 'preserving food', 'moonshine', 'sorghum', 'wild plants'],
        description:    'Wild plant uses, food preservation, sorghum making, and moonshine. One of the later volumes compiled by the Foxfire Fund.',
    },
    {
        qid:            'QID-B-001012',
        type:           'book',
        canonical_name: 'Foxfire 12',
        subtitle:       'War Stories, Cherokee Traditions, Summer and Fall Wild Plant Foods, and Beekeeping',
        author:         'Foxfire Fund',
        publisher:      'Anchor Books',
        year:           2004,
        series:         'Foxfire',
        series_number:  12,
        tags:           ['foxfire', 'appalachian', 'cherokee', 'beekeeping', 'world war ii', 'wild plants'],
        description:    'World War II memories, Cherokee traditions, beekeeping, and plant foraging.',
    },

    // ── Companion volumes in the Appalachian folk tradition ────────────────────

    {
        qid:            'QID-B-001013',
        type:           'book',
        canonical_name: 'Possum Living',
        subtitle:       'How to Live Well Without a Job and with (Almost) No Money',
        author:         'Dolly Freed',
        publisher:      'Universe Books',
        year:           1978,
        isbn:           '9780876637913',
        tags:           ['homesteading', 'self-sufficiency', 'frugality', 'appalachian', 'counterculture'],
        description:    'Eighteen-year-old Dolly Freed and her father lived for years on less than $700 annually outside Philadelphia, raising animals and brewing their own liquor. A Foxfire-adjacent cult classic.',
        condition_notes: 'Original 1978 Universe Books edition is genuinely scarce. Fine copies: $60–$150. Reprinted by Tin House Books in 2010 ($10–$20).',
    },
    {
        qid:            'QID-B-001014',
        type:           'book',
        canonical_name: 'Memories of a Mountain Shortline',
        author:         'Andrew Sparks',
        publisher:      'Cherokee Publishing',
        year:           1976,
        tags:           ['appalachian', 'railroad', 'georgia', 'mountain culture'],
        description:    'Documentation of the Tallulah Falls Railway in northeast Georgia, the region Foxfire documented.',
    },
    {
        qid:            'QID-B-001015',
        type:           'book',
        canonical_name: 'Blue Ridge Folklife',
        author:         'Ted Olson',
        publisher:      'University Press of Mississippi',
        year:           1998,
        tags:           ['appalachian', 'folk culture', 'blue ridge', 'traditional skills'],
        description:    'Academic survey of Blue Ridge Mountain folk traditions — music, crafts, foodways, and religious practice.',
    },
];

// ── Derived lookup structures ──────────────────────────────────────────────────

export const KNOWN_TITLES = new Map<string, FoxfireSeedItem>(
    SEED_ITEMS.map(s => [s.canonical_name.toLowerCase(), s])
);

export const FOXFIRE_KEYWORDS = [
    'foxfire', 'appalachian', 'rabun county', 'eliot wigginton', 'folk craft',
    'homesteading', 'moonshine', 'log cabin', 'mountain craft', 'traditional skills',
    'blue ridge', 'smoky mountains', 'appalachia', 'folk art', 'dulcimer', 'banjo',
    'blacksmithing', 'quilting', 'canning', 'preserving', 'self-sufficiency',
    'back to the land', 'hand tool', 'vernacular', 'possum living', 'folk pottery',
];

export const FOXFIRE_AUTHORS = new Set([
    'eliot wigginton', 'wigginton', 'foxfire fund', 'dolly freed',
]);

export const FOXFIRE_CATEGORIES = new Set([
    'folk craft', 'appalachian', 'homesteading', 'crafts', 'self-sufficiency',
    'traditional skills', 'rural life', 'heritage', 'folk art',
]);

export const ALL_TAGS = new Set(
    SEED_ITEMS.flatMap(s => s.tags)
);
