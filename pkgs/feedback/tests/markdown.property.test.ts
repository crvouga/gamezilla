import { expect, test } from 'bun:test';
import {
  feedbackMarkdownBlocks,
  safeMarkdownHref,
} from '@pkgs/feedback/client';
import { assertProperty, fc } from '@pkgs/property';

test('fenced Markdown preserves arbitrary code verbatim', async () => {
  await assertProperty(
    'feedback-markdown',
    fc.property(
      fc.string().filter((text) => !text.includes('```')),
      (text) => {
        expect(feedbackMarkdownBlocks(`\`\`\`ts\n${text}\n\`\`\``)).toEqual([
          { type: 'code', text },
        ]);
      }
    )
  );
});
test('Markdown links cannot select executable or implicit remote destinations', async () => {
  await assertProperty(
    'feedback-markdown',
    fc.property(
      fc.constantFrom('javascript:', 'data:', 'vbscript:', '//'),
      fc.string(),
      (scheme, rest) => {
        expect(safeMarkdownHref(`${scheme}${rest}`)).toBeUndefined();
      }
    )
  );
});
