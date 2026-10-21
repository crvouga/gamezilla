import type { SerializeDomHtmlOptions } from '@pkgs/ui-testing-solid-dom-shared-ts/serialize-dom-html';

/**
 * Reuse the last HTML when the document has not mutated. Layout and text
 * both notify the observer, including records not yet delivered to the
 * callback (`takeRecords`). A parked tree is not read through this cache.
 */
export function createHtmlSnapshotCache(
  document: Document,
  read: (options?: SerializeDomHtmlOptions) => string | undefined
): {
  snapshot(options?: SerializeDomHtmlOptions): string | undefined;
  close(): void;
} {
  let dirty = true;
  let html: string | undefined;
  let key = '';
  const observer = new MutationObserver(() => {
    dirty = true;
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  return {
    snapshot(options) {
      if (observer.takeRecords().length > 0) dirty = true;
      const next = options?.stylesheetHref ?? '';
      if (!dirty && html !== undefined && next === key) return html;
      key = next;
      html = read(options);
      dirty = html === undefined;
      return html;
    },
    close() {
      observer.disconnect();
    },
  };
}
