import { Trans } from '@lingui/solid/macro';
import type { GameOptionGroup } from '@pkgs/turn-game-shared-ts/game-frame';
import { GameOptionField } from '@pkgs/ui-root-client-ts/game-option-field';
import { Text } from '@pkgs/ui-root-client-ts/text';
import {
  type Accessor,
  createSignal,
  For,
  type JSX,
  Match,
  Switch,
} from 'solid-js';

/**
 * A game's options while its custom game is set up, drawn by the frame from
 * the game's `frame.options`: a choice as chips, a count as a stepper with
 * its range under it. Whoever may set the game up changes them, and each
 * change is the configuration choice the option encodes; everyone else
 * reads them. Each option's control is `custom-game-option-${id}` (a
 * choice's chips `-${value}`; a count's stepper `-decrease`, `-increase`,
 * `-value`, and its range `-range`).
 */
export type GameFrameOptionsProps = {
  readonly options: readonly GameOptionGroup[];
  readonly position: string;
  readonly editable: boolean;
  /** Applies a configuration choice; rejects when it is refused. */
  readonly apply: (choice: string) => Promise<void>;
};

export function frameOptionTestId(id: string): string {
  return `custom-game-option-${id}`;
}

/**
 * The value shown while a change is on its way, then the position's again.
 * Changes made while one is applied are sent after it, the last one last,
 * so quick taps never send against a stale game. A refused change shows
 * the position's value again; the screen says why (`custom-game-error`).
 */
function useOptionDraft<T>(
  read: Accessor<T>,
  apply: (value: T) => Promise<void>
): { value: Accessor<T>; change: (value: T) => void } {
  const [draft, setDraft] = createSignal<{ value: T } | null>(null);
  let sending = false;
  const flush = async (): Promise<void> => {
    if (sending) return;
    sending = true;
    let sent: { value: T } | null = null;
    try {
      for (let next = draft(); next !== null && next !== sent; next = draft()) {
        sent = next;
        await apply(next.value);
      }
    } finally {
      sending = false;
      setDraft(null);
    }
  };
  return {
    value: () => draft()?.value ?? read(),
    change: (value) => {
      if (value === (draft()?.value ?? read())) return;
      setDraft({ value });
      flush().catch(() => setDraft(null));
    },
  };
}

type OptionProps<K extends GameOptionGroup['kind']> = Omit<
  GameFrameOptionsProps,
  'options'
> & { readonly option: Extract<GameOptionGroup, { kind: K }> };

function ChoiceOption(props: OptionProps<'choice'>): JSX.Element {
  const id = frameOptionTestId(props.option.id);
  const draft = useOptionDraft(
    () => props.option.read(props.position),
    (value: string) => props.apply(props.option.encode(value))
  );
  return (
    <GameOptionField
      kind="choice"
      label={props.option.label()}
      readOnly={!props.editable}
      testId={id}
      value={draft.value()}
      onChange={draft.change}
      options={props.option.options.map((choice) => ({
        value: choice.value,
        label: choice.label(),
        testId: `${id}-${choice.value}`,
      }))}
    />
  );
}

function CountOption(props: OptionProps<'count'>): JSX.Element {
  const id = frameOptionTestId(props.option.id);
  const draft = useOptionDraft(
    () => props.option.read(props.position),
    (value: number) => props.apply(props.option.encode(value))
  );
  const min = (): number => props.option.min;
  const max = (): number => props.option.max;
  return (
    <GameOptionField
      kind="count"
      label={props.option.label()}
      readOnly={!props.editable}
      testId={id}
      value={draft.value()}
      min={min()}
      max={max()}
      onChange={draft.change}
      message={{
        text: (
          <Text variant="inherit" testId={`${id}-range`}>
            <Trans>
              Choose from {min()} to {max()}.
            </Trans>
          </Text>
        ),
      }}
    />
  );
}

export function GameFrameOptions(props: GameFrameOptionsProps): JSX.Element {
  return (
    <For each={props.options}>
      {(option) => (
        <Switch>
          <Match when={option.kind === 'choice' ? option : undefined}>
            {(choice) => (
              <ChoiceOption
                option={choice()}
                position={props.position}
                editable={props.editable}
                apply={props.apply}
              />
            )}
          </Match>
          <Match when={option.kind === 'count' ? option : undefined}>
            {(count) => (
              <CountOption
                option={count()}
                position={props.position}
                editable={props.editable}
                apply={props.apply}
              />
            )}
          </Match>
        </Switch>
      )}
    </For>
  );
}
