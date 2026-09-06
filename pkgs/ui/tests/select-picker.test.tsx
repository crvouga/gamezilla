/** @jsxImportSource solid-js */
import { asLocalized } from '@pkgs/i18n';
import { SurfaceStackProvider, Text } from '@pkgs/ui';
import {
  filterPickerOptions,
  isTypeAheadKey,
  nextPickerOptionIndex,
  Picker,
  type PickerOption,
  pickerOptionText,
  typeAheadIndex,
} from '@pkgs/ui/components/picker';
import { PickerSection } from '@pkgs/ui/components/picker-section';
import { Select } from '@pkgs/ui/components/select';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, type JSX } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';
import { mustQuery, renderUi } from './support/render';

const FRUIT: PickerOption[] = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry', disabled: true },
  { value: 'date', label: 'Date' },
];

function Harness(props: {
  initial?: string;
  onChange?: (v: string) => void;
  searchable?: boolean;
  label?: string;
}): JSX.Element {
  const [value, setValue] = createSignal(props.initial ?? 'banana');
  return (
    <SurfaceStackProvider>
      <Picker
        label={props.label ?? 'Fruit'}
        options={FRUIT}
        value={value()}
        onValueChange={(next) => {
          setValue(next);
          props.onChange?.(next);
        }}
        searchable={props.searchable}
      />
    </SurfaceStackProvider>
  );
}

describe('picker logic', () => {
  test('pickerOptionText prefers searchText, then string label; JSX labels are opaque', () => {
    expect(pickerOptionText({ value: 'a', label: 'Apple' })).toBe('Apple');
    expect(
      pickerOptionText({ value: 'a', label: 'Apple', searchText: 'Fuji' })
    ).toBe('Fuji');
    expect(pickerOptionText({ value: 42, label: <b>x</b> })).toBe('');
    // Opaque rows never vanish from a filtered list.
    expect(
      filterPickerOptions([{ value: 42, label: <b>x</b> }], 'zzz')
    ).toHaveLength(1);
  });

  test('filterPickerOptions is case-insensitive and keeps everything on empty query', () => {
    expect(filterPickerOptions(FRUIT, '')).toHaveLength(4);
    expect(filterPickerOptions(FRUIT, 'AN').map((o) => o.value)).toEqual([
      'banana',
    ]);
    expect(filterPickerOptions(FRUIT, 'zzz')).toEqual([]);
  });

  test('nextPickerOptionIndex wraps arrows and jumps Home / End', () => {
    const count = 3;
    expect(nextPickerOptionIndex({ key: 'ArrowDown', current: 2, count })).toBe(
      0
    );
    expect(nextPickerOptionIndex({ key: 'ArrowUp', current: 0, count })).toBe(
      2
    );
    expect(nextPickerOptionIndex({ key: 'Home', current: 2, count })).toBe(0);
    expect(nextPickerOptionIndex({ key: 'End', current: 0, count })).toBe(2);
    expect(nextPickerOptionIndex({ key: 'a', current: 0, count })).toBeNull();
    expect(
      nextPickerOptionIndex({ key: 'ArrowDown', current: 0, count: 0 })
    ).toBeNull();
  });

  test('type-ahead matches prefixes and cycles on repeated letters', () => {
    const texts = ['Apple', 'Banana', 'Blueberry', 'Cherry'];
    expect(isTypeAheadKey('b')).toBe(true);
    expect(isTypeAheadKey('Enter')).toBe(false);
    expect(typeAheadIndex(texts, 'b', 0)).toBe(1);
    expect(typeAheadIndex(texts, 'bb', 1)).toBe(2);
    expect(typeAheadIndex(texts, 'bl', -1)).toBe(2);
    expect(typeAheadIndex(texts, 'zz', 0)).toBeNull();
  });
});

describe('PickerSection', () => {
  test('renders label, description and children in a section', () => {
    renderUi(() => (
      <PickerSection label="Theme" description="Pick a look">
        <Text label="child" />
      </PickerSection>
    ));
    const section = mustQuery('[data-component="PickerSection"]');
    expect(section.tagName).toBe('SECTION');
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByText('Pick a look')).toBeInTheDocument();
    expect(screen.getByText('child')).toBeInTheDocument();
  });
});

describe('Picker', () => {
  test('trigger shows the selected label and listbox popup semantics', () => {
    renderUi(() => <Harness />);
    const trigger = screen.getByRole('button', { name: 'Fruit' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('Banana');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  test('opens a dialog with a listbox, marks the current option and picks on click', () => {
    const onChange = vi.fn();
    renderUi(() => <Harness onChange={onChange} />, { width: 1200 });
    fireEvent.click(screen.getByRole('button', { name: 'Fruit' }));
    expect(screen.getByRole('dialog', { name: 'Fruit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fruit' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    const listbox = screen.getByRole('listbox', { name: 'Fruit' });
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
    expect(listbox).toContainElement(options[0] ?? null);
    expect(screen.getByRole('option', { name: 'Banana' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveAttribute(
      'aria-selected',
      'false'
    );
    expect(screen.getByRole('option', { name: 'Cherry' })).toBeDisabled();
    // Focus lands on the selected option.
    expect(screen.getByRole('option', { name: 'Banana' })).toHaveFocus();

    fireEvent.click(screen.getByRole('option', { name: 'Date' }));
    expect(onChange).toHaveBeenCalledWith('date');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fruit' })).toHaveTextContent(
      'Date'
    );
  });

  test('arrow keys rove over enabled options, Enter picks, Escape closes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderUi(() => <Harness onChange={onChange} />, { width: 1200 });
    fireEvent.click(screen.getByRole('button', { name: 'Fruit' }));
    expect(screen.getByRole('option', { name: 'Banana' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    // Cherry is disabled and skipped.
    expect(screen.getByRole('option', { name: 'Date' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('option', { name: 'Date' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('apple');
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Fruit' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  test('type-ahead moves focus to the first option starting with the typed letter', async () => {
    const user = userEvent.setup();
    renderUi(() => <Harness initial="apple" />, { width: 1200 });
    fireEvent.click(screen.getByRole('button', { name: 'Fruit' }));
    expect(screen.getByRole('option', { name: 'Apple' })).toHaveFocus();
    await user.keyboard('d');
    expect(screen.getByRole('option', { name: 'Date' })).toHaveFocus();
  });

  test('searchable picker filters the listbox from the search field', async () => {
    const user = userEvent.setup();
    renderUi(() => <Harness searchable />, { width: 1200 });
    fireEvent.click(screen.getByRole('button', { name: 'Fruit' }));
    const search = screen.getByRole('searchbox', { name: 'Search…' });
    expect(search).toHaveFocus();
    await user.type(search, 'ap');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Apple' })).toBeInTheDocument();
    await user.clear(search);
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  test('disabled trigger does not open; placeholder shows when nothing matches', () => {
    renderUi(() => (
      <SurfaceStackProvider>
        <Picker
          options={FRUIT}
          value="nope"
          onValueChange={() => {}}
          placeholder={asLocalized('Choose a fruit')}
          disabled
          aria-label="Fruit"
        />
      </SurfaceStackProvider>
    ));
    const trigger = screen.getByRole('button', { name: 'Fruit' });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveTextContent('Choose a fruit');
    fireEvent.click(trigger);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Select', () => {
  test('is a Picker tagged as Select and picks a value', () => {
    const onChange = vi.fn();
    renderUi(
      () => (
        <SurfaceStackProvider>
          <Select
            label="Size"
            options={[
              { value: 'sm', label: 'Small' },
              { value: 'lg', label: 'Large' },
            ]}
            value="sm"
            onValueChange={onChange}
          />
        </SurfaceStackProvider>
      ),
      { width: 1200 }
    );
    expect(mustQuery('[data-component="Select"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Size' }));
    fireEvent.click(screen.getByRole('option', { name: 'Large' }));
    expect(onChange).toHaveBeenCalledWith('lg');
  });
});
