/** @jsxImportSource solid-js */

import { Trans, useLingui } from '@lingui/solid/macro';
import type { SyncEngineStatus } from '@pkgs/sync-engine-client-ts/sync-status';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { RefreshCwIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { StatusDotStatus } from '@pkgs/ui-root-client-ts/status-dot';
import { StatusDot } from '@pkgs/ui-root-client-ts/status-dot';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type Accessor, type JSX, Show } from 'solid-js';

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
            <Notice tone="error" dataSet={{ testid: 'sync-last-error' }}>
              <P variant="inherit" tone="inherit" selectable>
                {err()}
              </P>
            </Notice>
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

export type SyncScreenViewProps = {
  /** The sync engine's live status. */
  readonly status: SyncEngineStatus;
  /** Refused changes no other screen tells, each dismissible. */
  readonly refusedChanges?: JSX.Element;
  readonly onRetry: () => void;
};

/**
 * `/more/sync`, presentational: the local database and sync engine state, any
 * last error, refused changes told nowhere else, and "Retry sync". `SyncScreen`
 * wires the live status, the refusals and the engine refresh.
 */
export function SyncScreenView(props: SyncScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const connectionLabel = useConnectionLabel(() => props.status);

  return (
    <MenuScreen
      screenId="sync"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Sync</Trans> },
      ]}
    >
      <MenuSection>
        <MenuRow
          title={t`Connection`}
          value={connectionLabel()}
          dataSet={{ testid: 'sync-connection' }}
          trailing={
            <StatusDot
              status={connectionDotStatus(
                props.status.connection,
                lastErrorOf(props.status) !== null
              )}
              size={STATUS_DOT_SIZE}
            />
          }
        />
      </MenuSection>
      <StateSection status={props.status} />
      {props.refusedChanges}
      <StackVertical>
        <Button
          title={t`Retry sync`}
          intent="neutral"
          variant="outline"
          startIcon={<RefreshCwIcon size={BUTTON_ICON_SIZE} />}
          onClick={() => props.onRetry()}
          dataSet={{ testid: 'sync-retry' }}
        />
      </StackVertical>
    </MenuScreen>
  );
}
