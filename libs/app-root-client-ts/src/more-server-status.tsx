/** @jsxImportSource solid-js */
/**
 * `/more/server-status` — Connection in Settings. Says whether the app is
 * connected, and if not whether that is the person's choice, their device,
 * or the product out of reach; when it last was; the app's version; and what
 * still works without a connection. Built only on the shell's existing
 * signals (device network, work offline, origin availability, sync status).
 */

import { APP_VERSION } from '@libs/app-root-shared-ts/app-metadata';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui as useLinguiRuntime } from '@lingui/solid';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useOptionalOriginAvailability } from '@pkgs/http-client-client-ts/solid';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { RefreshCwIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { StatusDotStatus } from '@pkgs/ui-root-client-ts/status-dot';
import { StatusDot } from '@pkgs/ui-root-client-ts/status-dot';
import type { JSX } from 'solid-js';
import { type ConnectionCause, connectionStateOf } from './connection-cause';
import {
  createConnectionCause,
  useConnectionExplanation,
  useConnectionStatusLabel,
} from './connection-copy';
import { useSyncStatus } from './sync-status-context';

const STATUS_DOT_SIZE = 12;
const BUTTON_ICON_SIZE = 16;

function dotOf(cause: ConnectionCause): StatusDotStatus {
  if (cause === 'connected') return 'online';
  if (cause === 'checking') return 'pending';
  if (cause === 'unreachable') return 'warning';
  return 'offline';
}

function useLastConnectedLabel(): (atMs: number | null) => string {
  const { t } = useLingui();
  const { i18n } = useLinguiRuntime();
  return (atMs) =>
    atMs === null
      ? t`Not yet`
      : new Intl.DateTimeFormat(i18n().locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(atMs));
}

export default function MoreServerStatusScreen(): JSX.Element {
  const { t } = useLingui();
  const sync = useSyncStatus();
  const availability = useOptionalOriginAvailability();
  const cause = createConnectionCause(() => {
    const status = sync();
    return (
      status.connection === 'connected' &&
      status.hasSynced &&
      status.online &&
      (status.lastError === null || status.lastError.length === 0)
    );
  });
  const statusLabel = useConnectionStatusLabel();
  const explanation = useConnectionExplanation();
  const lastConnected = useLastConnectedLabel();
  return (
    <MenuScreen
      screenId="connection"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Connection</Trans> },
      ]}
    >
      <MenuSection footer={explanation(cause())}>
        <MenuRow
          title={t`Connection`}
          value={statusLabel(cause())}
          trailing={
            <StatusDot status={dotOf(cause())} size={STATUS_DOT_SIZE} />
          }
          hideChevron
          dataSet={{
            testid: Handles.connectionState(connectionStateOf(cause())),
          }}
        />
        <MenuRow
          title={t`Last connected`}
          value={lastConnected(sync().lastSyncedAtMs)}
          hideChevron
        />
        <MenuRow title={t`App version`} value={APP_VERSION} hideChevron />
      </MenuSection>
      <Notice dataSet={{ testid: Handles.connectionWithoutConnection }}>
        <Trans>
          Without a connection, your spaces, games on this device and
          preferences keep working. What you do is kept on this device and
          shared once the connection is back. Signing in, searching for people
          and playing someone online need a connection.
        </Trans>
      </Notice>
      <StackVertical self="stretch">
        <Button
          title={t`Check again`}
          intent="neutral"
          variant="outline"
          startIcon={<RefreshCwIcon size={BUTTON_ICON_SIZE} />}
          disabled={cause() === 'workingOffline'}
          onClick={() => {
            void availability?.refresh();
          }}
          dataSet={{ testid: 'connection-check-again' }}
        />
      </StackVertical>
    </MenuScreen>
  );
}
