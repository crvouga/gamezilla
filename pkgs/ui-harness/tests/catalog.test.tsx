/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { CatalogDetail } from '@pkgs/ui-client/catalog-detail';
import { CatalogDetailNav } from '@pkgs/ui-client/catalog-detail-nav';
import type { CatalogItem } from '@pkgs/ui-shared/catalog-item';
import { CatalogList } from '@pkgs/ui-client/catalog-list';
import { ContentEdgePaddingProvider } from '@pkgs/ui-client/content-edge-padding';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { cssOf, renderUi } from './render';

function nth<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`missing item ${index}`);
  return item;
}

const ITEMS: readonly CatalogItem[] = [
  { id: 'btn', label: 'Button', category: 'Inputs' },
  { id: 'chk', label: 'Checkbox', category: 'Inputs' },
  { id: 'badge', label: 'Badge', category: 'Data display' },
  { id: 'misc', label: 'Misc thing' },
];

describe('CatalogList', () => {
  test('renders grouped rows as buttons and selects by id', () => {
    const onSelect = mock();
    renderUi(() => <CatalogList items={ITEMS} onSelect={onSelect} />);
    expect(screen.getByRole('heading', { name: 'Inputs' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Data display' })
    ).toBeInTheDocument();
    const rows = screen.getAllByRole('button');
    expect(rows.map((r) => r.textContent.replace('›', ''))).toEqual([
      'Button',
      'Checkbox',
      'Badge',
      'Misc thing',
    ]);
    expect(nth(rows, 0).className).toMatch(/min-h-11/);
    fireEvent.click(screen.getByRole('button', { name: /Badge/ }));
    expect(onSelect).toHaveBeenCalledWith('badge');
  });

  test('search field filters rows and shows the empty state', () => {
    renderUi(() => <CatalogList items={ITEMS} onSelect={() => {}} />);
    const input = screen.getByRole('searchbox', { name: 'Search…' });
    fireEvent.input(input, { target: { value: 'check' } });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: /Checkbox/ })
    ).toBeInTheDocument();
    fireEvent.input(input, { target: { value: 'zzz' } });
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByText('No matching items')).toBeInTheDocument();
  });
});

describe('CatalogDetailNav', () => {
  test('prev/next buttons navigate in flattened order and clamp at ends', () => {
    const onNavigate = mock();
    const [current, setCurrent] = createSignal('btn');
    renderUi(() => (
      <CatalogDetailNav
        items={ITEMS}
        currentId={current()}
        onNavigate={onNavigate}
      />
    ));
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByText('1 of 4')).toBeInTheDocument();
    const prev = screen.getByRole('button', { name: 'Previous' });
    const next = screen.getByRole('button', { name: 'Next' });
    expect(prev).toBeDisabled();
    expect(cssOf(next)).toMatch(/width:44px/);
    fireEvent.click(next);
    expect(onNavigate).toHaveBeenCalledWith('chk');
    setCurrent('misc');
    expect(screen.getByText('4 of 4')).toBeInTheDocument();
    expect(next).toBeDisabled();
    fireEvent.click(prev);
    expect(onNavigate).toHaveBeenLastCalledWith('badge');
  });

  test('unknown id shows a dash position with both ends disabled', () => {
    renderUi(() => (
      <CatalogDetailNav items={ITEMS} currentId="nope" onNavigate={() => {}} />
    ));
    expect(screen.getByText('— of 4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});

describe('CatalogDetail', () => {
  test('renders children plus a bottom nav bar when onNavigate is set', () => {
    const onNavigate = mock();
    renderUi(() => (
      <CatalogDetail items={ITEMS} currentId="chk" onNavigate={onNavigate}>
        <p>Body copy</p>
      </CatalogDetail>
    ));
    expect(screen.getByText('Body copy')).toBeInTheDocument();
    expect(screen.getByText('2 of 4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNavigate).toHaveBeenCalledWith('badge');
  });

  test('omits the nav without onNavigate and shows not-found for unknown ids', () => {
    renderUi(() => (
      <>
        <CatalogDetail
          items={ITEMS}
          currentId="chk"
          dataSet={{ component: 'Known' }}
        >
          <p>Known body</p>
        </CatalogDetail>
        <CatalogDetail
          items={ITEMS}
          currentId="ghost"
          dataSet={{ component: 'Unknown' }}
        >
          <p>Never shown</p>
        </CatalogDetail>
      </>
    ));
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.getByText('Item not found')).toBeInTheDocument();
    expect(
      screen.getByText('No catalog entry for "ghost".')
    ).toBeInTheDocument();
    expect(screen.queryByText('Never shown')).toBeNull();
  });

  test('screenBodyBleed cancels the shell edge padding on the nav bar', () => {
    renderUi(() => (
      <ContentEdgePaddingProvider step={4}>
        <CatalogDetail
          items={ITEMS}
          currentId="chk"
          onNavigate={() => {}}
          screenBodyBleed
        >
          <p>x</p>
        </CatalogDetail>
      </ContentEdgePaddingProvider>
    ));
    const nav = screen.getByRole('navigation');
    const bar = nav.parentElement;
    if (!(bar instanceof HTMLElement)) throw new Error('missing bar');
    const css = cssOf(bar);
    expect(css).toMatch(/margin-left:-16px|margin:0-16px|margin-right:-16px/);
  });
});
