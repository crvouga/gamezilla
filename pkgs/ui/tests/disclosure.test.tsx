/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import {
  Collapsible,
  ScreenLargeTitle,
  ScreenTitleProvider,
  useRequiredScreenTitleContext,
  useScreenTitleScroll,
} from '@pkgs/ui';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'solid-js';
import { renderUi } from './support/render';

describe('Collapsible', () => {
  test('toggles body and aria-expanded', async () => {
    const user = userEvent.setup();
    renderUi(() => (
      <Collapsible title="More">
        <p class="text">{'hidden body'}</p>
      </Collapsible>
    ));
    const toggle = screen.getByRole('button', { name: 'More' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('hidden body')).toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('hidden body')).toBeInTheDocument();
  });
});

describe('ScreenTitle', () => {
  function Scroller(): JSX.Element {
    const scroll = useScreenTitleScroll();
    const ctx = useRequiredScreenTitleContext();
    return (
      <>
        <div data-testid="scroller" onScroll={scroll.onScroll} />
        <p class="text">{ctx.showInTopBar() ? 'top:yes' : 'top:no'}</p>
      </>
    );
  }

  test('large title falls back to provider title; scroll reveals top bar title', () => {
    renderUi(() => (
      <ScreenTitleProvider title="Spaces">
        <ScreenLargeTitle />
        <Scroller />
      </ScreenTitleProvider>
    ));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Spaces'
    );
    expect(screen.getByText('top:no')).toBeInTheDocument();
    const scroller = screen.getByTestId('scroller');
    scroller.scrollTop = 80;
    fireEvent.scroll(scroller);
    expect(screen.getByText('top:yes')).toBeInTheDocument();
  });
});
