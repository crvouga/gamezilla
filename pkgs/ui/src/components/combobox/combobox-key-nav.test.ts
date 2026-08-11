import { describe, expect, test } from 'bun:test';

import { handleComboboxKeyNav } from './combobox-key-nav';
import { defaultFilterOption, toggleSelectedValue } from './combobox-types';

describe('toggleSelectedValue', () => {
  test('adds missing value', () => {
    expect(toggleSelectedValue(['a'], 'b')).toEqual(['a', 'b']);
  });

  test('removes existing value', () => {
    expect(toggleSelectedValue(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('defaultFilterOption', () => {
  test('matches searchText', () => {
    expect(
      defaultFilterOption(
        { label: 'X', value: 'x', searchText: 'Apple' },
        'app'
      )
    ).toBe(true);
  });
});

describe('handleComboboxKeyNav', () => {
  test('ArrowDown advances highlight', () => {
    let index = 0;
    const prevented: string[] = [];
    handleComboboxKeyNav({
      event: {
        key: 'ArrowDown',
        preventDefault: () => {
          prevented.push('ArrowDown');
        },
      },
      optionCount: 3,
      highlightedIndex: 0,
      setHighlightedIndex: (updater) => {
        index = updater(index);
      },
      onActivate: () => {},
      onClose: () => {},
      onBackspaceEmpty: undefined,
      query: '',
    });
    expect(index).toBe(1);
    expect(prevented).toEqual(['ArrowDown']);
  });

  test('Backspace on empty query removes last selection', () => {
    let removed = false;
    handleComboboxKeyNav({
      event: {
        key: 'Backspace',
        preventDefault: () => {},
      },
      optionCount: 2,
      highlightedIndex: 0,
      setHighlightedIndex: () => {},
      onActivate: () => {},
      onClose: () => {},
      onBackspaceEmpty: () => {
        removed = true;
      },
      query: '',
    });
    expect(removed).toBe(true);
  });

  test('Enter activates highlighted option', () => {
    let activated = false;
    handleComboboxKeyNav({
      event: {
        key: 'Enter',
        preventDefault: () => {},
      },
      optionCount: 2,
      highlightedIndex: 1,
      setHighlightedIndex: () => {},
      onActivate: () => {
        activated = true;
      },
      onClose: () => {},
      onBackspaceEmpty: undefined,
      query: 'a',
    });
    expect(activated).toBe(true);
  });
});
