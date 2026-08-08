import {
  addShape,
  readLiveShapes,
  removeShape,
  reorderShapes,
  SHAPE_KINDS,
  type ShapeKind,
  shapesDomainPack,
} from '../../domain-packs/shapes-app';
import { openSimWorld } from '../../sim/world';
import {
  applyEdgePartition,
  applyFaults,
  applyHold,
  applyUnpartition,
  clearFaultsState,
  clientOrThrow,
  freshEdges,
  freshLife,
  pushAction,
  type SessionMutable,
} from './session-state';
import type { LabCommand } from './types';
import { RELIABLE_FAULTS } from './types';

function fisherYates<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

function pickKind(random: () => number): ShapeKind {
  const i = Math.floor(random() * SHAPE_KINDS.length);
  return SHAPE_KINDS[i] ?? 'circle';
}

async function openWorldCmd(
  state: SessionMutable,
  cmd: Extract<LabCommand, { type: 'openWorld' }>
): Promise<void> {
  if (state.world !== null) await state.world.dispose();
  state.rowImageFanout = cmd.rowImageFanout !== false;
  state.liveResendOnReconnect = cmd.liveResendOnReconnect === true;
  state.edges = freshEdges();
  state.skew = { alice: 0, bob: 0 };
  state.life = freshLife();
  state.converged = null;
  state.lastError = null;
  state.world = await openSimWorld({
    seed: cmd.seed ?? 42,
    domain: shapesDomainPack,
    faults: RELIABLE_FAULTS,
    rowImageFanout: state.rowImageFanout,
    liveResendOnReconnect: state.liveResendOnReconnect,
  });
  await state.world.addClient({ id: 'alice' });
  await state.world.addClient({ id: 'bob' });
  pushAction(state, `openWorld seed=${state.world.seed.toString(16)}`, true);
}

async function lifecycleCmd(
  state: SessionMutable,
  cmd: LabCommand
): Promise<void> {
  switch (cmd.type) {
    case 'setOnline': {
      const c = clientOrThrow(state, cmd.clientId);
      c.lifecycle.setOnline(cmd.value);
      state.life = {
        ...state.life,
        [cmd.clientId]: {
          ...(state.life[cmd.clientId] ?? freshLife().alice),
          online: cmd.value,
        },
      };
      pushAction(state, `${cmd.clientId} online=${cmd.value}`, true);
      return;
    }
    case 'setForeground': {
      const c = clientOrThrow(state, cmd.clientId);
      c.lifecycle.setForeground(cmd.value);
      state.life = {
        ...state.life,
        [cmd.clientId]: {
          ...(state.life[cmd.clientId] ?? freshLife().alice),
          foreground: cmd.value,
        },
      };
      pushAction(state, `${cmd.clientId} foreground=${cmd.value}`, true);
      return;
    }
    case 'connect': {
      const c = clientOrThrow(state, cmd.clientId);
      await c.engine.connect();
      state.life = {
        ...state.life,
        [cmd.clientId]: {
          ...(state.life[cmd.clientId] ?? freshLife().alice),
          connected: true,
        },
      };
      pushAction(state, `${cmd.clientId} connect`, true);
      return;
    }
    case 'disconnect': {
      const c = clientOrThrow(state, cmd.clientId);
      await c.engine.disconnect();
      state.life = {
        ...state.life,
        [cmd.clientId]: {
          ...(state.life[cmd.clientId] ?? freshLife().alice),
          connected: false,
        },
      };
      pushAction(state, `${cmd.clientId} disconnect`, true);
      return;
    }
    case 'crash': {
      if (state.world === null) throw new Error('World is not open');
      await state.world.crashClient(cmd.clientId);
      pushAction(state, `${cmd.clientId} crash`, true);
      return;
    }
    case 'restart': {
      if (state.world === null) throw new Error('World is not open');
      await state.world.restartClient(cmd.clientId);
      state.life = {
        ...state.life,
        [cmd.clientId]: {
          online: true,
          foreground: true,
          connected: true,
        },
      };
      pushAction(state, `${cmd.clientId} restart`, true);
      return;
    }
    case 'setClockSkew': {
      if (state.world === null) throw new Error('World is not open');
      state.world.setClockSkew(cmd.clientId, cmd.skewMs);
      state.skew = { ...state.skew, [cmd.clientId]: cmd.skewMs };
      pushAction(state, `${cmd.clientId} skew=${cmd.skewMs}`, true);
      return;
    }
    default:
      throw new Error(`Not a lifecycle command: ${cmd.type}`);
  }
}

async function edgeCmd(state: SessionMutable, cmd: LabCommand): Promise<void> {
  switch (cmd.type) {
    case 'partition':
      applyEdgePartition(state, cmd.clientId, cmd.traffic);
      pushAction(state, `${cmd.clientId} partition ${cmd.traffic}`, true);
      return;
    case 'unpartition':
      applyUnpartition(state, cmd.clientId, cmd.traffic);
      pushAction(state, `${cmd.clientId} unpartition ${cmd.traffic}`, true);
      return;
    case 'heal':
      applyUnpartition(state, cmd.clientId, 'all');
      pushAction(state, `${cmd.clientId} heal`, true);
      return;
    case 'hold':
      applyHold(state, cmd.clientId, cmd.traffic, true);
      pushAction(state, `${cmd.clientId} hold ${cmd.traffic}`, true);
      return;
    case 'release':
      applyHold(state, cmd.clientId, cmd.traffic, false);
      pushAction(state, `${cmd.clientId} release ${cmd.traffic}`, true);
      return;
    case 'setFaults':
      if (state.world === null) throw new Error('World is not open');
      applyFaults(state, cmd.clientId, cmd.traffic, cmd.faults);
      pushAction(state, `${cmd.clientId} setFaults ${cmd.traffic}`, true);
      return;
    case 'clearFaults':
      if (state.world === null) throw new Error('World is not open');
      clearFaultsState(state, cmd.clientId);
      pushAction(state, `${cmd.clientId} clearFaults`, true);
      return;
    default:
      throw new Error(`Not an edge command: ${cmd.type}`);
  }
}

async function shapeCmd(state: SessionMutable, cmd: LabCommand): Promise<void> {
  switch (cmd.type) {
    case 'addShape': {
      const c = clientOrThrow(state, cmd.clientId);
      if (state.world === null) throw new Error('World is not open');
      const kind = cmd.kind ?? pickKind(() => state.world!.rng.random());
      const id = state.world.nextId();
      await c.mutate(addShape, { id, kind });
      pushAction(state, `${cmd.clientId} add ${kind}`, true);
      return;
    }
    case 'removeShape': {
      const c = clientOrThrow(state, cmd.clientId);
      await c.mutate(removeShape, { id: cmd.shapeId });
      pushAction(state, `${cmd.clientId} remove ${cmd.shapeId}`, true);
      return;
    }
    case 'reorderShapes': {
      const c = clientOrThrow(state, cmd.clientId);
      await c.mutate(reorderShapes, { orderedIds: [...cmd.orderedIds] });
      pushAction(state, `${cmd.clientId} reorder`, true);
      return;
    }
    case 'shuffleShapes': {
      const c = clientOrThrow(state, cmd.clientId);
      if (state.world === null) throw new Error('World is not open');
      const shapes = await readLiveShapes(c.db);
      if (shapes.length < 2) {
        pushAction(state, `${cmd.clientId} shuffle (noop)`, true);
        return;
      }
      const orderedIds = fisherYates(
        shapes.map((s) => s.id),
        () => state.world!.rng.random()
      );
      await c.mutate(reorderShapes, { orderedIds });
      pushAction(state, `${cmd.clientId} shuffle`, true);
      return;
    }
    default:
      throw new Error(`Not a shape command: ${cmd.type}`);
  }
}

async function timeCmd(state: SessionMutable, cmd: LabCommand): Promise<void> {
  if (state.world === null) throw new Error('World is not open');
  switch (cmd.type) {
    case 'runFor':
      await state.world.runFor(cmd.ms);
      pushAction(state, `runFor ${cmd.ms}ms`, true);
      return;
    case 'runUntilIdle':
      await state.world.runUntilIdle();
      pushAction(state, 'runUntilIdle', true);
      return;
    case 'assertConverged':
      state.edges = freshEdges();
      await state.world.assertConverged();
      state.converged = true;
      state.lastError = null;
      pushAction(state, 'assertConverged', true);
      return;
    case 'checkInvariants': {
      const v = await state.world.checkInvariants();
      if (v !== null) {
        state.converged = false;
        state.lastError = v.detail;
        pushAction(state, 'checkInvariants', false, v.detail);
        return;
      }
      pushAction(state, 'checkInvariants ok', true);
      return;
    }
    default:
      throw new Error(`Not a time command: ${cmd.type}`);
  }
}

const LIFECYCLE = new Set([
  'setOnline',
  'setForeground',
  'connect',
  'disconnect',
  'crash',
  'restart',
  'setClockSkew',
]);
const EDGE = new Set([
  'partition',
  'unpartition',
  'heal',
  'hold',
  'release',
  'setFaults',
  'clearFaults',
]);
const SHAPE = new Set([
  'addShape',
  'removeShape',
  'reorderShapes',
  'shuffleShapes',
]);
const TIME = new Set([
  'runFor',
  'runUntilIdle',
  'assertConverged',
  'checkInvariants',
]);

/** Dispatch one lab command against mutable session state. */
export async function runLabCommand(
  state: SessionMutable,
  cmd: LabCommand
): Promise<void> {
  if (cmd.type === 'openWorld') {
    await openWorldCmd(state, cmd);
    return;
  }
  if (cmd.type === 'disposeWorld') {
    if (state.world !== null) {
      await state.world.dispose();
      state.world = null;
    }
    pushAction(state, 'disposeWorld', true);
    return;
  }
  if (LIFECYCLE.has(cmd.type)) {
    await lifecycleCmd(state, cmd);
    return;
  }
  if (EDGE.has(cmd.type)) {
    await edgeCmd(state, cmd);
    return;
  }
  if (SHAPE.has(cmd.type)) {
    await shapeCmd(state, cmd);
    return;
  }
  if (TIME.has(cmd.type)) {
    await timeCmd(state, cmd);
    return;
  }
  throw new Error(`Unknown command ${cmd.type}`);
}
