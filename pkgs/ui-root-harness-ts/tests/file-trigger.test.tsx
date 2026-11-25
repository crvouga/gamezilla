/** @jsxImportSource @solidjs/web */
import { expect, mock, test } from 'bun:test';
import { FileTrigger } from '@pkgs/ui-root-client-ts/file-trigger';
import { fireEvent, screen } from '@solidjs/testing-library';
import { renderUi } from './render';

test('Add picture opens the hidden chooser from the report button', () => {
  // regression: feedback-native-file-input-keyboard-stop
  const choose = mock();
  renderUi(() => (
    <FileTrigger
      label="Add a picture"
      accept="image/png"
      onSelect={choose}
      testId="bug-report-picture"
    >
      {(open) => (
        <button type="button" onClick={open}>
          Add picture
        </button>
      )}
    </FileTrigger>
  ));
  const input = screen.getByTestId('bug-report-picture');
  expect(input).not.toBeVisible();
  const clicked = mock();
  input.addEventListener('click', clicked);
  fireEvent.click(screen.getByRole('button', { name: 'Add picture' }));
  expect(clicked).toHaveBeenCalledTimes(1);
});
