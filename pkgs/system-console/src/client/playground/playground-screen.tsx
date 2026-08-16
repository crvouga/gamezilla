import { Box, ErrorState, LoadingState, TabStrip, useTheme } from '@pkgs/ui';
import { type ReactNode, useState } from 'react';

import type { SystemConsolePorts } from '../../shared/ports';
import {
  ClientPlaygroundPanel,
  ServerPlaygroundPanel,
} from './playground-panel';
import type { PlaygroundSessionState } from './use-playground-session';

const NODE_TABS = [
  { id: 'alice', label: 'Alice' },
  { id: 'bob', label: 'Bob' },
  { id: 'server', label: 'Server' },
] as const;

type NodeId = (typeof NODE_TABS)[number]['id'];

/**
 * Fill-viewport playground. Tablet/desktop: three equal columns. Mobile only:
 * Alice / Bob / Server tabs. All panels stay mounted so ProductApp state survives
 * tab switches and breakpoint resizes.
 */
export function PlaygroundScreen<R>(props: {
  readonly ports: SystemConsolePorts<R>;
  readonly state: PlaygroundSessionState<R>;
}) {
  const { ports, state } = props;
  const { breakpoint } = useTheme();
  const wide = breakpoint !== 'mobile';
  const [node, setNode] = useState<NodeId>('alice');

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

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        background: 'background',
        overflow: 'hidden',
      }}
    >
      {wide ? null : (
        <TabStrip
          accessibilityLabel="Playground nodes"
          items={[...NODE_TABS]}
          selectedId={node}
          onSelect={(id) => setNode(id as NodeId)}
        />
      )}
      <Box
        sx={
          wide
            ? {
                flex: 1,
                minHeight: 0,
                flexDirection: 'row',
                overflow: 'hidden',
              }
            : {
                flex: 1,
                minHeight: 0,
                position: 'relative',
              }
        }
      >
        <PanelSlot wide={wide} active={node === 'alice'} separator={wide}>
          <ClientPlaygroundPanel
            title="Alice"
            ProductApp={ports.ProductApp}
            actor={alice}
          />
        </PanelSlot>
        <PanelSlot wide={wide} active={node === 'bob'} separator={wide}>
          <ClientPlaygroundPanel
            title="Bob"
            ProductApp={ports.ProductApp}
            actor={bob}
          />
        </PanelSlot>
        <PanelSlot wide={wide} active={node === 'server'}>
          <ServerPlaygroundPanel node={server} />
        </PanelSlot>
      </Box>
    </Box>
  );
}

function PanelSlot(props: {
  readonly wide: boolean;
  readonly active: boolean;
  readonly separator?: boolean;
  readonly children: ReactNode;
}) {
  if (props.wide) {
    return (
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflow: 'hidden',
          ...(props.separator === true
            ? { borderRightWidth: 1, borderColor: 'border' as const }
            : {}),
        }}
      >
        {props.children}
      </Box>
    );
  }
  return (
    <Box
      sx={{
        absoluteFill: true,
        display: props.active ? 'flex' : 'none',
        pointerEvents: props.active ? 'auto' : 'none',
        overflow: 'hidden',
      }}
    >
      {props.children}
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
