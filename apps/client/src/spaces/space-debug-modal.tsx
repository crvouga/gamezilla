/**
 * `SpaceDebugModal` — developer-facing inspector for the space detail screen.
 *
 * Renders the full debug payload (self auth identity, the space entity, the
 * current device's membership row, and resolved member presentations) as a
 * single {@link JsonView} tree so every id/name/timestamp is reachable
 * without bespoke labels.
 */

import { useAuth, type AuthState } from '@gamezilla/client/auth/auth-context';
import { PrincipalServiceToken } from '@gamezilla/client/auth/principal-service';
import { useDependency } from '@gamezilla/lib/dependency-injection/react';
import { JsonView, ResponsiveSurface } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import { useMemo } from 'react';
import { useWindowDimensions } from 'react-native';

import type { useCurrentMembership, useSpace } from './use-spaces';
import type { SpaceMemberRow } from './types';

type Space = ReturnType<typeof useSpace>;
type CurrentMembership = ReturnType<typeof useCurrentMembership>;

type SpaceDebugPayload = {
  self: {
    principalId: string;
    accountId: AuthState['accountId'];
    mode: AuthState['mode'];
    displayName: AuthState['displayName'];
    session: AuthState['session'];
    providers: AuthState['providers'];
  };
  route: { spaceId: string | null };
  space: {
    title: Space['title'];
    customTitle: Space['customTitle'];
    hostId: Space['hostId'];
    hostDisplayName: Space['hostDisplayName'];
    live: Space['live'];
    createdAt: Space['createdAt'];
    endedAt: Space['endedAt'];
    isLoading: Space['isLoading'];
    entity: Space['space'];
  };
  currentMembership: {
    activeSpaceId: CurrentMembership['activeSpaceId'];
    role: CurrentMembership['role'];
    isLoading: CurrentMembership['isLoading'];
    entity: CurrentMembership['membershipEntity'];
  };
  members: SpaceMemberRow[];
};

function buildPayload(args: {
  selfPrincipalId: string;
  auth: AuthState;
  spaceId: string | undefined;
  space: Space;
  current: CurrentMembership;
  members: SpaceMemberRow[];
}): SpaceDebugPayload {
  const { selfPrincipalId, auth, spaceId, space, current, members } = args;
  return {
    self: {
      principalId: selfPrincipalId,
      accountId: auth.accountId,
      mode: auth.mode,
      displayName: auth.displayName,
      session: auth.session,
      providers: auth.providers,
    },
    route: { spaceId: spaceId ?? null },
    space: {
      title: space.title,
      customTitle: space.customTitle,
      hostId: space.hostId,
      hostDisplayName: space.hostDisplayName,
      live: space.live,
      createdAt: space.createdAt,
      endedAt: space.endedAt,
      isLoading: space.isLoading,
      entity: space.space,
    },
    currentMembership: {
      activeSpaceId: current.activeSpaceId,
      role: current.role,
      isLoading: current.isLoading,
      entity: current.membershipEntity,
    },
    members,
  };
}

export type SpaceDebugModalProps = {
  visible: boolean;
  onClose: () => void;
  spaceId: string | undefined;
  space: Space;
  current: CurrentMembership;
  members: SpaceMemberRow[];
};

export function SpaceDebugModal({
  visible,
  onClose,
  spaceId,
  space,
  current,
  members,
}: SpaceDebugModalProps) {
  const principalService = useDependency(PrincipalServiceToken);
  const auth = useAuth();
  const selfPrincipalId = principalService.getPrincipalId();
  const { height: windowHeight } = useWindowDimensions();
  // Surface caps at 80% (mobile sheet) / unconstrained (desktop modal). Bound
  // the inner JSON viewer to ~65% of the viewport so it never escapes either
  // form factor.
  const treeMaxHeight = Math.round(windowHeight * 0.65);

  const payload = useMemo(
    () =>
      buildPayload({ selfPrincipalId, auth, spaceId, space, current, members }),
    [auth, current, members, selfPrincipalId, space, spaceId]
  );

  return (
    <ResponsiveSurface
      visible={visible}
      onClose={onClose}
      title={<Trans>Space debug</Trans>}
      maxWidth={720}
    >
      <JsonView
        label={<Trans>space-screen.debug</Trans>}
        value={payload}
        initialExpandDepth={2}
        maxHeight={treeMaxHeight}
      />
    </ResponsiveSurface>
  );
}
