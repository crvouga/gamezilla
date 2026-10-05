import type { ProductHarnessSession } from '@pkgs/harness-console-shared/ports';
import { Button } from '@pkgs/ui-root-client/button';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { IconButton } from '@pkgs/ui-root-client/icon-button';
import {
  MonitorIcon,
  PlusIcon,
  ServerIcon,
  XIcon,
} from '@pkgs/ui-root-client/icons';
import { ResponsiveSurface } from '@pkgs/ui-root-client/responsive-surface';
import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js';

const ICON_SIZE = 32;
const GLYPH_SIZE = 16;

type NodeRow = {
  readonly id: string;
  readonly kind: 'client' | 'server';
  readonly removable: boolean;
};

function NodeRowView(props: {
  readonly row: NodeRow;
  readonly busy: boolean;
  readonly onRemove: (row: NodeRow) => void;
}) {
  return (
    <div class="box flex-row items-center gap-2 min-w-0">
      <Show
        when={props.row.kind === 'client'}
        fallback={<ServerIcon size={GLYPH_SIZE} color="icon" />}
      >
        <MonitorIcon size={GLYPH_SIZE} color="icon" />
      </Show>
      <p class="text flex-1 min-w-0 text-text text-xs [font-family:mono]">
        {props.row.id}
      </p>
      <IconButton
        label={`Remove ${props.row.id}`}
        size={ICON_SIZE}
        disabled={props.busy || !props.row.removable}
        onClick={() => props.onRemove(props.row)}
      >
        <XIcon size={GLYPH_SIZE} color="icon" />
      </IconButton>
    </div>
  );
}

function useTopologyRows(session: () => ProductHarnessSession) {
  const [rows, setRows] = createSignal<readonly NodeRow[]>([]);
  createEffect(() => {
    const live = session();
    const refresh = () => {
      const clientIds = [...live.clients.keys()];
      const serverIds = [...live.servers.keys()];
      setRows([
        ...clientIds.map((id) => ({
          id,
          kind: 'client' as const,
          removable: clientIds.length > 1,
        })),
        ...serverIds.map((id) => ({
          id,
          kind: 'server' as const,
          removable: serverIds.length > 1,
        })),
      ]);
    };
    refresh();
    onCleanup(live.subscribe(refresh));
  });
  return rows;
}

/**
 * Add / remove client and server nodes while the harness runs.
 *
 * The last client and the last server instance are not removable: an empty
 * fleet is a crash (`crash server` in the palette), not a topology change.
 */
export function ProductHarnessTopologyChrome(props: {
  readonly session: ProductHarnessSession;
}) {
  const [open, setOpen] = createSignal(false);
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
      <IconButton
        label="Add or remove harness nodes"
        size={ICON_SIZE}
        onClick={() => setOpen(true)}
      >
        <PlusIcon size={GLYPH_SIZE} color="icon" />
      </IconButton>
      <ResponsiveSurface
        visible={open()}
        onClose={() => setOpen(false)}
        title="Nodes"
        label="Harness nodes"
        size="small"
        stackId="product-harness-topology"
      >
        <div class="box gap-3">
          <div class="box flex-row items-center gap-2">
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
          </div>
          <Show when={error()}>
            {(message) => (
              <p class="text textCaption text-destructive">{message()}</p>
            )}
          </Show>
          <Show
            when={rows().length > 0}
            fallback={
              <EmptyState
                variant="compact"
                title="No nodes"
                body="Add a client or a server instance to get started."
              />
            }
          >
            <div class="box gap-1.5">
              <For each={rows()}>
                {(row) => (
                  <NodeRowView row={row} busy={busy()} onRemove={remove} />
                )}
              </For>
            </div>
          </Show>
        </div>
      </ResponsiveSurface>
    </>
  );
}
