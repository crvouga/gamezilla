import type {
  Entity,
  PatchInput,
  PatchesDbQuery,
  PatchesDbQueryWhereClause,
} from '../../interface';
import type { PlaygroundSim } from './playground-sim';

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
export const shapeKindRegistry: Record<
  ShapeKind,
  ShapeKindDefinition
> = shapeKindRegistryBase;

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

/**
 * Prefer {@link Crypto.randomUUID}; fall back for non-secure contexts (e.g. `file://`)
 * where `randomUUID` throws or is unavailable.
 */
export function randomEntityId(): string {
  const c = globalThis.crypto;
  if (c !== undefined && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      /* fall through */
    }
  }
  if (c !== undefined && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    bytes[6] = (bytes[6]! & 0x0f) | 0x40;
    bytes[8] = (bytes[8]! & 0x3f) | 0x80;
    const p = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${p.slice(0, 8)}-${p.slice(8, 12)}-${p.slice(12, 16)}-${p.slice(16, 20)}-${p.slice(20)}`;
  }
  return `ent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
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
  if (!client) throw new Error(`playgroundCreateShape: unknown client ${clientId}`);
  await client.syncDb.write([createShapeInput(order)]);
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
  if (!client) throw new Error(`playgroundUpdateRandomShape: unknown client ${clientId}`);
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
    throw new Error(`playgroundSoftDeleteRandomShape: unknown client ${clientId}`);
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
