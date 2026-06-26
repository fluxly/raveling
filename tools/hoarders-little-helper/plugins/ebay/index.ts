import type { MarketplacePlugin, ChecklistItem, ListingPayload, ExportResult } from '../interface';

const EBAY_CONDITIONS: Record<string, { id: number; label: string }> = {
    mint:  { id: 1000, label: 'New' },
    fine:  { id: 1500, label: 'New Other (no tags)' },
    vg:    { id: 4000, label: 'Used – Like New' },
    good:  { id: 5000, label: 'Used – Good' },
    fair:  { id: 6000, label: 'Used – Acceptable' },
    poor:  { id: 7000, label: 'For Parts or Not Working' },
};

export const ebayPlugin: MarketplacePlugin = {
    id:   'ebay',
    name: 'eBay',
    icon: '🏷️',

    validate(payload: ListingPayload): ChecklistItem[] {
        const title     = payload.title?.trim() ?? '';
        const titleLen  = title.length;
        const condKey   = (payload.condition ?? '').toLowerCase();
        const condFound = !!EBAY_CONDITIONS[condKey];

        return [
            {
                label:    'Title (≤80 chars)',
                status:   !title ? 'fail' : titleLen > 80 ? 'fail' : 'pass',
                message:  !title ? 'Required'
                        : titleLen > 80 ? `Too long: ${titleLen}/80 characters`
                        : `${titleLen}/80 characters`,
                required: true,
            },
            {
                label:    'Price',
                status:   payload.price > 0 ? 'pass' : 'fail',
                message:  payload.price > 0 ? `$${(payload.price / 100).toFixed(2)}` : 'Required',
                required: true,
            },
            {
                label:   'Condition',
                status:  condFound ? 'pass' : 'warn',
                message: condFound
                    ? _cond(payload.condition).label
                    : `Unrecognized — will export as "Used – Good" (ID 5000)`,
            },
            {
                label:   'Description',
                status:  payload.description?.trim() ? 'pass' : 'warn',
                message: payload.description?.trim() ? undefined : 'Strongly recommended — improves search placement',
            },
            {
                label:   'Category',
                status:  payload.category?.trim() ? 'pass' : 'warn',
                message: payload.category?.trim() ? payload.category : 'Add an eBay category number for best accuracy',
            },
            {
                label:   'Photos',
                status:  payload.photos?.length > 0 ? 'pass' : 'warn',
                message: payload.photos?.length ? `${payload.photos.length} photo(s) attached` : 'Photos increase sell-through by 3×',
            },
        ];
    },

    preview(payload: ListingPayload): string {
        const title    = payload.title?.trim() || '—';
        const price    = payload.price > 0 ? `US $${(payload.price / 100).toFixed(2)}` : '—';
        const cond     = _cond(payload.condition).label;
        const desc     = payload.description?.trim() ?? '';
        const photoMsg = payload.photos?.length ? `${payload.photos.length} photo(s)` : 'No photos';
        const titleLen = (payload.title ?? '').length;

        return `
            <div style="font-family:'Quantico',monospace; font-size:0.82rem; color:rgba(255,255,255,0.8); line-height:1.55;">
                <div style="margin-bottom:10px; color:rgba(255,255,255,0.3); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em;">eBay File Exchange Preview</div>
                <div style="font-size:1.05rem; font-weight:700; margin-bottom:4px; color:${titleLen > 80 ? '#FF5555' : '#fff'};">${_hesc(title)}</div>
                ${titleLen > 80 ? `<div style="color:#FF5555; font-size:0.7rem; margin-bottom:6px;">⚠ ${titleLen} chars — eBay enforces 80-char limit</div>` : ''}
                <div style="display:flex; gap:10px; flex-wrap:wrap; margin-top:10px; align-items:center;">
                    <span style="background:rgba(255,120,0,0.15); border:1px solid rgba(255,120,0,0.45); color:#FF8C00; padding:4px 14px; border-radius:4px; font-size:1rem; font-weight:700;">${price}</span>
                    <span style="background:rgba(30,120,230,0.12); border:1px solid rgba(30,120,230,0.35); color:#6AB4FF; padding:3px 10px; border-radius:4px; font-size:0.78rem;">${_hesc(cond)}</span>
                    <span style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.35); padding:3px 9px; border-radius:4px; font-size:0.72rem;">📷 ${photoMsg}</span>
                </div>
                ${desc ? `<div style="margin-top:12px; color:rgba(255,255,255,0.55); font-size:0.78rem; border-top:1px solid rgba(255,255,255,0.07); padding-top:10px; max-height:80px; overflow:hidden;">${_hesc(desc)}</div>` : ''}
                <div style="margin-top:14px; color:rgba(255,255,255,0.18); font-size:0.68rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">Upload at: seller.ebay.com → Listings → File Exchange</div>
            </div>`;
    },

    async export(payload: ListingPayload): Promise<ExportResult> {
        const cond  = _cond(payload.condition);
        const price = payload.price > 0 ? (payload.price / 100).toFixed(2) : '0.00';
        const title = (payload.title ?? '').slice(0, 80);

        // eBay File Exchange format — Version=745, FixedPrice / GTC
        const header = [
            '*Action(SiteID=US|Country=US|Currency=USD|Version=745|CC=UTF-8)',
            'CustomLabel', 'Category', 'Title',
            'StartPrice', 'BuyItNowPrice', 'Quantity', 'ConditionID',
            'Description', 'PicURL', 'Format', 'Duration', 'ImmediatePayRequired',
        ].join(',');

        const row = [
            'Add',
            _csvCell(payload.sku ?? ''),
            _csvCell(payload.category ?? ''),
            _csvCell(title),
            price,
            price,
            '1',
            String(cond.id),
            _csvCell(payload.description ?? ''),
            '', // PicURL — requires publicly hosted URLs; add after uploading photos to eBay
            'FixedPrice',
            'GTC',
            '1',
        ].join(',');

        return {
            success:        true,
            message:        'Ready to save. Upload at: seller.ebay.com → Listings → File Exchange.',
            exportContent:  [header, row].join('\n'),
            exportFilename: `${_slug(payload.title)}-ebay.csv`,
            exportMimeType: 'text/csv',
        };
    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function _cond(c: string): { id: number; label: string } {
    return EBAY_CONDITIONS[(c ?? '').toLowerCase()] ?? { id: 5000, label: 'Used – Good' };
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
