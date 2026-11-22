import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import type { GameOptionGroup } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameOptionFieldProps } from '@pkgs/ui-root-client-ts/game-option-field';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type Accessor, createMemo, createSignal } from 'solid-js';
import type { FrameOptions } from './game-frame-view-types';

/**
 * A custom game's settings while it is set up, as the setup's settings rows
 * (`GameOptionField`): the player count (read, never changed here: the
 * seats set it), the game's own options from its `frame.options` (a choice
 * as chips, a count as a stepper with its range under it), and, for a host
 * of a game played by turns, the clock. Whoever may set the game up changes
 * them, each change the configuration choice it encodes; everyone else
 * reads them. Each option's control is `custom-game-option-${id}` (a
 * choice's chips `-${value}`; a count's stepper `-decrease`, `-increase`,
 * `-value`, and its range `-range`); the clock's chips are
 * `custom-game-untimed` and `custom-game-clock-${minutes}-${increment}`.
 */

type Choose = (input: CustomGameInput) => Promise<void>;

export function frameOptionTestId(id: string): string {
  return `custom-game-option-${id}`;
}

/** The clocks offered beside the one the game has: minutes and added seconds. */
const CLOCK_PRESETS: readonly (readonly [number, number])[] = [
  [3, 2],
  [5, 0],
  [5, 3],
  [10, 0],
  [15, 10],
];

const UNTIMED = 'untimed';

function clockKey(minutes: number, increment: number): string {
  return minutes === 0 ? UNTIMED : `${minutes}+${increment}`;
}

/**
 * Each option's value while a change is on its way, then the position's
 * again. Changes made while one is applied are sent after it, the last one
 * last, so quick taps never send against a stale game. A refused change
 * shows the position's value again; the screen says why
 * (`custom-game-error`).
 */
function createDrafts() {
  type Draft = { readonly value: unknown };
  const [drafts, setDrafts] = createSignal<ReadonlyMap<string, Draft>>(
    new Map()
  );
  const sending = new Set<string>();
  const put = (id: string, draft: Draft | undefined): void => {
    setDrafts((all) => {
      const next = new Map(all);
      if (draft === undefined) next.delete(id);
      else next.set(id, draft);
      return next;
    });
  };
  const flush = async (
    id: string,
    apply: (value: unknown) => Promise<void>
  ): Promise<void> => {
    if (sending.has(id)) return;
    sending.add(id);
    let sent: Draft | undefined;
    try {
      for (
        let next = drafts().get(id);
        next !== undefined && next !== sent;
        next = drafts().get(id)
      ) {
        sent = next;
        await apply(next.value);
      }
    } finally {
      sending.delete(id);
      put(id, undefined);
    }
  };
  const shown = <T,>(id: string, read: () => T): T => {
    const draft = drafts().get(id);
    return draft === undefined ? read() : (draft.value as T);
  };
  return {
    value: shown,
    change: <T,>(
      id: string,
      value: T,
      read: () => T,
      apply: (value: T) => Promise<void>
    ): void => {
      if (value === shown(id, read)) return;
      put(id, { value });
      flush(id, (sent) => apply(sent as T)).catch(() => put(id, undefined));
    },
  };
}

type Drafts = ReturnType<typeof createDrafts>;

function optionField(
  option: GameOptionGroup,
  options: Accessor<FrameOptions | null>,
  drafts: Drafts,
  choose: Choose
): GameOptionFieldProps {
  const id = frameOptionTestId(option.id);
  const position = (): string => options()?.position ?? '';
  const readOnly = (): boolean => options()?.editable !== true;
  if (option.kind === 'choice') {
    const read = (): string => option.read(position());
    const apply = (value: string) =>
      choose({ operation: 'rules', choice: option.encode(value) });
    return {
      kind: 'choice',
      label: option.label(),
      get readOnly() {
        return readOnly();
      },
      testId: id,
      get value() {
        return drafts.value(id, read);
      },
      onChange: (value) => drafts.change(id, value, read, apply),
      options: option.options.map((choice) => ({
        value: choice.value,
        label: choice.label(),
        testId: `${id}-${choice.value}`,
      })),
    };
  }
  const read = (): number => option.read(position());
  const apply = (value: number) =>
    choose({ operation: 'rules', choice: option.encode(value) });
  return {
    kind: 'count',
    label: option.label(),
    get readOnly() {
      return readOnly();
    },
    testId: id,
    get value() {
      return drafts.value(id, read);
    },
    min: option.min,
    max: option.max,
    onChange: (value) => drafts.change(id, value, read, apply),
    message: {
      text: (
        <Text variant="inherit" testId={`${id}-range`}>
          <Trans>
            Choose from {option.min} to {option.max}.
          </Trans>
        </Text>
      ),
    },
  };
}

/** The clock words a chip says: `Untimed`, `5 min + 3 sec`. */
function clockLabel(minutes: number, increment: number): string {
  if (minutes === 0) return t`Untimed`;
  return increment === 0
    ? t`${minutes} min`
    : t`${minutes} min + ${increment} sec`;
}

/** The clock as chips: untimed, the usual clocks, and the one it has. */
function clockField(
  clock: NonNullable<FrameOptions['clock']>,
  choose: Choose
): GameOptionFieldProps {
  const presets = CLOCK_PRESETS.some(
    ([minutes, increment]) =>
      minutes === clock.minutes && increment === clock.increment
  )
    ? CLOCK_PRESETS
    : [...CLOCK_PRESETS, [clock.minutes, clock.increment] as const];
  const timed = presets.filter(([minutes]) => minutes > 0);
  return {
    kind: 'choice',
    label: t`Clock`,
    testId: 'custom-game-time',
    value: clockKey(clock.minutes, clock.increment),
    onChange: (value) => {
      const chosen = timed.find(
        ([minutes, increment]) => clockKey(minutes, increment) === value
      );
      void choose(
        chosen === undefined
          ? { operation: 'untimed' }
          : { operation: 'clock', minutes: chosen[0], increment: chosen[1] }
      ).catch(() => undefined);
    },
    options: [
      {
        value: UNTIMED,
        label: clockLabel(0, 0),
        testId: 'custom-game-untimed',
      },
      ...timed.map(([minutes, increment]) => ({
        value: clockKey(minutes, increment),
        label: clockLabel(minutes, increment),
        testId: `custom-game-clock-${minutes}-${increment}`,
      })),
    ],
  };
}

/** The player count, read: each count is its own game, set by the seats. */
function playersField(
  players: NonNullable<FrameOptions['players']>
): GameOptionFieldProps {
  return {
    kind: 'count',
    label: t`Players`,
    readOnly: true,
    value: players.count,
    min: players.min,
    max: players.max,
    onChange: () => undefined,
    testId: 'custom-game-players',
  };
}

/**
 * The settings rows of the game being set up: the player count, the
 * game's own options, then the clock. Each option's row keeps its draft
 * while the position changes under it.
 */
export function useFrameSettings(
  options: Accessor<FrameOptions | null>,
  choose: Choose
): Accessor<readonly GameOptionFieldProps[]> {
  const drafts = createDrafts();
  const groups = createMemo(() => options()?.groups ?? [], undefined, {
    equals: (a, b) =>
      a.length === b.length && a.every((group, i) => group === b[i]),
  });
  const fields = createMemo(() =>
    groups().map((group) => optionField(group, options, drafts, choose))
  );
  return createMemo((): readonly GameOptionFieldProps[] => {
    const shown = options();
    if (shown === null) return [];
    return [
      ...(shown.players === null ? [] : [playersField(shown.players)]),
      ...fields(),
      ...(shown.clock === null ? [] : [clockField(shown.clock, choose)]),
    ];
  });
}
