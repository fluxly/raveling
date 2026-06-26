export function render(): string {
    return `
        <div class="stack-view">
            <div class="stack-header">
                <span class="stack-header-icon" aria-hidden="true">📊</span>
                <h1 class="stack-title">Reports</h1>
            </div>
            <p class="stack-placeholder text">
                Valuation summaries, inventory exports, analytics. Phase 7.
            </p>
        </div>
    `;
}

export function mount(_el: HTMLElement): void {}
