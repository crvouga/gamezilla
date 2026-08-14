import { Box, ScrollView, Text } from '@pkgs/ui';

import type { PlaygroundActor, SystemConsolePorts } from '../../shared/ports';
import { emptySx, t } from '../tokens';
import type { PlaygroundSessionState } from './use-playground-session';

/**
 * Two phone frames (Alice / Bob), each mounting the injected product app with
 * an embedded, isolated actor `io` + `resources`.
 */
export function PlaygroundScreen<R>(props: {
  readonly ports: SystemConsolePorts<R>;
  readonly state: PlaygroundSessionState<R>;
}) {
  const { ports, state } = props;

  if (state.status === 'error') {
    return (
      <Box sx={centerSx}>
        <Text sx={emptySx}>Failed to boot playground: {state.error}</Text>
      </Box>
    );
  }
  if (state.status !== 'ready') {
    return (
      <Box sx={centerSx}>
        <Text sx={emptySx}>Booting playground…</Text>
      </Box>
    );
  }

  const { alice, bob } = state.session.actors;
  return (
    <ScrollView
      horizontal
      frameSx={{ flex: 1, backgroundColor: t.bg }}
      sx={{ flexDirection: 'row', gap: 16, padding: 16 }}
    >
      <PhoneFrame ProductApp={ports.ProductApp} actor={alice} />
      <PhoneFrame ProductApp={ports.ProductApp} actor={bob} />
    </ScrollView>
  );
}

function PhoneFrame<R>(props: {
  readonly ProductApp: SystemConsolePorts<R>['ProductApp'];
  readonly actor: PlaygroundActor<R>;
}) {
  const { ProductApp, actor } = props;
  return (
    <Box sx={{ gap: 8 }}>
      <Text sx={{ color: t.muted, fontSize: 12 }}>{actor.id}</Text>
      <Box sx={frameSx}>
        <ProductApp io={actor.io} resources={actor.resources} embedded />
      </Box>
    </Box>
  );
}

const centerSx = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: t.bg,
} as const;

const frameSx = {
  width: 390,
  height: 780,
  borderWidth: 1,
  borderColor: t.border,
  borderRadius: 24,
  overflow: 'hidden',
  backgroundColor: t.bg,
} as const;
