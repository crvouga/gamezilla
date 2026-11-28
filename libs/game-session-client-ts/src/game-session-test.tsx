import { TEST_HOOKS_ENABLED } from '@libs/app-config-shared-ts/test-hooks';
import { gameSessionChoiceSchema } from '@libs/game-session-shared-ts/game-session-choice';
import { TestCommandProbe } from '@pkgs/ui-root-client-ts/test-command-probe';
import type { JSX } from '@solidjs/web';
import { createSignal, Show } from 'solid-js';
import { gameSessionCanMove } from './game-session-can-move';
import type { GameSessionReview } from './use-game-session-review';
import type { GameSessionScreenModel } from './use-game-session-screen';

/** Observations of the rendered room state; omitted from end-user bundles. */
export function GameSessionTest(props: {
  model: GameSessionScreenModel;
  review: GameSessionReview;
}): JSX.Element {
  const [request, setRequest] = createSignal('');
  const [receipt, setReceipt] = createSignal({
    request: '',
    reason: '',
    pending: false,
  });
  const attempt = async (): Promise<void> => {
    const raw = request();
    setReceipt({ request: raw, reason: '', pending: true });
    try {
      await props.model.attempt(gameSessionChoiceSchema.parse(JSON.parse(raw)));
      setReceipt({ request: raw, reason: '', pending: false });
    } catch (cause) {
      setReceipt({
        request: raw,
        reason: cause instanceof Error ? cause.message : 'choice failed',
        pending: false,
      });
    }
  };
  return (
    <Show when={TEST_HOOKS_ENABLED}>
      <TestCommandProbe
        commandLabel="Game Session conformance command"
        sendLabel="Send game choice"
        command={request()}
        onCommandInput={setRequest}
        onSend={() => {
          void attempt();
        }}
        commandTestId="game-session-command-input"
        sendTestId="game-session-command-send"
        readoutTestId="game-session-debug"
        readout={JSON.stringify({
          ...props.model.games(),
          error: props.model.error() || props.review.error(),
          myId: props.model.myId(),
          members: props.model.members(),
          settled: props.model.settled(),
          receipt: receipt(),
          connected: props.model.connected(),
          displayFen: props.review.fen(),
          reviewPly: props.review.displayedPly(),
          live: props.review.live(),
          mySide: props.model.mySide(),
          waiting: props.model.waiting(),
          // The person's own private setup as the screen shows it: what
          // their setup board holds and what their game board draws.
          privateSetup: props.model.privateSetup.has()
            ? {
                arranged: props.model.privateSetup.draft(),
                own: props.model.privateSetup.own(),
              }
            : null,
          // The person's own hand in a game with dealt hands, as their
          // board receives it; never another side's.
          ownHand: props.model.ownHand(),
          ownCommitment: props.model.ownCommitment(),
          away: props.model.away(),
          gates: {
            create: props.model.canCreate(),
            configure: props.model.canConfigure(),
            invite: props.model.canInvite(),
            bot: props.model.canBot(),
            start: props.model.canStart(),
            cancel: props.model.canCancel(),
            join: props.model.canJoin(),
            watch: props.model.watchDecision().allowed,
            play: props.model.canPlay(),
            move: gameSessionCanMove(props.model, props.review),
          },
        })}
      />
    </Show>
  );
}
