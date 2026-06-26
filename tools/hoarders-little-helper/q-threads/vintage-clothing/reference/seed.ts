/**
 * Reference data for the Vintage Clothing Q-Thread.
 *
 * This thread dates American vintage garments by construction markers rather
 * than matching against specific catalog items. The Quiddity DB holds garment
 * TYPE records (e.g. "Levi's 501 — selvedge era") that inventory items are
 * matched against.
 *
 * Key dating rules:
 *   - Care label law: US federal law (16 CFR Part 423) effective July 3, 1971.
 *     Items with NO care label were almost certainly made before 1972.
 *   - Union labels: ILGWU (International Ladies' Garment Workers' Union) used
 *     from 1900 until the 1995 merger that created UNITE. Label design changed
 *     significantly over the decades.
 *   - Zippers: Talon (formerly Hookless Fastener) 1913–; Conmar 1930s–1960s;
 *     Scovill "Gripper" 1930s–1960s; YKK entered US market ~1963.
 *   - Selvedge (selvedge-edge) denim: Levi's used selvedge through c.1983.
 *   - Levi's red tab: introduced 1936. Capitalized "LEVI'S" tab: post-1971.
 *   - Country of origin: "Made in USA" required on imports 1971+; on all
 *     garments by the Textile Fiber Products Identification Act (1960).
 */

export interface GarmentTypeItem {
    qid:            string;
    type:           'garment';
    canonical_name: string;
    era_start:      number;    // earliest year
    era_end:        number;    // latest year (9999 = ongoing)
    brand?:         string;
    tags:           string[];
    description:    string;
    markers:        string[];  // human-readable dating markers
    condition_notes?: string;
}

export const SEED_ITEMS: GarmentTypeItem[] = [

    // ── Levi's 501 ────────────────────────────────────────────────────────────

    {
        qid:            'QID-G-000001',
        type:           'garment',
        canonical_name: 'Levi\'s 501 — Pre-1955 Selvedge, Cinch Back',
        brand:          'Levi\'s',
        era_start:      1890,
        era_end:        1955,
        tags:           ['levis', '501', 'selvedge', 'cinch back', 'vintage denim', 'pre-war denim', 'denim'],
        description:    'Levi\'s 501 with a cinch strap at the back waist, no belt loops (or early belt loops added later), selvedge denim. Suspender buttons on the waistband. Big E red tab not yet present.',
        markers:        ['cinch strap (back buckle)', 'suspender buttons', 'no care label', 'selvedge denim', 'capital E red tab or no tab', 'Conmar or no-name zipper or button fly'],
        condition_notes: 'Extremely rare. Wearable condition: $500–$5,000+. Deadstock or museum-grade pieces can reach five figures.',
    },
    {
        qid:            'QID-G-000002',
        type:           'garment',
        canonical_name: 'Levi\'s 501 — Big E (1955–1971)',
        brand:          'Levi\'s',
        era_start:      1955,
        era_end:        1971,
        tags:           ['levis', '501', 'big e', 'selvedge', 'vintage denim', '1950s denim', '1960s denim', 'denim'],
        description:    'Levi\'s 501 with the "Big E" red tab (capital E in "LEVI\'S"). Selvedge denim, hidden rivets at the back pockets introduced 1937. No care label (pre-1972). Arcuate (double stitch) on back pockets.',
        markers:        ['Big E tab (capital E)', 'selvedge denim', 'no care label', 'hidden back-pocket rivets', 'single-stitched back pockets', 'Talon or Conmar zipper (if zip-fly)'],
        condition_notes: 'Big E 501 in wearable VG: $150–$600. Fine/deadstock: $800–$3,000+. The most collected vintage denim category.',
    },
    {
        qid:            'QID-G-000003',
        type:           'garment',
        canonical_name: 'Levi\'s 501 — Small e, Post-1971 USA',
        brand:          'Levi\'s',
        era_start:      1971,
        era_end:        1983,
        tags:           ['levis', '501', 'small e', 'selvedge', 'vintage denim', '1970s denim', 'denim', 'made in usa'],
        description:    'Post-1971 Levi\'s with lower-case "e" red tab ("LEVI\'S" with lowercase). Still selvedge denim until c.1983. Care label now present (post-July 1971). American-made.',
        markers:        ['small e tab (lowercase)', 'selvedge denim (until ~1983)', 'care label present', '"Made in USA"', 'YKK or Talon zipper'],
        condition_notes: 'VG: $60–$180. Fine/deadstock: $200–$600. Selvedge examples command higher prices.',
    },

    // ── Lee denim ─────────────────────────────────────────────────────────────

    {
        qid:            'QID-G-000004',
        type:           'garment',
        canonical_name: 'Lee 101B Cowboy Cut — Pre-1960',
        brand:          'Lee',
        era_start:      1944,
        era_end:        1960,
        tags:           ['lee', '101b', 'cowboy cut', 'vintage denim', 'western wear', 'workwear', 'denim'],
        description:    'Lee 101B "Cowboy Cut" jeans, introduced 1944. Selvedge denim, no care label, Lee label sewn inside waistband with the "Lee" name in a distinctive script.',
        markers:        ['Lee script label', 'selvedge denim', 'no care label', 'Scovill Gripper or Conmar zipper', 'storm rider label if jacket', 'union label may be present'],
        condition_notes: 'Pre-1960 Lee 101B: VG $80–$250. Fine: $300–$700.',
    },

    // ── Union labels ──────────────────────────────────────────────────────────

    {
        qid:            'QID-G-000005',
        type:           'garment',
        canonical_name: 'ILGWU Union Label — Script Logo (1959–1974)',
        brand:          'ILGWU',
        era_start:      1959,
        era_end:        1974,
        tags:           ['ilgwu', 'union label', 'union made', 'vintage clothing', 'era marker', 'american made'],
        description:    'The ILGWU (International Ladies\' Garment Workers\' Union) script logo label, used 1959–1974. Red, white, and blue oval with cursive "ILGWU" text. Items with this label are definitively from this era.',
        markers:        ['ILGWU oval label', 'cursive script', 'red/white/blue colors', '"Look for the Union Label"'],
        condition_notes: 'Label itself is an era marker, not a value driver. The garment\'s own category determines price.',
    },
    {
        qid:            'QID-G-000006',
        type:           'garment',
        canonical_name: 'ILGWU Union Label — "Look for the Union Label" (1975–1995)',
        brand:          'ILGWU',
        era_start:      1975,
        era_end:        1995,
        tags:           ['ilgwu', 'union label', 'union made', 'vintage clothing', 'era marker', '1970s', '1980s'],
        description:    'The "Look for the Union Label" ILGWU label (made famous by the 1975 TV jingle). Square/rectangular label with a stylized figure. In use until the 1995 merger forming UNITE.',
        markers:        ['"Look for the Union Label" text', 'stylized sewing figure or geometric logo', 'blue and white label'],
    },

    // ── Zipper era markers ────────────────────────────────────────────────────

    {
        qid:            'QID-G-000007',
        type:           'garment',
        canonical_name: 'Conmar Zipper — Era Marker (1930s–1960s)',
        brand:          'Conmar',
        era_start:      1930,
        era_end:        1965,
        tags:           ['conmar', 'zipper', 'era marker', 'vintage clothing', '1940s', '1950s'],
        description:    'Conmar zipper pull and slider. "CONMAR" stamped on the zipper slider. Indicates garment pre-dates c.1965. Conmar was a major US zipper competitor to Talon.',
        markers:        ['"CONMAR" stamped on slider', 'heavy metal pull tab', 'no YKK branding'],
    },
    {
        qid:            'QID-G-000008',
        type:           'garment',
        canonical_name: 'Talon Zipper — Era Marker (1930s–1970s)',
        brand:          'Talon',
        era_start:      1930,
        era_end:        1975,
        tags:           ['talon', 'zipper', 'era marker', 'vintage clothing'],
        description:    'Talon zipper (formerly Hookless Fastener Company, renamed Talon 1937). "TALON" stamped on slider. Very common in American garments 1937–1975. Talon zippers confirm pre-1980s manufacture.',
        markers:        ['"TALON" on slider', 'slider shape varies by decade', 'no YKK branding'],
    },

    // ── Workwear and chore coats ──────────────────────────────────────────────

    {
        qid:            'QID-G-000009',
        type:           'garment',
        canonical_name: 'Carhartt Duck Chore Coat — Pre-1980 USA Made',
        brand:          'Carhartt',
        era_start:      1940,
        era_end:        1980,
        tags:           ['carhartt', 'chore coat', 'workwear', 'duck canvas', 'american made', 'vintage workwear'],
        description:    'Pre-1980 American-made Carhartt duck canvas chore coat. Earlier labels feature the Carhartt name in a different typeface. No modern bar tacks on pockets. Made in USA with union label.',
        markers:        ['union label (ILGWU or similar)', '"Made in USA"', 'no care label (pre-1972) or early care label', 'older Carhartt label design', 'no bar tacks or metal rivets at pocket stress points'],
        condition_notes: 'Pre-1980 Carhartt in wearable condition: $80–$300. Blanket-lined or denim-lined versions: $150–$450.',
    },
    {
        qid:            'QID-G-000010',
        type:           'garment',
        canonical_name: 'Pendleton Wool Shirt — Pre-1960',
        brand:          'Pendleton',
        era_start:      1924,
        era_end:        1960,
        tags:           ['pendleton', 'wool shirt', 'western wear', 'american made', 'vintage wool', 'blanket shirt'],
        description:    'Pendleton Woolen Mills shirt, pre-1960. Label reads "Pendleton, Portland, Oregon. Guaranteed Virgin Wool." Later labels add fiber content percentages per the Textile Fiber Products Act (1960).',
        markers:        ['no fiber percentage on label (pre-1960)', '"Guaranteed Virgin Wool" wording', 'older Pendleton label design', 'no care label', 'pearl snap or button front'],
        condition_notes: 'Pre-1960 Pendleton in VG: $50–$150. Board shirt / outdoor check patterns: premium. Robe-style: $100–$300.',
    },
];

// ── Derived lookup structures ──────────────────────────────────────────────────

export const KNOWN_TYPES = new Map<string, GarmentTypeItem>(
    SEED_ITEMS.map(s => [s.canonical_name.toLowerCase(), s])
);

// Clothing category keywords that trigger recognition
export const CLOTHING_CATEGORIES = new Set([
    'clothing', 'apparel', 'garment', 'denim', 'jeans', 'jacket', 'coat', 'shirt',
    'dress', 'skirt', 'pants', 'trousers', 'workwear', 'vintage clothing', 'textile',
    'fashion', 'western wear', 'wool', 'chore coat', 'dungarees',
]);

// Marker keywords that strongly suggest a vintage garment
export const VINTAGE_MARKERS = [
    'selvedge', 'selvage', 'big e', 'small e', 'red tab', 'union label', 'ilgwu',
    'acwa', 'talon zipper', 'conmar', 'ykk', 'no care label', 'deadstock',
    'cinch strap', 'suspender buttons', 'single stitch', 'chain stitch',
    'hidden rivets', 'made in usa', 'made in the usa', 'pendleton', 'carhartt',
    '501', '101b', 'cowboy cut', 'denim', 'blanket lined', 'duck canvas',
    'virgin wool', 'wool shirt', 'western shirt',
];

export const ALL_TAGS = new Set(SEED_ITEMS.flatMap(s => s.tags));
