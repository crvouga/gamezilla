/** @jsxImportSource solid-js */
import { expect } from 'bun:test';
import { MarkdownEditor } from '@pkgs/ui-root-client-ts/markdown-editor';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

export function editor() {
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

export function formatAndUndo(
  mounted: ReturnType<typeof editor>,
  text: string
): void {
  mounted.setValue(text);
  fireEvent.click(mounted.heading);
  expect(mounted.field.querySelector('h2')?.textContent).toBe(text);
  expect(mounted.value()).toBe(`## ${text}`);
  fireEvent.click(mounted.undo);
  expect(mounted.field.querySelector('h2')).toBeNull();
  expect(mounted.value()).toBe(text);
}
