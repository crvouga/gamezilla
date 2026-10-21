/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { Form } from '@pkgs/ui-root-client-ts/form';
import { FormField } from '@pkgs/ui-root-client-ts/form-field';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { Textarea } from '@pkgs/ui-root-client-ts/textarea';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { mustQuery, renderUi } from './render';

describe('Form', () => {
  test('a named form that submits without a page load', async () => {
    const user = userEvent.setup();
    const onSubmit = mock();
    renderUi(() => (
      <Form aria-label="Rename" onSubmit={onSubmit} testId="rename">
        <input aria-label="Name" />
        <button type="submit">{'Save'}</button>
      </Form>
    ));
    const form = screen.getByRole('form', { name: 'Rename' });
    expect(form.tagName).toBe('FORM');
    expect(form.className).toMatch(/\bgap-ui-lg\b/);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    const event = new Event('submit', { cancelable: true, bubbles: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  test('noValidate and gap reach the form', () => {
    renderUi(() => (
      <Form aria-label="Loose" noValidate gap="xl" onSubmit={() => undefined}>
        {null}
      </Form>
    ));
    const form = mustQuery('form') as HTMLFormElement;
    expect(form.noValidate).toBe(true);
    expect(form.className).toMatch(/\bgap-ui-xl\b/);
  });
});

describe('FormField', () => {
  test('labels any control and describes it with help and error', () => {
    renderUi(() => (
      <FormField
        label="Display name"
        required
        help="Shown to others."
        error="Too short."
      >
        {(field) => (
          <TextInput
            id={field.id}
            aria-describedby={field.describedBy}
            invalid={field.invalid}
            value=""
            onChangeText={() => undefined}
          />
        )}
      </FormField>
    ));
    const input = screen.getByRole('textbox', { name: /Display name/ });
    expect(input).toHaveAccessibleDescription('Shown to others. Too short.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Too short.');
    expect(mustQuery('[data-component="FormField"]')).toHaveAttribute(
      'data-invalid',
      'true'
    );
  });

  test('without an error the control is valid and described by help only', () => {
    const [error, setError] = createSignal<string | undefined>(undefined);
    renderUi(() => (
      <FormField label="Bio" help="Optional." error={error()}>
        {() => <Textarea value="" onValueChange={() => undefined} />}
      </FormField>
    ));
    const area = screen.getByRole('textbox', { name: 'Bio' });
    expect(area).toHaveAccessibleDescription('Optional.');
    expect(area).not.toHaveAttribute('aria-invalid');
    expect(screen.queryByRole('alert')).toBeNull();
    setError('Write less.');
    expect(area).toHaveAttribute('aria-invalid', 'true');
    expect(area.className).toMatch(/\binputError\b/);
    expect(area).toHaveAccessibleDescription('Optional. Write less.');
  });
});

describe('Textarea', () => {
  test('edits, caps and counts', async () => {
    const user = userEvent.setup();
    const [text, setText] = createSignal('');
    renderUi(() => (
      <Textarea
        aria-label="Note"
        value={text()}
        onValueChange={setText}
        maxLength={5}
        showCount
        rows={4}
      />
    ));
    const area = screen.getByRole('textbox', {
      name: 'Note',
    }) as HTMLTextAreaElement;
    expect(area).toHaveAttribute('rows', '4');
    expect(area).toHaveAttribute('maxlength', '5');
    expect(area).toHaveAccessibleDescription('0 / 5');
    await user.type(area, 'Hi');
    expect(area.value).toBe('Hi');
    expect(area).toHaveAccessibleDescription('2 / 5');
    fireEvent.input(area, { target: { value: 'Hello' } });
    expect(screen.getByText('5 / 5').className).toMatch(/\btext-destructive\b/);
  });

  test('disabled, read-only and required states', () => {
    renderUi(() => (
      <>
        <Textarea
          aria-label="Off"
          value=""
          onValueChange={() => undefined}
          disabled
        />
        <Textarea
          aria-label="Fixed"
          value="x"
          onValueChange={() => undefined}
          readOnly
          required
        />
      </>
    ));
    expect(screen.getByRole('textbox', { name: 'Off' })).toBeDisabled();
    const fixed = screen.getByRole('textbox', {
      name: 'Fixed',
    }) as HTMLTextAreaElement;
    expect(fixed.readOnly).toBe(true);
    expect(fixed).toBeRequired();
  });

  test('auto-grow fits the height to the text and turns off manual resize', () => {
    const [text, setText] = createSignal('a');
    renderUi(() => (
      <Textarea
        aria-label="Grow"
        value={text()}
        onValueChange={setText}
        autoGrow
      />
    ));
    const area = screen.getByRole('textbox', { name: 'Grow' });
    expect(area.className).toMatch(/\bresize-none\b/);
    setText('a\nb\nc');
    expect(area.style.height).toMatch(/px$/);
  });
});
