/** @jsxImportSource @solidjs/web */
import { expect, test } from 'bun:test';
import { setupI18n } from '@lingui/core';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { I18nProvider } from '@pkgs/lingui-solid-client-ts/runtime';
import { Combobox } from '@pkgs/ui-root-client-ts/combobox';
import { NumberStepper } from '@pkgs/ui-root-client-ts/number-stepper';
import { Select } from '@pkgs/ui-root-client-ts/select';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent, render } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { createAgent } from '@ui-sdk/solid/agent';
import { createSignal, untrack } from 'solid-js';

function renderPickers(content: () => JSX.Element) {
  const clock = createHarnessClock();
  return render(() => (
    <I18nProvider i18n={setupI18n({ locale: 'en', messages: { en: {} } })}>
      <ClockProvider clock={clock.clock} timers={clock.timers}>
        <ThemeProvider fixedLayout={{ width: 1024, height: 768 }}>
          <SurfaceStackProvider>{content()}</SurfaceStackProvider>
        </ThemeProvider>
      </ClockProvider>
    </I18nProvider>
  ));
}

test('an agent discovers and selects named options in closed pickers', async () => {
  const options = [
    { value: 1, label: 'One' },
    { value: 2, label: 'Two' },
  ];
  const [single, setSingle] = createSignal(1);
  const [colour, setColour] = createSignal(1);
  const [multiple, setMultiple] = createSignal<number[]>([]);
  const [rounds, setRounds] = createSignal(1);
  const ui = renderPickers(() => (
    <>
      <NumberStepper
        label="Rounds"
        min={1}
        max={9}
        value={rounds()}
        onChange={setRounds}
      />
      <Select
        label="Players"
        options={options}
        value={single()}
        onValueChange={setSingle}
      />
      <Combobox
        label="Teams"
        options={options}
        value={colour()}
        onValueChange={setColour}
      />
      <Combobox
        selectionMode="multiple"
        label="Guests"
        options={options}
        value={multiple()}
        onValueChange={setMultiple}
      />
    </>
  ));
  const agent = createAgent();
  for (const label of ['Players', 'Teams', 'Guests']) {
    const choices = await agent.query({ within: label });
    expect(
      Array.isArray(choices) &&
        choices.some((choice) =>
          choice.items?.some((item) => item.label === 'Two')
        )
    ).toBe(true);
  }
  const result = await agent.act({
    steps: [
      { ref: 'Rounds', action: 'setValue', args: [3] },
      { ref: 'Players', action: 'setValue', args: ['Two'] },
      { ref: 'Teams', action: 'setValue', args: ['Two'] },
      { ref: 'Guests', action: 'setValue', args: [['One', 'Two']] },
    ],
  });
  expect(result.error?.message).toBeUndefined();
  expect(untrack(() => [single(), colour(), multiple()])).toEqual([
    2,
    2,
    [1, 2],
  ]);
  expect(untrack(rounds)).toBe(3);
  expect(ui.queryByRole('dialog')).toBeNull();
});

// regression: ui-sdk-select-current-option
test('choosing the current option still finishes a picker', () => {
  const picks: string[] = [];
  const ui = renderPickers(() => (
    <Select
      value="current"
      label="Mode"
      options={[{ value: 'current', label: 'Current' }]}
      onValueChange={(next) => {
        picks.push(next);
      }}
    />
  ));
  fireEvent.click(ui.getByRole('button', { name: 'Mode' }));
  fireEvent.click(ui.getByRole('option', { name: 'Current' }));
  expect(picks).toEqual(['current']);
  expect(ui.queryByRole('dialog')).toBeNull();
});
