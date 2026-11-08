import type { SokobanPosition } from '@libs/sokoban-shared-ts/sokoban-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { Layer } from '@pkgs/ui-root-client-ts/layer';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import {
  createEffect,
  createSignal,
  type JSX,
  Match,
  on,
  Show,
  Switch,
} from 'solid-js';
import { useSokobanWords } from './use-sokoban-words';

/**
 * The solved card, laid over the board's lower edge so the pad and the
 * attempt's undo stay where the player's hand is. Putting it away keeps the
 * board in view; it returns on the next solve.
 */
export function SokobanSolvedCard(props: {
  readonly solved: boolean;
  readonly onReturnToLibrary: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const [putAway, setPutAway] = createSignal(false);
  createEffect(
    on(
      () => props.solved,
      (solved) => {
        if (!solved) setPutAway(false);
      }
    )
  );
  return (
    <Show when={props.solved && !putAway()}>
      <Layer inset="parent" justify="end" padding="sm" z="raised" passThrough>
        <Surface radius="control">
          <Notice
            tone="success"
            dataSet={{ testid: 'sokoban-solved' }}
            onDismiss={() => setPutAway(true)}
          >
            <P role="status" variant="bodyBold">
              <Trans>All crates are on goals</Trans>
            </P>
            <P variant="caption">
              <Trans>Keep playing or choose another puzzle.</Trans>
            </P>
            <Button
              title={t`Choose another puzzle`}
              onClick={props.onReturnToLibrary}
            />
          </Notice>
        </Surface>
      </Layer>
    </Show>
  );
}

/** What to know right now, most urgent first; `null` shows how to move. */
export type SokobanFeedback =
  | { readonly kind: 'overflow' }
  | { readonly kind: 'refusal'; readonly code: string; readonly message: string }
  | { readonly kind: 'saving' }
  | { readonly kind: 'solved' }
  | null;

function Message(props: { readonly feedback: SokobanFeedback }): JSX.Element {
  const words = useSokobanWords();
  const refusal = () =>
    props.feedback?.kind === 'refusal' ? props.feedback : undefined;
  return (
    <Switch>
      <Match when={props.feedback?.kind === 'overflow'}>
        <P
          role="status"
          variant="caption"
          tone="warning"
          dataSet={{ testid: 'sokoban-saving', state: 'full' }}
        >
          <Trans>Direction not added. Four directions are already waiting.</Trans>
        </P>
      </Match>
      <Match when={refusal()}>
        {(refused) => (
          <P
            role="status"
            variant="caption"
            tone="warning"
            dataSet={{ testid: 'sokoban-refusal', code: refused().code }}
          >
            {words.refusal(refused().code, refused().message)}{' '}
            <Trans>Try another direction.</Trans>
          </P>
        )}
      </Match>
      <Match when={props.feedback?.kind === 'saving'}>
        <P
          role="status"
          variant="caption"
          tone="secondary"
          dataSet={{ testid: 'sokoban-saving', state: 'keeping' }}
        >
          <Trans>Keeping your move. Up to four directions can wait.</Trans>
        </P>
      </Match>
      <Match when={props.feedback?.kind === 'solved'}>
        <P variant="caption" tone="success">
          <Trans>Solved. Keep playing or choose another puzzle.</Trans>
        </P>
      </Match>
    </Switch>
  );
}

/**
 * Counts, then one line beside the pad: how to move, or what just happened.
 * Feedback replaces the hint in place, so it never pushes the controls.
 */
export function SokobanStatus(props: {
  readonly position: SokobanPosition;
  readonly help: string;
  readonly wide: boolean;
  readonly feedback: SokobanFeedback;
}): JSX.Element {
  const { t } = useLingui();
  const hint = () => (
    <Show
      when={props.wide}
      fallback={<Trans>Swipe, tap beside the worker, or use the pad.</Trans>}
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
        role="status"
        variant="label"
        dataSet={{
          testid: 'sokoban-counts',
          moves: String(props.position.moves),
          pushes: String(props.position.pushes),
        }}
      >
        {/* Each count stays with its label; a narrow phone wraps only
            between the two counts. */}
        <Text variant="inherit" wrap="nowrap" numeral>
          {t`Moves ${props.position.moves}`}
        </Text>
        {' · '}
        <Text variant="inherit" wrap="nowrap" numeral>
          {t`Pushes ${props.position.pushes}`}
        </Text>
      </P>
      <Show
        when={props.feedback}
        fallback={
          <P id={props.help} variant="caption" tone="secondary">
            {hint()}
          </P>
        }
      >
        <Message feedback={props.feedback} />
        {/* The board keeps its description while feedback shows. */}
        <VisuallyHidden id={props.help}>{hint()}</VisuallyHidden>
      </Show>
    </StackVertical>
  );
}
