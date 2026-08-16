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

/** Thin status screen: boot state, actor ids, dispose posture. */
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
          <Row label="Alice" value={state.session.actors.alice.id} />
          <Row label="Bob" value={state.session.actors.bob.id} />
          <Row label="Server" value={state.session.server.id} />
          <Text sx={{ color: 'textSecondary', fontSize: 12 }}>
            Session disposes automatically when leaving the playground.
          </Text>
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
