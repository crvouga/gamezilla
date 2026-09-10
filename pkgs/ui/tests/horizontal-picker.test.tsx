/** @jsxImportSource solid-js */
import { HorizontalPicker } from '@pkgs/ui/components/horizontal-picker';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';
import { cssOf, mustQuery, renderUi } from './support/render';

const ITEMS = ['red', 'green', 'blue', 'gold'] as const;
const WIDTH = 100;

function scroller(): HTMLDivElement {
  return mustQuery(
    '[data-component="HorizontalPickerScroller"]'
  ) as HTMLDivElement;
}

describe('HorizontalPicker', () => {
  test('renders snapping cells, centering padding and arrows', () => {
    renderUi(() => (
      <HorizontalPicker
        items={ITEMS}
        selectedIndex={0}
        onSelect={() => {}}
        itemWidth={WIDTH}
        keyExtractor={(item) => item}
        renderItem={(item) => <p class="text">{item}</p>}
      />
    ));
    expect(mustQuery('[data-component="HorizontalPicker"]')).toBeTruthy();
    expect(cssOf(scroller())).toContain('scroll-snap-type:xmandatory');
    const content = mustQuery('[data-component="ScrollViewContent"]');
    expect(cssOf(content)).toContain('padding-left:calc(50%-50px)');
    const cells = document.querySelectorAll(
      '[data-component="HorizontalPickerCell"]'
    );
    expect(cells).toHaveLength(ITEMS.length);
    const first = mustQuery('[data-component="HorizontalPickerCell"]');
    expect(cssOf(first)).toContain(`width:${WIDTH}px`);
    expect(first.className).toMatch(/scroll-snap-align/);
    expect(cells[2]?.getAttribute('data-key')).toBe('blue');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
  });

  test('scroll events derive the index from scrollLeft / itemWidth', () => {
    const onSelect = vi.fn();
    const onSettle = vi.fn();
    renderUi(() => (
      <HorizontalPicker
        items={ITEMS}
        selectedIndex={0}
        onSelect={onSelect}
        onSettle={onSettle}
        itemWidth={WIDTH}
        renderItem={(item) => <p class="text">{item}</p>}
      />
    ));
    const el = scroller();
    el.scrollLeft = 40;
    fireEvent.scroll(el);
    expect(onSelect).not.toHaveBeenCalled();
    el.scrollLeft = 2 * WIDTH;
    fireEvent.scroll(el);
    expect(onSelect).toHaveBeenCalledWith('blue', 2);
    fireEvent(el, new Event('scrollend'));
    expect(onSettle).toHaveBeenCalledWith('blue', 2);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  test('arrows and cell clicks select neighbours; prev disabled at start', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const onSettle = vi.fn();
    const [index, setIndex] = createSignal(0);
    renderUi(() => (
      <HorizontalPicker
        items={ITEMS}
        selectedIndex={index()}
        onSelect={(_, i) => {
          onSelect(i);
          setIndex(i);
        }}
        onSettle={(_, i) => {
          onSettle(i);
        }}
        itemWidth={WIDTH}
        renderItem={(item) => <p class="text">{item}</p>}
      />
    ));
    const prev = screen.getByRole('button', { name: 'Previous' });
    expect(prev.hasAttribute('disabled')).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSelect).toHaveBeenLastCalledWith(1);
    expect(onSettle).toHaveBeenLastCalledWith(1);
    expect(prev.hasAttribute('disabled')).toBe(false);
    await user.click(screen.getByText('gold'));
    expect(onSelect).toHaveBeenLastCalledWith(3);
    expect(
      screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled')
    ).toBe(true);
  });

  test('showArrows={false} hides arrows; empty items render nothing', () => {
    renderUi(() => (
      <HorizontalPicker
        items={ITEMS}
        selectedIndex={1}
        onSelect={() => {}}
        showArrows={false}
        renderItem={(item) => <p class="text">{item}</p>}
      />
    ));
    expect(screen.queryByRole('button', { name: 'Previous' })).toBeNull();
    document.body.innerHTML = '';
    renderUi(() => (
      <HorizontalPicker
        items={[] as string[]}
        selectedIndex={0}
        onSelect={() => {}}
        renderItem={(item) => <p class="text">{item}</p>}
      />
    ));
    expect(document.querySelector('[data-component="HorizontalPicker"]')).toBe(
      null
    );
  });
});
