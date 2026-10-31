import { expect, test } from 'bun:test';
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

// regression: ui-editor-unsupported-expanded-state
test('a multiline textbox does not announce an unsupported expanded state', () => {
  const mounted = editor();
  try {
    expect(mounted.field.getAttribute('role')).toBe('textbox');
    expect(mounted.field.hasAttribute('aria-expanded')).toBe(false);
  } finally {
    mounted.unmount();
  }
});
