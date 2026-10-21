/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { auditTree, formatFailure } from '@pkgs/a11y-shared/audit';
import { FormField } from '@pkgs/ui-root-client/form-field';
import { Radio, RadioGroup } from '@pkgs/ui-root-client/radio-group';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

function Clock(props: { initial?: string; disabled?: boolean }) {
  const [value, setValue] = createSignal<string | undefined>(props.initial);
  return (
    <>
      <RadioGroup
        aria-label="Clock"
        value={value()}
        onValueChange={setValue}
        disabled={props.disabled}
      >
        <Radio value="blitz" label="Blitz" description="5 minutes each" />
        <Radio value="rapid" label="Rapid" />
        <Radio value="classical" label="Classical" disabled />
        <Radio value="none" label="No clock" />
      </RadioGroup>
      <output data-testid="value">{value() ?? 'unset'}</output>
    </>
  );
}

const radio = (name: string) => screen.getByRole('radio', { name });

describe('RadioGroup', () => {
  test('a named radiogroup of radios with labels and descriptions', () => {
    renderUi(() => <Clock initial="rapid" />);
    const group = screen.getByRole('radiogroup', { name: 'Clock' });
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(radio('Rapid')).toHaveAttribute('aria-checked', 'true');
    expect(radio('Blitz')).toHaveAttribute('aria-checked', 'false');
    expect(radio('Blitz')).toHaveAccessibleDescription('5 minutes each');
    expect(radio('Classical')).toBeDisabled();
    expect(auditTree(group).map(formatFailure)).toEqual([]);
  });

  test('the checked radio is the one tab stop; unset falls to the first enabled', () => {
    const { unmount } = renderUi(() => <Clock initial="rapid" />);
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([
      -1, 0, -1, -1,
    ]);
    unmount();
    renderUi(() => <Clock />);
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([
      0, -1, -1, -1,
    ]);
  });

  test('arrow keys move and check, wrapping and skipping disabled; Space checks', async () => {
    const user = userEvent.setup();
    renderUi(() => <Clock />);
    await user.tab();
    expect(document.activeElement).toBe(radio('Blitz'));
    expect(screen.getByTestId('value').textContent).toBe('unset');
    await user.keyboard(' ');
    expect(screen.getByTestId('value').textContent).toBe('blitz');
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(radio('Rapid'));
    expect(screen.getByTestId('value').textContent).toBe('rapid');
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(radio('No clock'));
    expect(screen.getByTestId('value').textContent).toBe('none');
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(radio('Blitz'));
    await user.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(radio('No clock'));
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('value').textContent).toBe('none');
  });

  test('a disabled group takes no input', async () => {
    const user = userEvent.setup();
    renderUi(() => <Clock initial="blitz" disabled />);
    for (const r of screen.getAllByRole('radio')) expect(r).toBeDisabled();
    await user.click(radio('Rapid'));
    expect(screen.getByTestId('value').textContent).toBe('blitz');
  });

  test('inside a group FormField it is named by the label and described by help and error', () => {
    renderUi(() => (
      <FormField
        label="Clock"
        group
        help="Applies to new games."
        error="Pick one."
      >
        {() => (
          <RadioGroup value={undefined} onValueChange={() => undefined}>
            <Radio value="blitz" label="Blitz" />
          </RadioGroup>
        )}
      </FormField>
    ));
    const group = screen.getByRole('radiogroup', { name: 'Clock' });
    expect(group).toHaveAccessibleDescription(
      'Applies to new games. Pick one.'
    );
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getByText('Clock').closest('label')?.hasAttribute('for')
    ).toBe(false);
  });
});
