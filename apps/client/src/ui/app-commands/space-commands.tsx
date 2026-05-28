import { EndSpaceConfirmModal } from '@libs/spaces/client/lifecycle/end-space-confirm-modal';
import { LeaveSpaceConfirmModal } from '@libs/spaces/client/lifecycle/leave-space-confirm-modal';
import { useSpaceActions } from '@libs/spaces/client/lifecycle/space-actions';
import { useCurrentSpaceCount } from '@libs/spaces/client/use-current-space-count';
import { useCurrentSpaceIds } from '@libs/spaces/client/use-current-space-ids';
import { useCurrentSpaceRole } from '@libs/spaces/client/use-current-space-role';
import { useLiveSpaceIds } from '@libs/spaces/client/use-live-space-ids';
import { useSpaceCommandLabel } from '@libs/spaces/client/use-space-command-label';
import { RegisterCommand } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { usePathname, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';

type PendingAction = { kind: 'end' | 'leave'; spaceId: string } | null;

type LifecycleRequest = {
  onRequestEnd: (spaceId: string) => void;
  onRequestLeave: (spaceId: string) => void;
};

const SPACE_ROUTE_RE = /^\/space\/([^/?#]+)/;

export function SpaceCommands(): ReactNode {
  const [pending, setPending] = useState<PendingAction>(null);
  const onRequestEnd = useCallback(
    (spaceId: string) => setPending({ kind: 'end', spaceId }),
    []
  );
  const onRequestLeave = useCallback(
    (spaceId: string) => setPending({ kind: 'leave', spaceId }),
    []
  );
  const onClose = useCallback(() => setPending(null), []);

  return (
    <>
      <SpaceCreateCommand />
      <SpaceJoinCurrentCommand />
      <LiveSpaceCommands />
      <CurrentSpaceCommands
        onRequestEnd={onRequestEnd}
        onRequestLeave={onRequestLeave}
      />
      <SpaceLifecycleConfirmModals pending={pending} onClose={onClose} />
    </>
  );
}

function SpaceCreateCommand(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const { createSpace } = useSpaceActions();
  const currentCount = useCurrentSpaceCount();
  return (
    <RegisterCommand
      id="space:new"
      title={t`Start new space`}
      category={t`Spaces`}
      icon="house.fill"
      keywords={[t`new`, t`create`, t`start`, t`space`, t`host`]}
      enabled={currentCount === 0}
      run={async () => {
        const id = createSpace();
        router.push({ pathname: '/space/[id]', params: { id } });
      }}
    />
  );
}

function SpaceJoinCurrentCommand(): ReactNode {
  const { t } = useLingui();
  const pathname = usePathname();
  const { joinSpace } = useSpaceActions();
  const currentCount = useCurrentSpaceCount();
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
      icon="right.to.bracket"
      keywords={[t`join`, t`this`, t`current`, t`space`]}
      run={async () => {
        await joinSpace(spaceId);
      }}
    />
  );
}

function LiveSpaceCommands(): ReactNode {
  const liveSpaceIds = useLiveSpaceIds();
  return (
    <>
      {liveSpaceIds.map((spaceId) => (
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
  const currentCount = useCurrentSpaceCount();
  const canJoin = role === null && currentCount === 0;
  return (
    <>
      <RegisterCommand
        id={`space:open:${spaceId}`}
        title={t`Open ${label}`}
        category={t`Spaces`}
        icon="house.fill"
        keywords={[t`open`, t`go to`, t`space`]}
        run={async () => {
          router.push({ pathname: '/space/[id]', params: { id: spaceId } });
        }}
      />
      <RegisterCommand
        id={`space:join:${spaceId}`}
        title={t`Join ${label}`}
        category={t`Spaces`}
        icon="right.to.bracket"
        keywords={[t`join`, t`lobby`, t`space`, t`multiplayer`]}
        enabled={canJoin}
        run={async () => {
          await joinSpace(spaceId);
        }}
      />
    </>
  );
}

function CurrentSpaceCommands({
  onRequestEnd,
  onRequestLeave,
}: LifecycleRequest): ReactNode {
  const { entries } = useCurrentSpaceIds();
  return (
    <>
      {entries.map((entry) => (
        <CurrentSpaceCommand
          key={entry.spaceId}
          spaceId={entry.spaceId}
          role={entry.role}
          onRequestEnd={onRequestEnd}
          onRequestLeave={onRequestLeave}
        />
      ))}
    </>
  );
}

function CurrentSpaceCommand({
  spaceId,
  role,
  onRequestEnd,
  onRequestLeave,
}: LifecycleRequest & {
  spaceId: string;
  role: 'host' | 'guest';
}): ReactNode {
  const { t } = useLingui();
  const label = useSpaceCommandLabel(spaceId);
  if (role === 'host') {
    return (
      <RegisterCommand
        id={`space:end:${spaceId}`}
        title={t`End ${label}`}
        category={t`Spaces`}
        icon="xmark"
        keywords={[t`end`, t`stop`, t`close`, t`host`, t`space`]}
        run={async () => {
          onRequestEnd(spaceId);
        }}
      />
    );
  }
  return (
    <RegisterCommand
      id={`space:leave:${spaceId}`}
      title={t`Leave ${label}`}
      category={t`Spaces`}
      icon="arrow.right.from.bracket"
      keywords={[t`leave`, t`exit`, t`guest`, t`space`]}
      run={async () => {
        onRequestLeave(spaceId);
      }}
    />
  );
}

function SpaceLifecycleConfirmModals({
  pending,
  onClose,
}: {
  pending: PendingAction;
  onClose: () => void;
}): ReactNode {
  const router = useRouter();
  const { endSpace, leaveSpace } = useSpaceActions();
  const onConfirmEnd = useCallback(() => {
    if (pending?.kind !== 'end') return;
    const id = pending.spaceId;
    onClose();
    void (async () => {
      await endSpace(id);
      router.replace('/');
    })();
  }, [pending, onClose, endSpace, router]);
  const onConfirmLeave = useCallback(() => {
    if (pending?.kind !== 'leave') return;
    const id = pending.spaceId;
    onClose();
    void (async () => {
      await leaveSpace(id);
      router.replace('/');
    })();
  }, [pending, onClose, leaveSpace, router]);
  return (
    <>
      <EndSpaceConfirmModal
        visible={pending?.kind === 'end'}
        onClose={onClose}
        onConfirm={onConfirmEnd}
      />
      <LeaveSpaceConfirmModal
        visible={pending?.kind === 'leave'}
        onClose={onClose}
        onConfirm={onConfirmLeave}
      />
    </>
  );
}
