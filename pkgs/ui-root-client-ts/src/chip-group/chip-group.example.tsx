/** @jsxImportSource solid-js */

import type { ChipGroupOption } from '@pkgs/ui-root-client-ts/chip-group';
import { ChipGroup } from '@pkgs/ui-root-client-ts/chip-group';
import { ClockIcon } from '@pkgs/ui-root-client-ts/icons';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

type Intensity = 'off' | 'mid' | 'high';

const OPTIONS: readonly ChipGroupOption<Intensity>[] = [
  { key: 'off', label: 'Off' },
  { key: 'mid', label: 'Mid' },
  { key: 'high', label: 'High' },
];

type Game = 'chess' | 'checkers' | 'go' | 'words';

const GAMES: readonly ChipGroupOption<Game>[] = [
  { key: 'chess', label: 'Chess' },
  { key: 'checkers', label: 'Checkers' },
  { key: 'go', label: 'Go', disabled: true },
  { key: 'words', label: 'Words' },
];

type Clock = '3' | '5' | '10';

function SingleBlock(): JSX.Element {
  const [value, setValue] = createSignal<Intensity>('mid');
  const [clock, setClock] = createSignal<Clock>('5');
  // Icons render inside the explorer's theme, so build them per mount.
  const clocks: readonly ChipGroupOption<Clock>[] = [
    { key: '3', label: '3 min', icon: <ClockIcon size={16} /> },
    { key: '5', label: '5 min', icon: <ClockIcon size={16} /> },
    { key: '10', label: '10 min', icon: <ClockIcon size={16} /> },
  ];
  return (
    <div class="box gap-4">
      <ChipGroup<Intensity>
        label="Single choice (radio chips; arrow keys move the choice)"
        options={OPTIONS}
        selected={value()}
        onSelect={setValue}
      />
      <p class="text textCaption">{`Selected: ${value()}`}</p>
      <ChipGroup<Clock>
        label="With icons"
        options={clocks}
        selected={clock()}
        onSelect={setClock}
      />
      <ChipGroup<Intensity>
        label="Disabled"
        options={OPTIONS}
        selected="high"
        onSelect={() => undefined}
        disabled
      />
    </div>
  );
}

function MultipleBlock(): JSX.Element {
  const [games, setGames] = createSignal<readonly Game[]>(['chess', 'words']);
  return (
    <div class="box gap-4">
      <ChipGroup<Game>
        selection="multiple"
        label="Multiple choice (toggle chips, aria-pressed; Go is disabled)"
        options={GAMES}
        selected={games()}
        onSelect={setGames}
      />
      <p class="text textCaption">{`Selected: ${games().join(', ') || 'none'}`}</p>
    </div>
  );
}

export default function ChipGroupExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <div class="box gap-6">
          <SingleBlock />
          <MultipleBlock />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
