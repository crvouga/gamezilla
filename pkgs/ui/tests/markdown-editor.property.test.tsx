/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';
import { MarkdownEditor } from '@pkgs/ui';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderUi } from './support/render';

const writing = fc
  .array(fc.constantFrom('Board', 'movement', 'feels', 'clear', 'today'), {
    minLength: 1,
    maxLength: 6,
  })
  .map((words) => words.join(' '));

test('formatting and undo preserve arbitrary authored paragraphs', () => {
  assertProperty(
    'markdown-editor',
    fc.property(writing, (text) => {
      let value = text;
      const mounted = renderUi(() => {
        const [source, setSource] = createSignal(text);
        return (
          <MarkdownEditor
            aria-label="Writing"
            value={source()}
            onChange={(next) => {
              value = next;
              setSource(next);
            }}
          />
        );
      });
      try {
        fireEvent.click(mounted.getByRole('button', { name: 'Heading' }));
        expect(
          mounted.getByRole('textbox').querySelector('h2')?.textContent
        ).toBe(text);
        expect(value).toBe(`## ${text}`);
        fireEvent.click(
          mounted.getByRole('button', { name: 'Undo (⌘/Ctrl+Z)' })
        );
        expect(mounted.getByRole('textbox').querySelector('h2')).toBeNull();
        expect(value).toBe(text);
      } finally {
        mounted.unmount();
      }
    })
  );
});

test('formatting cannot exceed the serialized writing limit', () => {
  assertProperty(
    'markdown-editor',
    fc.property(writing, (text) => {
      let changed = false;
      const mounted = renderUi(() => (
        <MarkdownEditor
          aria-label="Writing"
          value={text}
          maxLength={text.length}
          onChange={() => {
            changed = true;
          }}
        />
      ));
      try {
        fireEvent.click(mounted.getByRole('button', { name: 'Heading' }));
        expect(changed).toBe(false);
        expect(mounted.getByRole('textbox').textContent).toBe(text);
        expect(mounted.getByRole('textbox').querySelector('h2')).toBeNull();
      } finally {
        mounted.unmount();
      }
    })
  );
});

test('pasted links cannot introduce executable destinations', () => {
  assertProperty(
    'markdown-editor',
    fc.property(
      fc.constantFrom('javascript:', 'vbscript:', 'data:', '//'),
      writing,
      (scheme, text) => {
        const mounted = renderUi(() => (
          <MarkdownEditor aria-label="Writing" value="" onChange={() => {}} />
        ));
        try {
          const field = mounted.getByRole('textbox');
          fireEvent.paste(field, {
            clipboardData: {
              files: [],
              getData: (type: string) =>
                type === 'text/html'
                  ? `<a href="${scheme}example.com">${text}</a>`
                  : text,
            },
          });
          expect(field.querySelector('a')).toBeNull();
          expect(field.textContent).toBe(text);
        } finally {
          mounted.unmount();
        }
      }
    )
  );
});
