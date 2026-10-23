/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import type { LocalizedString } from '@pkgs/i18n-shared-ts/localized-string';
import { CodeEditor } from '@pkgs/ui-root-client-ts/code-editor';
import { CODE_EDITOR_LINE_HEIGHT } from '@pkgs/ui-root-shared-ts/code-editor-highlight';
import type { CodeToken } from '@pkgs/ui-root-shared-ts/code-editor-types';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { cssOf, mustQuery, renderUi } from './render';

const label = 'Code' as unknown as LocalizedString;

/** Tiny tokenizer: words starting with `k` are keywords, digits are numbers. */
function tokenize(src: string): readonly CodeToken[] {
  const out: CodeToken[] = [];
  const re = /k\w*|\d+/g;
  for (const m of src.matchAll(re)) {
    const start = m.index;
    out.push({
      kind: /^\d/.test(m[0]) ? 'number' : 'keyword',
      start,
      end: start + m[0].length,
    });
  }
  return out;
}

function textarea(): HTMLTextAreaElement {
  return screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Code' });
}

describe('CodeEditor', () => {
  test('renders a monospace textarea over a tokenized mirror', () => {
    renderUi(() => (
      <CodeEditor
        value="keep 42"
        onChangeText={() => {}}
        tokenize={tokenize}
        aria-label={label}
      />
    ));
    const root = mustQuery('[data-component="CodeEditor"]');
    expect(root).toBeTruthy();
    const field = textarea();
    expect(field.value).toBe('keep 42');
    // happy-dom's cssText parser drops quoted font stacks, so the mono
    // `font-family` cannot be asserted here; metrics + parity are.
    expect(cssOf(field)).toContain(`line-height:${CODE_EDITOR_LINE_HEIGHT}px`);
    expect(cssOf(field)).toContain('font-size:13px');
    const mirror = mustQuery('[data-component="CodeEditorMirror"]');
    expect(mirror.tagName).toBe('PRE');
    expect(mirror.getAttribute('aria-hidden')).toBe('true');
    expect(mirror.textContent).toBe('keep 42');
    expect(mirror.querySelectorAll('span')).toHaveLength(3);
    expect(cssOf(mirror)).toBe(cssOf(field));
  });

  test('grows with line count and honours minLines', () => {
    const [value, setValue] = createSignal('');
    renderUi(() => (
      <CodeEditor
        value={value()}
        onChangeText={setValue}
        tokenize={tokenize}
        minLines={2}
        aria-label={label}
      />
    ));
    const frame = mustQuery(
      '[data-component="CodeEditorMirror"]'
    ).parentElement;
    if (frame === null) throw new Error('mirror has no frame');
    expect(cssOf(frame)).toContain(
      `height:${2 * CODE_EDITOR_LINE_HEIGHT + 20}px`
    );
    setValue('a\nb\nc\nd');
    expect(cssOf(frame)).toContain(
      `height:${4 * CODE_EDITOR_LINE_HEIGHT + 20}px`
    );
  });

  test('reports text and selection changes from input/select events', async () => {
    const user = userEvent.setup();
    const onChangeText = mock();
    const onSelectionChange = mock();
    const [value, setValue] = createSignal('');
    renderUi(() => (
      <CodeEditor
        value={value()}
        onChangeText={(next) => {
          onChangeText(next);
          setValue(next);
        }}
        onSelectionChange={onSelectionChange}
        tokenize={tokenize}
        aria-label={label}
      />
    ));
    const field = textarea();
    await user.click(field);
    await user.keyboard('ab');
    expect(onChangeText).toHaveBeenLastCalledWith('ab');
    expect(field.value).toBe('ab');
    field.setSelectionRange(0, 1);
    fireEvent.select(field);
    expect(onSelectionChange).toHaveBeenLastCalledWith({ start: 0, end: 1 });
  });

  test('onKeyDown receives document keydown only while focused', async () => {
    const user = userEvent.setup();
    const onKeyDown = mock(() => true);
    renderUi(() => (
      <CodeEditor
        value=""
        onChangeText={() => {}}
        tokenize={tokenize}
        onKeyDown={onKeyDown}
        aria-label={label}
        trailing={<p class="text">{'hint'}</p>}
      />
    ));
    expect(screen.getByText('hint')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(onKeyDown).not.toHaveBeenCalled();
    await user.click(textarea());
    await user.keyboard('{Escape}');
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  test('editable={false} renders a read-only field', () => {
    renderUi(() => (
      <CodeEditor
        value="x"
        onChangeText={() => {}}
        tokenize={tokenize}
        editable={false}
        aria-label={label}
      />
    ));
    expect(textarea().readOnly).toBe(true);
  });
});
