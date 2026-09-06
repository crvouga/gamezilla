/** @jsxImportSource solid-js */
import {
  Collapsible,
  ScreenLargeTitle,
  ScreenTitleProvider,
  SectionCard,
  Text,
  useRequiredScreenTitleContext,
  useScreenTitleScroll,
} from '@pkgs/ui';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'solid-js';
import { describe, expect, test } from 'vitest';
import { renderUi } from './support/render';

describe('Collapsible / SectionCard', () => {
  test('toggles body and aria-expanded', async () => {
    const user = userEvent.setup();
    renderUi(() => (
      <Collapsible title="More">
        <Text label="hidden body" />
      </Collapsible>
    ));
    const toggle = screen.getByRole('button', { name: 'More' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('hidden body')).toBeNull();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('hidden body')).toBeInTheDocument();
  });

  test('SectionCard opens by default when asked', () => {
    renderUi(() => (
      <SectionCard title="Section" defaultOpen dataSet={{ testid: 'sc' }}>
        <Text label="content" />
      </SectionCard>
    ));
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.getByTestId('sc').getAttribute('style')).toContain(
      'var(--ui-color-border)'
    );
  });
});

describe('ScreenTitle', () => {
  function Scroller(): JSX.Element {
    const scroll = useScreenTitleScroll();
    const ctx = useRequiredScreenTitleContext();
    return (
      <>
        <div data-testid="scroller" onScroll={scroll.onScroll} />
        <Text label={ctx.showInTopBar() ? 'top:yes' : 'top:no'} />
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
