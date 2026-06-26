import * as inbox       from './stacks/inbox';
import * as items       from './stacks/items';
import * as collections from './stacks/collections';
import * as listings    from './stacks/listings';
import * as sold        from './stacks/sold';
import * as reports     from './stacks/reports';
import * as settings    from './stacks/settings';
import * as quiddity    from './stacks/quiddity';
import { resetNavSignal } from './nav-signal';

type Stack = {
    render(): string;
    mount(el: HTMLElement): void | Promise<void>;
};

const STACKS: Record<string, Stack> = {
    inbox, items, collections, listings, sold, reports, settings, quiddity,
};

export class Router {
    private _content:  HTMLElement;
    private _current:  string = '';

    constructor(contentEl: HTMLElement) {
        this._content = contentEl;
    }

    navigate(id: string): void {
        if (id === this._current) return;
        this._current = id;

        resetNavSignal(); // abort listeners registered by the previous stack

        const stack = STACKS[id];
        if (!stack) {
            this._content.innerHTML = `<div class="stack-view"><p class="stack-placeholder text">Unknown stack: ${id}</p></div>`;
            return;
        }

        this._content.innerHTML = stack.render() + Router._sharedStyles;

        // Move focus to the stack heading — standard SPA a11y pattern.
        // tabindex="-1" makes any h1 programmatically focusable without entering tab order.
        const h1 = this._content.querySelector<HTMLElement>('h1');
        if (h1) {
            h1.setAttribute('tabindex', '-1');
            h1.focus({ preventScroll: true });
        }

        void stack.mount(this._content);
    }

    // Shared CSS injected into every stack view — avoids a separate stylesheet.
    private static readonly _sharedStyles = `
        <style>
            .stack-view {
                display: flex;
                flex-direction: column;
                height: 100%;
                overflow-y: auto;
                padding: 28px 32px;
                gap: 20px;
            }
            .stack-header {
                display: flex;
                align-items: center;
                gap: 14px;
                padding-bottom: 16px;
                border-bottom: 1px solid rgba(255,255,255,0.07);
                flex-shrink: 0;
            }
            .stack-header-icon { font-size: 28px; line-height: 1; }
            .stack-title {
                font-family: 'Silkscreen', monospace;
                font-size: 1.5rem;
                color: #fff;
                flex: 1;
                outline: none; /* receives programmatic focus only — no visible ring needed */
            }
            .stack-count {
                font-size: 1rem;
                color: rgba(255,255,255,0.35);
            }
            .stack-placeholder {
                font-size: 1rem;
                color: rgba(255,255,255,0.35);
                line-height: 1.6;
                max-width: 480px;
            }
            .stack-actions {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }
            .hlh-btn {
                appearance: none;
                background: rgba(255,79,179,0.12);
                border: 1px solid rgba(255,79,179,0.35);
                border-radius: 5px;
                color: #fff;
                font-family: 'Silkscreen', monospace;
                font-size: 1rem;
                padding: 10px 18px;
                cursor: pointer;
                transition: background 0.12s, border-color 0.12s;
                min-height: 44px;
            }
            .hlh-btn:hover {
                background: rgba(255,79,179,0.22);
                border-color: rgba(255,79,179,0.55);
            }
            .hlh-btn:focus-visible {
                outline: 2px solid #00F0FF;
                outline-offset: 2px;
            }
            .settings-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 18px 0;
                border-bottom: 1px solid rgba(255,255,255,0.06);
            }
            .settings-label {
                font-size: 9px;
                letter-spacing: 0.12em;
                color: rgba(255,255,255,0.28);
                text-transform: uppercase;
            }
            .settings-value {
                font-size: 1rem;
                color: rgba(255,255,255,0.65);
                line-height: 1.5;
            }
            .text { font-family: 'Quantico', monospace; }

            /* ── Settings ── */
            .settings-hint {
                font-size: 0.75rem;
                color: rgba(255,255,255,0.25);
                line-height: 1.5;
                margin-top: 6px;
            }
            .api-key-row {
                display: flex;
                gap: 10px;
                align-items: center;
                flex-wrap: wrap;
                margin-top: 8px;
            }
            .api-key-input {
                flex: 1;
                min-width: 220px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 5px;
                color: #E6E2D3;
                font-size: 0.9rem;
                padding: 10px 14px;
                min-height: 44px;
                letter-spacing: 0.04em;
            }
            .api-key-input:focus {
                outline: 2px solid #00F0FF;
                outline-offset: 1px;
                border-color: rgba(0,240,255,0.3);
            }

            /* ── Ghost / active button variants ── */
            .hlh-btn-ghost {
                background: transparent;
                border-color: rgba(255,255,255,0.15);
                color: rgba(255,255,255,0.55);
            }
            .hlh-btn-ghost:hover {
                background: rgba(255,255,255,0.06);
                border-color: rgba(255,255,255,0.25);
            }
            .hlh-btn-active {
                background: rgba(167,255,0,0.12);
                border-color: rgba(167,255,0,0.35);
                color: #A7FF00;
            }

            /* ── Quiddity tab UI ── */
            .q-tabs {
                display: flex;
                gap: 4px;
                border-bottom: 1px solid rgba(255,255,255,0.08);
                padding-bottom: 0;
                flex-shrink: 0;
            }
            .q-tab {
                appearance: none;
                background: none;
                border: none;
                border-bottom: 2px solid transparent;
                color: rgba(255,255,255,0.40);
                font-family: 'Quantico', monospace;
                font-size: 0.82rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                padding: 8px 14px 10px;
                cursor: pointer;
                min-height: 44px;
                transition: color 0.12s, border-color 0.12s;
            }
            .q-tab:hover { color: rgba(255,255,255,0.70); }
            .q-tab.active {
                color: #00F0FF;
                border-bottom-color: #00F0FF;
            }
            .q-tab:focus-visible { outline: 2px solid #00F0FF; outline-offset: 2px; }

            .q-tab-content { flex: 1; overflow-y: auto; padding-top: 20px; }

            .q-loading { color: rgba(255,255,255,0.3); font-style: italic; }
            .q-empty   { color: rgba(255,255,255,0.3); font-style: italic; line-height: 1.6; }

            .q-thread-list { display: flex; flex-direction: column; gap: 2px; }
            .q-thread-row {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 12px 16px;
                background: rgba(255,255,255,0.03);
                border-radius: 6px;
            }
            .q-thread-info { display: flex; flex-direction: column; flex: 1; }
            .q-thread-name { font-size: 0.9rem; color: rgba(255,255,255,0.85); }
            .q-thread-version { font-size: 0.72rem; color: rgba(255,255,255,0.35); }
            .q-thread-meta { display: flex; flex-direction: column; gap: 2px; }
            .q-thread-id { font-size: 0.72rem; color: rgba(255,255,255,0.30); font-family: 'Quantico', monospace; }
            .q-thread-priority { font-size: 0.7rem; color: rgba(255,255,255,0.25); }

            .q-search-bar { margin-bottom: 16px; }
            .q-search-input, .q-input {
                width: 100%;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.12);
                border-radius: 5px;
                color: #E6E2D3;
                font-family: 'Quantico', monospace;
                font-size: 0.9rem;
                padding: 10px 14px;
                min-height: 44px;
            }
            .q-search-input:focus, .q-input:focus {
                outline: 2px solid #00F0FF;
                outline-offset: 1px;
            }

            .q-results { display: flex; flex-direction: column; gap: 8px; }
            .q-card {
                background: rgba(255,255,255,0.04);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 6px;
                padding: 12px 16px;
                display: grid;
                grid-template-columns: auto 1fr auto;
                grid-template-rows: auto auto;
                gap: 2px 10px;
            }
            .q-card-qid   { grid-row: 1; grid-column: 1; font-size: 0.72rem; color: rgba(255,255,255,0.35); font-family: 'Quantico', monospace; align-self: center; }
            .q-card-name  { grid-row: 1; grid-column: 2; font-size: 0.9rem; color: rgba(255,255,255,0.85); }
            .q-card-sub   { grid-row: 2; grid-column: 2; font-size: 0.78rem; color: rgba(255,255,255,0.45); }
            .q-card-type  { grid-row: 1; grid-column: 3; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.06em; color: rgba(0,240,255,0.7); padding: 2px 7px; border: 1px solid rgba(0,240,255,0.2); border-radius: 999px; align-self: center; }

            .q-wl-actions  { margin-bottom: 12px; }
            .q-wl-form     { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; padding: 14px; background: rgba(255,255,255,0.04); border-radius: 6px; }
            .form-actions  { display: flex; gap: 8px; }
            .q-wl-list     { display: flex; flex-direction: column; gap: 4px; }
            .q-wl-row      { border: 1px solid rgba(255,255,255,0.07); border-radius: 6px; overflow: hidden; }
            .q-wl-expand   {
                width: 100%;
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 16px;
                background: rgba(255,255,255,0.03);
                border: none;
                color: inherit;
                font-family: 'Silkscreen', monospace;
                font-size: 0.82rem;
                cursor: pointer;
                text-align: left;
                min-height: 44px;
            }
            .q-wl-expand:hover { background: rgba(255,255,255,0.06); }
            .q-wl-expand:focus-visible { outline: 2px solid #00F0FF; outline-offset: 2px; }
            .q-wl-name    { flex: 1; color: rgba(255,255,255,0.80); }
            .q-wl-meta    { font-size: 0.70rem; color: rgba(255,255,255,0.30); font-family: 'Quantico', monospace; }
            .q-wl-chevron { font-size: 0.65rem; color: rgba(255,255,255,0.25); }
            .q-wl-detail  { padding: 12px 16px; background: rgba(0,0,0,0.15); }
            .wl-item-row  { display: flex; gap: 10px; align-items: center; padding: 4px 0; border-top: 1px solid rgba(255,255,255,0.04); }
            .wl-item-qid  { font-size: 0.78rem; color: rgba(255,255,255,0.7); font-family: 'Quantico', monospace; }
            .wl-item-notes { font-size: 0.72rem; color: rgba(255,255,255,0.35); font-style: italic; }

            @media (prefers-reduced-motion: reduce) {
                *, *::before, *::after { transition: none !important; animation: none !important; }
            }
        </style>
    `;
}
