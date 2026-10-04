import { describe, expect, mock, test } from 'bun:test';
import {
  clampHighlightedIndex,
  defaultFilterOption,
  filterComboboxOptions,
} from '@pkgs/ui-shared/combobox-filter';
import type { ComboboxKeyEvent } from '@pkgs/ui-shared/combobox-key-nav';
import { handleComboboxKeyNav } from '@pkgs/ui-shared/combobox-key-nav';
import {
  isMultipleComboboxProps,
  isValueSelected,
  removeSelectedValue,
  selectedOptionsFor,
  toggleSelectedValue,
} from '@pkgs/ui-shared/combobox-selection';
import type { ComboboxOption } from '@pkgs/ui-shared/combobox-types';

const RED: ComboboxOption = { value: 'red', label: 'Red' };
const GREEN: ComboboxOption = {
  value: 'green',
  label: 'Green',
  searchText: 'emerald',
};
const BLUE: ComboboxOption = { value: 'blue', label: 'Blue' };
const OPTIONS: ComboboxOption[] = [RED, GREEN, BLUE];

function keyEvent(key: string): ComboboxKeyEvent & { prevented: boolean } {
  const ev = {
    key,
    prevented: false,
    preventDefault() {
      ev.prevented = true;
    },
  };
  return ev;
}

describe('combobox filter', () => {
  test('defaultFilterOption matches label or searchText, case-insensitive', () => {
    expect(defaultFilterOption(RED, 'RE')).toBe(true);
    expect(defaultFilterOption(GREEN, 'emer')).toBe(true);
    expect(defaultFilterOption(BLUE, 'x')).toBe(false);
    expect(defaultFilterOption(BLUE, '')).toBe(true);
  });

  test('filterComboboxOptions uses the custom predicate when provided', () => {
    expect(
      filterComboboxOptions(OPTIONS, 'e', undefined).map((o) => o.value)
    ).toEqual(['red', 'green', 'blue']);
    expect(
      filterComboboxOptions(OPTIONS, 'anything', (o) => o.value === 'blue')
    ).toEqual([BLUE]);
    expect(filterComboboxOptions(OPTIONS, '   ', undefined)).toHaveLength(3);
  });

  test('clampHighlightedIndex keeps the index inside the list', () => {
    expect(clampHighlightedIndex(5, 3)).toBe(2);
    expect(clampHighlightedIndex(-1, 3)).toBe(0);
    expect(clampHighlightedIndex(1, 0)).toBe(0);
  });
});

describe('combobox selection', () => {
  test('toggle / remove preserve order and never duplicate', () => {
    expect(toggleSelectedValue(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleSelectedValue(['a', 'b'], 'a')).toEqual(['b']);
    expect(removeSelectedValue(['a', 'b'], 'b')).toEqual(['a']);
    expect(removeSelectedValue(['a'], 'zzz')).toEqual(['a']);
  });

  test('selectedOptionsFor keeps option order and drops unknown values', () => {
    expect(
      selectedOptionsFor(OPTIONS, ['blue', 'nope', 'red']).map((o) => o.value)
    ).toEqual(['red', 'blue']);
  });

  test('isValueSelected handles single and multiple modes', () => {
    expect(isValueSelected('red', undefined, 'red')).toBe(true);
    expect(isValueSelected('red', undefined, 'blue')).toBe(false);
    expect(isValueSelected(null, new Set(['blue']), 'blue')).toBe(true);
    expect(isValueSelected(null, new Set<string>(), 'blue')).toBe(false);
  });

  test('isMultipleComboboxProps discriminates on selectionMode', () => {
    expect(
      isMultipleComboboxProps({
        selectionMode: 'multiple',
        options: OPTIONS,
        value: [],
        onValueChange: () => {},
      })
    ).toBe(true);
    expect(
      isMultipleComboboxProps({
        options: OPTIONS,
        value: null,
        onValueChange: () => {},
      })
    ).toBe(false);
  });
});

describe('handleComboboxKeyNav', () => {
  function run(
    key: string,
    overrides: Partial<Parameters<typeof handleComboboxKeyNav>[0]> = {}
  ) {
    const ev = keyEvent(key);
    const setHighlightedIndex = mock();
    const onActivate = mock();
    const onBackspaceEmpty = mock();
    const handled = handleComboboxKeyNav({
      event: ev,
      optionCount: 3,
      highlightedIndex: 1,
      setHighlightedIndex,
      onActivate,
      onBackspaceEmpty,
      query: '',
      ...overrides,
    });
    return { ev, handled, setHighlightedIndex, onActivate, onBackspaceEmpty };
  }

  test('arrows and Home / End move the highlight and prevent default', () => {
    const down = run('ArrowDown');
    expect(down.handled).toBe(true);
    expect(down.ev.prevented).toBe(true);
    const updater = down.setHighlightedIndex.mock.calls[0]?.[0] as (
      n: number
    ) => number;
    expect(updater(1)).toBe(2);
    expect(updater(2)).toBe(0);

    const up = run('ArrowUp');
    const upd = up.setHighlightedIndex.mock.calls[0]?.[0] as (
      n: number
    ) => number;
    expect(upd(0)).toBe(2);

    const home = run('Home');
    expect(
      (home.setHighlightedIndex.mock.calls[0]?.[0] as (n: number) => number)(2)
    ).toBe(0);
    const end = run('End');
    expect(
      (end.setHighlightedIndex.mock.calls[0]?.[0] as (n: number) => number)(0)
    ).toBe(2);
  });

  test('Enter activates the highlighted option', () => {
    const r = run('Enter');
    expect(r.handled).toBe(true);
    expect(r.onActivate).toHaveBeenCalledTimes(1);
  });

  test('Backspace on an empty query fires onBackspaceEmpty; non-empty query is untouched', () => {
    expect(run('Backspace').onBackspaceEmpty).toHaveBeenCalledTimes(1);
    expect(
      run('Backspace', { query: 'x' }).onBackspaceEmpty
    ).not.toHaveBeenCalled();
    expect(run('Backspace', { onBackspaceEmpty: undefined }).handled).toBe(
      false
    );
  });

  test('Escape and letters are not handled here', () => {
    expect(run('Escape').handled).toBe(false);
    expect(run('a').handled).toBe(false);
    // Arrows are still swallowed on an empty list (no caret jump), but the
    // highlight is left alone; Enter on an empty list is not consumed.
    const empty = run('ArrowDown', { optionCount: 0 });
    expect(empty.handled).toBe(true);
    expect(empty.setHighlightedIndex).not.toHaveBeenCalled();
    expect(run('Enter', { optionCount: 0 }).handled).toBe(false);
  });
});
