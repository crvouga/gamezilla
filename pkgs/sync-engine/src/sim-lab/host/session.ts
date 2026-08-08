import { readLiveShapes } from '../../domain-packs/shapes-app';
import { runLabCommand } from './session-commands';
import {
  createSessionMutable,
  pushAction,
  type SessionMutable,
} from './session-state';
import {
  EMPTY_EDGE,
  EMPTY_SNAPSHOT,
  type LabClientId,
  type LabClientSnapshot,
  type LabCommand,
  type LabSnapshot,
} from './types';

export type LabSession = {
  readonly getSnapshot: () => Promise<LabSnapshot>;
  readonly dispatch: (cmd: LabCommand) => Promise<LabSnapshot>;
  readonly dispose: () => Promise<void>;
};

async function buildClientSnap(
  state: SessionMutable,
  id: LabClientId
): Promise<LabClientSnapshot | null> {
  if (state.world === null) return null;
  const c = state.world.clients.get(id);
  if (c === undefined) return null;
  const status = c.engine.status.getSnapshot();
  const edge = state.edges[id];
  const l = state.life[id];
  return {
    id,
    actorId: c.actorId,
    shapes: await readLiveShapes(c.db),
    online: l?.online ?? true,
    foreground: l?.foreground ?? true,
    connected: l?.connected ?? true,
    syncStatus: {
      connection: status.connection,
      online: status.online,
      hasSynced: status.hasSynced,
      lastError: status.lastError,
    },
    skewMs: state.skew[id] ?? 0,
    edge: edge ?? EMPTY_EDGE,
  };
}

function shapesKey(
  xs: readonly { id: string; kind: string; sort_key: number }[]
): string {
  return JSON.stringify(
    xs.map((x) => ({ id: x.id, kind: x.kind, sort_key: x.sort_key }))
  );
}

async function getSnapshot(state: SessionMutable): Promise<LabSnapshot> {
  if (state.world === null) {
    return {
      ...EMPTY_SNAPSHOT,
      lastError: state.lastError,
      actions: state.actions,
    };
  }
  return {
    open: true,
    seed: state.world.seed.toString(16),
    now: state.world.clock.now(),
    rowImageFanout: state.rowImageFanout,
    liveResendOnReconnect: state.liveResendOnReconnect,
    alice: await buildClientSnap(state, 'alice'),
    bob: await buildClientSnap(state, 'bob'),
    serverShapes: await readLiveShapes(state.world.server.db),
    converged: state.converged,
    lastError: state.lastError,
    actions: state.actions,
  };
}

function probeConverged(snap: LabSnapshot): boolean {
  const a = snap.alice?.shapes ?? [];
  const b = snap.bob?.shapes ?? [];
  const s = snap.serverShapes;
  return shapesKey(a) === shapesKey(s) && shapesKey(b) === shapesKey(s);
}

/** Owns one shapes-domain SimWorld with fixed alice + bob clients. */
export function createLabSession(): LabSession {
  const state = createSessionMutable();

  return {
    getSnapshot: () => getSnapshot(state),
    async dispatch(cmd) {
      try {
        await runLabCommand(state, cmd);
        if (
          cmd.type !== 'assertConverged' &&
          cmd.type !== 'checkInvariants' &&
          state.world !== null
        ) {
          state.converged = probeConverged(await getSnapshot(state));
        }
        return getSnapshot(state);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        state.lastError = message;
        if (cmd.type === 'assertConverged') state.converged = false;
        pushAction(state, cmd.type, false, message);
        return getSnapshot(state);
      }
    },
    async dispose() {
      if (state.world !== null) {
        await state.world.dispose();
        state.world = null;
      }
    },
  };
}
