import { useSpaceLifecycleModals } from '@libs/spaces/client/lifecycle/space-lifecycle-modal-provider';
import { useSpaceActions } from '@libs/spaces/client/lifecycle/space-actions';
import { useCurrentSpaceCount } from '@libs/spaces/client/use-current-space-count';
import { useCurrentSpaceIds } from '@libs/spaces/client/use-current-space-ids';
import { useCurrentSpaceRole } from '@libs/spaces/client/use-current-space-role';
import { useLiveSpaceIds } from '@libs/spaces/client/use-live-space-ids';
import { openSpaceDetail } from '@libs/spaces/client/space-routes';
import { useSpaceCommandLabel } from '@libs/spaces/client/use-space-command-label';
import {
  Gamepad2Icon,
  LogInIcon,
  LogOutIcon,
  RegisterCommand,
  XIcon,
} from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { usePathname, useRouter } from 'expo-router';
import { type ReactNode } from 'react';

const SPACE_ROUTE_RE = /^\/space\/([^/?#]+)/;

export function SpaceCommands(): ReactNode {
  return (
    <>
      <SpaceCreateCommand />
      <SpaceJoinCurrentCommand />
      <LiveSpaceCommands />
      <CurrentSpaceCommands />
    </>
  );
}

function SpaceCreateCommand(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const { createSpace } = useSpaceActions();
  const { count: currentCount, isLoading: membershipLoading } =
    useCurrentSpaceCount();
  return (
    <RegisterCommand
      id="space:new"
      title={t`Start new space`}
      category={t`Spaces`}
      icon={Gamepad2Icon}
      keywords={[t`new`, t`create`, t`start`, t`space`, t`host`]}
      enabled={!membershipLoading && currentCount === 0}
      run={async () => {
        await createSpace((id) => {
          openSpaceDetail(router, id);
        });
      }}
    />
  );
}

function SpaceJoinCurrentCommand(): ReactNode {
  const { t } = useLingui();
  const pathname = usePathname();
  const { joinSpace } = useSpaceActions();
  const { count: currentCount } = useCurrentSpaceCount();
  const spaceId = SPACE_ROUTE_RE.exec(pathname)?.[1] ?? '';
  const role = useCurrentSpaceRole(spaceId);

  if (spaceId.length === 0) return null;
  if (role !== null) return null;
  if (currentCount > 0) return null;

  return (
    <RegisterCommand
      id="space:join-current"
      title={t`Join this space`}
      category={t`Spaces`}
      icon={LogInIcon}
      keywords={[t`join`, t`this`, t`current`, t`space`]}
      run={async () => {
        await joinSpace(spaceId);
      }}
    />
  );
}

function LiveSpaceCommands(): ReactNode {
  const { spaceIds } = useLiveSpaceIds();
  return (
    <>
      {spaceIds.map((spaceId) => (
        <LiveSpaceCommand key={spaceId} spaceId={spaceId} />
      ))}
    </>
  );
}

function LiveSpaceCommand({ spaceId }: { spaceId: string }): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const { joinSpace } = useSpaceActions();
  const label = useSpaceCommandLabel(spaceId);
  const role = useCurrentSpaceRole(spaceId);
  const { count: currentCount } = useCurrentSpaceCount();
  const canJoin = role === null && currentCount === 0;
  return (
    <>
      <RegisterCommand
        id={`space:open:${spaceId}`}
        title={t`Open ${label}`}
        category={t`Spaces`}
        icon={Gamepad2Icon}
        keywords={[t`open`, t`go to`, t`space`]}
        run={async () => {
          openSpaceDetail(router, spaceId);
        }}
      />
      <RegisterCommand
        id={`space:join:${spaceId}`}
        title={t`Join ${label}`}
        category={t`Spaces`}
        icon={LogInIcon}
        keywords={[t`join`, t`lobby`, t`space`, t`multiplayer`]}
        enabled={canJoin}
        run={async () => {
          await joinSpace(spaceId);
        }}
      />
    </>
  );
}

function CurrentSpaceCommands(): ReactNode {
  const { entries } = useCurrentSpaceIds();
  return (
    <>
      {entries.map((entry) => (
        <CurrentSpaceCommand
          key={entry.spaceId}
          spaceId={entry.spaceId}
          role={entry.role}
        />
      ))}
    </>
  );
}

function CurrentSpaceCommand({
  spaceId,
  role,
}: {
  spaceId: string;
  role: 'host' | 'guest';
}): ReactNode {
  const { t } = useLingui();
  const label = useSpaceCommandLabel(spaceId);
  const { requestEndSpace, requestLeaveSpace } = useSpaceLifecycleModals();

  if (role === 'host') {
    return (
      <RegisterCommand
        id={`space:end:${spaceId}`}
        title={t`End ${label}`}
        category={t`Spaces`}
        icon={XIcon}
        keywords={[t`end`, t`stop`, t`close`, t`host`, t`space`]}
        run={async () => {
          requestEndSpace(spaceId);
        }}
      />
    );
  }
  return (
    <RegisterCommand
      id={`space:leave:${spaceId}`}
      title={t`Leave ${label}`}
      category={t`Spaces`}
      icon={LogOutIcon}
      keywords={[t`leave`, t`exit`, t`guest`, t`space`]}
      run={async () => {
        requestLeaveSpace(spaceId);
      }}
    />
  );
}
