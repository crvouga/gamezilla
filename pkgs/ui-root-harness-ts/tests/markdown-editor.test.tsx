import { test } from 'bun:test';
import { editor, formatAndUndo } from './markdown-editor-fixture';

// regression: markdown-property-editor-remount-cost
test('independent paragraphs can be formatted and undone in one editor', () => {
  const mounted = editor();
  try {
    for (const text of ['Board', 'movement feels clear', 'today'])
      formatAndUndo(mounted, text);
  } finally {
    mounted.unmount();
  }
});
