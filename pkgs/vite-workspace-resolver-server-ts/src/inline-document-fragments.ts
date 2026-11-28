// @io-wall-ok — Vite's HTML transform reads local build inputs.
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/** Keep first-paint styles and markup in the HTML response in dev and builds. */
export function inlineDocumentFragments(
  files: Readonly<Record<string, string>>,
  renderCss: (css: string) => string
) {
  return {
    name: 'inline-document-fragments',
    transformIndexHtml: {
      order: 'pre',
      handler: (html: string) =>
        html.replace(
          /(?:<!-- include ([a-z0-9-]+\.html) -->|\/\* include ([a-z0-9-]+\.css) \*\/)/g,
          (_, htmlFile: string | undefined, cssFile: string) => {
            const name = htmlFile ?? cssFile;
            const file = files[name];
            if (file === undefined)
              throw new Error(`Unknown document fragment: ${name}`);
            const source = readFileSync(file, 'utf8');
            return name.endsWith('.css') ? renderCss(source) : source;
          }
        ),
    },
  } satisfies Plugin;
}
