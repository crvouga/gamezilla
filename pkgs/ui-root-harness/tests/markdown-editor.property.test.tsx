import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { fireEvent } from '@solidjs/testing-library';
import fc from 'fast-check';
import { editor, formatAndUndo } from './markdown-editor-fixture';

const writing = fc
  .array(fc.constantFrom('Board', 'movement', 'feels', 'clear', 'today'), {
    minLength: 1,
    maxLength: 6,
  })
  .map((words) => words.join(' '));

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
