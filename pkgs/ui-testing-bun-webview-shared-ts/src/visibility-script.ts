/** Check alternate landing controls with one page evaluation. */
export function visibilityScript(selectors: readonly string[]): string {
  return `(function(){
    function visible(el) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.display === 'none' || style.opacity === '0') return false;
      }
      if (s.opacity !== '0') return true;
      return el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox') &&
        Array.from(el.labels ?? []).some(visible);
    }
    return ${JSON.stringify(selectors)}.some(function(selector) {
      const el = document.querySelector(selector);
      return el !== null && visible(el);
    });
  })()`;
}
