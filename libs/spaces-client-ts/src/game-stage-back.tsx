import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, onCleanup, Show } from 'solid-js';
import { DefineBackButton } from './spaces-nav-context';

export type GameLeaveAction = 'abort' | 'resign';

export type GameStageBackProps = {
  readonly gameId: string | null;
  readonly action: GameLeaveAction | null;
  readonly message: string;
  readonly label?: string | undefined;
  readonly backWithinGame: () => boolean;
  readonly returnToSpaceScreen: () => void;
  readonly submit: (action: GameLeaveAction) => Promise<void>;
};

/** The board's Back and device Back share this confirmation, bound to the game the person saw. */
export function GameStageBack(props: GameStageBackProps): JSX.Element {
  const { t } = useLingui();
  type Choice = { id: string; action: GameLeaveAction; message: string };
  const round = createMemo(() => props.gameId);
  const [choice, setChoice] = createSignal<Choice | null>(() => {
    round();
    return null;
  });
  let sending = false;
  let mounted = true;
  onCleanup(() => {
    mounted = false;
  });
  const asked = (): Choice | null => {
    const selected = choice();
    return selected?.id === props.gameId ? selected : null;
  };
  const close = (): void => {
    if (!sending) setChoice(null);
  };
  const back = (): void => {
    if (sending) return;
    if (asked() !== null) return close();
    if (props.backWithinGame()) return;
    if (props.action === null || props.gameId === null)
      return props.returnToSpaceScreen();
    setChoice({
      id: props.gameId,
      action: props.action,
      message: props.message,
    });
  };
  const confirm = async (selected: Choice): Promise<void> => {
    if (sending || asked() !== selected) return;
    if (selected.action !== props.action) {
      setChoice(null);
      return;
    }
    sending = true;
    try {
      await props.submit(selected.action);
      if (mounted && asked() === selected) {
        setChoice(null);
        props.returnToSpaceScreen();
      }
    } finally {
      sending = false;
    }
  };
  return (
    <>
      <DefineBackButton onPress={back} label={props.label} deviceBack />
      <Show when={asked()} keyed>
        {(selected) => (
          <MutationModal
            visible
            onClose={close}
            title={
              selected.action === 'abort'
                ? t`Abort game and go back?`
                : t`Resign and go back?`
            }
            message={selected.message}
            submitLabel={
              selected.action === 'abort' ? t`Abort game` : t`Resign game`
            }
            cancelLabel={t`Keep playing`}
            variant="destructive"
            operation={() => confirm(selected)}
            successTitle={t`Game finished`}
            submitDataSet={{ testid: 'game-back-confirm' }}
            cancelDataSet={{ testid: 'game-back-stay' }}
          />
        )}
      </Show>
    </>
  );
}
