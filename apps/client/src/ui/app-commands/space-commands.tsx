import { useIsSignedIn } from '@libs/auth/public/use-current-user';
import { openSpaceDetail } from '@libs/spaces/public/space-routes';
import { useCreateSpace } from '@libs/spaces/root/client/create-space/use-create-space';
import { useRequestEndSpace } from '@libs/spaces/root/client/end-space/end-space-modal-provider';
import { useJoinSpace } from '@libs/spaces/root/client/join-space/use-join-space';
import { useRequestLeaveSpace } from '@libs/spaces/root/client/leave-space/leave-space-modal-provider';
import { useCurrentSpaceIds } from '@libs/spaces/root/client/use-current-space-ids';
import { useCurrentSpaceRole } from '@libs/spaces/root/client/use-current-space-role';
import { useLiveSpaceIds } from '@libs/spaces/root/client/use-live-space-ids';
import { useSpaceCommandLabel } from '@libs/spaces/root/client/use-space-command-label';
import { useLingui } from '@lingui/react/macro';
import {
  Gamepad2Icon,
  LogInIcon,
  LogOutIcon,
  RegisterCommand,
  usePathname,
  useRouter,
  XIcon,
} from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

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
  const createSpace = useCreateSpace();
  const signedIn = useIsSignedIn();
  return (
    <RegisterCommand
      id="space:new"
      title={t`Start new space`}
      category={t`Spaces`}
      icon={Gamepad2Icon}
      keywords={[t`new`, t`create`, t`start`, t`space`, t`host`]}
      enabled={signedIn}
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
  const joinSpace = useJoinSpace();
  const spaceId = SPACE_ROUTE_RE.exec(pathname)?.[1] ?? '';
  const role = useCurrentSpaceRole(spaceId);
  const signedIn = useIsSignedIn();

  if (spaceId.length === 0) return null;
  if (role !== null) return null;
  if (!signedIn) return null;

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
  const joinSpace = useJoinSpace();
  const label = useSpaceCommandLabel(spaceId);
  const role = useCurrentSpaceRole(spaceId);
  const signedIn = useIsSignedIn();
  const canJoin = role === null && signedIn;
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
  const requestEndSpace = useRequestEndSpace();
  const requestLeaveSpace = useRequestLeaveSpace();

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
