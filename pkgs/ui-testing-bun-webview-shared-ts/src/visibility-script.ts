/** Check alternate landing controls with one page evaluation. */
export function visibilityScript(selectors: readonly string[]): string {
  return `(function(){
    function ancestorsVisible(el) {
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (parent.hasAttribute('hidden') || style.display === 'none' || style.opacity === '0') return false;
      }
      return true;
    }
    return ${JSON.stringify(selectors)}.some(function(selector) {
    const el = document.querySelector(selector);
    if (!el || !ancestorsVisible(el)) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    if (s.opacity !== '0') return true;
    return el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox') &&
      Array.from(el.labels ?? []).some(label => {
        const style = getComputedStyle(label);
        return ancestorsVisible(label) && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      });
  }); })()`;
}
