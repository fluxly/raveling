import type { MarketplacePlugin, ChecklistItem, ListingPayload, ExportResult } from '../interface';

export const csvPlugin: MarketplacePlugin = {
    id:   'csv',
    name: 'CSV Export',
    icon: '📄',

    validate(payload: ListingPayload): ChecklistItem[] {
        return [
            {
                label:    'Title',
                status:   payload.title?.trim() ? 'pass' : 'fail',
                message:  payload.title?.trim() ? undefined : 'Required',
                required: true,
            },
            {
                label:    'Price',
                status:   payload.price > 0 ? 'pass' : 'fail',
                message:  payload.price > 0 ? `$${(payload.price / 100).toFixed(2)}` : 'Set a price',
                required: true,
            },
            {
                label:   'Description',
                status:  payload.description?.trim() ? 'pass' : 'warn',
                message: payload.description?.trim() ? undefined : 'Recommended',
            },
            {
                label:   'Condition',
                status:  payload.condition?.trim() ? 'pass' : 'warn',
                message: payload.condition?.trim() ? undefined : 'Recommended',
            },
            {
                label:   'Photos',
                status:  payload.photos?.length > 0 ? 'pass' : 'warn',
                message: payload.photos?.length > 0 ? `${payload.photos.length} photo(s)` : 'No photos attached',
            },
        ];
    },

    preview(payload: ListingPayload): string {
        const price = payload.price > 0 ? `$${(payload.price / 100).toFixed(2)}` : '—';
        const rows  = _csvRows(payload);
        return `
            <div style="font-family: 'Quantico', monospace; font-size: 0.8rem; color: rgba(255,255,255,0.75);">
                <div style="margin-bottom:10px; color:rgba(255,255,255,0.35); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.1em;">CSV Preview</div>
                <table style="width:100%; border-collapse:collapse; font-size:0.78rem;">
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.1)">
                        <th style="text-align:left; padding:4px 8px; color:rgba(255,255,255,0.4); font-weight:700; width:120px;">Field</th>
                        <th style="text-align:left; padding:4px 8px; color:rgba(255,255,255,0.4); font-weight:700;">Value</th>
                    </tr>
                    ${rows.map(([k, v]) => `
                        <tr style="border-bottom:1px solid rgba(255,255,255,0.05)">
                            <td style="padding:5px 8px; color:rgba(255,255,255,0.4);">${_hesc(k)}</td>
                            <td style="padding:5px 8px; color:#fff; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${_hesc(v)}</td>
                        </tr>`).join('')}
                </table>
                <div style="margin-top:10px; color:rgba(255,255,255,0.25); font-size:0.7rem;">Price: ${price} · ${payload.photos?.length ?? 0} photo(s)</div>
            </div>`;
    },

    async export(payload: ListingPayload): Promise<ExportResult> {
        const rows = _csvRows(payload);
        const header = rows.map(([k]) => _csvCell(k)).join(',');
        const values = rows.map(([, v]) => _csvCell(v)).join(',');
        const content = [header, values].join('\n');

        return {
            success:         true,
            message:         'Ready to save.',
            exportContent:   content,
            exportFilename:  `${_slug(payload.title)}.csv`,
            exportMimeType:  'text/csv',
        };
    },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function _csvRows(p: ListingPayload): [string, string][] {
    return [
        ['title',       p.title         ?? ''],
        ['description', p.description   ?? ''],
        ['price_usd',   p.price > 0 ? (p.price / 100).toFixed(2) : ''],
        ['condition',   p.condition     ?? ''],
        ['category',    p.category      ?? ''],
        ['sku',         (p.sku as string) ?? ''],
        ['tags',        (p.tags as string[])?.join('; ') ?? ''],
        ['photo_count', String(p.photos?.length ?? 0)],
    ];
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
