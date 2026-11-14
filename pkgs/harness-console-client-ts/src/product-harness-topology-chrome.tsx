import type { ProductHarnessSession } from '@pkgs/harness-console-shared-ts/ports';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import { MonitorIcon, ServerIcon, XIcon } from '@pkgs/ui-root-client-ts/icons';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';
import { InspectorRow } from './inspector-row';

const ICON_SIZE = 32;
const GLYPH_SIZE = 16;

type NodeRow = {
  readonly id: string;
  readonly kind: 'client' | 'server';
};

function NodeRowView(props: {
  readonly row: NodeRow;
  readonly busy: boolean;
  readonly onRemove: (row: NodeRow) => void;
}) {
  return (
    <InspectorRow
      label={props.row.id}
      leading={
        <Show
          when={props.row.kind === 'client'}
          fallback={<ServerIcon size={GLYPH_SIZE} color="icon" />}
        >
          <MonitorIcon size={GLYPH_SIZE} color="icon" />
        </Show>
      }
      trailing={
        <IconButton
          label={`Remove ${props.row.id}`}
          size={ICON_SIZE}
          disabled={props.busy}
          onClick={() => props.onRemove(props.row)}
        >
          <XIcon size={GLYPH_SIZE} color="icon" />
        </IconButton>
      }
    />
  );
}

function useTopologyRows(session: () => ProductHarnessSession) {
  const [rows, setRows] = createSignal<readonly NodeRow[]>([]);
  createEffect(() => {
    const live = session();
    const refresh = () => {
      setRows([
        ...[...live.clients.keys()].map((id) => ({
          id,
          kind: 'client' as const,
        })),
        ...[...live.servers.keys()].map((id) => ({
          id,
          kind: 'server' as const,
        })),
      ]);
    };
    refresh();
    onCleanup(live.subscribe(refresh));
  });
  return rows;
}

/**
 * Add and remove clients and API instances while the harness runs, down to
 * none of either. With no client, the harness's own app is all there is to
 * show. With no API instance the balancer has nothing behind it, and every
 * client's request fails as one to a server that is not there, until an
 * instance is added. The balancer and pub/sub are one of each and stay.
 */
export function ProductHarnessTopologySurface(props: {
  readonly session: ProductHarnessSession;
  readonly open: boolean;
  readonly onClose: () => void;
}) {
  const [busy, setBusy] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const rows = useTopologyRows(() => props.session);

  const run = (work: () => Promise<unknown>): void => {
    setBusy(true);
    setError(null);
    void work()
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setBusy(false));
  };

  const remove = (row: NodeRow): void => {
    run(() =>
      row.kind === 'client'
        ? props.session.removeClient(row.id)
        : props.session.removeServer(row.id)
    );
  };

  return (
    <>
      <ResponsiveSurface
        visible={props.open}
        onClose={props.onClose}
        title="Instances"
        label="Harness instances"
        size="small"
        stackId="product-harness-topology"
      >
        <StackVertical gap="lg">
          <StackHorizontal align="center" gap="sm">
            <Button
              size="sm"
              title="Add client"
              disabled={busy()}
              onClick={() => run(() => props.session.addClient())}
            />
            <Button
              size="sm"
              title="Add server"
              disabled={busy()}
              onClick={() => run(() => props.session.addServer())}
            />
          </StackHorizontal>
          <Show when={error()}>
            {(message) => <Notice tone="error">{message()}</Notice>}
          </Show>
          <Show
            when={rows().length > 0}
            fallback={
              <EmptyState
                variant="compact"
                title="No clients and no servers"
                body="Add a client to use the app, and a server to answer it."
              />
            }
          >
            <StackVertical>
              <For each={rows()}>
                {(row) => (
                  <NodeRowView row={row} busy={busy()} onRemove={remove} />
                )}
              </For>
            </StackVertical>
          </Show>
        </StackVertical>
      </ResponsiveSurface>
    </>
  );
}
