import { Box, ScrollView, Text } from '@pkgs/ui';

import { appBodyContentSx, appBodyFrameSx, badgeSx, t } from '../tokens';
import type { PlaygroundSessionState } from './use-playground-session';

/** Thin status screen: boot state, actor ids, dispose posture. */
export function PlaygroundSessionScreen<R>(props: {
  readonly state: PlaygroundSessionState<R>;
}) {
  const { state } = props;
  return (
    <ScrollView frameSx={appBodyFrameSx} sx={appBodyContentSx}>
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Text sx={{ color: t.text, fontSize: 14, fontWeight: '600' }}>
          Playground session
        </Text>
        <Text sx={badgeSx(statusBadge(state))}>
          {state.status.toUpperCase()}
        </Text>
      </Box>

      {state.status === 'error' ? (
        <Text sx={{ color: t.fail, fontSize: 12 }}>{state.error}</Text>
      ) : null}

      {state.status === 'ready' ? (
        <Box sx={{ gap: 6 }}>
          <Row label="Alice" value={state.session.actors.alice.id} />
          <Row label="Bob" value={state.session.actors.bob.id} />
          <Text sx={{ color: t.muted, fontSize: 12 }}>
            Session disposes automatically when leaving the playground.
          </Text>
        </Box>
      ) : (
        <Text sx={{ color: t.muted, fontSize: 12 }}>
          {state.status === 'booting'
            ? 'Booting two isolated actors…'
            : 'Open the Playground tab to boot a session.'}
        </Text>
      )}
    </ScrollView>
  );
}

function Row(props: { readonly label: string; readonly value: string }) {
  return (
    <Box sx={{ flexDirection: 'row', gap: 8 }}>
      <Text sx={{ color: t.muted, fontSize: 12, minWidth: 56 }}>
        {props.label}
      </Text>
      <Text sx={{ color: t.text, fontSize: 12 }}>{props.value}</Text>
    </Box>
  );
}

function statusBadge(state: PlaygroundSessionState<unknown>): string {
  if (state.status === 'ready') return 'passed';
  if (state.status === 'error') return 'failed';
  return 'neutral';
}
