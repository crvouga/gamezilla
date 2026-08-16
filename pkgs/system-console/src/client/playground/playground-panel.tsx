import { Box, TabStrip, Text } from '@pkgs/ui';
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

/**
 * Client panel: UI / DB / Logs. ProductApp stays mounted across tab switches so
 * sync engines are not torn down mid-hydrate (warm remount used to skip
 * waitForFirstSync and paint empty client_config → “no sign-in methods”).
 */
export function ClientPlaygroundPanel<R>(props: {
  readonly title: string;
  readonly ProductApp: SystemConsolePorts<R>['ProductApp'];
  readonly actor: PlaygroundActor<R>;
}) {
  const { title, ProductApp, actor } = props;
  const [tab, setTab] = useState<ClientTabId>('ui');

  return (
    <PanelShell
      title={title}
      accessibilityLabel={`${title} views`}
      items={[...CLIENT_TABS]}
      selectedId={tab}
      onSelect={(id) => setTab(id as ClientTabId)}
    >
      <Box
        sx={{
          ...uiBodySx,
          display: tab === 'ui' ? 'flex' : 'none',
          pointerEvents: tab === 'ui' ? 'auto' : 'none',
        }}
      >
        <ProductApp io={actor.io} resources={actor.resources} embedded />
      </Box>
      {tab === 'db' ? <PlaygroundDbPane sqlClient={actor.sqlClient} /> : null}
      {tab === 'logs' ? <PlaygroundLogsPane logs={actor.logs} /> : null}
    </PanelShell>
  );
}

/** Server panel: DB / Logs only (no product UI). */
export function ServerPlaygroundPanel(props: {
  readonly node: PlaygroundNode;
}) {
  const { node } = props;
  const [tab, setTab] = useState<ServerTabId>('db');

  return (
    <PanelShell
      title="Server"
      accessibilityLabel="Server views"
      items={[...SERVER_TABS]}
      selectedId={tab}
      onSelect={(id) => setTab(id as ServerTabId)}
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
  readonly accessibilityLabel: string;
  readonly items: readonly { id: string; label: string }[];
  readonly selectedId: string;
  readonly onSelect: (id: string) => void;
  readonly children: ReactNode;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        background: 'surface',
      }}
    >
      <TabStrip
        accessibilityLabel={props.accessibilityLabel}
        leading={
          <Text
            label={props.title}
            sx={{ color: 'text', fontSize: 12, fontWeight: '600' }}
          />
        }
        items={props.items}
        selectedId={props.selectedId}
        onSelect={props.onSelect}
      />
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
