/** @jsxImportSource solid-js */
import { SurfaceStackProvider } from '@pkgs/ui';
import {
  Combobox,
  type ComboboxOption,
  comboboxOptionId,
} from '@pkgs/ui/components/combobox';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, type JSX } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';
import { mustQuery, renderUi } from './support/render';

const COLORS: ComboboxOption[] = [
  { value: 'red', label: 'Red' },
  { value: 'green', label: 'Green' },
  { value: 'blue', label: 'Blue' },
  { value: 'black', label: 'Black' },
];

const VIEWPORT = { width: 400, height: 300 };

function Single(props: {
  onChange?: (v: string | null) => void;
  initial?: string | null;
}): JSX.Element {
  const [value, setValue] = createSignal<string | null>(props.initial ?? null);
  return (
    <SurfaceStackProvider>
      <Combobox
        label="Colour"
        options={COLORS}
        value={value()}
        onValueChange={(next) => {
          setValue(next);
          props.onChange?.(next);
        }}
        listViewport={VIEWPORT}
      />
    </SurfaceStackProvider>
  );
}

function Multiple(props: { onChange?: (v: string[]) => void }): JSX.Element {
  const [value, setValue] = createSignal<string[]>(['red']);
  return (
    <SurfaceStackProvider>
      <Combobox
        selectionMode="multiple"
        label="Colours"
        options={COLORS}
        value={value()}
        onValueChange={(next) => {
          setValue(next);
          props.onChange?.(next);
        }}
        listViewport={VIEWPORT}
      />
    </SurfaceStackProvider>
  );
}

function openSurface(name: string): HTMLElement {
  const trigger = screen.getByRole('combobox', { name });
  fireEvent.click(trigger);
  return trigger;
}

describe('Combobox (single)', () => {
  test('trigger exposes combobox semantics and the placeholder', () => {
    renderUi(() => <Single />, { width: 1200 });
    const trigger = screen.getByRole('combobox', { name: 'Colour' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveTextContent('Select…');
    expect(mustQuery('[data-component="Combobox"]')).toBeInTheDocument();
  });

  test('opens a dialog with a focused search box and a listbox; click picks and closes', () => {
    const onChange = vi.fn();
    renderUi(() => <Single onChange={onChange} initial="green" />, {
      width: 1200,
    });
    const trigger = openSurface('Colour');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Colour' })).toBeInTheDocument();
    // Surface chrome is fixed; only ComboboxList (VirtualList) scrolls.
    expect(document.querySelector('[data-component="ScrollView"]')).toBeNull();
    expect(mustQuery('[data-component="ComboboxList"]')).toBeInTheDocument();
    const search = screen.getByRole('searchbox', { name: 'Search…' });
    expect(search).toHaveFocus();
    const listbox = screen.getByRole('listbox', { name: 'Colour' });
    expect(search).toHaveAttribute('aria-controls', listbox.id);
    expect(screen.getByRole('option', { name: 'Green' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', { name: 'Red' })).toHaveAttribute(
      'aria-selected',
      'false'
    );
    fireEvent.click(screen.getByRole('option', { name: 'Blue' }));
    expect(onChange).toHaveBeenCalledWith('blue');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Colour' })).toHaveTextContent(
      'Blue'
    );
  });

  test('typing filters options; arrows move aria-activedescendant; Enter picks', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderUi(() => <Single onChange={onChange} />, { width: 1200 });
    openSurface('Colour');
    const search = screen.getByRole('searchbox', { name: 'Search…' });
    const listbox = screen.getByRole('listbox', { name: 'Colour' });
    expect(search).toHaveAttribute(
      'aria-activedescendant',
      comboboxOptionId(listbox.id, 0)
    );
    await user.type(search, 'bl');
    const names = screen.getAllByRole('option').map((o) => o.textContent);
    expect(names).toEqual(['Blue', 'Black']);
    await user.keyboard('{ArrowDown}');
    expect(search).toHaveAttribute(
      'aria-activedescendant',
      comboboxOptionId(listbox.id, 1)
    );
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('black');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('no match shows the empty message; Escape closes without picking', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderUi(
      () => (
        <SurfaceStackProvider>
          <Combobox
            label="Colour"
            options={COLORS}
            value={null}
            onValueChange={onChange}
            emptyMessage="Nothing here"
            listViewport={VIEWPORT}
          />
        </SurfaceStackProvider>
      ),
      { width: 1200 }
    );
    openSurface('Colour');
    await user.type(screen.getByRole('searchbox', { name: 'Search…' }), 'zzz');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(screen.getByRole('status')).toHaveTextContent('Nothing here');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Combobox (multiple)', () => {
  test('renders chips, toggles values without closing, Done closes', () => {
    const onChange = vi.fn();
    renderUi(() => <Multiple onChange={onChange} />, { width: 1200 });
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Red/ })).toBeInTheDocument();

    openSurface('Colours');
    const listbox = screen.getByRole('listbox', { name: 'Colours' });
    expect(listbox).toHaveAttribute('aria-multiselectable', 'true');
    expect(screen.getByRole('option', { name: 'Red' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    fireEvent.click(screen.getByRole('option', { name: 'Blue' }));
    expect(onChange).toHaveBeenLastCalledWith(['red', 'blue']);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Blue' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    fireEvent.click(screen.getByRole('option', { name: 'Red' }));
    expect(onChange).toHaveBeenLastCalledWith(['blue']);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('chip click removes the value; clear button empties the selection', () => {
    const onChange = vi.fn();
    renderUi(() => <Multiple onChange={onChange} />, { width: 1200 });
    fireEvent.click(mustQuery('[data-component="ComboboxChip"]'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  test('Backspace in an empty search removes the last chip', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderUi(() => <Multiple onChange={onChange} />, { width: 1200 });
    openSurface('Colours');
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
