import type { MarketplacePlugin, ChecklistItem, ListingPayload, ExportResult } from '../interface';

export const shopifyPlugin: MarketplacePlugin = {
    id:   'shopify',
    name: 'Shopify',
    icon: '🛍️',

    validate(payload: ListingPayload): ChecklistItem[] {
        const tags    = (payload.tags as string[] | undefined) ?? [];
        const hasDesc = !!payload.description?.trim();

        return [
            {
                label:    'Title',
                status:   payload.title?.trim() ? 'pass' : 'fail',
                message:  payload.title?.trim() ? undefined : 'Required for Shopify product',
                required: true,
            },
            {
                label:    'Price',
                status:   payload.price > 0 ? 'pass' : 'fail',
                message:  payload.price > 0 ? `$${(payload.price / 100).toFixed(2)}` : 'Required',
                required: true,
            },
            {
                label:   'Description',
                status:  hasDesc ? 'pass' : 'warn',
                message: hasDesc ? undefined : 'Product Body — used on the storefront page',
            },
            {
                label:   'Tags',
                status:  tags.length > 0 ? 'pass' : 'warn',
                message: tags.length > 0 ? `${tags.length} tag(s)` : 'Tags help customers filter your shop',
            },
            {
                label:   'Photos',
                status:  payload.photos?.length > 0 ? 'pass' : 'warn',
                message: payload.photos?.length ? `${payload.photos.length} photo(s) attached` : 'At least one product image recommended',
            },
        ];
    },

    preview(payload: ListingPayload): string {
        const title  = payload.title?.trim() || '—';
        const price  = payload.price > 0 ? `$${(payload.price / 100).toFixed(2)}` : '—';
        const tags   = (payload.tags as string[] | undefined) ?? [];
        const desc   = payload.description?.trim() ?? '';
        const vendor = (payload['publisher'] as string) || (payload['brand'] as string) || '';

        const tagChips = tags.map(t =>
            `<span style="background:rgba(0,128,96,0.15); border:1px solid rgba(0,128,96,0.3); color:#2DB87D; padding:2px 8px; border-radius:12px; font-size:0.7rem; white-space:nowrap;">${_hesc(t)}</span>`
        ).join(' ');

        return `
            <div style="font-family:'Quantico',monospace; font-size:0.82rem; color:rgba(255,255,255,0.8); line-height:1.55;">
                <div style="margin-bottom:10px; color:rgba(255,255,255,0.3); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em;">Shopify Product Preview</div>
                ${vendor ? `<div style="color:rgba(45,184,125,0.8); font-size:0.72rem; text-transform:uppercase; letter-spacing:0.06em; margin-bottom:4px;">${_hesc(vendor)}</div>` : ''}
                <div style="font-size:1.05rem; font-weight:700; color:#fff; margin-bottom:8px;">${_hesc(title)}</div>
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;">
                    <span style="background:rgba(45,184,125,0.15); border:1px solid rgba(45,184,125,0.4); color:#2DB87D; padding:4px 14px; border-radius:4px; font-size:1rem; font-weight:700;">${price}</span>
                    <span style="color:rgba(255,255,255,0.3); font-size:0.72rem;">📷 ${payload.photos?.length ?? 0} photo(s)</span>
                    <span style="color:rgba(255,255,255,0.3); font-size:0.72rem; background:rgba(45,184,125,0.1); border:1px solid rgba(45,184,125,0.2); padding:2px 8px; border-radius:3px;">Draft</span>
                </div>
                ${tags.length > 0 ? `<div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom:10px;">${tagChips}</div>` : ''}
                ${desc ? `<div style="color:rgba(255,255,255,0.55); font-size:0.78rem; border-top:1px solid rgba(255,255,255,0.07); padding-top:10px; max-height:80px; overflow:hidden;">${_hesc(desc)}</div>` : ''}
                <div style="margin-top:14px; color:rgba(255,255,255,0.18); font-size:0.68rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">Shopify product CSV · Import at: your-store.myshopify.com/admin/products</div>
            </div>`;
    },

    async export(payload: ListingPayload): Promise<ExportResult> {
        const handle  = _slug(payload.title);
        const price   = payload.price > 0 ? (payload.price / 100).toFixed(2) : '0.00';
        const tags    = ((payload.tags as string[] | undefined) ?? []).join(', ');
        const vendor  = ((payload['publisher'] as string) || (payload['brand'] as string) || '').trim();
        const body    = payload.description?.trim()
            ? `<p>${payload.description.trim().replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p>`
            : '';

        // Official Shopify product CSV format — import at Admin → Products → Import
        const header = [
            'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type', 'Tags',
            'Published', 'Option1 Name', 'Option1 Value',
            'Variant SKU', 'Variant Grams', 'Variant Inventory Qty',
            'Variant Inventory Policy', 'Variant Fulfillment Service',
            'Variant Price', 'Variant Compare At Price',
            'Variant Requires Shipping', 'Variant Taxable',
            'Image Src', 'Image Position', 'Image Alt Text', 'Status',
        ].join(',');

        const row = [
            _csvCell(handle),
            _csvCell(payload.title ?? ''),
            _csvCell(body),
            _csvCell(vendor),
            _csvCell(payload.category ?? ''),
            _csvCell(payload.category ?? ''),  // Type mirrors category
            _csvCell(tags),
            'false',        // Published — start as draft
            'Title',
            'Default Title',
            _csvCell(payload.sku ?? ''),
            '0',            // Variant Grams
            '1',            // Variant Inventory Qty
            'deny',         // Variant Inventory Policy
            'manual',       // Variant Fulfillment Service
            price,
            '',             // Variant Compare At Price
            'true',         // Variant Requires Shipping
            'true',         // Variant Taxable
            '',             // Image Src — add hosted URLs after upload
            '1',
            _csvCell(payload.title ?? ''),
            'draft',
        ].join(',');

        return {
            success:        true,
            message:        'Ready to save. Import at: your-store.myshopify.com/admin/products → Import.',
            exportContent:  [header, row].join('\n'),
            exportFilename: `${handle}-shopify.csv`,
            exportMimeType: 'text/csv',
        };
    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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
