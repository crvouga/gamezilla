/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { Tooltip } from '@pkgs/ui-client/tooltip';
import { fireEvent, screen } from '@solidjs/testing-library';
import fc from 'fast-check';
import { renderUi } from './render';

function checkTooltip(input: {
  x: number;
  y: number;
  placement: 'top-start' | 'bottom-end';
  scheme: 'dark' | 'light';
}) {
  const { x, y, placement, scheme } = input;
  const mounted = renderUi(
    () => (
      <Tooltip floating placement={placement} label="Attach">
        <button type="button">Attach</button>
      </Tooltip>
    ),
    { colorScheme: scheme }
  );
  try {
    const button = mounted.getByRole('button', { name: 'Attach' });
    const anchor = button.parentElement;
    const layer = screen
      .getByRole('tooltip', { hidden: true })
      .closest<HTMLElement>('[data-component="FloatingTooltip"]');
    if (!anchor || !layer) throw new Error('Tooltip host missing');
    anchor.getBoundingClientRect = () =>
      DOMRect.fromRect({ x, y, width: 44, height: 44 });
    layer.getBoundingClientRect = () =>
      DOMRect.fromRect({ width: 160, height: 30 });
    fireEvent.mouseEnter(anchor);
    expect(Number.parseFloat(layer.style.left)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(layer.style.left) + 160).toBeLessThanOrEqual(
      window.innerWidth - 8
    );
    expect(Number.parseFloat(layer.style.top)).toBeGreaterThanOrEqual(8);
    expect(Number.parseFloat(layer.style.top) + 30).toBeLessThanOrEqual(
      window.innerHeight - 8
    );
    expect(layer.getAttribute('data-theme')).toBe(scheme);
  } finally {
    mounted.unmount();
  }
}

test('floating tooltip labels stay within the viewport and retain their theme', () => {
  assertProperty(
    'floating-tooltip',
    fc.property(
      fc.integer({ min: 0, max: 1100 }),
      fc.integer({ min: 0, max: 800 }),
      fc.constantFrom('top-start' as const, 'bottom-end' as const),
      fc.constantFrom('dark' as const, 'light' as const),
      (x, y, placement, scheme) => {
        checkTooltip({ x, y, placement, scheme });
      }
    )
  );
});
