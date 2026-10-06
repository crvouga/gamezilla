import { useMyDeviceId, useMyId } from '@libs/auth-client/use-current-user';
import { useModeration } from '@libs/moderation-client/moderation-context';
import { spaceTitleText, usernameText } from '@libs/moderation-shared/display';
import { useProfileRow } from '@libs/profile-client/public-use-profile-row';
import { resolveSpaceFallbackTitleParts } from '@libs/spaces-shared/resolve-space-fallback-title-parts';
import { resolveSpaceTitleUsername } from '@libs/spaces-shared/resolve-space-title-username';
import { useLingui } from '@lingui/solid/macro';
import { type Accessor, createMemo } from 'solid-js';
import { SpaceField, useSpaceColumn } from './use-space-column';
import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';

/**
 * Live space title for cards, miniplayer, a11y, and command palette. A custom
 * title the moderation policy masks falls through to the host-name default,
 * and that host name is itself moderated.
 */
export function useSpaceDisplayTitle(
  spaceId: string | Accessor<string>
): Accessor<string> {
  const { t } = useLingui();
  const resolvedSpaceId = (): string =>
    typeof spaceId === 'function' ? spaceId() : spaceId;
  const customTitle = useSpaceColumn(spaceId, SpaceField.title);
  const host = useSpaceHostMembershipDisplay(spaceId);
  const hostProfileId = createMemo(() => {
    const id = host()?.profileId;
    return id !== undefined && id.length > 0 ? id : null;
  });
  const myId = useMyId();
  const myDeviceId = useMyDeviceId();
  const hostId = useSpaceColumn(spaceId, SpaceField.hostId);
  const hostRow = useProfileRow(hostProfileId);
  const myRow = useProfileRow(() => (myId().length > 0 ? myId() : null));
  const moderation = useModeration();
  const hostUsername = createMemo(() => {
    const id = hostProfileId();
    return id === null
      ? null
      : usernameText(moderation(), hostRow.row()?.username, id);
  });
  const myUsername = createMemo(() =>
    myId().length > 0
      ? usernameText(moderation(), myRow.row()?.username, myId())
      : null
  );

  return createMemo(() => {
    const title = spaceTitleText(
      moderation(),
      customTitle(),
      resolvedSpaceId()
    );
    if (title !== null && title.length > 0) {
      return title;
    }
    const parts = resolveSpaceFallbackTitleParts(
      resolveSpaceTitleUsername({
        hostUsername: hostUsername(),
        myUsername: myUsername(),
        hostProfileId: hostProfileId() ?? '',
        myId: myId(),
        hostId: hostId(),
        myDeviceId: myDeviceId(),
      })
    );
    if (parts.kind === 'host') {
      return t`${parts.hostName}'s space`;
    }
    return t`Space`;
  });
}
