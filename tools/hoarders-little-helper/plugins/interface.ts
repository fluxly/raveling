/**
 * MarketplacePlugin interface — implemented by every marketplace connector.
 *
 * Plugins are pure TypeScript — no Tauri IPC in the interface itself.
 * File I/O happens via Tauri in the export() implementation when needed.
 */

export interface ChecklistItem {
    label:     string;
    status:    'pass' | 'warn' | 'fail' | 'pending';
    message?:  string;
    required?: boolean;
}

export interface ListingPayload {
    title:         string;
    description:   string;
    price:         number;       // USD cents
    condition:     string;
    category:      string;
    photos:        string[];     // local file paths
    sku?:          string;
    tags?:         string[];
    [key: string]: unknown;
}

export interface ExportResult {
    success:      boolean;
    message:      string;
    remoteId?:    string;        // ID assigned by the marketplace
    exportPath?:  string;        // local file path for CSV/text exports (set by app after save)
    // For file-based exports (CSV, etc.) — app layer handles the Tauri save dialog
    exportContent?:   string;   // file content to write
    exportFilename?:  string;   // suggested filename
    exportMimeType?:  string;   // e.g. 'text/csv'
}

export interface MarketplacePlugin {
    readonly id:   string;       // e.g. 'csv', 'abebooks', 'shopify'
    readonly name: string;       // Display name
    readonly icon: string;       // Emoji or short label

    /**
     * Returns a list of checklist items describing whether the listing is
     * ready to publish. Plugins should mark items as 'pending' when they
     * cannot evaluate (e.g. API key not set).
     */
    validate(payload: ListingPayload): ChecklistItem[];

    /**
     * Returns an HTML string for the live preview panel.
     * Must be safe to inject into a shadow DOM container (no <script> tags).
     */
    preview(payload: ListingPayload): string;

    /**
     * Perform the actual export/publish operation.
     * May open a Tauri save dialog, call an API, write a file, etc.
     */
    export(payload: ListingPayload): Promise<ExportResult>;
}
