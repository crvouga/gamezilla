/** @jsxImportSource @solidjs/web */
import { expect, test } from 'bun:test';
import { Checkbox } from '@pkgs/ui-root-client-ts/checkbox';
import { Radio, RadioGroup } from '@pkgs/ui-root-client-ts/radio-group';
import { RangeControl } from '@pkgs/ui-root-client-ts/range-control';
import { SegmentedControl } from '@pkgs/ui-root-client-ts/segmented-control';
import { Switch } from '@pkgs/ui-root-client-ts/switch';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { Textarea } from '@pkgs/ui-root-client-ts/textarea';
import { render } from '@solidjs/testing-library';
import { createAgent } from '@ui-sdk/solid/agent';
import { createSignal, untrack } from 'solid-js';

test('an agent edits named fields, chooses options and adjusts a native slider', async () => {
  const [name, setName] = createSignal('');
  const [note, setNote] = createSignal('');
  const [privateGame, setPrivateGame] = createSignal(false);
  const [sound, setSound] = createSignal(false);
  const [pace, setPace] = createSignal('normal');
  const [view, setView] = createSignal('list');
  const [volume, setVolume] = createSignal(2);
  render(() => (
    <>
      <TextInput label="Game name" value={name()} onChangeText={setName} />
      <Textarea
        aria-label="Description"
        value={note()}
        onValueChange={setNote}
      />
      <Checkbox
        label="Private"
        checked={privateGame()}
        onToggle={setPrivateGame}
      />
      <Switch label="Sound" value={sound()} onValueChange={setSound} />
      <RadioGroup aria-label="Pace" value={pace()} onValueChange={setPace}>
        <Radio value="normal" label="Normal" />
        <Radio value="fast" label="Quick" />
      </RadioGroup>
      <SegmentedControl
        aria-label="Layout"
        segments={[
          { key: 'list', label: 'List' },
          { key: 'grid', label: 'Tiles' },
        ]}
        selected={view()}
        onSelect={setView}
      />
      <RangeControl
        label="Volume"
        min={0}
        max={10}
        value={volume()}
        onInput={setVolume}
      />
      <TextInput
        label="Password"
        secureTextEntry
        value="private-password"
        onChangeText={() => undefined}
      />
    </>
  ));
  const agent = createAgent();
  const snapshot = agent.snapshot();
  expect(JSON.stringify(snapshot)).not.toContain('private-password');
  expect(snapshot.find((entry) => entry.label === 'Password')?.['value']).toBe(
    '[redacted]'
  );
  const result = await agent.act({
    steps: [
      { ref: 'Game name', action: 'setValue', args: ['Match'] },
      { ref: 'Description', action: 'setValue', args: ['Friendly'] },
      { ref: 'Private', action: 'setChecked', args: [true] },
      { ref: 'Sound', action: 'setChecked', args: [true] },
      { ref: 'Pace', action: 'setValue', args: ['Quick'] },
      { ref: 'Layout', action: 'setValue', args: ['Tiles'] },
      { ref: 'Volume', action: 'setValue', args: [7] },
    ],
  });
  expect(result.error?.message).toBeUndefined();
  expect(
    untrack(() => [
      name(),
      note(),
      privateGame(),
      sound(),
      pace(),
      view(),
      volume(),
    ])
  ).toEqual(['Match', 'Friendly', true, true, 'fast', 'grid', 7]);
});
