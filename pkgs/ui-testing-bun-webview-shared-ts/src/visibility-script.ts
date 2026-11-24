/** Check alternate landing controls with one page evaluation. */
export function visibilityScript(
  selectors: readonly string[],
  state: 'visible' | 'hidden' = 'visible'
): string {
  return `(function(){
    function visible(el) {
      const s = getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
      for (let parent = el.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (parent.hasAttribute('hidden') || style.display === 'none' || style.opacity === '0') return false;
      }
      if (s.opacity !== '0') return true;
      return el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox') &&
        Array.from(el.labels ?? []).some(visible);
    }
    return ${JSON.stringify(selectors)}.some(function(selector, index) {
      const el = document.querySelector(selector);
      const shown = el !== null && visible(el);
      return index === 0 && ${state === 'hidden'} ? !shown : shown;
    });
  })()`;
}
