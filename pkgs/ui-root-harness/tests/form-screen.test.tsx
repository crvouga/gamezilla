import { expect, test } from 'bun:test';
import { Trans } from '@lingui/solid';
import { FormScreen } from '@pkgs/ui-root-client/form-screen';
import { TextInput } from '@pkgs/ui-root-client/text-input';
import { fireEvent } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, Show } from 'solid-js';
import { renderUi } from './render';

// regression: ui-form-actions-provider-context
test('translated actions retain their provider while saving, retrying and cancelling', async () => {
  const user = userEvent.setup();
  let saves = 0;
  let cancellations = 0;
  const view = renderUi(() => (
    <FormScreen
      screenId="translated-editor"
      breadcrumbs={[{ name: 'Editor' }]}
      submit={{
        label: <Trans id="save" message="Save" />,
        errorLabel: <Trans id="retry" message="Try again" />,
        successLabel: <Trans id="saved" message="Saved" />,
        operation: () => {
          saves += 1;
          return saves === 1
            ? Promise.reject(new Error('Save refused'))
            : Promise.resolve();
        },
      }}
      cancel={{
        label: <Trans id="cancel" message="Cancel" />,
        onClick: () => {
          cancellations += 1;
        },
      }}
    >
      <input aria-label="Name" />
    </FormScreen>
  ));
  await user.click(view.getByRole('button', { name: 'Save' }));
  expect(saves).toBe(1);
  await user.click(view.getByRole('button', { name: 'Try again' }));
  expect(saves).toBe(2);
  expect(view.getByRole('status').textContent).toBe('Saved');
  await user.click(view.getByRole('button', { name: 'Cancel' }));
  expect(cancellations).toBe(1);
});

// regression: ui-form-screen-native-submit
test('Enter submits a valid editor and preserves the draft after a failed save and retry', async () => {
  const user = userEvent.setup();
  const [name, setName] = createSignal('');
  let attempts = 0;
  const view = renderUi(() => (
    <FormScreen
      screenId="keyboard-editor"
      breadcrumbs={[{ name: 'Editor' }]}
      submit={{
        label: <Show when={true}>Save</Show>,
        errorLabel: <Show when={true}>Try again</Show>,
        successLabel: <strong>Saved</strong>,
        operation: () => {
          attempts += 1;
          return attempts === 1
            ? Promise.reject(new Error('Save refused'))
            : Promise.resolve();
        },
      }}
    >
      <TextInput label="Name" value={name()} onChangeText={setName} required />
    </FormScreen>
  ));
  const input = view.getByRole<HTMLInputElement>('textbox');
  await user.type(input, 'Robin{Enter}');
  expect(attempts).toBe(1);
  expect(view.getByRole('status').textContent).toBe('Try again');
  expect(input.value).toBe('Robin');
  expect(view.queryAllByRole('button', { name: 'Try again' }).length).toBe(1);
  await user.keyboard('{Enter}');
  expect(attempts).toBe(2);
  expect(view.getByRole('status').textContent).toBe('Saved');
  expect(view.queryAllByRole('button', { name: 'Saved' }).length).toBe(1);
  expect(view.getByRole('textbox')).toBe(input);
});

test('native validity and a disabled save action guard programmatic submissions', async () => {
  const [disabled, setDisabled] = createSignal(false);
  let calls = 0;
  const view = renderUi(() => (
    <FormScreen
      screenId="validation"
      breadcrumbs={[{ name: 'Editor' }]}
      submit={{
        label: 'Save',
        get disabled() {
          return disabled();
        },
        operation: () => {
          calls += 1;
          return Promise.resolve();
        },
      }}
    >
      <input aria-label="Required" required />
    </FormScreen>
  ));
  const input = view.getByRole<HTMLInputElement>('textbox');
  const form = input.form;
  if (form === null) throw new Error('Missing form');
  fireEvent.submit(form);
  expect(calls).toBe(0);
  fireEvent.input(input, { target: { value: 'Ready' } });
  setDisabled(true);
  fireEvent.submit(form);
  expect(calls).toBe(0);
  setDisabled(false);
  fireEvent.submit(form);
  await Promise.resolve();
  expect(calls).toBe(1);
});
