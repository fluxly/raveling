// AbortController reset on every router navigation — lets stacks register
// document-level event listeners that auto-clean up when the user navigates away.
let _ctrl = new AbortController();
export function getNavSignal(): AbortSignal  { return _ctrl.signal; }
export function resetNavSignal(): void       { _ctrl.abort(); _ctrl = new AbortController(); }
