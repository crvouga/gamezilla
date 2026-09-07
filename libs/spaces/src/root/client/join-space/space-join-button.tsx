import { useIsSignedIn } from '@libs/auth/public/use-current-user';
import { Handles } from '@libs/test-ids';
import { useLingui } from '@lingui/solid/macro';
import { Sounds } from '@pkgs/sounds';
import { useOptionalSoundEngine } from '@pkgs/sounds/solid';
import { Button, useMutationButton } from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { useJoinSpace } from './use-join-space';

export type SpaceJoinButtonProps = {
  spaceId: string;
  joinable: boolean;
  /** Stretch within a footer row (matches FormActionsFooter submit). */
  flex?: number;
};

export function SpaceJoinButton(props: SpaceJoinButtonProps): JSX.Element {
  const { t } = useLingui();
  const joinSpace = useJoinSpace();
  const signedIn = useIsSignedIn();
  const disabled = (): boolean =>
    !signedIn() || !props.joinable || props.spaceId.length === 0;
  const engine = useOptionalSoundEngine();

  const join = useMutationButton({
    operation: () => joinSpace(props.spaceId),
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
