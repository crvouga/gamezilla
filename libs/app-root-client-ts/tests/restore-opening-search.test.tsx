import { expect, test } from 'bun:test';
import { restoreOpeningSearch } from '@libs/app-root-client-ts/restore-opening-search';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

test('a search started during opening reaches the live search control with its selection intact', () => {
  const opening = document.createElement('div');
  const draft = document.createElement('input');
  draft.name = 'people-search';
  draft.value = 'alex';
  draft.setSelectionRange(1, 3, 'backward');
  opening.append(draft);

  const [query, setQuery] = createSignal('');
  const { container } = renderWithI18n(() => (
    <TextInput
      name="people-search"
      label="Find people"
      value={query()}
      onChangeText={setQuery}
    />
  ));
  expect(restoreOpeningSearch(opening, container, draft)).toBe(true);
  const field = screen.getByRole('textbox');
  expect(document.activeElement).toBe(field);
  expect(query()).toBe('alex');
  expect(field).toHaveProperty('selectionStart', 1);
  expect(field).toHaveProperty('selectionEnd', 3);
  expect(field).toHaveProperty('selectionDirection', 'backward');
});
