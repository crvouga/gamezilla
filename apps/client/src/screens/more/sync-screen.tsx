/** @jsxImportSource solid-js */
/**
 * `/more/sync` — local database + sync engine state from the shell's
 * `SyncStatusContext`; "Retry sync" re-runs the engine's query refresh.
 */

import { Trans, useLingui } from '@lingui/solid/macro';
import type { SyncEngineStatus } from '@pkgs/sync-engine/client';
import { useSyncEngine } from '@pkgs/sync-engine/solid';
import {
  Box,
  Button,
  MenuRow,
  MenuSection,
  RefreshCwIcon,
  ScreenBase,
  StatusDot,
  type StatusDotStatus,
  Text,
} from '@pkgs/ui';
import { type Accessor, type JSX, Show } from 'solid-js';

import { useSyncStatus } from '../../shell/sync/sync-status-context';

const STATUS_DOT_SIZE = 12;
const BUTTON_ICON_SIZE = 16;

export function connectionDotStatus(
  connection: SyncEngineStatus['connection'],
  hasError: boolean
): StatusDotStatus {
  if (hasError) return 'warning';
  if (connection === 'connected') return 'online';
  if (connection === 'disconnected') return 'offline';
  return 'pending';
}

function lastErrorOf(status: SyncEngineStatus): string | null {
  return status.lastError !== null && status.lastError.length > 0
    ? status.lastError
    : null;
}

function useConnectionLabel(
  status: Accessor<SyncEngineStatus>
): Accessor<string> {
  const { t } = useLingui();
  return () => {
    const c = status().connection;
    if (c === 'disconnected') return t`Disconnected`;
    if (c === 'connecting') return t`Connecting`;
    if (c === 'syncing') return t`Syncing`;
    return t`Connected`;
  };
}

function StateSection(props: {
  readonly status: SyncEngineStatus;
}): JSX.Element {
  const { t } = useLingui();
  const yesNo = (v: boolean): string => (v ? t`Yes` : t`No`);
  const lastError = (): string | null => lastErrorOf(props.status);
  return (
    <MenuSection
      title={<Trans>State</Trans>}
      footer={
        <Show when={lastError()}>
          {(err) => (
            <Text
              variant="caption"
              sx={{ color: 'destructive', userSelect: 'text' }}
              label={err()}
              dataSet={{ testid: 'sync-last-error' }}
            />
          )}
        </Show>
      }
    >
      <MenuRow
        title={t`Online`}
        value={yesNo(props.status.online)}
        dataSet={{ testid: 'sync-online' }}
      />
      <MenuRow
        title={t`Has synced`}
        value={yesNo(props.status.hasSynced)}
        dataSet={{ testid: 'sync-has-synced' }}
      />
      <MenuRow
        title={t`Has ever synced`}
        value={yesNo(props.status.hasEverSynced)}
      />
      <MenuRow
        title={t`Last error`}
        value={lastError() === null ? t`None` : t`See below`}
      />
    </MenuSection>
  );
}

export function SyncScreen(): JSX.Element {
  const { t } = useLingui();
  const status = useSyncStatus();
  const engine = useSyncEngine();
  const connectionLabel = useConnectionLabel(status);
  const onRetry = (): void => {
    void engine.refreshQueries();
  };

  return (
    <ScreenBase
      screenId="sync"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Sync</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box sx={[sx, { gap: 5 }]}>
          <MenuSection>
            <MenuRow
              title={t`Connection`}
              value={connectionLabel()}
              dataSet={{ testid: 'sync-connection' }}
              trailing={
                <StatusDot
                  status={connectionDotStatus(
                    status().connection,
                    lastErrorOf(status()) !== null
                  )}
                  size={STATUS_DOT_SIZE}
                />
              }
            />
          </MenuSection>
          <StateSection status={status()} />
          <Box sx={{ alignSelf: 'stretch' }}>
            <Button
              title={t`Retry sync`}
              intent="neutral"
              variant="outline"
              startIcon={<RefreshCwIcon size={BUTTON_ICON_SIZE} />}
              onClick={onRetry}
              dataSet={{ testid: 'sync-retry' }}
            />
          </Box>
        </Box>
      )}
    />
  );
}
