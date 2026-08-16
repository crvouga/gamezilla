import { Box, ErrorState, LoadingState, ScrollView, useTheme } from '@pkgs/ui';

import type { SystemConsolePorts } from '../../shared/ports';
import {
  ClientPlaygroundPanel,
  ServerPlaygroundPanel,
} from './playground-panel';
import type { PlaygroundSessionState } from './use-playground-session';

/**
 * Three fill-width panels (Alice / Bob / Server). Each panel owns a PillTabBar:
 * clients UI|DB|Logs; server DB|Logs.
 */
export function PlaygroundScreen<R>(props: {
  readonly ports: SystemConsolePorts<R>;
  readonly state: PlaygroundSessionState<R>;
}) {
  const { ports, state } = props;
  const { breakpoint } = useTheme();
  const mobile = breakpoint === 'mobile';

  if (state.status === 'error') {
    return (
      <Box sx={centerSx}>
        <ErrorState title="Failed to boot playground" body={state.error} />
      </Box>
    );
  }
  if (state.status !== 'ready') {
    return (
      <Box sx={centerSx}>
        <LoadingState caption="Booting playground…" />
      </Box>
    );
  }

  const { alice, bob } = state.session.actors;
  const { server } = state.session;

  if (mobile) {
    return (
      <ScrollView frameSx={{ flex: 1, minHeight: 0, background: 'background' }}>
        <ClientPlaygroundPanel
          title="Alice"
          ProductApp={ports.ProductApp}
          actor={alice}
          stacked
          separator
        />
        <ClientPlaygroundPanel
          title="Bob"
          ProductApp={ports.ProductApp}
          actor={bob}
          stacked
          separator
        />
        <ServerPlaygroundPanel node={server} stacked />
      </ScrollView>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        flexDirection: 'row',
        background: 'background',
      }}
    >
      <ClientPlaygroundPanel
        title="Alice"
        ProductApp={ports.ProductApp}
        actor={alice}
        separator
      />
      <ClientPlaygroundPanel
        title="Bob"
        ProductApp={ports.ProductApp}
        actor={bob}
        separator
      />
      <ServerPlaygroundPanel node={server} />
    </Box>
  );
}

const centerSx = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  background: 'background',
  padding: 4,
} as const;
