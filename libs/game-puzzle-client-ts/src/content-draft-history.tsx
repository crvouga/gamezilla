import { useLingui } from '@lingui/solid/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import type { SpaceGameAction } from '@pkgs/ui-root-client-ts/space-types';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { type Accessor, type JSX, Show } from 'solid-js';
import type { DraftEditDirection } from './draft-edit-history';
import type { useContentDraftSave } from './use-content-draft-save';
import type { DraftEditHistoryTools } from './use-draft-edit-history';

type HistoryProps = {
  writer: ReturnType<typeof useContentDraftSave>;
  history: DraftEditHistoryTools;
  disabled: Accessor<boolean>;
};

/** What a step says at rest, while it runs, once done and when it failed. */
type StepWords = Readonly<
  Record<'idle' | 'loading' | 'success' | 'error', string>
>;

function useStepWords(direction: DraftEditDirection): StepWords {
  const { t } = useLingui();
  return direction === 'undo'
    ? {
        idle: t`Undo`,
        loading: t`Undoing…`,
        success: t`Edit undone`,
        error: t`Try undoing again`,
      }
    : {
        idle: t`Redo`,
        loading: t`Redoing…`,
        success: t`Edit restored`,
        error: t`Try redoing again`,
      };
}

function useDraftEditStep(props: HistoryProps, direction: DraftEditDirection) {
  const { t } = useLingui();
  const words = useStepWords(direction);
  const step = useMutationButton({
    operation: async () => {
      await props.writer.save();
      if (props.writer.dirty())
        throw new Error(t`Keep the current changes first. Try saving again.`);
      props.writer.adopt(
        await props.history.step(direction, props.writer.draftId())
      );
    },
    labels: words,
    get disabled() {
      return (
        props.disabled() ||
        !props.history.choices(props.writer.draftId())[direction]
      );
    },
  });
  return {
    step,
    /** The step as the action bar draws it, its words saying how it went. */
    action: (testId: string): SpaceGameAction => ({
      id: direction,
      label: words[step.feedback()],
      disabled:
        step.buttonProps.disabled === true || step.feedback() === 'loading',
      onPress: () => void step.run(),
      testId,
    }),
  };
}

/**
 * Undo and redo of this session's draft edits, for the board's action bar;
 * each keeps a new draft copy. `failure` says a step that did not happen,
 * with its retry, over the board.
 */
export function useContentDraftHistory(props: HistoryProps): {
  readonly actions: Accessor<readonly SpaceGameAction[]>;
  readonly failure: JSX.Element;
} {
  const { t } = useLingui();
  const undo = useDraftEditStep(props, 'undo');
  const redo = useDraftEditStep(props, 'redo');
  return {
    actions: () => [
      undo.action('content-undo-draft-edit'),
      redo.action('content-redo-draft-edit'),
    ],
    failure: (
      <Show when={undo.step.error() ?? redo.step.error()}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`Your draft is unchanged`}
            body={error().message}
            retry={{
              onClick: () => {
                void (undo.step.error() === null ? redo : undo).step.run();
              },
            }}
          />
        )}
      </Show>
    ),
  };
}
