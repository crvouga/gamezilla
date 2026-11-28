/** @jsxImportSource @solidjs/web */
import { expect, mock, test } from 'bun:test';
import { FilePicker } from '@pkgs/ui-root-client-ts/file-picker';
import { FileTrigger } from '@pkgs/ui-root-client-ts/file-trigger';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent, render } from '@solidjs/testing-library';
import { createAgent } from '@ui-sdk/solid/agent';

test('both file controls forward the chosen file for the caller to validate', () => {
  const chosen: File[] = [];
  const capture = (file: File | null) => {
    if (file) chosen.push(file);
  };
  const view = render(() => (
    <ThemeProvider fixedLayout={{ width: 1000, height: 600 }}>
      <FilePicker
        label="Choose an image"
        accept="image/*"
        chooseLabel="Choose"
        fileName={null}
        hint="A .png or .jpg image."
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
  // regression: file-picker-selected-ambiguous-label
  const trigger = view.getByRole('button', {
    name: 'Choose an image',
    description: 'A .png or .jpg image.',
  });
  expect(view.getByLabelText('Choose an image')).toBe(trigger);
  expect(
    createAgent()
      .snapshot()
      .map((control) => control.label)
  ).toContain('Choose an image');
  const inputs = Array.from(
    view.container.querySelectorAll('input[type="file"]')
  );
  expect(inputs).toHaveLength(2);
  const nativeInput = inputs[0];
  if (!(nativeInput instanceof HTMLInputElement))
    throw new Error('Missing native file input');
  expect(nativeInput).toHaveAttribute('aria-hidden', 'true');
  expect(nativeInput).toHaveAttribute('tabindex', '-1');
  const opened = mock((event: Event) => event.preventDefault());
  nativeInput.addEventListener('click', opened);
  trigger.focus();
  expect(document.activeElement).toBe(trigger);
  trigger.click();
  expect(opened).toHaveBeenCalledTimes(1);
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
