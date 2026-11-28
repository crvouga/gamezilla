// @io-wall-ok — Vite's HTML transform reads a local build input.
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';

/** Include a shared fragment in the document response, also in development. */
export function inlineHtmlFragment(marker: string, file: string) {
  return {
    name: 'inline-html-fragment',
    transformIndexHtml: {
      order: 'pre',
      handler: (html: string) =>
        html.replace(marker, () => readFileSync(file, 'utf8')),
    },
  } satisfies Plugin;
}
