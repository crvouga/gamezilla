import { assert } from '@gamezilla/shared/assert';
import type {
  Entity,
  PatchInput,
  PatchesDbQuery,
  PatchesDbQueryWhereClause,
} from '../interface';
import { playgroundPollAllClients, type PlaygroundSim } from './playground-sim';

assert.notThrows(
  () => crypto.randomUUID(),
  'crypto.randomUUID must be available'
);

export const SHAPE_ENTITY_TYPE = 'shape';

export const SHAPE_ATTR = {
  kind: 'shape/kind',
  fill: 'shape/fill',
  points: 'shape/points',
  order: 'shape/order',
  deleted: 'shape/deleted',
} as const;

export const SHAPE_NOT_DELETED_CLAUSE: PatchesDbQueryWhereClause = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: SHAPE_ATTR.deleted },
    { type: '=', attribute: SHAPE_ATTR.deleted, value: false },
  ],
};

/** Non-deleted shapes sorted for stable UI lists. */
export function shapeListQuery(): PatchesDbQuery {
  return {
    entityType: SHAPE_ENTITY_TYPE,
    where: SHAPE_NOT_DELETED_CLAUSE,
    orderBy: [{ attribute: SHAPE_ATTR.order, direction: 'asc' }],
  };
}

/** Polymorphic shape kind: storage id + SVG geometry. */
export interface ShapeKindDefinition {
  readonly id: string;
  svgPoints(): string;
}

/**
 * Registry of shape kinds. Add an entry here to support a new kind everywhere
 * (create, update, `pointsForKind` unknown-attr fallback uses {@link defaultShapeKindKey}).
 */
const shapeKindRegistryBase = {
  triangle: {
    id: 'triangle',
    svgPoints(): string {
      return '50,8 92,88 8,88';
    },
  },
  square: {
    id: 'square',
    svgPoints(): string {
      return '12,12 88,12 88,88 12,88';
    },
  },
  hex: {
    id: 'hex',
    svgPoints(): string {
      return '50,4 90,28 90,72 50,96 10,72 10,28';
    },
  },
} as const satisfies Record<string, ShapeKindDefinition>;

export type ShapeKind = keyof typeof shapeKindRegistryBase;

/** Mutable map for runtime lookup; keys match {@link ShapeKind}. */
export const shapeKindRegistry: Record<ShapeKind, ShapeKindDefinition> =
  shapeKindRegistryBase;

export const defaultShapeKindKey: ShapeKind = 'triangle';

function shapeKindKeys(): ShapeKind[] {
  return Object.keys(shapeKindRegistryBase) as ShapeKind[];
}

function pickRandomRegisteredKind(): ShapeKind {
  const keys = shapeKindKeys();
  const i = Math.floor(Math.random() * keys.length);
  const k = keys[i];
  return k === undefined ? defaultShapeKindKey : k;
}

function randomHueColor(): string {
  return `hsl(${Math.floor(Math.random() * 360)}, 70%, 52%)`;
}

function resolveDefinition(kind: string): ShapeKindDefinition {
  const def = shapeKindRegistryBase[kind as ShapeKind];
  return def ?? shapeKindRegistryBase[defaultShapeKindKey];
}

/** SVG `points` string in a 0–100 viewBox (polygon). */
export function pointsForKind(kind: string): string {
  return resolveDefinition(kind).svgPoints();
}

export function nextShapeOrder(entities: Entity[]): number {
  let max = -1;
  for (const e of entities) {
    const o = e.attributes[SHAPE_ATTR.order];
    if (typeof o === 'number' && Number.isFinite(o)) {
      max = Math.max(max, o);
    }
  }
  return max + 1;
}

/** Entity id for playground patches; same fallback as patch rows ({@link randomUuidV4}). */
export function randomEntityId(): string {
  return crypto.randomUUID();
}

export function createShapeInput(order: number): PatchInput {
  const keys = shapeKindKeys();
  const useWildcard = Math.random() < 0.25;
  let key: ShapeKind;
  if (useWildcard) {
    key = pickRandomRegisteredKind();
  } else {
    const i = Math.floor(Math.random() * keys.length);
    const k = keys[i];
    key = k === undefined ? pickRandomRegisteredKind() : k;
  }
  const def = shapeKindRegistryBase[key];
  const resolved = def ?? shapeKindRegistryBase[defaultShapeKindKey];
  return {
    entityId: randomEntityId(),
    entityType: SHAPE_ENTITY_TYPE,
    attributes: {
      [SHAPE_ATTR.kind]: resolved.id,
      [SHAPE_ATTR.fill]: randomHueColor(),
      [SHAPE_ATTR.points]: resolved.svgPoints(),
      [SHAPE_ATTR.order]: order,
    },
  };
}

function randomEntity(entities: Entity[]): Entity | null {
  if (entities.length === 0) return null;
  const i = Math.floor(Math.random() * entities.length);
  const e = entities[i];
  return e === undefined ? null : e;
}

export async function playgroundCreateShape(
  sim: PlaygroundSim,
  clientId: string,
  order: number
): Promise<void> {
  const client = sim.clients.find((c) => c.id === clientId);
  if (!client)
    throw new Error(`playgroundCreateShape: unknown client ${clientId}`);
  const input = createShapeInput(order);
  await client.syncDb.write([input]);
  await sim.syncNow(clientId);
}

export async function playgroundUpdateRandomShape(
  sim: PlaygroundSim,
  clientId: string,
  localEntities: Entity[]
): Promise<boolean> {
  const entity = randomEntity(localEntities);
  if (!entity) return false;
  const client = sim.clients.find((c) => c.id === clientId);
  if (!client)
    throw new Error(`playgroundUpdateRandomShape: unknown client ${clientId}`);
  const picked = pickRandomRegisteredKind();
  const def =
    shapeKindRegistryBase[picked] ?? shapeKindRegistryBase[defaultShapeKindKey];
  const attrs: Record<string, unknown> = {
    [SHAPE_ATTR.kind]: def.id,
    [SHAPE_ATTR.fill]: randomHueColor(),
    [SHAPE_ATTR.points]: def.svgPoints(),
  };
  await client.syncDb.write([
    {
      entityId: entity.entityId,
      entityType: SHAPE_ENTITY_TYPE,
      attributes: attrs,
    },
  ]);
  await sim.syncNow(clientId);
  return true;
}

export async function playgroundSoftDeleteRandomShape(
  sim: PlaygroundSim,
  clientId: string,
  localEntities: Entity[]
): Promise<boolean> {
  const entity = randomEntity(localEntities);
  if (!entity) return false;
  const client = sim.clients.find((c) => c.id === clientId);
  if (!client)
    throw new Error(
      `playgroundSoftDeleteRandomShape: unknown client ${clientId}`
    );
  await client.syncDb.write([
    {
      entityId: entity.entityId,
      entityType: SHAPE_ENTITY_TYPE,
      attributes: { [SHAPE_ATTR.deleted]: true },
    },
  ]);
  await sim.syncNow(clientId);
  return true;
}

/** Warm up each client with a few random shapes (synced to server and peers). */
export async function seedPlaygroundShapes(
  sim: PlaygroundSim,
  options?: { shapesPerClient?: number }
): Promise<void> {
  const n = options?.shapesPerClient ?? 2;
  for (const c of sim.clients) {
    for (let i = 0; i < n; i++) {
      await playgroundCreateShape(sim, c.id, i);
    }
  }
}

export async function playgroundServerCreateShape(
  sim: PlaygroundSim,
  order: number
): Promise<void> {
  await sim.serverBacking.write([createShapeInput(order)]);
  await playgroundPollAllClients(sim);
}

export async function playgroundServerUpdateRandomShape(
  sim: PlaygroundSim,
  entities: Entity[]
): Promise<boolean> {
  const entity = randomEntity(entities);
  if (!entity) return false;
  const picked = pickRandomRegisteredKind();
  const def =
    shapeKindRegistryBase[picked] ?? shapeKindRegistryBase[defaultShapeKindKey];
  const attrs: Record<string, unknown> = {
    [SHAPE_ATTR.kind]: def.id,
    [SHAPE_ATTR.fill]: randomHueColor(),
    [SHAPE_ATTR.points]: def.svgPoints(),
  };
  await sim.serverBacking.write([
    {
      entityId: entity.entityId,
      entityType: SHAPE_ENTITY_TYPE,
      attributes: attrs,
    },
  ]);
  await playgroundPollAllClients(sim);
  return true;
}

export async function playgroundServerSoftDeleteRandomShape(
  sim: PlaygroundSim,
  entities: Entity[]
): Promise<boolean> {
  const entity = randomEntity(entities);
  if (!entity) return false;
  await sim.serverBacking.write([
    {
      entityId: entity.entityId,
      entityType: SHAPE_ENTITY_TYPE,
      attributes: { [SHAPE_ATTR.deleted]: true },
    },
  ]);
  await playgroundPollAllClients(sim);
  return true;
}

export async function playgroundDeleteShape(
  sim: PlaygroundSim,
  clientId: string,
  entityId: string
): Promise<void> {
  const client = sim.clients.find((c) => c.id === clientId);
  if (!client)
    throw new Error(`playgroundDeleteShape: unknown client ${clientId}`);
  await client.syncDb.write([
    {
      entityId,
      entityType: SHAPE_ENTITY_TYPE,
      attributes: { [SHAPE_ATTR.deleted]: true },
    },
  ]);
  await sim.syncNow(clientId);
}

export async function playgroundServerDeleteShape(
  sim: PlaygroundSim,
  entityId: string
): Promise<void> {
  await sim.serverBacking.write([
    {
      entityId,
      entityType: SHAPE_ENTITY_TYPE,
      attributes: { [SHAPE_ATTR.deleted]: true },
    },
  ]);
  await playgroundPollAllClients(sim);
}

export async function playgroundRandomizeShape(
  sim: PlaygroundSim,
  clientId: string,
  entityId: string
): Promise<void> {
  const client = sim.clients.find((c) => c.id === clientId);
  if (!client)
    throw new Error(`playgroundRandomizeShape: unknown client ${clientId}`);
  const picked = pickRandomRegisteredKind();
  const def =
    shapeKindRegistryBase[picked] ?? shapeKindRegistryBase[defaultShapeKindKey];
  await client.syncDb.write([
    {
      entityId,
      entityType: SHAPE_ENTITY_TYPE,
      attributes: {
        [SHAPE_ATTR.kind]: def.id,
        [SHAPE_ATTR.fill]: randomHueColor(),
        [SHAPE_ATTR.points]: def.svgPoints(),
      },
    },
  ]);
  await sim.syncNow(clientId);
}

export async function playgroundServerRandomizeShape(
  sim: PlaygroundSim,
  entityId: string
): Promise<void> {
  const picked = pickRandomRegisteredKind();
  const def =
    shapeKindRegistryBase[picked] ?? shapeKindRegistryBase[defaultShapeKindKey];
  await sim.serverBacking.write([
    {
      entityId,
      entityType: SHAPE_ENTITY_TYPE,
      attributes: {
        [SHAPE_ATTR.kind]: def.id,
        [SHAPE_ATTR.fill]: randomHueColor(),
        [SHAPE_ATTR.points]: def.svgPoints(),
      },
    },
  ]);
  await playgroundPollAllClients(sim);
}

/** Rewrite order attributes for a client after reordering. */
export async function playgroundReorderShapes(
  sim: PlaygroundSim,
  clientId: string,
  orderedEntityIds: string[]
): Promise<void> {
  const client = sim.clients.find((c) => c.id === clientId);
  if (!client)
    throw new Error(`playgroundReorderShapes: unknown client ${clientId}`);
  const patches = orderedEntityIds.map((entityId, i) => ({
    entityId,
    entityType: SHAPE_ENTITY_TYPE,
    attributes: { [SHAPE_ATTR.order]: i },
  }));
  if (patches.length > 0) {
    await client.syncDb.write(patches);
    await sim.syncNow(clientId);
  }
}

export async function playgroundServerReorderShapes(
  sim: PlaygroundSim,
  orderedEntityIds: string[]
): Promise<void> {
  const patches = orderedEntityIds.map((entityId, i) => ({
    entityId,
    entityType: SHAPE_ENTITY_TYPE,
    attributes: { [SHAPE_ATTR.order]: i },
  }));
  if (patches.length > 0) {
    await sim.serverBacking.write(patches);
    await playgroundPollAllClients(sim);
  }
}

/** Soft-delete all shapes for a client (clear DB). */
export async function playgroundClearAllShapes(
  sim: PlaygroundSim,
  clientId: string,
  localEntities: Entity[]
): Promise<void> {
  const client = sim.clients.find((c) => c.id === clientId);
  if (!client)
    throw new Error(`playgroundClearAllShapes: unknown client ${clientId}`);
  if (localEntities.length === 0) return;
  const patches = localEntities.map((e) => ({
    entityId: e.entityId,
    entityType: SHAPE_ENTITY_TYPE,
    attributes: { [SHAPE_ATTR.deleted]: true },
  }));
  await client.syncDb.write(patches);
  await sim.syncNow(clientId);
}

export async function playgroundServerClearAllShapes(
  sim: PlaygroundSim,
  entities: Entity[]
): Promise<void> {
  if (entities.length === 0) return;
  const patches = entities.map((e) => ({
    entityId: e.entityId,
    entityType: SHAPE_ENTITY_TYPE,
    attributes: { [SHAPE_ATTR.deleted]: true },
  }));
  await sim.serverBacking.write(patches);
  await playgroundPollAllClients(sim);
}
