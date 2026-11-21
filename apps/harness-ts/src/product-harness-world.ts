/**
 * The whole in-tab world as one file: every node's data, the virtual clock
 * and the faults (a {@link HarnessCheckpoint}), with the panel that was on
 * show. A bug report carries it, gzipped, so whoever fixes the bug can
 * reopen the world as it was.
 */

import type {
  HarnessCheckpoint,
  HarnessCheckpointSqlFormat,
} from '@pkgs/harness-console-shared-ts/checkpoint';
import { z } from 'zod';

export const HARNESS_WORLD_FORMAT = 'harness-world/v1';
export const HARNESS_WORLD_TYPE = 'application/gzip';

/** The world, and where the console was looking when it was taken. */
export type HarnessWorld = {
  readonly checkpoint: HarnessCheckpoint;
  /** The console's address query (`?show=client:bob`): the panel on show and each panel's view. */
  readonly search: string;
};

const bytesSchema = z.string().transform((text, ctx) => {
  try {
    return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
  } catch {
    ctx.addIssue({ code: 'custom', message: 'not base64' });
    return z.NEVER;
  }
});

const SQL_FORMATS: readonly [
  HarnessCheckpointSqlFormat,
  ...HarnessCheckpointSqlFormat[],
] = ['mixed-pgmm-sqlm', 'sqlm', 'sqlite3-image', 'logical'];

const worldSchema = z.object({
  format: z.literal(HARNESS_WORLD_FORMAT),
  search: z.string().max(4000),
  checkpoint: z.object({
    label: z.string(),
    capturedAtMs: z.number().finite(),
    clockMs: z.number().finite(),
    clockPaused: z.boolean(),
    localSchemaVersion: z.number().int(),
    clientIds: z.array(z.string()),
    serverIds: z.array(z.string()),
    roomTopics: z.array(z.string()),
    partitions: z.array(z.string()),
    skewByAddress: z.record(z.string(), z.number()),
    downAddresses: z.array(z.string()),
    evictedAddresses: z.array(z.string()),
    sqlFormat: z.enum(SQL_FORMATS),
    serverSql: bytesSchema,
    clientSql: z.record(z.string(), bytesSchema),
    clientKv: z.record(z.string(), z.record(z.string(), z.string())),
    rooms: z.record(
      z.string(),
      z.object({
        liveCheckpoint: z.unknown(),
        entries: z.array(z.unknown()),
        dedup: z.record(z.string(), z.unknown()),
      })
    ),
  }),
});

function base64(bytes: Uint8Array): string {
  let text = '';
  // In slices: one call with every byte overflows the stack.
  for (let at = 0; at < bytes.length; at += 0x8000)
    text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
  return btoa(text);
}

async function through(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream
): Promise<Uint8Array> {
  const piped = new Blob([bytes as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

export async function encodeHarnessWorld(
  world: HarnessWorld
): Promise<Uint8Array> {
  const { checkpoint } = world;
  const json = JSON.stringify({
    format: HARNESS_WORLD_FORMAT,
    search: world.search,
    checkpoint: {
      ...checkpoint,
      serverSql: base64(checkpoint.serverSql),
      clientSql: Object.fromEntries(
        Object.entries(checkpoint.clientSql).map(([id, bytes]) => [
          id,
          base64(bytes),
        ])
      ),
    },
  });
  return through(new TextEncoder().encode(json), new CompressionStream('gzip'));
}

/** The world in a file, or `null` for anything that is not one. */
export async function decodeHarnessWorld(
  bytes: Uint8Array
): Promise<HarnessWorld | null> {
  try {
    const json = await through(bytes, new DecompressionStream('gzip'));
    const parsed = worldSchema.safeParse(
      JSON.parse(new TextDecoder().decode(json))
    );
    if (!parsed.success) return null;
    return {
      search: parsed.data.search,
      checkpoint: parsed.data.checkpoint as HarnessCheckpoint,
    };
  } catch {
    return null;
  }
}
