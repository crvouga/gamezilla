import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui } from '@lingui/solid/macro';
import { useOptionalSoundEngine } from '@pkgs/sounds-client/solid';
import { Sounds } from '@pkgs/sounds-shared/sound-id';
import { useMutationFeedback } from '@pkgs/sync-engine-client/use-mutation-feedback';
import { Button } from '@pkgs/ui-root-client/button';
import { useMutationButton } from '@pkgs/ui-root-client/use-mutation-button';
import type { JSX } from 'solid-js';

import { useCheckConnection } from './use-check-connection';
import { useJoinSpace } from './use-join-space';

export type SpaceJoinButtonProps = {
  spaceId: string;
  /** Stretch within a footer row (matches FormActionsFooter submit). */
  flex?: number;
  /** Joining needs the server; called instead of joining without one. */
  onOffline: () => void;
};

export function SpaceJoinButton(props: SpaceJoinButtonProps): JSX.Element {
  const { t } = useLingui();
  const joinSpace = useJoinSpace();
  const checkConnection = useCheckConnection();
  const disabled = (): boolean => props.spaceId.length === 0;
  const engine = useOptionalSoundEngine();
  const persisted = useMutationFeedback('joinSpace', () => ({
    spaceId: props.spaceId,
  }));

  const join = useMutationButton({
    operation: async () => {
      if (persisted()?.status !== 'pending' && !(await checkConnection())) {
        props.onOffline();
        throw new Error(t`Joining someone else's space needs a connection.`);
      }
      await joinSpace(props.spaceId);
    },
    labels: {
      get idle() {
        return persisted()?.status === 'pending'
          ? t`Not confirmed. Check again`
          : t`Join space`;
      },
      loading: t`Joining…`,
      success: t`Joined`,
      error: t`Couldn't join`,
    },
    get disabled() {
      return disabled();
    },
    onPhaseChange: (transition) => {
      const current = engine?.();
      if (current === undefined) return;
      if (transition.to === 'success') {
        current.play(Sounds.social.roomJoined);
      } else if (transition.to === 'error') {
        current.play(Sounds.feedback.error);
      }
    },
  });

  return (
    <Button
      {...join.buttonProps}
      flex={props.flex}
      dataSet={{ testid: Handles.spaceJoin }}
    />
  );
}
