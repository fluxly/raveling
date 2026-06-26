import Database from '@tauri-apps/plugin-sql';
import { MIGRATIONS } from './schema';

// Singleton — one connection for the app's lifetime.
let _db: Database | null = null;

export async function getDb(): Promise<Database> {
    if (_db) return _db;
    throw new Error('DB not initialized — call initDb() first');
}

export async function initDb(): Promise<Database> {
    _db = await Database.load('sqlite:hlh.db');
    await _runMigrations(_db);
    return _db;
}

async function _runMigrations(db: Database): Promise<void> {
    // Ensure the migrations table itself exists before querying it.
    await db.execute(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version    INTEGER PRIMARY KEY,
            label      TEXT NOT NULL,
            applied_at TEXT NOT NULL
        )
    `);

    const applied = await db.select<{ version: number }[]>(
        'SELECT version FROM schema_migrations'
    );
    const appliedSet = new Set(applied.map(r => r.version));

    for (const m of MIGRATIONS) {
        if (appliedSet.has(m.version)) continue;

        for (const stmt of m.sql) {
            await db.execute(stmt);
        }

        await db.execute(
            'INSERT INTO schema_migrations (version, label, applied_at) VALUES (?, ?, ?)',
            [m.version, m.label, new Date().toISOString()]
        );
    }
}

// ── Photo helpers ─────────────────────────────────────────────────────────────

export interface PhotoRow {
    id:         string;
    item_id:    string | null;
    original:   string;
    thumbnail:  string | null;
    medium:     string | null;
    phash:      string | null;
    is_hero:    number;
    sort_order: number;
    is_blurry:  number;
    created_at: string;
}

export async function insertPhoto(p: {
    id: string;
    item_id?: string | null;
    original: string;
    thumbnail?: string | null;
    medium?: string | null;
    phash?: string | null;
    is_blurry?: boolean;
}): Promise<void> {
    const db = await getDb();
    await db.execute(
        `INSERT INTO photos
            (id, item_id, original, thumbnail, medium, phash, is_blurry, is_hero, sort_order, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
        [
            p.id,
            p.item_id ?? null,
            p.original,
            p.thumbnail ?? null,
            p.medium    ?? null,
            p.phash     ?? null,
            p.is_blurry ? 1 : 0,
            new Date().toISOString(),
        ]
    );
}

export async function listInboxPhotos(): Promise<PhotoRow[]> {
    const db = await getDb();
    return db.select<PhotoRow[]>(
        'SELECT * FROM photos WHERE item_id IS NULL ORDER BY created_at DESC'
    );
}

export async function listPhotosForItem(itemId: string): Promise<PhotoRow[]> {
    const db = await getDb();
    return db.select<PhotoRow[]>(
        'SELECT * FROM photos WHERE item_id = ? ORDER BY sort_order, created_at',
        [itemId]
    );
}

export async function assignPhotoToItem(photoId: string, itemId: string): Promise<void> {
    const db = await getDb();
    await db.execute('UPDATE photos SET item_id = ? WHERE id = ?', [itemId, photoId]);
}

export async function deletePhoto(photoId: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM photos WHERE id = ?', [photoId]);
}

// ── Item helpers ──────────────────────────────────────────────────────────────

export interface ItemRow {
    id:         string;
    title:      string | null;
    brand:      string | null;
    author:     string | null;
    publisher:  string | null;
    category:   string | null;
    year:       number | null;
    materials:  string | null;   // JSON
    dimensions: string | null;   // JSON
    condition:  string | null;
    notes:      string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
}

export async function countItems(): Promise<number> {
    const db = await getDb();
    const rows = await db.select<{ n: number }[]>(
        'SELECT COUNT(*) as n FROM items WHERE deleted_at IS NULL'
    );
    return rows[0]?.n ?? 0;
}

export async function insertItem(
    id: string,
    fields: Partial<Omit<ItemRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>>
): Promise<void> {
    const db  = await getDb();
    const now = new Date().toISOString();
    await db.execute(
        `INSERT INTO items (id, title, brand, author, publisher, category, year,
                            materials, dimensions, condition, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            fields.title       ?? null,
            fields.brand       ?? null,
            fields.author      ?? null,
            fields.publisher   ?? null,
            fields.category    ?? null,
            fields.year        ?? null,
            fields.materials   ?? null,
            fields.dimensions  ?? null,
            fields.condition   ?? null,
            fields.notes       ?? null,
            now, now,
        ]
    );
}

export async function updateItem(
    id: string,
    fields: Partial<Omit<ItemRow, 'id' | 'created_at' | 'deleted_at'>>
): Promise<void> {
    const db  = await getDb();
    const now = new Date().toISOString();
    const sets: string[] = ['updated_at = ?'];
    const vals: unknown[] = [now];

    for (const [k, v] of Object.entries(fields)) {
        if (k === 'updated_at') continue;
        sets.push(`${k} = ?`);
        vals.push(v ?? null);
    }
    vals.push(id);
    await db.execute(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function listItems(limit = 100, offset = 0): Promise<ItemRow[]> {
    const db = await getDb();
    return db.select<ItemRow[]>(
        `SELECT * FROM items WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [limit, offset]
    );
}

export async function getItem(id: string): Promise<ItemRow | null> {
    const db   = await getDb();
    const rows = await db.select<ItemRow[]>('SELECT * FROM items WHERE id = ?', [id]);
    return rows[0] ?? null;
}

export async function searchItems(query: string, limit = 50): Promise<ItemRow[]> {
    const db = await getDb();
    // FTS5 MATCH — wrap in quotes to handle special chars
    const escaped = query.trim().replace(/"/g, '""');
    const ids = await db.select<{ id: string }[]>(
        `SELECT id FROM items_fts WHERE items_fts MATCH ? ORDER BY rank LIMIT ?`,
        [`"${escaped}"*`, limit]
    );
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return db.select<ItemRow[]>(
        `SELECT * FROM items WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
        ids.map(r => r.id)
    );
}

// ── Tag helpers ───────────────────────────────────────────────────────────────

export interface TagRow {
    id:   string;
    name: string;
    color: string | null;
}

export async function listTags(): Promise<TagRow[]> {
    const db = await getDb();
    return db.select<TagRow[]>('SELECT * FROM tags ORDER BY name');
}

export async function upsertTag(name: string, color?: string): Promise<TagRow> {
    const db = await getDb();
    const existing = await db.select<TagRow[]>('SELECT * FROM tags WHERE name = ?', [name]);
    if (existing[0]) return existing[0];
    const id = crypto.randomUUID();
    await db.execute(
        'INSERT INTO tags (id, name, color) VALUES (?, ?, ?)',
        [id, name, color ?? null]
    );
    return { id, name, color: color ?? null };
}

export async function getTagsForItem(itemId: string): Promise<TagRow[]> {
    const db = await getDb();
    return db.select<TagRow[]>(
        `SELECT t.* FROM tags t
         JOIN item_tags it ON it.tag_id = t.id
         WHERE it.item_id = ?
         ORDER BY t.name`,
        [itemId]
    );
}

export async function setTagsForItem(itemId: string, tagNames: string[]): Promise<void> {
    const db = await getDb();
    // Upsert tags, get IDs
    const tagRows = await Promise.all(tagNames.map(n => upsertTag(n)));
    // Replace all item_tags for this item
    await db.execute('DELETE FROM item_tags WHERE item_id = ?', [itemId]);
    for (const tag of tagRows) {
        await db.execute(
            'INSERT OR IGNORE INTO item_tags (item_id, tag_id) VALUES (?, ?)',
            [itemId, tag.id]
        );
    }
}

// ── Collection helpers ────────────────────────────────────────────────────────

export interface CollectionRow {
    id:          string;
    name:        string;
    description: string | null;
    color:       string | null;
    created_at:  string;
    updated_at:  string;
}

export async function listCollections(): Promise<CollectionRow[]> {
    const db = await getDb();
    return db.select<CollectionRow[]>('SELECT * FROM collections ORDER BY name');
}

export async function insertCollection(
    id: string,
    name: string,
    description?: string,
    color?: string,
): Promise<void> {
    const db  = await getDb();
    const now = new Date().toISOString();
    await db.execute(
        'INSERT INTO collections (id, name, description, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, name, description ?? null, color ?? '#FF4FB3', now, now]
    );
}

export async function updateCollection(
    id: string,
    fields: Partial<Pick<CollectionRow, 'name' | 'description' | 'color'>>,
): Promise<void> {
    const db  = await getDb();
    const now = new Date().toISOString();
    const sets: string[] = ['updated_at = ?'];
    const vals: unknown[] = [now];
    for (const [k, v] of Object.entries(fields)) {
        sets.push(`${k} = ?`);
        vals.push(v ?? null);
    }
    vals.push(id);
    await db.execute(`UPDATE collections SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function deleteCollection(id: string): Promise<void> {
    const db = await getDb();
    await db.execute('DELETE FROM collections WHERE id = ?', [id]);
}

export async function getCollectionItems(collectionId: string): Promise<ItemRow[]> {
    const db = await getDb();
    return db.select<ItemRow[]>(
        `SELECT i.* FROM items i
         JOIN collection_items ci ON ci.item_id = i.id
         WHERE ci.collection_id = ? AND i.deleted_at IS NULL
         ORDER BY ci.added_at DESC`,
        [collectionId]
    );
}

export async function addItemToCollection(collectionId: string, itemId: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'INSERT OR IGNORE INTO collection_items (collection_id, item_id, added_at) VALUES (?, ?, ?)',
        [collectionId, itemId, new Date().toISOString()]
    );
}

export async function removeItemFromCollection(collectionId: string, itemId: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'DELETE FROM collection_items WHERE collection_id = ? AND item_id = ?',
        [collectionId, itemId]
    );
}

export async function getItemCollections(itemId: string): Promise<CollectionRow[]> {
    const db = await getDb();
    return db.select<CollectionRow[]>(
        `SELECT c.* FROM collections c
         JOIN collection_items ci ON ci.collection_id = c.id
         WHERE ci.item_id = ?
         ORDER BY c.name`,
        [itemId]
    );
}

// ── Quiddity helpers ──────────────────────────────────────────────────────────

export interface QuiddityItemRow {
    id:             string;
    qid:            string;
    type:           string;
    canonical_name: string;
    subtitle:       string | null;
    description:    string | null;
    notes:          string | null;
    created_at:     string;
    updated_at:     string;
}

export async function searchQuiddityItems(query: string, limit = 30): Promise<QuiddityItemRow[]> {
    const db = await getDb();
    const q  = `%${query}%`;
    return db.select<QuiddityItemRow[]>(
        `SELECT * FROM quiddity_items
         WHERE canonical_name LIKE ? OR subtitle LIKE ?
         ORDER BY canonical_name LIMIT ?`,
        [q, q, limit]
    );
}

export async function getQuiddityItem(qid: string): Promise<QuiddityItemRow | null> {
    const db   = await getDb();
    const rows = await db.select<QuiddityItemRow[]>(
        'SELECT * FROM quiddity_items WHERE qid = ?', [qid]
    );
    return rows[0] ?? null;
}

export async function upsertQuiddityItem(item: Omit<QuiddityItemRow, 'created_at' | 'updated_at'>): Promise<void> {
    const db  = await getDb();
    const now = new Date().toISOString();
    await db.execute(
        `INSERT INTO quiddity_items
            (id, qid, type, canonical_name, subtitle, description, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(qid) DO UPDATE SET
            canonical_name = excluded.canonical_name,
            subtitle       = excluded.subtitle,
            description    = excluded.description,
            notes          = excluded.notes,
            updated_at     = excluded.updated_at`,
        [item.id, item.qid, item.type, item.canonical_name,
         item.subtitle ?? null, item.description ?? null, item.notes ?? null,
         now, now]
    );
}

// ── Research event helpers ────────────────────────────────────────────────────

export interface ResearchEventRow {
    id:          string;
    item_id:     string;
    service:     string;
    provider:    string | null;
    cmd:         string;
    result:      string | null;   // JSON
    confidence:  number | null;
    source:      string | null;
    approved_at: string | null;
    created_at:  string;
}

export async function insertResearchEvent(ev: Omit<ResearchEventRow, 'created_at'>): Promise<void> {
    const db  = await getDb();
    const now = new Date().toISOString();
    await db.execute(
        `INSERT INTO research_events
            (id, item_id, service, provider, cmd, result, confidence, source, approved_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [ev.id, ev.item_id, ev.service, ev.provider ?? null, ev.cmd,
         ev.result ?? null, ev.confidence ?? null, ev.source ?? null,
         ev.approved_at ?? null, now]
    );
}

export async function listResearchEventsForItem(itemId: string): Promise<ResearchEventRow[]> {
    const db = await getDb();
    return db.select<ResearchEventRow[]>(
        'SELECT * FROM research_events WHERE item_id = ? ORDER BY created_at DESC',
        [itemId]
    );
}

export async function approveResearchEvent(id: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'UPDATE research_events SET approved_at = ? WHERE id = ?',
        [new Date().toISOString(), id]
    );
}

// ── Q-Thread registry helpers ─────────────────────────────────────────────────

export interface QThreadRegistryRow {
    id:       string;
    name:     string;
    version:  string;
    path:     string;
    enabled:  number;
    priority: number;
}

export async function listQthreads(): Promise<QThreadRegistryRow[]> {
    const db = await getDb();
    return db.select<QThreadRegistryRow[]>(
        'SELECT * FROM qthread_registry ORDER BY priority DESC, name'
    );
}

export async function upsertQthread(row: QThreadRegistryRow): Promise<void> {
    const db = await getDb();
    await db.execute(
        `INSERT INTO qthread_registry (id, name, version, path, enabled, priority)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            name     = excluded.name,
            version  = excluded.version,
            path     = excluded.path,
            priority = excluded.priority`,
        [row.id, row.name, row.version, row.path, row.enabled, row.priority]
    );
}

export async function setQthreadEnabled(id: string, enabled: boolean): Promise<void> {
    const db = await getDb();
    await db.execute(
        'UPDATE qthread_registry SET enabled = ? WHERE id = ?',
        [enabled ? 1 : 0, id]
    );
}

// ── Wishlist helpers ──────────────────────────────────────────────────────────

export interface WishlistRow {
    id:         string;
    name:       string;
    thread_id:  string | null;
    created_at: string;
}

export interface WishlistItemRow {
    wishlist_id: string;
    qid:         string;
    added_at:    string;
    notes:       string | null;
}

export async function listWishlists(): Promise<WishlistRow[]> {
    const db = await getDb();
    return db.select<WishlistRow[]>('SELECT * FROM wishlists ORDER BY name');
}

export async function insertWishlist(id: string, name: string, threadId?: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'INSERT INTO wishlists (id, name, thread_id, created_at) VALUES (?, ?, ?, ?)',
        [id, name, threadId ?? null, new Date().toISOString()]
    );
}

export async function getWishlistItems(wishlistId: string): Promise<WishlistItemRow[]> {
    const db = await getDb();
    return db.select<WishlistItemRow[]>(
        'SELECT * FROM wishlist_items WHERE wishlist_id = ? ORDER BY added_at DESC',
        [wishlistId]
    );
}

export async function addToWishlist(wishlistId: string, qid: string, notes?: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'INSERT OR IGNORE INTO wishlist_items (wishlist_id, qid, added_at, notes) VALUES (?, ?, ?, ?)',
        [wishlistId, qid, new Date().toISOString(), notes ?? null]
    );
}

export async function removeFromWishlist(wishlistId: string, qid: string): Promise<void> {
    const db = await getDb();
    await db.execute(
        'DELETE FROM wishlist_items WHERE wishlist_id = ? AND qid = ?',
        [wishlistId, qid]
    );
}

// ── Settings helpers ──────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
    const db   = await getDb();
    const rows = await db.select<{ value: string }[]>(
        'SELECT value FROM settings WHERE key = ?', [key]
    );
    return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
    const db  = await getDb();
    const now = new Date().toISOString();
    await db.execute(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, value, now]
    );
}

// ── AI cache helpers ──────────────────────────────────────────────────────────

export interface AiCacheRow {
    id:          string;
    provider:    string;
    model:       string;
    prompt_hash: string;
    response:    string;
    token_count: number | null;
    created_at:  string;
}

export async function getAiCache(promptHash: string): Promise<string | null> {
    const db   = await getDb();
    const rows = await db.select<{ response: string }[]>(
        'SELECT response FROM ai_cache WHERE prompt_hash = ?', [promptHash]
    );
    return rows[0]?.response ?? null;
}

export async function setAiCache(
    promptHash: string, provider: string, model: string,
    response: string, tokenCount?: number
): Promise<void> {
    const db = await getDb();
    await db.execute(
        `INSERT INTO ai_cache (id, provider, model, prompt_hash, response, token_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(prompt_hash) DO UPDATE SET response = excluded.response`,
        [crypto.randomUUID(), provider, model, promptHash, response,
         tokenCount ?? null, new Date().toISOString()]
    );
}

// ── Listing helpers ───────────────────────────────────────────────────────────

export interface ListingRow {
    id:           string;
    item_id:      string;
    marketplace:  string;
    status:       'draft' | 'active' | 'sold' | 'ended' | 'error';
    payload:      string | null;  // JSON ListingPayload
    remote_id:    string | null;
    published_at: string | null;
    created_at:   string;
    updated_at:   string;
}

export async function listListingsForItem(itemId: string): Promise<ListingRow[]> {
    const db = await getDb();
    return db.select<ListingRow[]>(
        'SELECT * FROM listings WHERE item_id = ? ORDER BY created_at DESC',
        [itemId]
    );
}

export async function listAllListings(status?: string): Promise<ListingRow[]> {
    const db = await getDb();
    if (status) {
        return db.select<ListingRow[]>(
            'SELECT * FROM listings WHERE status = ? ORDER BY updated_at DESC',
            [status]
        );
    }
    return db.select<ListingRow[]>('SELECT * FROM listings ORDER BY updated_at DESC');
}

export async function insertListing(fields: {
    item_id:     string;
    marketplace: string;
    payload?:    object;
}): Promise<string> {
    const db  = await getDb();
    const id  = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.execute(
        `INSERT INTO listings (id, item_id, marketplace, status, payload, remote_id, published_at, created_at, updated_at)
         VALUES (?, ?, ?, 'draft', ?, NULL, NULL, ?, ?)`,
        [id, fields.item_id, fields.marketplace,
         fields.payload ? JSON.stringify(fields.payload) : null, now, now]
    );
    return id;
}

export async function updateListing(
    id: string,
    fields: { status?: ListingRow['status']; payload?: object | string | null; remote_id?: string | null; published_at?: string | null }
): Promise<void> {
    const db  = await getDb();
    const now = new Date().toISOString();
    const sets: string[]  = ['updated_at = ?'];
    const vals: unknown[] = [now];

    if ('status'       in fields) { sets.push('status = ?');       vals.push(fields.status); }
    if ('payload'      in fields) {
        sets.push('payload = ?');
        const p = fields.payload;
        vals.push(p == null ? null : typeof p === 'string' ? p : JSON.stringify(p));
    }
    if ('remote_id'    in fields) { sets.push('remote_id = ?');    vals.push(fields.remote_id); }
    if ('published_at' in fields) { sets.push('published_at = ?'); vals.push(fields.published_at); }

    vals.push(id);
    await db.execute(`UPDATE listings SET ${sets.join(', ')} WHERE id = ?`, vals);
}

export async function getListing(id: string): Promise<ListingRow | null> {
    const db   = await getDb();
    const rows = await db.select<ListingRow[]>('SELECT * FROM listings WHERE id = ?', [id]);
    return rows[0] ?? null;
}
