/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { HouseIcon, XIcon } from '@pkgs/ui-client/icons';
import { OnColorProvider } from '@pkgs/ui-client/on-color-context';
import { screen } from '@solidjs/testing-library';
import { renderUi } from './render';

describe('icons', () => {
  test('decorative by default, labelled icons expose role=img', () => {
    renderUi(() => (
      <>
        <HouseIcon dataSet={{ testid: 'deco' }} />
        <XIcon label="Close" size={16} />
      </>
    ));
    expect(screen.getByTestId('deco')).toHaveAttribute('aria-hidden', 'true');
    const labelled = screen.getByRole('img', { name: 'Close' });
    const svg = labelled.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('16');
  });

  test('color resolves tokens; default stroke follows --ui-on-icon', () => {
    renderUi(() => (
      <>
        <HouseIcon color="destructive" dataSet={{ testid: 'tok' }} />
        <OnColorProvider value={{ fg: '#fff', fgMuted: '#eee', icon: '#abc' }}>
          <HouseIcon dataSet={{ testid: 'ctx' }} />
        </OnColorProvider>
      </>
    ));
    expect(
      screen.getByTestId('tok').querySelector('svg')?.getAttribute('stroke')
    ).toBe('var(--ui-color-destructive)');
    const ctx = screen.getByTestId('ctx');
    expect(ctx.querySelector('svg')?.getAttribute('stroke')).toBe(
      'var(--ui-on-icon)'
    );
    expect(ctx.parentElement?.style.getPropertyValue('--ui-on-icon')).toBe(
      '#abc'
    );
  });
});
