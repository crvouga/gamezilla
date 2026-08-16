import {
  Badge,
  Box,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  MutationModal,
  Pressable,
  ScrollView,
  Text,
} from '@pkgs/ui';
import { useCallback, useState } from 'react';

import type {
  PlaygroundSession,
  PlaygroundSnapshotInfo,
} from '../../shared/ports';
import {
  appBodyFrameSx,
  statusBadgeIntent,
  useAppBodyContentSx,
} from '../tokens';
import {
  formatSnapshotAge,
  formatSnapshotTitle,
} from './playground-snapshot-format';
import type {
  PlaygroundSessionState,
  UsePlaygroundSessionResult,
} from './use-playground-session';
import { usePlaygroundSnapshots } from './use-playground-snapshots';

type SessionView = 'overview' | 'snapshots';

/** Session status + nested Snapshots list (sole durable playground store UI). */
export function PlaygroundSessionScreen<R>(props: {
  readonly state: PlaygroundSessionState<R>;
  readonly wipe: UsePlaygroundSessionResult<R>['wipe'];
  readonly reboot: UsePlaygroundSessionResult<R>['reboot'];
}) {
  const { state, wipe, reboot } = props;
  const [view, setView] = useState<SessionView>('overview');

  if (state.status === 'ready' && view === 'snapshots') {
    return (
      <SnapshotsScreen
        session={state.session}
        onBack={() => setView('overview')}
      />
    );
  }

  return (
    <SessionOverview
      state={state}
      wipe={wipe}
      reboot={reboot}
      onOpenSnapshots={() => setView('snapshots')}
    />
  );
}

function SessionOverview<R>(props: {
  readonly state: PlaygroundSessionState<R>;
  readonly wipe: UsePlaygroundSessionResult<R>['wipe'];
  readonly reboot: UsePlaygroundSessionResult<R>['reboot'];
  readonly onOpenSnapshots: () => void;
}) {
  const { state, wipe, reboot, onOpenSnapshots } = props;
  const bodySx = useAppBodyContentSx();
  const [wipeOpen, setWipeOpen] = useState(false);
  const closeWipe = useCallback(() => setWipeOpen(false), []);
  const runWipe = useCallback(async () => {
    await wipe();
  }, [wipe]);
  const onWipeSuccess = useCallback(() => {
    setWipeOpen(false);
    reboot();
  }, [reboot]);

  return (
    <ScrollView frameSx={appBodyFrameSx} sx={bodySx}>
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2.5 }}>
        <Text sx={{ color: 'text', fontSize: 14, fontWeight: '600' }}>
          Playground session
        </Text>
        <Badge
          label={state.status.toUpperCase()}
          intent={statusBadgeIntent(statusBadge(state))}
          size="sm"
        />
      </Box>

      {state.status === 'error' ? (
        <ErrorState title="Boot failed" body={state.error} />
      ) : null}

      {state.status === 'ready' ? (
        <Box sx={{ gap: 1.5 }}>
          {[...state.session.clients.values()].map((client) => (
            <Row key={client.id} label="Client" value={client.address} />
          ))}
          <Row label="Server" value={state.session.server.address} />
          <Row label="PubSub" value={state.session.pubsub.address} />
          {[...state.session.rooms.values()].map((room) => (
            <Row key={room.id} label="Room" value={room.address} />
          ))}
          <Text sx={{ color: 'textSecondary', fontSize: 12 }}>
            Live SQL, auth, and KV are in-memory only. ObjectStore snapshots are
            the sole durable state — boot auto-loads the newest snapshot when
            one exists.
          </Text>
          <Box sx={{ pt: 1, gap: 1.5 }}>
            <Button
              title="Snapshots"
              intent="neutral"
              variant="outline"
              size="sm"
              onPress={onOpenSnapshots}
            />
            <Button
              title="Reset to empty session"
              intent="danger"
              variant="outline"
              size="sm"
              onPress={() => setWipeOpen(true)}
            />
          </Box>
        </Box>
      ) : state.status === 'booting' ? (
        <LoadingState variant="compact" caption="Booting World playground…" />
      ) : state.status === 'error' ? null : (
        <EmptyState
          variant="compact"
          title="Idle"
          body="Open the Playground tab to boot a session."
        />
      )}

      {/* Keep mounted across ready→booting so success dismiss does not unmount ModalRoot mid-flight. */}
      <MutationModal
        visible={wipeOpen}
        onClose={closeWipe}
        title="Reset to empty session?"
        message="Tears down the live World and reboots without loading a snapshot. Saved snapshots are kept."
        submitLabel="Reset"
        variant="destructive"
        operation={runWipe}
        successTitle="Session reset"
        successBody="Dismiss to reboot a blank session."
        onSuccess={onWipeSuccess}
        stackId="playground-wipe"
      />
    </ScrollView>
  );
}

function SnapshotsScreen<R>(props: {
  readonly session: PlaygroundSession<R>;
  readonly onBack: () => void;
}) {
  const { session, onBack } = props;
  const bodySx = useAppBodyContentSx();
  const list = usePlaygroundSnapshots(session);
  const [deleteTarget, setDeleteTarget] =
    useState<PlaygroundSnapshotInfo | null>(null);
  const closeDelete = useCallback(() => setDeleteTarget(null), []);
  const runDelete = useCallback(async () => {
    if (deleteTarget === null) return;
    await list.onDelete(deleteTarget.id);
  }, [deleteTarget, list]);

  return (
    <ScrollView frameSx={appBodyFrameSx} sx={bodySx}>
      <SnapshotHeader onBack={onBack} />
      <Text sx={{ color: 'textSecondary', fontSize: 12 }}>
        Save the live in-memory system, or load a prior snapshot into it.
      </Text>
      <SnapshotToolbar
        busy={list.busy}
        onSave={() => {
          void list.onSave();
        }}
        onRefresh={() => {
          void list.refresh();
        }}
      />
      {list.error !== null ? (
        <Text sx={{ color: 'danger', fontSize: 12 }}>{list.error}</Text>
      ) : null}
      <SnapshotList
        snaps={list.snaps}
        busy={list.busy}
        nowMs={session.io.clock.now()}
        onLoad={(id) => {
          void list.onLoad(id);
        }}
        onDeleteRequest={setDeleteTarget}
      />
      <MutationModal
        visible={deleteTarget !== null}
        onClose={closeDelete}
        title="Delete snapshot?"
        message={
          deleteTarget === null
            ? ''
            : `Permanently remove “${formatSnapshotTitle(deleteTarget.createdAtMs)}” from ObjectStore. This cannot be undone.`
        }
        submitLabel="Delete"
        variant="destructive"
        operation={runDelete}
        successTitle="Snapshot deleted"
        successBody="The snapshot is gone from ObjectStore."
        onSuccess={closeDelete}
        stackId="playground-snapshot-delete"
      />
    </ScrollView>
  );
}

function SnapshotHeader(props: { readonly onBack: () => void }) {
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Pressable
        accessibilityLabel="Back to session"
        onPress={props.onBack}
        sx={{ paddingHorizontal: 2, paddingVertical: 1 }}
      >
        <Text sx={{ color: 'tint', fontSize: 13, fontWeight: '600' }}>
          ← Session
        </Text>
      </Pressable>
      <Text sx={{ color: 'text', fontSize: 14, fontWeight: '600' }}>
        Snapshots
      </Text>
    </Box>
  );
}

function SnapshotToolbar(props: {
  readonly busy: boolean;
  readonly onSave: () => void;
  readonly onRefresh: () => void;
}) {
  return (
    <Box sx={{ flexDirection: 'row', gap: 1.5, alignItems: 'center' }}>
      <Button
        title="Save snapshot"
        size="sm"
        variant="outline"
        disabled={props.busy}
        onPress={props.onSave}
      />
      <Button
        title="Refresh list"
        size="sm"
        intent="neutral"
        variant="ghost"
        disabled={props.busy}
        onPress={props.onRefresh}
      />
    </Box>
  );
}

function SnapshotList(props: {
  readonly snaps: readonly PlaygroundSnapshotInfo[];
  readonly busy: boolean;
  readonly nowMs: number;
  readonly onLoad: (id: string) => void;
  readonly onDeleteRequest: (snap: PlaygroundSnapshotInfo) => void;
}) {
  if (props.snaps.length === 0) {
    return (
      <EmptyState
        variant="compact"
        title="No snapshots yet"
        body="Save the current session to create the first durable snapshot."
      />
    );
  }
  return (
    <Box sx={{ gap: 1 }}>
      {props.snaps.map((s) => (
        <SnapshotRow
          key={s.id}
          snap={s}
          busy={props.busy}
          nowMs={props.nowMs}
          onLoad={props.onLoad}
          onDeleteRequest={props.onDeleteRequest}
        />
      ))}
    </Box>
  );
}

function SnapshotRow(props: {
  readonly snap: PlaygroundSnapshotInfo;
  readonly busy: boolean;
  readonly nowMs: number;
  readonly onLoad: (id: string) => void;
  readonly onDeleteRequest: (snap: PlaygroundSnapshotInfo) => void;
}) {
  const { snap, busy, nowMs, onLoad, onDeleteRequest } = props;
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingVertical: 2,
        paddingHorizontal: 2,
        borderWidth: 1,
        borderColor: 'border',
        borderRadius: 'md',
        background: 'surface',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, gap: 0.5 }}>
        <Text
          sx={{ color: 'text', fontSize: 13, fontWeight: '600' }}
          numberOfLines={1}
          label={formatSnapshotTitle(snap.createdAtMs)}
        />
        <Text
          sx={{ color: 'textSecondary', fontSize: 11 }}
          label={formatSnapshotAge(snap.createdAtMs, nowMs)}
        />
      </Box>
      <Box sx={{ flexDirection: 'row', gap: 1, alignItems: 'center' }}>
        <Button
          title="Load"
          size="sm"
          variant="outline"
          disabled={busy}
          onPress={() => onLoad(snap.id)}
        />
        <Button
          title="Delete"
          size="sm"
          intent="danger"
          variant="outline"
          disabled={busy}
          onPress={() => onDeleteRequest(snap)}
        />
      </Box>
    </Box>
  );
}

function Row(props: { readonly label: string; readonly value: string }) {
  return (
    <Box sx={{ flexDirection: 'row', gap: 2 }}>
      <Text sx={{ color: 'textSecondary', fontSize: 12, minWidth: 56 }}>
        {props.label}
      </Text>
      <Text sx={{ color: 'text', fontSize: 12 }}>{props.value}</Text>
    </Box>
  );
}

function statusBadge(state: PlaygroundSessionState<unknown>): string {
  if (state.status === 'ready') return 'passed';
  if (state.status === 'error') return 'failed';
  return 'neutral';
}
