/** Installed on a fresh about:blank target before its first navigation.
 * The first frame to start loading is the main frame. A click can start
 * another navigation there without changing Bun's view.loading flag. */
export function chromeDocumentLoad(view: EventTarget) {
  let mainFrame: string | undefined;
  let loading = false;
  function frameId(event: Event): string | undefined {
    const data: unknown = event instanceof MessageEvent ? event.data : null;
    return data !== null &&
      typeof data === 'object' &&
      'frameId' in data &&
      typeof data.frameId === 'string'
      ? data.frameId
      : undefined;
  }
  view.addEventListener('Page.frameStartedLoading', (event) => {
    const id = frameId(event);
    if (id === undefined) return;
    mainFrame ??= id;
    if (id === mainFrame) loading = true;
  });
  view.addEventListener('Page.domContentEventFired', () => {
    loading = false;
  });
  // A cancelled or same-document navigation can stop without a new DOM.
  view.addEventListener('Page.frameStoppedLoading', (event) => {
    if (mainFrame !== undefined && frameId(event) === mainFrame)
      loading = false;
  });
  return () => loading;
}
