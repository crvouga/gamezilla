import {
  Badge,
  Box,
  EmptyState,
  ErrorState,
  LoadingState,
  ScrollView,
  Text,
} from '@pkgs/ui';

import {
  appBodyFrameSx,
  statusBadgeIntent,
  useAppBodyContentSx,
} from '../tokens';
import type { PlaygroundSessionState } from './use-playground-session';

/** Session status + addresses (snapshots live in Playground TabStrip chrome). */
export function PlaygroundSessionScreen<R>(props: {
  readonly state: PlaygroundSessionState<R>;
}) {
  const { state } = props;
  const bodySx = useAppBodyContentSx();

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
            one exists. Manage snapshots from the Playground tab chrome.
          </Text>
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
