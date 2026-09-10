/** @jsxImportSource solid-js */
import { OnColorProvider, Text } from '@pkgs/ui';
import { screen } from '@solidjs/testing-library';
import { describe, expect, test } from 'vitest';
import { cssOf, renderUi } from './support/render';

describe('Text', () => {
  test('applies variant typography and the text color variable', () => {
    renderUi(() => <Text data-testid="t" variant="heading" label="Hi" />);
    const el = screen.getByTestId('t');
    expect(el.className).toMatch(/textHeading/);
    expect(cssOf(el)).toContain('color:var(--ui-color-text)');
    expect(el).toHaveTextContent('Hi');
  });

  test('class color wins over the variant color', () => {
    renderUi(() => (
      <Text data-testid="t" class="text-destructive" label="Err" />
    ));
    expect(screen.getByTestId('t').className).toMatch(/text-destructive/);
  });

  test('reads the on-color context on colored surfaces', () => {
    renderUi(() => (
      <OnColorProvider background="#000000">
        <Text data-testid="t" label="On dark" />
      </OnColorProvider>
    ));
    const style = cssOf(screen.getByTestId('t'));
    expect(style).toContain('color:hsla(0,0%,100%,1)');
  });

  test('reserves a line for empty strings and clamps lines', () => {
    renderUi(() => <Text data-testid="t" label="" numberOfLines={2} as="p" />);
    const el = screen.getByTestId('t');
    expect(el.tagName).toBe('P');
    expect(el.textContent).toBe('\u200b');
    expect(cssOf(el)).toContain('-webkit-line-clamp:2');
  });
});
