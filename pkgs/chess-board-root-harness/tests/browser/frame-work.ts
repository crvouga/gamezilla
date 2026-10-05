/** Observe native frame work, including records already delivered as microtasks. */
export function observeFrameWork(script: string): string {
  return `(async () => {
    let writes = 0;
    const observer = new MutationObserver(records => { writes += records.length; });
    observer.observe(document.querySelector('[data-testid="browser-board"]'),
      {subtree:true,attributes:true,childList:true,characterData:true});
    try {
      ${script};
      await window.boardExample.paint();
      return writes + observer.takeRecords().length;
    } finally { observer.disconnect(); }
  })()`;
}
