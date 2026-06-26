export interface Migration {
    version: number;
    label:   string;
    sql:     string[];
}

export const MIGRATIONS: Migration[] = [
    {
        version: 1,
        label:   'core_tables',
        sql: [
            `PRAGMA journal_mode = WAL`,
            `PRAGMA foreign_keys = ON`,
            `CREATE TABLE IF NOT EXISTS schema_migrations (
                version    INTEGER PRIMARY KEY,
                label      TEXT NOT NULL,
                applied_at TEXT NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS items (
                id          TEXT PRIMARY KEY,
                title       TEXT,
                brand       TEXT,
                author      TEXT,
                publisher   TEXT,
                category    TEXT,
                year        INTEGER,
                materials   TEXT,
                dimensions  TEXT,
                condition   TEXT,
                notes       TEXT,
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL,
                deleted_at  TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS photos (
                id          TEXT PRIMARY KEY,
                item_id     TEXT REFERENCES items(id),
                original    TEXT NOT NULL,
                thumbnail   TEXT,
                medium      TEXT,
                hero        TEXT,
                phash       TEXT,
                is_hero     INTEGER DEFAULT 0,
                sort_order  INTEGER DEFAULT 0,
                created_at  TEXT NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS tags (
                id    TEXT PRIMARY KEY,
                name  TEXT NOT NULL UNIQUE,
                color TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS item_tags (
                item_id TEXT REFERENCES items(id) ON DELETE CASCADE,
                tag_id  TEXT REFERENCES tags(id)  ON DELETE CASCADE,
                PRIMARY KEY (item_id, tag_id)
            )`,
            `CREATE TABLE IF NOT EXISTS research_events (
                id          TEXT PRIMARY KEY,
                item_id     TEXT REFERENCES items(id),
                service     TEXT NOT NULL,
                provider    TEXT,
                cmd         TEXT NOT NULL,
                result      TEXT,
                confidence  REAL,
                source      TEXT,
                approved_at TEXT,
                created_at  TEXT NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS listings (
                id           TEXT PRIMARY KEY,
                item_id      TEXT REFERENCES items(id),
                marketplace  TEXT NOT NULL,
                status       TEXT DEFAULT 'draft',
                payload      TEXT,
                remote_id    TEXT,
                published_at TEXT,
                created_at   TEXT NOT NULL,
                updated_at   TEXT NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS settings (
                key        TEXT PRIMARY KEY,
                value      TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )`,
            `CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
                id UNINDEXED, title, brand, author, publisher, notes,
                content='items', content_rowid='rowid'
            )`,
        ],
    },
    {
        version: 2,
        label:   'photo_blur_flag',
        sql: [
            `ALTER TABLE photos ADD COLUMN is_blurry INTEGER NOT NULL DEFAULT 0`,
        ],
    },
    {
        version: 3,
        label:   'collections_and_fts_triggers',
        sql: [
            `CREATE TABLE IF NOT EXISTS collections (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                description TEXT,
                color       TEXT DEFAULT '#FF4FB3',
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS collection_items (
                collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
                item_id       TEXT NOT NULL REFERENCES items(id)       ON DELETE CASCADE,
                added_at      TEXT NOT NULL,
                PRIMARY KEY (collection_id, item_id)
            )`,
            // Each trigger is its own statement — semicolons inside BEGIN...END
            // would break naive split-on-semicolon approaches.
            `CREATE TRIGGER IF NOT EXISTS items_ai AFTER INSERT ON items BEGIN
                INSERT INTO items_fts(rowid, id, title, brand, author, publisher, notes)
                VALUES (new.rowid, new.id, new.title, new.brand, new.author, new.publisher, new.notes);
            END`,
            `CREATE TRIGGER IF NOT EXISTS items_ad AFTER DELETE ON items BEGIN
                INSERT INTO items_fts(items_fts, rowid, id, title, brand, author, publisher, notes)
                VALUES ('delete', old.rowid, old.id, old.title, old.brand, old.author, old.publisher, old.notes);
            END`,
            `CREATE TRIGGER IF NOT EXISTS items_au AFTER UPDATE ON items BEGIN
                INSERT INTO items_fts(items_fts, rowid, id, title, brand, author, publisher, notes)
                VALUES ('delete', old.rowid, old.id, old.title, old.brand, old.author, old.publisher, old.notes);
                INSERT INTO items_fts(rowid, id, title, brand, author, publisher, notes)
                VALUES (new.rowid, new.id, new.title, new.brand, new.author, new.publisher, new.notes);
            END`,
        ],
    },
    {
        version: 4,
        label:   'quiddity_foundation',
        sql: [
            `ALTER TABLE items ADD COLUMN qid TEXT`,
            `CREATE TABLE IF NOT EXISTS quiddity_sources (
                id          TEXT PRIMARY KEY,
                thread_id   TEXT NOT NULL,
                path        TEXT,
                title       TEXT,
                imported_at TEXT NOT NULL,
                page_count  INTEGER,
                status      TEXT NOT NULL DEFAULT 'pending'
            )`,
            `CREATE TABLE IF NOT EXISTS quiddity_items (
                id             TEXT PRIMARY KEY,
                qid            TEXT UNIQUE NOT NULL,
                type           TEXT NOT NULL,
                canonical_name TEXT NOT NULL,
                subtitle       TEXT,
                description    TEXT,
                notes          TEXT,
                created_at     TEXT NOT NULL,
                updated_at     TEXT NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS quiddity_aliases (
                id      TEXT PRIMARY KEY,
                quid_id TEXT NOT NULL REFERENCES quiddity_items(id) ON DELETE CASCADE,
                alias   TEXT NOT NULL,
                source  TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS quiddity_people (
                id         TEXT PRIMARY KEY,
                quid_id    TEXT NOT NULL REFERENCES quiddity_items(id) ON DELETE CASCADE,
                role       TEXT NOT NULL,
                name       TEXT NOT NULL,
                person_qid TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS quiddity_publications (
                id          TEXT PRIMARY KEY,
                quid_id     TEXT NOT NULL REFERENCES quiddity_items(id) ON DELETE CASCADE,
                publisher   TEXT,
                edition     TEXT,
                year        INTEGER,
                isbn        TEXT,
                open_lib_id TEXT,
                oclc        TEXT
            )`,
            `CREATE TABLE IF NOT EXISTS quiddity_mentions (
                id          TEXT PRIMARY KEY,
                quid_id     TEXT NOT NULL REFERENCES quiddity_items(id)  ON DELETE CASCADE,
                source_id   TEXT NOT NULL REFERENCES quiddity_sources(id) ON DELETE CASCADE,
                publication TEXT,
                issue       TEXT,
                page        TEXT,
                section     TEXT,
                snippet     TEXT,
                confidence  REAL,
                thread_id   TEXT NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS wishlists (
                id         TEXT PRIMARY KEY,
                name       TEXT NOT NULL,
                thread_id  TEXT,
                created_at TEXT NOT NULL
            )`,
            `CREATE TABLE IF NOT EXISTS wishlist_items (
                wishlist_id TEXT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
                qid         TEXT NOT NULL,
                added_at    TEXT NOT NULL,
                notes       TEXT,
                PRIMARY KEY (wishlist_id, qid)
            )`,
            `CREATE TABLE IF NOT EXISTS qthread_registry (
                id       TEXT PRIMARY KEY,
                name     TEXT NOT NULL,
                version  TEXT NOT NULL,
                path     TEXT NOT NULL,
                enabled  INTEGER NOT NULL DEFAULT 1,
                priority INTEGER NOT NULL DEFAULT 0
            )`,
        ],
    },
    {
        version: 5,
        label:   'ai_cache',
        sql: [
            `CREATE TABLE IF NOT EXISTS ai_cache (
                id          TEXT PRIMARY KEY,
                provider    TEXT NOT NULL,
                model       TEXT NOT NULL,
                prompt_hash TEXT NOT NULL UNIQUE,
                response    TEXT NOT NULL,
                token_count INTEGER,
                created_at  TEXT NOT NULL
            )`,
        ],
    },
];
