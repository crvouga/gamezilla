import { expect, test } from 'bun:test';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { WordTileActions } from '@pkgs/ui-root-client-ts/word-tile-workbench';
import { fireEvent } from '@solidjs/testing-library';

// regression: word-tiles-phone-action-overload
test('secondary tools disclose, keep disabled semantics and restore focus without losing the primary', () => {
  const selected: string[] = [];
  const view = render(() => (
    <WordTileActions
      label="Word actions"
      moreLabel="More actions"
      testId="tools"
      items={[
        {
          id: 'submit',
          label: 'Play word',
          testId: 'play',
          emphasis: 'primary',
          onPress: () => selected.push('play'),
        },
        {
          id: 'recall',
          label: 'Recall tiles',
          testId: 'recall',
          onPress: () => selected.push('recall'),
        },
        {
          id: 'undo',
          label: 'Undo',
          testId: 'undo',
          disabled: true,
          onPress: () => selected.push('undo'),
        },
      ]}
    />
  ));
  const more = view.getByRole('button', { name: 'More actions' });
  expect(view.queryByRole('button', { name: 'Recall tiles' })).toBeNull();
  fireEvent.click(more);
  expect(view.getAllByRole('button', { name: 'Play word' })).toHaveLength(1);
  expect(
    view.getByRole('button', { name: 'Undo' }).hasAttribute('disabled')
  ).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Recall tiles' }));
  expect(selected).toEqual(['recall']);
  expect(more.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(more);
  fireEvent.click(more);
  fireEvent.keyDown(view.getByRole('button', { name: 'Recall tiles' }), {
    key: 'Escape',
  });
  expect(more.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(more);
});
