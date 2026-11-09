import type { SokobanPosition } from '@libs/sokoban-shared-ts/sokoban-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { useSokobanWords } from './use-sokoban-words';

/** What to know right now, most urgent first; `null` shows how to move. */
export type SokobanFeedback =
  | { readonly kind: 'overflow' }
  | {
      readonly kind: 'refusal';
      readonly code: string;
      readonly message: string;
    }
  | { readonly kind: 'saving' }
  | { readonly kind: 'solved' }
  | null;

/**
 * Solved: the board shows every crate on a goal and the attempt says the
 * completion is saved. The way on is offered once: by the screen when it
 * has one (a pack or a playtest), otherwise here.
 */
function Solved(props: { readonly wayOn: (() => void) | undefined }) {
  const { t } = useLingui();
  return (
    <StackVertical
      gap="xs"
      align="start"
      dataSet={{ testid: 'sokoban-solved' }}
    >
      <VisuallyHidden role="status">
        <Trans>All crates are on goals</Trans>
      </VisuallyHidden>
      <Show
        when={props.wayOn}
        fallback={
          <P variant="label" tone="success">
            <Trans>Solved: every crate is on a goal.</Trans>
          </P>
        }
      >
        {(open) => (
          <Button title={t`More puzzles`} size="sm" onClick={open()} />
        )}
      </Show>
    </StackVertical>
  );
}

function Message(props: {
  readonly feedback: SokobanFeedback;
  readonly wide: boolean;
  readonly onReturnToLibrary: (() => void) | undefined;
}): JSX.Element {
  const words = useSokobanWords();
  const refusal = () =>
    props.feedback?.kind === 'refusal' ? props.feedback : undefined;
  return (
    <Switch>
      <Match when={props.feedback?.kind === 'overflow'}>
        <P
          role="status"
          variant="label"
          tone="warning"
          lines={props.wide ? undefined : 2}
          dataSet={{ testid: 'sokoban-saving', state: 'full' }}
        >
          <Trans>Not added: four moves waiting.</Trans>
        </P>
      </Match>
      <Match when={refusal()}>
        {(refused) => (
          <P
            role="status"
            variant="label"
            tone="warning"
            lines={props.wide ? undefined : 2}
            dataSet={{ testid: 'sokoban-refusal', code: refused().code }}
          >
            {words.refusal(refused().code, refused().message)}
          </P>
        )}
      </Match>
      <Match when={props.feedback?.kind === 'saving'}>
        <P
          role="status"
          variant="caption"
          tone="secondary"
          lines={props.wide ? undefined : 2}
          dataSet={{ testid: 'sokoban-saving', state: 'keeping' }}
        >
          <Trans>Keeping your move. More can wait.</Trans>
        </P>
      </Match>
      <Match when={props.feedback?.kind === 'solved'}>
        <Solved wayOn={props.onReturnToLibrary} />
      </Match>
    </Switch>
  );
}

/**
 * Counts, then one line beside the pad: how to move, or what just happened.
 * Feedback replaces the hint in place and is never taller than the pad, so
 * it never pushes the controls.
 */
export function SokobanStatus(props: {
  readonly position: SokobanPosition;
  readonly help: string;
  readonly wide: boolean;
  readonly feedback: SokobanFeedback;
  readonly onReturnToLibrary: (() => void) | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const hint = () => (
    <Show
      when={props.wide}
      fallback={<Trans>Swipe, tap or use the pad.</Trans>}
    >
      <Trans>
        Move with the arrow keys, W A S D or the pad, or click a square beside
        the worker.
      </Trans>
    </Show>
  );
  return (
    <StackVertical gap="xs" shrink>
      <P
        variant="label"
        dataSet={{
          testid: 'sokoban-counts',
          moves: String(props.position.moves),
          pushes: String(props.position.pushes),
        }}
      >
        {/* On a phone the counts keep two lines, so a longer number never
            re-wraps them and moves the pad; wide screens use one line. */}
        <Text
          variant="inherit"
          wrap="nowrap"
          lines={props.wide ? undefined : 1}
          numeral
          testId="sokoban-count-moves"
        >
          {t`Moves ${props.position.moves}`}
        </Text>
        <Show when={props.wide}>{' · '}</Show>
        <Text
          variant="inherit"
          wrap="nowrap"
          lines={props.wide ? undefined : 1}
          numeral
          testId="sokoban-count-pushes"
        >
          {t`Pushes ${props.position.pushes}`}
        </Text>
      </P>
      <Show
        when={props.feedback}
        fallback={
          <P
            id={props.help}
            variant="caption"
            tone="secondary"
            lines={props.wide ? undefined : 2}
          >
            {hint()}
          </P>
        }
      >
        <Message
          feedback={props.feedback}
          wide={props.wide}
          onReturnToLibrary={props.onReturnToLibrary}
        />
        {/* The board keeps its description while feedback shows. */}
        <VisuallyHidden id={props.help}>{hint()}</VisuallyHidden>
      </Show>
    </StackVertical>
  );
}
