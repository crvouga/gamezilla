/**
 * Assign `srcdoc` on a real DOM iframe.
 * The web host does not reliably apply the `srcDoc` prop (especially
 * on the first of several client preview iframes), so the viewer must write
 * the DOM property + attribute after mount.
 */
export function applyPreviewIframeSrcdoc(
  el: {
    srcdoc: string;
    setAttribute: (name: string, value: string) => void;
  },
  html: string
): void {
  el.srcdoc = html;
  el.setAttribute('srcdoc', html);
}
