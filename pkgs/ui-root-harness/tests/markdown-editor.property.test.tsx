/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { MarkdownEditor } from '@pkgs/ui-root-client/markdown-editor';
import { fireEvent } from '@solidjs/testing-library';
import fc from 'fast-check';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

const writing = fc
  .array(fc.constantFrom('Board', 'movement', 'feels', 'clear', 'today'), {
    minLength: 1,
    maxLength: 6,
  })
  .map((words) => words.join(' '));

function editor() {
  const [value, setValue] = createSignal('');
  const [limit, setLimit] = createSignal(1000);
  const mounted = renderUi(() => (
    <MarkdownEditor
      aria-label="Writing"
      value={value()}
      maxLength={limit()}
      onChange={setValue}
    />
  ));
  return {
    ...mounted,
    value,
    setValue,
    setLimit,
    heading: mounted.getByRole('button', { name: 'Heading' }),
    undo: mounted.getByRole('button', { name: 'Undo (⌘/Ctrl+Z)' }),
    field: mounted.getByRole('textbox'),
  };
}

function formatAndUndo(mounted: ReturnType<typeof editor>, text: string): void {
  mounted.setValue(text);
  fireEvent.click(mounted.heading);
  expect(mounted.field.querySelector('h2')?.textContent).toBe(text);
  expect(mounted.value()).toBe(`## ${text}`);
  fireEvent.click(mounted.undo);
  expect(mounted.field.querySelector('h2')).toBeNull();
  expect(mounted.value()).toBe(text);
}

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

test('formatting and undo preserve arbitrary authored paragraphs', () => {
  const mounted = editor();
  try {
    assertProperty(
      'markdown-editor',
      fc.property(writing, (text) => formatAndUndo(mounted, text))
    );
  } finally {
    mounted.unmount();
  }
});

test('formatting cannot exceed the serialized writing limit', () => {
  const mounted = editor();
  try {
    assertProperty(
      'markdown-editor',
      fc.property(writing, (text) => {
        mounted.setLimit(text.length);
        mounted.setValue(text);
        fireEvent.click(mounted.heading);
        expect(mounted.value()).toBe(text);
        expect(mounted.field.textContent).toBe(text);
        expect(mounted.field.querySelector('h2')).toBeNull();
      })
    );
  } finally {
    mounted.unmount();
  }
});

test('pasted links cannot introduce executable destinations', () => {
  const mounted = editor();
  try {
    assertProperty(
      'markdown-editor',
      fc.property(
        fc.constantFrom('javascript:', 'vbscript:', 'data:', '//'),
        writing,
        (scheme, text) => {
          mounted.setValue('');
          fireEvent.paste(mounted.field, {
            clipboardData: {
              files: [],
              getData: (type: string) =>
                type === 'text/html'
                  ? `<a href="${scheme}example.com">${text}</a>`
                  : text,
            },
          });
          expect(mounted.field.querySelector('a')).toBeNull();
          expect(mounted.field.textContent).toBe(text);
        }
      )
    );
  } finally {
    mounted.unmount();
  }
});
