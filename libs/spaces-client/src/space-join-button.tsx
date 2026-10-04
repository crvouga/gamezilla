import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui } from '@lingui/solid/macro';
import { Sounds } from '@pkgs/sounds-shared/sound-id';
import { useOptionalSoundEngine } from '@pkgs/sounds-client/solid';
import { Button } from '@pkgs/ui-client/button';
import { useMutationButton } from '@pkgs/ui-client/use-mutation-button';
import type { JSX } from 'solid-js';

import { useCheckConnection } from './use-check-connection';
import { useJoinSpace } from './use-join-space';

export type SpaceJoinButtonProps = {
  spaceId: string;
  joinable: boolean;
  /** Stretch within a footer row (matches FormActionsFooter submit). */
  flex?: number;
  /** Joining needs the server; called instead of joining without one. */
  onOffline: () => void;
};

export function SpaceJoinButton(props: SpaceJoinButtonProps): JSX.Element {
  const { t } = useLingui();
  const joinSpace = useJoinSpace();
  const checkConnection = useCheckConnection();
  const disabled = (): boolean => !props.joinable || props.spaceId.length === 0;
  const engine = useOptionalSoundEngine();

  const join = useMutationButton({
    operation: async () => {
      if (!(await checkConnection())) {
        props.onOffline();
        return;
      }
      await joinSpace(props.spaceId);
    },
    labels: {
      idle: t`Join space`,
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
