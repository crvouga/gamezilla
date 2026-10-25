import { TEST_HOOKS_ENABLED } from '@libs/app-config-shared-ts/test-hooks';
import { customGameChoiceSchema } from '@libs/game-session-shared-ts/custom-game-choice';
import { TestCommandProbe } from '@pkgs/ui-root-client-ts/test-command-probe';
import { createSignal, type JSX, Show } from 'solid-js';
import { customGameCanMove } from './custom-game-can-move';
import type { CustomGameReview } from './use-custom-game-review';
import type { CustomGameScreenModel } from './use-custom-game-screen';

/** Observations of the rendered room state; omitted from end-user bundles. */
export function CustomGameTest(props: {
  model: CustomGameScreenModel;
  review: CustomGameReview;
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
      await props.model.attempt(customGameChoiceSchema.parse(JSON.parse(raw)));
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
        commandLabel="Custom Game conformance command"
        sendLabel="Send game choice"
        command={request()}
        onCommandInput={setRequest}
        onSend={() => {
          void attempt();
        }}
        commandTestId="custom-game-command-input"
        sendTestId="custom-game-command-send"
        readoutTestId="custom-game-debug"
        readout={JSON.stringify({
          ...props.model.games(),
          error: props.model.error() || props.review.error(),
          myId: props.model.myId(),
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
            move: customGameCanMove(props.model, props.review),
          },
        })}
      />
    </Show>
  );
}
