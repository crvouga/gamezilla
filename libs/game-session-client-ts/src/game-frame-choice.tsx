import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { Spinner } from '@pkgs/ui-root-client-ts/spinner';
import { type Accessor, createSignal, type JSX, Show } from 'solid-js';

/**
 * A place's choices, sent one at a time: which one is on its way, and the
 * step taken once the room accepts it. A refused choice stays on the
 * place; the frame's notice says why.
 */
export type FrameChoices = {
  /** The id of the choice being sent; `null` when none is. */
  readonly pending: Accessor<string | null>;
  readonly choose: (id: string, operation: () => Promise<void>) => void;
};

/** `accepted` runs after a choice the room took (returning to the lobby). */
export function createFrameChoices(accepted: () => void): FrameChoices {
  const [pending, setPending] = createSignal<string | null>(null);
  return {
    pending,
    choose: (id, operation) => {
      if (pending() !== null) return;
      setPending(id);
      void operation().then(
        () => {
          setPending(null);
          accepted();
        },
        () => setPending(null)
      );
    },
  };
}

/**
 * One choice as a row: pressing it sends the choice, shows it is on its
 * way, and holds every other row of the place until the room answers.
 */
export function FrameChoiceRow(props: {
  readonly choices: FrameChoices;
  /** The choice's handle (`custom-game-white-bot`). */
  readonly id: string;
  /** What tells this choice from others sharing its handle (a person); the handle when absent. */
  readonly choice?: string | undefined;
  readonly title: JSX.Element;
  readonly caption?: JSX.Element | undefined;
  readonly leading?: JSX.Element | undefined;
  /** The choice the seat or game holds now. */
  readonly selected?: boolean | undefined;
  readonly tone?: 'destructive' | undefined;
  readonly disabled?: boolean | undefined;
  readonly operation: () => Promise<void>;
}): JSX.Element {
  const key = (): string => props.choice ?? props.id;
  const sending = (): boolean => props.choices.pending() === key();
  return (
    <MenuRow
      title={props.title}
      caption={props.caption}
      leading={props.leading}
      selected={props.selected}
      tone={props.tone}
      hideChevron
      trailing={
        <Show when={sending()}>
          <Spinner size="sm" />
        </Show>
      }
      disabled={props.disabled === true || props.choices.pending() !== null}
      onClick={() => props.choices.choose(key(), props.operation)}
      dataSet={{ testid: props.id }}
    />
  );
}
