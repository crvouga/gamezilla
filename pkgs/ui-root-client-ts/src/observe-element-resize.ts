type ResizeObserverHandle = Pick<
  ResizeObserver,
  'observe' | 'unobserve' | 'disconnect'
>;
type FrameScheduler = Pick<
  Window,
  'requestAnimationFrame' | 'cancelAnimationFrame'
>;

/** Batch every changed target outside ResizeObserver's layout delivery pass. */
export function createFrameResizeObserver(
  view: FrameScheduler,
  apply: (entries: readonly ResizeObserverEntry[]) => void
): ResizeObserverHandle | undefined {
  if (typeof ResizeObserver === 'undefined') return undefined;
  let frame: number | null = null;
  const pending = new Map<Element, ResizeObserverEntry>();
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) pending.set(entry.target, entry);
    if (frame !== null) return;
    frame = view.requestAnimationFrame(() => {
      frame = null;
      const batch = [...pending.values()];
      pending.clear();
      apply(batch);
    });
  });
  return {
    observe: (element, options) => observer.observe(element, options),
    unobserve: (element) => {
      pending.delete(element);
      observer.unobserve(element);
    },
    disconnect: () => {
      observer.disconnect();
      if (frame !== null) view.cancelAnimationFrame(frame);
      frame = null;
      pending.clear();
    },
  };
}

/** Reactive consumers may change the measured element's descendants. */
export function observeElementResize(
  element: Element,
  apply: (entry?: ResizeObserverEntry) => void
): () => void {
  const view = element.ownerDocument.defaultView;
  if (view === null) return () => undefined;
  const observer = createFrameResizeObserver(view, (entries) =>
    apply(entries[0])
  );
  observer?.observe(element);
  return () => observer?.disconnect();
}
