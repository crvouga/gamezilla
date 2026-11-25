/** @jsxImportSource @solidjs/web */
import { expect, test } from 'bun:test';
import { FilePicker } from '@pkgs/ui-root-client-ts/file-picker';
import { FileTrigger } from '@pkgs/ui-root-client-ts/file-trigger';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent, render } from '@solidjs/testing-library';

test('both file controls forward the chosen file for the caller to validate', () => {
  const chosen: File[] = [];
  const capture = (file: File | null) => {
    if (file) chosen.push(file);
  };
  const view = render(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 1000, height: 600 }}
    >
      <FilePicker
        label="Photo"
        accept="image/*"
        chooseLabel="Choose"
        fileName={null}
        emptyLabel="No file"
        onSelect={capture}
      />
      <FileTrigger
        label="Attachment"
        accept="image/*"
        testId="attachment"
        onSelect={capture}
      >
        {(open) => (
          <button type="button" onClick={open}>
            Attach
          </button>
        )}
      </FileTrigger>
    </ThemeProvider>
  ));
  expect(view.getByRole('button', { name: 'Photo' })).toBeTruthy();
  const inputs = Array.from(
    view.container.querySelectorAll('input[type="file"]')
  );
  expect(inputs).toHaveLength(2);
  expect(inputs[1]).toBe(view.getByTestId('attachment'));
  const file = new File(['notes'], 'notes.txt', { type: 'text/plain' });
  for (const input of inputs) {
    expect(input.getAttribute('accept')).toBe('image/*');
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    fireEvent.change(input);
  }
  expect(chosen).toEqual([file, file]);
});
