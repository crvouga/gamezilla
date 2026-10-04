/** Normalize identifiers that cannot affect this snapshot's paint, retaining all visible content. */
const METADATA = [
  'data-testid',
  'data-actor',
  'data-surface',
  'key',
  'tabindex',
  'aria-controls',
  'aria-describedby',
  'aria-labelledby',
] as const;

function referencesAttribute(css: string, name: string): boolean {
  return new RegExp(`(?:\\[\\s*|attr\\(\\s*)${name}(?:\\W|$)`, 'i').test(css);
}

function svgFingerprint(encoded: string): string {
  let svg: string;
  try {
    svg = decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
  // Embedded styles or scripts can refer to IDs through arbitrary expressions.
  if (/<(?:style|script|animate\w*|set)\b|\b(?:begin|end|on\w+)=/i.test(svg))
    return encoded;
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]!);
  if (new Set(ids).size !== ids.length) return encoded;
  const names = new Map(ids.map((id, i) => [id, `uq-${i}`]));
  const references = [
    ...svg.matchAll(/url\((['"]?)#([^)'"\s]+)\1\)|\bhref="#([^"]+)"/g),
  ];
  if (references.some((m) => !names.has(m[2] ?? m[3]!))) return encoded;
  const normalized = svg
    .replace(/\bid="([^"]+)"/g, (_, id: string) => `id="${names.get(id)}"`)
    .replace(
      /url\((['"]?)#([^)'"\s]+)\1\)/g,
      (_, quote: string, id: string) =>
        `url(${quote}#${names.get(id) ?? id}${quote})`
    )
    .replace(
      /\b((?:xlink:)?href)="#([^"]+)"/g,
      (_, attr: string, id: string) => `${attr}="#${names.get(id) ?? id}"`
    );
  return encodeURIComponent(normalized);
}

export async function snapshotFingerprint(
  html: string,
  stylesheet: string
): Promise<string> {
  const css = `${stylesheet}\n${[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n')}`;
  const ignored = METADATA.filter((name) => !referencesAttribute(css, name));
  return new HTMLRewriter()
    .on('*', {
      element(element) {
        for (const name of ignored) element.removeAttribute(name);
        const id = element.getAttribute('id');
        // Keep IDs referenced by CSS, fragment links, SVG paint or form labels.
        if (
          id &&
          /^[\w-]+$/.test(id) &&
          !css.includes(`#${id}`) &&
          !referencesAttribute(css, 'id') &&
          !html.includes(`#${id}`) &&
          !html.includes(`for="${id}"`)
        )
          element.removeAttribute('id');
        const src = element.getAttribute('src');
        const prefix = 'data:image/svg+xml;utf8,';
        if (src?.startsWith(prefix) && !referencesAttribute(css, 'src'))
          element.setAttribute(
            'src',
            `${prefix}${svgFingerprint(src.slice(prefix.length))}`
          );
      },
    })
    .transform(new Response(html))
    .text();
}
