/**
 * Encode raw SVG markup as an `<img src>` data URI. Rendering SVG strings via
 * `<img>` (instead of `innerHTML`) keeps embedded scripts inert and lets the
 * plate scale the graphic with `object-fit`.
 */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
