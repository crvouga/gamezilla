import { createMessageNamespace } from '@pkgs/message-shared-ts/message';
import { z } from 'zod';

const ns = createMessageNamespace('game-simulation');
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const epoch = z.string().min(1).max(256);

const inputSchema = z
  .object({
    version: z.literal(1),
    epoch,
    playerId: z.string().min(1).max(256),
    sequence: integer.min(1),
    /** Held controls: the requested tick. Commands: the latest tick the device saw. */
    tick: integer,
    value: z.unknown(),
  })
  .strict();

const requestSchema = z.object({ version: z.literal(1) }).strict();

const snapshotSchema = z
  .object({
    version: z.literal(1),
    epoch,
    revision: integer.min(1),
    tick: integer,
    paused: z.boolean(),
    state: z.string().max(65_536),
    acknowledged: z.record(z.string().min(1).max(256), integer),
  })
  .strict();

export type SimulationInputPayload = z.infer<typeof inputSchema>;
export type SimulationSnapshotPayload = z.infer<typeof snapshotSchema>;

export const SubmitSimulationInput = ns<SimulationInputPayload>(
  'input',
  (value): value is SimulationInputPayload =>
    inputSchema.safeParse(value).success
);
export const RequestSimulationSnapshot = ns<z.infer<typeof requestSchema>>(
  'request',
  (value): value is z.infer<typeof requestSchema> =>
    requestSchema.safeParse(value).success
);
export const SimulationStateChanged = ns<SimulationSnapshotPayload>(
  'snapshot',
  (value): value is SimulationSnapshotPayload =>
    snapshotSchema.safeParse(value).success
);
