/**
 * PGMM hydrate packs int8 / timestamptz micros that fit float64 as JS
 * `number` (PACK_INT). postgres-mem arithmetic and timestamp format then
 * throw `Cannot mix BigInt and other types` (V8) / `Invalid mix of BigInt`
 * (Bun). Coerce those slots back to bigint after snapshot open.
 */

type RepairTable = {
  readonly columns: readonly { readonly type: unknown }[];
  materializeSlab(): void;
  mutableRows(): unknown[][];
};

type RepairSequence = {
  increment: unknown;
  minValue: unknown;
  maxValue: unknown;
  startValue: unknown;
  cache: unknown;
  lastValue: unknown;
};

type RepairSchema = {
  readonly tables: Map<string, RepairTable>;
  readonly sequences: Map<string, RepairSequence>;
};

type RepairState = {
  readonly schemas: Map<string, RepairSchema>;
  readonly sequenceCurrval: Map<string, unknown>;
};

const BIGINT_SCALAR_TYPES = new Set([
  'int8',
  'timestamp',
  'timestamptz',
  'time',
  'money',
]);

const SEQUENCE_BIGINT_KEYS = [
  'increment',
  'minValue',
  'maxValue',
  'startValue',
  'cache',
  'lastValue',
] as const;

export function repairPostgresMemPgmmBigintSlots(db: object): void {
  const state = readRepairState(db);
  if (state == null) return;
  for (const schema of state.schemas.values()) {
    for (const table of schema.tables.values()) {
      repairTable(table);
    }
    for (const seq of schema.sequences.values()) {
      repairSequence(seq);
    }
  }
  for (const [key, value] of state.sequenceCurrval) {
    state.sequenceCurrval.set(key, asBigint(value));
  }
}

function repairTable(table: RepairTable): void {
  table.materializeSlab();
  const rows = table.mutableRows();
  const types = table.columns.map((col) => typeId(col.type));
  for (const row of rows) {
    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      if (type == null) continue;
      row[i] = coerceSlot(type, row[i]);
    }
  }
}

function repairSequence(seq: RepairSequence): void {
  for (const key of SEQUENCE_BIGINT_KEYS) {
    seq[key] = asBigint(seq[key]);
  }
}

function typeId(type: unknown): string {
  if (typeof type === 'string') return type;
  if (type != null && typeof type === 'object' && 'id' in type) {
    const id = (type as { id: unknown }).id;
    if (typeof id === 'string') return id;
  }
  return '';
}

function coerceSlot(type: string, value: unknown): unknown {
  if (value == null) return value;
  if (BIGINT_SCALAR_TYPES.has(type)) return asBigint(value);
  if (type === 'timetz') return coerceMicrosObject(value);
  if (type === 'interval') return coerceMicrosObject(value);
  return value;
}

function coerceMicrosObject(value: unknown): unknown {
  if (value == null || typeof value !== 'object') return value;
  const rec = value as Record<string, unknown>;
  if (!('micros' in rec)) return value;
  return { ...rec, micros: asBigint(rec['micros']) };
}

function asBigint(value: unknown): unknown {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) {
    return BigInt(value);
  }
  return value;
}

function readRepairState(db: object): RepairState | null {
  if (!('state' in db)) return null;
  const state = (db as { state: unknown }).state;
  if (state == null || typeof state !== 'object') return null;
  if (!('schemas' in state) || !('sequenceCurrval' in state)) return null;
  const schemas = (state as { schemas: unknown }).schemas;
  const sequenceCurrval = (state as { sequenceCurrval: unknown })
    .sequenceCurrval;
  if (!(schemas instanceof Map) || !(sequenceCurrval instanceof Map)) {
    return null;
  }
  return state as RepairState;
}
