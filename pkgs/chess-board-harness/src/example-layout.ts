/** Inject the example activity's available space into the DOM layout port. */
export function attachExampleLayout(root: HTMLElement, host: HTMLElement) {
  root.style.width = '320px';
  const footprint = () => {
    const width =
      host.style.width === '100%'
        ? Number.parseFloat(root.style.width)
        : Number.parseFloat(host.style.width);
    const ratio = (host.style.aspectRatio || '1').split('/').map(Number);
    const height =
      host.style.height === ''
        ? (width * (ratio[1] ?? 1)) / (ratio[0] ?? 1)
        : Number.parseFloat(host.style.height);
    return new DOMRect(0, 0, width, height);
  };
  host.getBoundingClientRect = footprint;
  host.dispatchEvent(new Event('ui-testing:element-layout'));
  return {
    footprint,
    availableWidth: () => Number.parseFloat(root.style.width),
    setAvailableWidth(width: number) {
      root.style.width = `${width}px`;
      host.dispatchEvent(new Event('ui-testing:element-layout'));
    },
  };
}
