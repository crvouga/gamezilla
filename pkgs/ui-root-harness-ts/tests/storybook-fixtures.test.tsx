import { expect, test } from 'bun:test';
import SpinnerExample from '@pkgs/ui-root-client-ts/spinner/spinner.example';
import { renderUi } from './render';

// regression: scheme-preview-all-caps-labels
test('component examples present their states once without appearance labels', () => {
  const { container } = renderUi(() => <SpinnerExample />);
  expect(
    container.querySelectorAll('[data-component="Spinner"]').length
  ).toBeGreaterThan(0);
  expect(container.textContent).not.toMatch(/\b(light|dark)\b/i);
});
