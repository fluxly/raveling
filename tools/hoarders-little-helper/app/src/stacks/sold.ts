export function render(): string {
    return `
        <div class="stack-view">
            <div class="stack-header">
                <span class="stack-header-icon" aria-hidden="true">✅</span>
                <h1 class="stack-title">Sold</h1>
            </div>
            <p class="stack-placeholder text">
                Completed sales with full provenance history. Phase 6.
            </p>
        </div>
    `;
}

export function mount(_el: HTMLElement): void {}
