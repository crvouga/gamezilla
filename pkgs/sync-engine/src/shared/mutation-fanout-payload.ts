/**
 * Client→MQTT mutation fanout. Peers apply `defineMutation.run` locally;
 * originator still uploads to Postgres for authority.
 */
export type MutationFanoutPayload = {
  readonly v: 1;
  readonly kind: 'mutation';
  readonly mutationId: string;
  readonly name: string;
  readonly args: unknown;
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly clientId: string;
  readonly seq: number;
  readonly createdAt: string;
};

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readAccountId(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  const parsed = readString(value);
  return parsed === null ? undefined : parsed;
}

function readNonNegInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

type FanoutFields = {
  readonly mutationId: string;
  readonly name: string;
  readonly actorId: string;
  readonly deviceId: string;
  readonly clientId: string;
  readonly createdAt: string;
  readonly seq: number;
  readonly accountId: string | null;
};

function readFanoutFields(
  record: Record<string, unknown>
): FanoutFields | null {
  const mutationId = readString(record['mutationId']);
  const name = readString(record['name']);
  const actorId = readString(record['actorId']);
  const deviceId = readString(record['deviceId']);
  const clientId = readString(record['clientId']);
  const createdAt = readString(record['createdAt']);
  const seq = readNonNegInt(record['seq']);
  const accountId = readAccountId(record['accountId']);
  if (
    mutationId === null ||
    name === null ||
    actorId === null ||
    deviceId === null ||
    clientId === null ||
    createdAt === null ||
    seq === null ||
    accountId === undefined
  ) {
    return null;
  }
  return {
    mutationId,
    name,
    actorId,
    deviceId,
    clientId,
    createdAt,
    seq,
    accountId,
  };
}

/** Returns a fanout payload or null when `data` is not a v1 mutation message. */
export function parseMutationFanout(
  data: unknown
): MutationFanoutPayload | null {
  if (data === null || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (record['kind'] !== 'mutation' || record['v'] !== 1) return null;
  const fields = readFanoutFields(record);
  if (fields === null) return null;
  return {
    v: 1,
    kind: 'mutation',
    ...fields,
    args: record['args'],
  };
}

export function buildMutationFanoutPayload(args: {
  readonly mutationId: string;
  readonly name: string;
  readonly args: unknown;
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly clientId: string;
  readonly seq: number;
  readonly createdAt: string;
}): MutationFanoutPayload {
  return {
    v: 1,
    kind: 'mutation',
    mutationId: args.mutationId,
    name: args.name,
    args: args.args,
    actorId: args.actorId,
    deviceId: args.deviceId,
    accountId: args.accountId,
    clientId: args.clientId,
    seq: args.seq,
    createdAt: args.createdAt,
  };
}
