import {
  Badge,
  Box,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  MutationModal,
  ScrollView,
  Text,
} from '@pkgs/ui';
import { useCallback, useState } from 'react';

import {
  appBodyFrameSx,
  statusBadgeIntent,
  useAppBodyContentSx,
} from '../tokens';
import type {
  PlaygroundSessionState,
  UsePlaygroundSessionResult,
} from './use-playground-session';

/** Thin status screen: boot state, actor ids, durable wipe control. */
export function PlaygroundSessionScreen<R>(props: {
  readonly state: PlaygroundSessionState<R>;
  readonly wipe: UsePlaygroundSessionResult<R>['wipe'];
  readonly reboot: UsePlaygroundSessionResult<R>['reboot'];
}) {
  const { state, wipe, reboot } = props;
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
          <Row label="Alice" value={state.session.actors.alice.id} />
          <Row label="Bob" value={state.session.actors.bob.id} />
          <Row label="Server" value={state.session.server.id} />
          <Text sx={{ color: 'textSecondary', fontSize: 12 }}>
            SQL + auth/KV survive page refresh (OPFS + namespaced localStorage).
            Closing Console releases handles but keeps the durable files.
          </Text>
          <Box sx={{ pt: 1 }}>
            <Button
              title="Wipe playground data"
              intent="danger"
              variant="outline"
              size="sm"
              onPress={() => setWipeOpen(true)}
            />
          </Box>
          <MutationModal
            visible={wipeOpen}
            onClose={closeWipe}
            title="Wipe playground data?"
            message="Deletes Alice, Bob, and server OPFS databases and clears namespaced auth/KV. This cannot be undone."
            submitLabel="Wipe"
            variant="destructive"
            operation={runWipe}
            successTitle="Playground wiped"
            successBody="Dismiss to reboot a fresh session."
            onSuccess={onWipeSuccess}
            stackId="playground-wipe"
          />
        </Box>
      ) : state.status === 'booting' ? (
        <LoadingState
          variant="compact"
          caption="Booting Alice, Bob, and server…"
        />
      ) : state.status === 'error' ? null : (
        <EmptyState
          variant="compact"
          title="Idle"
          body="Open the Playground tab to boot a session."
        />
      )}
    </ScrollView>
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
