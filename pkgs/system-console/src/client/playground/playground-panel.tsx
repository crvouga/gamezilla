import { Box, PillTabBar, Text } from '@pkgs/ui';
import { type ReactNode, useState } from 'react';

import type {
  PlaygroundActor,
  PlaygroundNode,
  SystemConsolePorts,
} from '../../shared/ports';
import { PlaygroundDbPane } from './playground-db-pane';
import { PlaygroundLogsPane } from './playground-logs-pane';

const CLIENT_TABS = [
  { id: 'ui', label: 'UI' },
  { id: 'db', label: 'DB' },
  { id: 'logs', label: 'Logs' },
] as const;

const SERVER_TABS = [
  { id: 'db', label: 'DB' },
  { id: 'logs', label: 'Logs' },
] as const;

type ClientTabId = (typeof CLIENT_TABS)[number]['id'];
type ServerTabId = (typeof SERVER_TABS)[number]['id'];

/** Client panel: UI / DB / Logs with live ProductApp on the UI tab. */
export function ClientPlaygroundPanel<R>(props: {
  readonly title: string;
  readonly ProductApp: SystemConsolePorts<R>['ProductApp'];
  readonly actor: PlaygroundActor<R>;
  readonly stacked?: boolean;
  /** Draw a flush separator after this panel (right in row, bottom when stacked). */
  readonly separator?: boolean;
}) {
  const {
    title,
    ProductApp,
    actor,
    stacked = false,
    separator = false,
  } = props;
  const [tab, setTab] = useState<ClientTabId>('ui');

  let body: ReactNode = null;
  if (tab === 'ui') {
    body = (
      <Box sx={uiBodySx}>
        <ProductApp io={actor.io} resources={actor.resources} embedded />
      </Box>
    );
  } else if (tab === 'db') {
    body = <PlaygroundDbPane sqlClient={actor.sqlClient} />;
  } else {
    body = <PlaygroundLogsPane logs={actor.logs} />;
  }

  return (
    <PanelShell
      title={title}
      stacked={stacked}
      separator={separator}
      tabBar={
        <PillTabBar
          accessibilityLabel={`${title} views`}
          items={[...CLIENT_TABS]}
          selectedId={tab}
          onSelect={(id) => setTab(id as ClientTabId)}
        />
      }
    >
      {body}
    </PanelShell>
  );
}

/** Server panel: DB / Logs only (no product UI). */
export function ServerPlaygroundPanel(props: {
  readonly node: PlaygroundNode;
  readonly stacked?: boolean;
  readonly separator?: boolean;
}) {
  const { node, stacked = false, separator = false } = props;
  const [tab, setTab] = useState<ServerTabId>('db');

  return (
    <PanelShell
      title="Server"
      stacked={stacked}
      separator={separator}
      tabBar={
        <PillTabBar
          accessibilityLabel="Server views"
          items={[...SERVER_TABS]}
          selectedId={tab}
          onSelect={(id) => setTab(id as ServerTabId)}
        />
      }
    >
      {tab === 'db' ? (
        <PlaygroundDbPane sqlClient={node.sqlClient} />
      ) : (
        <PlaygroundLogsPane logs={node.logs} />
      )}
    </PanelShell>
  );
}

function PanelShell(props: {
  readonly title: string;
  readonly tabBar: ReactNode;
  readonly children: ReactNode;
  readonly stacked?: boolean;
  readonly separator?: boolean;
}) {
  const separatorSx = props.separator
    ? props.stacked
      ? { borderBottomWidth: 1, borderColor: 'border' as const }
      : { borderRightWidth: 1, borderColor: 'border' as const }
    : {};

  return (
    <Box
      sx={
        props.stacked
          ? {
              width: '100%',
              minHeight: 420,
              overflow: 'hidden',
              background: 'surface',
              ...separatorSx,
            }
          : {
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden',
              background: 'surface',
              ...separatorSx,
            }
      }
    >
      <Box
        sx={{
          paddingHorizontal: 10,
          paddingTop: 8,
          paddingBottom: 4,
          borderBottomWidth: 1,
          borderColor: 'border',
          background: 'surface',
          flexShrink: 0,
          gap: 2,
        }}
      >
        <Text sx={{ color: 'text', fontSize: 12, fontWeight: '600' }}>
          {props.title}
        </Text>
        {props.tabBar}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {props.children}
      </Box>
    </Box>
  );
}

const uiBodySx = {
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
  position: 'relative',
  background: 'surface',
} as const;
