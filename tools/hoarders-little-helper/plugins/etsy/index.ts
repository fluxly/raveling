import type { MarketplacePlugin, ChecklistItem, ListingPayload, ExportResult } from '../interface';

export const etsyPlugin: MarketplacePlugin = {
    id:   'etsy',
    name: 'Etsy',
    icon: '🌿',

    validate(payload: ListingPayload): ChecklistItem[] {
        const title    = payload.title?.trim() ?? '';
        const titleLen = title.length;
        const tags     = (payload.tags as string[] | undefined) ?? [];
        const longTags = tags.filter(t => t.length > 20);

        let tagStatus:  ChecklistItem['status'] = 'pass';
        let tagMessage: string | undefined;
        let tagRequired = false;

        if (tags.length === 0) {
            tagStatus  = 'warn';
            tagMessage = 'Tags drive Etsy search — add up to 13';
        } else if (tags.length > 13) {
            tagStatus   = 'fail';
            tagMessage  = `Too many: ${tags.length}/13 maximum`;
            tagRequired = true;
        } else if (longTags.length > 0) {
            tagStatus  = 'warn';
            tagMessage = `${longTags.length} tag(s) exceed 20-char limit: ${longTags.slice(0, 3).join(', ')}`;
        } else {
            tagMessage = `${tags.length}/13 tags`;
        }

        return [
            {
                label:    'Title (≤140 chars)',
                status:   !title ? 'fail' : titleLen > 140 ? 'fail' : 'pass',
                message:  !title ? 'Required'
                        : titleLen > 140 ? `Too long: ${titleLen}/140 characters`
                        : `${titleLen}/140 characters`,
                required: true,
            },
            {
                label:    'Price',
                status:   payload.price > 0 ? 'pass' : 'fail',
                message:  payload.price > 0 ? `$${(payload.price / 100).toFixed(2)}` : 'Required',
                required: true,
            },
            {
                label:    'Tags',
                status:   tagStatus,
                message:  tagMessage,
                required: tagRequired,
            },
            {
                label:   'Description',
                status:  payload.description?.trim() ? 'pass' : 'warn',
                message: payload.description?.trim() ? undefined : 'Describe what makes this special — buyers read it',
            },
            {
                label:   'Category',
                status:  payload.category?.trim() ? 'pass' : 'warn',
                message: payload.category?.trim() ? payload.category : 'Helps buyers browse to your listing',
            },
            {
                label:   'Photos',
                status:  payload.photos?.length > 0 ? 'pass' : 'warn',
                message: payload.photos?.length
                    ? `${payload.photos.length} photo(s) — Etsy recommends 10`
                    : 'Etsy strongly recommends at least 5 photos',
            },
        ];
    },

    preview(payload: ListingPayload): string {
        const title    = payload.title?.trim() || '—';
        const price    = payload.price > 0 ? `$${(payload.price / 100).toFixed(2)}` : '—';
        const tags     = (payload.tags as string[] | undefined) ?? [];
        const desc     = payload.description?.trim() ?? '';
        const titleLen = (payload.title ?? '').length;

        const tagChips = tags.slice(0, 13).map(t => {
            const over = t.length > 20;
            return `<span style="background:rgba(241,100,34,0.12); border:1px solid rgba(241,100,34,${over ? '0.6' : '0.25'}); color:${over ? '#FF6B6B' : '#F16422'}; padding:2px 8px; border-radius:12px; font-size:0.7rem; white-space:nowrap;">${_hesc(t)}${over ? ' ⚠' : ''}</span>`;
        }).join(' ');

        return `
            <div style="font-family:'Quantico',monospace; font-size:0.82rem; color:rgba(255,255,255,0.8); line-height:1.55;">
                <div style="margin-bottom:10px; color:rgba(255,255,255,0.3); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em;">Etsy Listing Preview</div>
                <div style="font-size:1.05rem; font-weight:700; margin-bottom:4px; color:${titleLen > 140 ? '#FF5555' : '#fff'};">${_hesc(title)}</div>
                ${titleLen > 140 ? `<div style="color:#FF5555; font-size:0.7rem; margin-bottom:6px;">⚠ ${titleLen} chars — Etsy enforces 140-char limit</div>` : ''}
                <div style="margin-top:10px; display:flex; align-items:center; gap:12px;">
                    <span style="background:rgba(241,100,34,0.15); border:1px solid rgba(241,100,34,0.45); color:#F16422; padding:4px 14px; border-radius:4px; font-size:1rem; font-weight:700;">${price}</span>
                    <span style="color:rgba(255,255,255,0.35); font-size:0.72rem;">📷 ${payload.photos?.length ?? 0} photo(s)</span>
                </div>
                ${tags.length > 0 ? `<div style="margin-top:10px; display:flex; flex-wrap:wrap; gap:5px;">${tagChips}</div>` : ''}
                ${tags.length > 13 ? `<div style="color:#FF5555; font-size:0.7rem; margin-top:6px;">⚠ ${tags.length} tags — Etsy allows 13 maximum</div>` : ''}
                ${desc ? `<div style="margin-top:12px; color:rgba(255,255,255,0.55); font-size:0.78rem; border-top:1px solid rgba(255,255,255,0.07); padding-top:10px; max-height:80px; overflow:hidden;">${_hesc(desc)}</div>` : ''}
                <div style="margin-top:14px; color:rgba(255,255,255,0.18); font-size:0.68rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">CSV for Etsy Shop Manager · etsy.com/your/listings</div>
            </div>`;
    },

    async export(payload: ListingPayload): Promise<ExportResult> {
        const tags     = (payload.tags as string[] | undefined) ?? [];
        const year     = payload['year'] as number | null | undefined;
        const price    = payload.price > 0 ? (payload.price / 100).toFixed(2) : '0.00';

        // Format compatible with Etsy Shop Manager listing export
        const header = [
            'TITLE', 'DESCRIPTION', 'PRICE', 'QUANTITY', 'SKU',
            'TAGS', 'MATERIALS', 'SECTION', 'WHO_MADE', 'WHEN_MADE', 'IS_SUPPLY', 'TYPE',
        ].join(',');

        const row = [
            _csvCell(payload.title ?? ''),
            _csvCell(payload.description ?? ''),
            price,
            '1',
            _csvCell(payload.sku ?? ''),
            _csvCell(tags.slice(0, 13).join(', ')),
            '', // MATERIALS — not tracked in HLH
            _csvCell(payload.category ?? ''),
            'someone_else',                // WHO_MADE — vintage items
            _whenMade(year),               // WHEN_MADE — decade from item year
            'false',                       // IS_SUPPLY
            'physical',                    // TYPE
        ].join(',');

        return {
            success:        true,
            message:        'Ready to save. Import at: etsy.com/your/listings → Import listings.',
            exportContent:  [header, row].join('\n'),
            exportFilename: `${_slug(payload.title)}-etsy.csv`,
            exportMimeType: 'text/csv',
        };
    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function _whenMade(year: number | null | undefined): string {
    if (!year) return '2020_2024';
    if (year < 1902) return 'before_1902';
    if (year < 1920) return '1902_1920';
    if (year < 1940) return '1920_1939';
    if (year < 1950) return '1939_1949';
    if (year < 1960) return '1950_1959';
    if (year < 1970) return '1960_1969';
    if (year < 1980) return '1970_1979';
    if (year < 1990) return '1980_1989';
    if (year < 2000) return '1990_1999';
    if (year < 2010) return '2000_2009';
    if (year < 2020) return '2010_2019';
    return '2020_2024';
}

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
