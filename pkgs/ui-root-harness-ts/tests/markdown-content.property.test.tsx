/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { MarkdownContent } from '@pkgs/ui-root-client-ts/markdown-content';
import fc from 'fast-check';
import { renderUi } from './render';

test('fenced Markdown preserves arbitrary code verbatim', () => {
  assertProperty(
    'markdown-content',
    fc.property(
      fc.string().filter((text) => !text.includes('```')),
      (text) => {
        const mounted = renderUi(() => (
          <MarkdownContent value={`\`\`\`ts\n${text}\n\`\`\``} />
        ));
        try {
          expect(mounted.container.querySelector('code')?.textContent).toBe(
            text
          );
        } finally {
          mounted.unmount();
        }
      }
    )
  );
});

test('Markdown links cannot select executable or implicit remote destinations', () => {
  assertProperty(
    'markdown-content',
    fc.property(
      fc.constantFrom('javascript:', 'data:', 'vbscript:', '//'),
      fc.stringMatching(/^[a-z]{1,12}$/),
      (scheme, rest) => {
        const mounted = renderUi(() => (
          <MarkdownContent value={`[Open](${scheme}${rest})`} />
        ));
        try {
          expect(mounted.container.querySelector('a')).toBeNull();
        } finally {
          mounted.unmount();
        }
      }
    )
  );
});
