import { TEST_HOOKS_ENABLED } from '@libs/app-config-shared/test-hooks';
import { customGameChoiceSchema } from '@libs/game-session-shared/custom-game-choice';
import { createSignal, type JSX, Show } from 'solid-js';
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
      <div class="sr-only">
        <input
          value={request()}
          onInput={(event) => setRequest(event.currentTarget.value)}
          aria-label="Custom Game conformance command"
          tabIndex={-1}
          data-testid="chess-custom-command-input"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            void attempt();
          }}
          data-testid="chess-custom-command-send"
        >
          Send game choice
        </button>
        <pre data-testid="chess-custom-debug">
          {JSON.stringify({
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
            },
          })}
        </pre>
      </div>
    </Show>
  );
}
