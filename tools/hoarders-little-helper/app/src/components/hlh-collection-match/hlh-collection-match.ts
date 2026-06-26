/**
 * hlh-collection-match
 *
 * Shows which user collections this item fits into, scored by category
 * and tag overlap. Lets the user add/remove the item from collections
 * directly without leaving the item card.
 *
 * Attributes:
 *   item-id  — string — DB item id
 *
 * Events emitted (bubbles + composed):
 *   hlh-collection-changed  detail: { itemId, collectionId, action: 'added'|'removed' }
 */

import {
    listCollections, getCollectionItems, getItemCollections,
    getTagsForItem, addItemToCollection, removeItemFromCollection,
    type CollectionRow, type ItemRow,
} from '../../db/index';
import { getItem } from '../../db/index';

interface CollectionMatch {
    collection: CollectionRow;
    score:      number;    // 0–1
    isMember:   boolean;
    reason:     string;
}

class HlhCollectionMatch extends HTMLElement {
    static get observedAttributes(): string[] { return ['item-id']; }

    private _root: ShadowRoot;

    constructor() {
        super();
        this._root = this.attachShadow({ mode: 'open' });
        this._root.innerHTML = `<style>${STYLES}</style><div class="cm-panel"></div>`;
    }

    connectedCallback(): void { void this._load(); }
    attributeChangedCallback(_: string, p: string | null, n: string | null): void {
        if (p !== n) void this._load();
    }

    async refresh(): Promise<void> { await this._load(); }

    private async _load(): Promise<void> {
        const itemId = this.getAttribute('item-id');
        const panel  = this._root.querySelector('.cm-panel')!;
        if (!itemId) { panel.innerHTML = `<div class="cm-empty">No item selected.</div>`; return; }

        const [item, allCollections, memberCollections, itemTags] = await Promise.all([
            getItem(itemId),
            listCollections(),
            getItemCollections(itemId),
            getTagsForItem(itemId),
        ]);

        if (!item || allCollections.length === 0) {
            panel.innerHTML = `<div class="cm-empty">No collections yet. Create one in the Collections tab.</div>`;
            return;
        }

        const memberIds   = new Set(memberCollections.map(c => c.id));
        const itemTagSet  = new Set(itemTags.map(t => t.name.toLowerCase()));
        const itemCat     = (item.category ?? '').toLowerCase();

        // Score each collection
        const scored = await _scoreCollections(allCollections, item, itemTagSet, itemCat, memberIds);
        scored.sort((a, b) => {
            if (a.isMember !== b.isMember) return a.isMember ? -1 : 1;
            return b.score - a.score;
        });

        if (scored.length === 0) {
            panel.innerHTML = `<div class="cm-empty">No collections to match.</div>`;
            return;
        }

        panel.innerHTML = `
            <ul class="cm-list" role="list" aria-label="Collection matches">
                ${scored.slice(0, 8).map(m => _renderMatch(m, itemId)).join('')}
            </ul>`;

        // Wire add/remove buttons
        panel.querySelectorAll<HTMLElement>('[data-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset['action']!;
                const collId = btn.dataset['coll']!;
                try {
                    if (action === 'add') {
                        await addItemToCollection(collId, itemId);
                        this.dispatchEvent(new CustomEvent('hlh-collection-changed', {
                            bubbles: true, composed: true,
                            detail:  { itemId, collectionId: collId, action: 'added' },
                        }));
                    } else {
                        await removeItemFromCollection(collId, itemId);
                        this.dispatchEvent(new CustomEvent('hlh-collection-changed', {
                            bubbles: true, composed: true,
                            detail:  { itemId, collectionId: collId, action: 'removed' },
                        }));
                    }
                    await this._load();   // refresh
                } catch (err) {
                    console.error('Collection action failed:', err);
                }
            });
        });
    }
}

// ── Scoring ───────────────────────────────────────────────────────────────────

async function _scoreCollections(
    collections: CollectionRow[],
    item: ItemRow,
    itemTagSet: Set<string>,
    itemCat: string,
    memberIds: Set<string>,
): Promise<CollectionMatch[]> {
    const results: CollectionMatch[] = [];

    for (const coll of collections) {
        const members = await getCollectionItems(coll.id);
        if (members.length === 0) {
            // Empty collection — always show if user is a member, otherwise skip
            if (memberIds.has(coll.id)) {
                results.push({ collection: coll, score: 0, isMember: true, reason: 'Member (empty collection)' });
            }
            continue;
        }

        // Category match: fraction of members sharing the same category
        const catMatches  = itemCat
            ? members.filter(m => (m.category ?? '').toLowerCase() === itemCat).length
            : 0;
        const catScore    = catMatches / members.length;

        // Tag overlap: sample up to 20 members, get their tags union, compute Jaccard
        const sample = members.slice(0, 20);
        const collTagSet = new Set<string>();
        for (const m of sample) {
            const tags = await getTagsForItem(m.id);
            tags.forEach(t => collTagSet.add(t.name.toLowerCase()));
        }

        let tagScore = 0;
        if (itemTagSet.size > 0 && collTagSet.size > 0) {
            const intersection = [...itemTagSet].filter(t => collTagSet.has(t)).length;
            const union        = new Set([...itemTagSet, ...collTagSet]).size;
            tagScore           = intersection / union;
        }

        const score  = catScore * 0.65 + tagScore * 0.35;
        const reasons: string[] = [];
        if (catMatches > 0)  reasons.push(`${catMatches}/${members.length} same category`);
        if (tagScore > 0)    reasons.push(`${Math.round(tagScore * 100)}% tag overlap`);

        // Always include members; include non-members with score > 0 or close matches
        if (memberIds.has(coll.id) || score > 0.05) {
            results.push({
                collection: coll,
                score,
                isMember:   memberIds.has(coll.id),
                reason:     reasons.join(' · ') || 'In collection',
            });
        }
    }

    return results;
}

// ── Render ────────────────────────────────────────────────────────────────────

function _renderMatch(m: CollectionMatch, itemId: string): string {
    const color    = m.collection.color ?? '#FF4FB3';
    const barWidth = Math.max(4, Math.round(m.score * 100));
    const action   = m.isMember ? 'remove' : 'add';
    const actionLabel = m.isMember ? 'Remove from collection' : 'Add to collection';
    const actionText  = m.isMember ? '✕ Remove' : '+ Add';
    const actionCls   = m.isMember ? 'cm-btn-remove' : 'cm-btn-add';

    return `
        <li class="cm-item ${m.isMember ? 'cm-member' : ''}" role="listitem">
            <div class="cm-dot" style="background:${_esc(color)}" aria-hidden="true"></div>
            <div class="cm-info">
                <div class="cm-name">${_esc(m.collection.name)}</div>
                ${m.reason ? `<div class="cm-reason">${_esc(m.reason)}</div>` : ''}
                ${!m.isMember && m.score > 0 ? `
                    <div class="cm-bar-track" aria-hidden="true">
                        <div class="cm-bar" style="width:${barWidth}%; background:${_esc(color)}"></div>
                    </div>` : ''}
            </div>
            <button class="cm-btn ${_esc(actionCls)}"
                    data-action="${_esc(action)}"
                    data-coll="${_esc(m.collection.id)}"
                    aria-label="${_esc(actionLabel)} ${_esc(m.collection.name)}">
                ${actionText}
            </button>
        </li>`;
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const STYLES = `
    :host { display: block; }
    * { box-sizing: border-box; margin: 0; padding: 0; }

    .cm-panel { font-family: var(--ravel-font, 'Quantico', monospace); }

    .cm-empty {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.25);
        font-style: italic;
        line-height: 1.5;
    }

    .cm-list {
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .cm-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 9px 10px;
        border-radius: 6px;
        border: 1px solid rgba(255,255,255,0.06);
        background: rgba(255,255,255,0.02);
        transition: background 0.1s;
    }

    .cm-item.cm-member {
        background: rgba(255,255,255,0.04);
        border-color: rgba(255,255,255,0.10);
    }

    .cm-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        flex-shrink: 0;
        opacity: 0.85;
    }

    .cm-info { flex: 1; min-width: 0; }

    .cm-name {
        font-size: 0.85rem;
        color: rgba(255,255,255,0.80);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .cm-reason {
        font-size: 0.7rem;
        color: rgba(255,255,255,0.30);
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .cm-bar-track {
        height: 3px;
        background: rgba(255,255,255,0.06);
        border-radius: 2px;
        margin-top: 5px;
        overflow: hidden;
    }

    .cm-bar {
        height: 100%;
        border-radius: 2px;
        opacity: 0.7;
        transition: width 0.3s ease;
        min-width: 3px;
    }

    .cm-btn {
        appearance: none;
        font-family: var(--ravel-font, 'Quantico', monospace);
        font-size: 0.72rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        min-height: 30px;
        flex-shrink: 0;
        white-space: nowrap;
        transition: background 0.1s;
    }

    .cm-btn-add {
        background: rgba(0,240,255,0.08);
        border: 1px solid rgba(0,240,255,0.22);
        color: #00F0FF;
    }
    .cm-btn-add:hover { background: rgba(0,240,255,0.16); }
    .cm-btn-add:focus-visible { outline: 2px solid #00F0FF; outline-offset: 2px; }

    .cm-btn-remove {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.12);
        color: rgba(255,255,255,0.35);
    }
    .cm-btn-remove:hover {
        background: rgba(255,60,60,0.10);
        border-color: rgba(255,80,80,0.3);
        color: rgba(255,255,255,0.65);
    }
    .cm-btn-remove:focus-visible { outline: 2px solid #FF4FB3; outline-offset: 2px; }
`;

function _esc(s: string): string {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

customElements.define('hlh-collection-match', HlhCollectionMatch);
