import { expect, test } from 'bun:test';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useThemeTokens } from '@pkgs/ui-root-client-ts/theme-context';
import { screen } from '@solidjs/testing-library';
import { SchemePreview } from '../../ui-root-client-ts/storybook/fixtures/scheme-preview';
import { renderUi } from './render';

test('theme preview renders children in both theme panes', () => {
  renderUi(() => (
    <SchemePreview>
      <P>preview child</P>
    </SchemePreview>
  ));
  for (const scheme of ['light', 'dark'])
    expect(
      document.querySelector(`[data-scheme="${scheme}"]`)?.textContent
    ).toContain('preview child');
  expect(screen.getAllByText('preview child')).toHaveLength(2);
});

// regression: scheme-preview-all-caps-labels
test('theme preview labels use sentence case in the footnote role', () => {
  renderUi(() => (
    <SchemePreview>
      <P>preview child</P>
    </SchemePreview>
  ));
  for (const name of ['Light', 'Dark']) {
    const label = screen.getByText(name);
    expect(label.textContent).toBe(name);
    expect(label.className).toMatch(/\btextFootnote\b/);
    expect(label.className).not.toMatch(/uppercase|tracking/);
  }
});

function ThemeReading() {
  const theme = useThemeTokens();
  return <P>{theme.colorScheme()}</P>;
}

test('preview CSS and JavaScript consumers read the same scheme', () => {
  renderUi(() => (
    <SchemePreview>
      <ThemeReading />
    </SchemePreview>
  ));
  expect(screen.getAllByText('light', { exact: true })).toHaveLength(1);
  expect(screen.getAllByText('dark', { exact: true })).toHaveLength(1);
});
