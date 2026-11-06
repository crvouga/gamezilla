/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui as useLinguiRuntime } from '@lingui/solid';
import { Trans, useLingui } from '@lingui/solid/macro';
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
  useConnectionExplanation,
  useConnectionStatusLabel,
} from './connection-copy';

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

export type ConnectionScreenViewProps = {
  /** Why the app is, or is not, connected right now. */
  readonly cause: ConnectionCause;
  /** When the server last answered (epoch ms), or `null` if it never has. */
  readonly lastSyncedAtMs: number | null;
  readonly version: string;
  /** Probe the product again; disabled while working offline. */
  readonly onCheckAgain: () => void;
};

/**
 * `/more/server-status` (Connection in Settings), presentational: whether the
 * app is connected and, if not, whose doing that is; when it last was; the
 * app's version; and what still works without a connection.
 * `MoreServerStatusScreen` derives the cause from the shell's signals.
 */
export function ConnectionScreenView(
  props: ConnectionScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  const statusLabel = useConnectionStatusLabel();
  const explanation = useConnectionExplanation();
  const lastConnected = useLastConnectedLabel();
  return (
    <MenuScreen
      screenId="connection"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, href: '/profile' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Connection</Trans> },
      ]}
    >
      <MenuSection footer={explanation(props.cause)}>
        <MenuRow
          title={t`Connection`}
          value={statusLabel(props.cause)}
          trailing={
            <StatusDot status={dotOf(props.cause)} size={STATUS_DOT_SIZE} />
          }
          hideChevron
          dataSet={{
            testid: Handles.connectionState(connectionStateOf(props.cause)),
          }}
        />
        <MenuRow
          title={t`Last connected`}
          value={lastConnected(props.lastSyncedAtMs)}
          hideChevron
        />
        <MenuRow title={t`App version`} value={props.version} hideChevron />
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
          disabled={props.cause === 'workingOffline'}
          onClick={() => props.onCheckAgain()}
          dataSet={{ testid: 'connection-check-again' }}
        />
      </StackVertical>
    </MenuScreen>
  );
}
