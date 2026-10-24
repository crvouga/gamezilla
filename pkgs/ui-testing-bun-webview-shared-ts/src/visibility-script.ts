/** Check alternate landing controls with one page evaluation. */
export function visibilityScript(selectors: readonly string[]): string {
  return `(function(){ return ${JSON.stringify(selectors)}.some(function(selector) {
    const el = document.querySelector(selector);
    if (!el) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    if (s.opacity !== '0') return true;
    return el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox') &&
      Array.from(el.labels ?? []).some(label => {
        const style = getComputedStyle(label);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });
  }); })()`;
}
