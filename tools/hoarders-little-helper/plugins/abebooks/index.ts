import type { MarketplacePlugin, ChecklistItem, ListingPayload, ExportResult } from '../interface';

/**
 * AbeBooks plugin — generates a listing in the AbeBooks HomBase upload CSV format.
 * The app layer (hlh-marketplace-preview) handles the actual file save dialog.
 */
export const abebooksPlugin: MarketplacePlugin = {
    id:   'abebooks',
    name: 'AbeBooks',
    icon: '📚',

    validate(payload: ListingPayload): ChecklistItem[] {
        const author    = (payload['author']    as string) ?? '';
        const publisher = (payload['publisher'] as string) ?? '';
        const isbn      = (payload['isbn']      as string) ?? '';

        return [
            {
                label:    'Title',
                status:   payload.title?.trim() ? 'pass' : 'fail',
                required: true,
                message:  payload.title?.trim() ? undefined : 'Required for AbeBooks',
            },
            {
                label:   'Author',
                status:  author.trim() ? 'pass' : 'warn',
                message: author.trim() ? undefined : 'Strongly recommended for books',
            },
            {
                label:    'Price',
                status:   payload.price > 0 ? 'pass' : 'fail',
                message:  payload.price > 0 ? `$${(payload.price / 100).toFixed(2)}` : 'Required',
                required: true,
            },
            {
                label:    'Condition',
                status:   _validCondition(payload.condition) ? 'pass' : 'fail',
                message:  _validCondition(payload.condition)
                    ? _conditionLabel(payload.condition)
                    : 'Must be: Good, Very Good, Fine, New, or Poor',
                required: true,
            },
            {
                label:   'Description',
                status:  payload.description?.trim() ? 'pass' : 'warn',
                message: payload.description?.trim() ? undefined : 'Recommended',
            },
            {
                label:   'Publisher',
                status:  publisher.trim() ? 'pass' : 'warn',
                message: publisher.trim() ? undefined : 'Recommended for books',
            },
            {
                label:   'ISBN',
                status:  isbn.trim() ? 'pass' : 'pending',
                message: isbn.trim() ? isbn : 'Optional but improves discoverability',
            },
        ];
    },

    preview(payload: ListingPayload): string {
        const author    = (payload['author']    as string) ?? '';
        const publisher = (payload['publisher'] as string) ?? '';
        const year      = (payload['year']      as number | string) ?? '';
        const isbn      = (payload['isbn']      as string) ?? '';
        const price     = payload.price > 0 ? `$${(payload.price / 100).toFixed(2)}` : '—';

        return `
            <div style="font-family:'Quantico',monospace; font-size:0.82rem; color:rgba(255,255,255,0.8); line-height:1.55;">
                <div style="margin-bottom:12px; color:rgba(255,255,255,0.3); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em;">AbeBooks Preview</div>
                <div style="font-size:1.05rem; font-weight:700; color:#fff; margin-bottom:6px;">${_hesc(payload.title ?? '—')}</div>
                ${author    ? `<div style="color:rgba(255,255,255,0.6); margin-bottom:4px;">by ${_hesc(author)}</div>` : ''}
                ${publisher ? `<div style="color:rgba(255,255,255,0.45); font-size:0.78rem;">${_hesc(publisher)}${year ? `, ${year}` : ''}</div>` : ''}
                ${isbn      ? `<div style="color:rgba(255,255,255,0.35); font-size:0.72rem; margin-top:4px;">ISBN: ${_hesc(isbn)}</div>` : ''}
                <div style="display:flex; gap:12px; margin-top:12px; flex-wrap:wrap;">
                    <span style="background:rgba(167,255,0,0.12); border:1px solid rgba(167,255,0,0.3); color:#A7FF00; padding:3px 10px; border-radius:4px; font-size:0.78rem; font-weight:700;">${price}</span>
                    <span style="background:rgba(0,240,255,0.08); border:1px solid rgba(0,240,255,0.2); color:#00F0FF; padding:3px 10px; border-radius:4px; font-size:0.78rem;">${_hesc(_conditionLabel(payload.condition))}</span>
                </div>
                ${payload.description ? `<div style="margin-top:14px; color:rgba(255,255,255,0.6); font-size:0.8rem; border-top:1px solid rgba(255,255,255,0.07); padding-top:12px; max-height:120px; overflow:hidden;">${_hesc(payload.description)}</div>` : ''}
            </div>`;
    },

    async export(payload: ListingPayload): Promise<ExportResult> {
        const author    = (payload['author']    as string) ?? '';
        const publisher = (payload['publisher'] as string) ?? '';
        const year      = String((payload['year'] as number | string) ?? '');
        const isbn      = (payload['isbn']      as string) ?? '';

        const csvRows: [string, string][] = [
            ['Title',       payload.title       ?? ''],
            ['Author',      author],
            ['Publisher',   publisher],
            ['Year',        year],
            ['ISBN',        isbn],
            ['Condition',   _conditionLabel(payload.condition)],
            ['Price',       payload.price > 0 ? (payload.price / 100).toFixed(2) : ''],
            ['Description', payload.description ?? ''],
        ];

        const header  = csvRows.map(([k]) => _csvCell(k)).join(',');
        const values  = csvRows.map(([, v]) => _csvCell(v)).join(',');
        const content = [header, values].join('\n');

        return {
            success:        true,
            message:        'Ready to save.',
            exportContent:  content,
            exportFilename: `${_slug(payload.title)}-abebooks.csv`,
            exportMimeType: 'text/csv',
        };
    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const ABE_CONDITIONS: Record<string, string> = {
    mint:  'Fine',
    fine:  'Fine',
    vg:    'Very Good',
    good:  'Good',
    fair:  'Good',
    poor:  'Poor',
};

function _validCondition(c: string): boolean { return !!ABE_CONDITIONS[c?.toLowerCase()]; }
function _conditionLabel(c: string): string  { return ABE_CONDITIONS[c?.toLowerCase()] ?? c ?? ''; }

function _csvCell(v: string): string {
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
}

function _slug(title: string): string {
    return (title ?? 'listing').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}

function _hesc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
