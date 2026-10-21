import { afterEach, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { createFailoverSqlClient } from '@pkgs/sql-client-root-shared-ts/failover-sql-client';
import type { FaultInjectingSqlClient } from '@pkgs/sql-client-root-shared-ts/fault-injecting-sql-client';
import { createFaultInjectingSqlClient } from '@pkgs/sql-client-root-shared-ts/fault-injecting-sql-client';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { classifyLocalStorageFailure } from '@pkgs/sql-client-root-shared-ts/local-storage-failure';
import {
  STATEMENT_ERRORS,
  STORAGE_FAULTS,
  type StorageFaultName,
} from '@pkgs/sql-client-root-shared-ts/storage-faults';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';

import fc from 'fast-check';

const KEYS = ['a', 'b', 'c', 'd'] as const;

type Op =
  | { readonly kind: 'set'; readonly k: string; readonly v: string }
  | { readonly kind: 'insertNew'; readonly k: string; readonly v: string }
  | { readonly kind: 'get'; readonly k: string }
  | { readonly kind: 'all' }
  | {
      readonly kind: 'tx';
      readonly entries: readonly { k: string; v: string }[];
      readonly refuse: boolean;
    };

const keyArb = fc.constantFrom(...KEYS);
const valueArb = fc.string({ maxLength: 6 });

const opArb: fc.Arbitrary<Op> = fc.oneof(
  fc.record({ kind: fc.constant('set' as const), k: keyArb, v: valueArb }),
  fc.record({
    kind: fc.constant('insertNew' as const),
    k: keyArb,
    v: valueArb,
  }),
  fc.record({ kind: fc.constant('get' as const), k: keyArb }),
  fc.record({ kind: fc.constant('all' as const) }),
  fc.record({
    kind: fc.constant('tx' as const),
    entries: fc.array(fc.record({ k: keyArb, v: valueArb }), {
      maxLength: 3,
    }),
    refuse: fc.boolean(),
  })
);

const faultNames = Object.keys(STORAGE_FAULTS) as StorageFaultName[];

const scenarioArb = fc.record({
  ops: fc.array(opArb, { minLength: 1, maxLength: 14 }),
  /** Storage dies before this op, for good. */
  breakAt: fc.option(fc.nat(13), { nil: undefined }),
  fault: fc.constantFrom(...faultNames),
  /** One odd, one-off error before this op; the database stays healthy. */
  transientAt: fc.option(fc.nat(13), { nil: undefined }),
});

type Outcome =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly why: 'constraint' | 'refused' | 'odd' };

const REFUSAL = new Error('refused by the caller');
const ODD = new Error('one odd error, nothing to do with storage');

async function applyOp(client: SqlClient, op: Op): Promise<unknown> {
  switch (op.kind) {
    case 'set':
      await client.run(
        sql`INSERT INTO kv (k, v) VALUES (${op.k}, ${op.v}) ON CONFLICT (k) DO UPDATE SET v = excluded.v`
      );
      return null;
    case 'insertNew':
      await client.run(sql`INSERT INTO kv (k, v) VALUES (${op.k}, ${op.v})`);
      return null;
    case 'get': {
      const rows = await client.query(
        sql<{ v: string }>`SELECT v FROM kv WHERE k = ${op.k}`
      );
      return rows[0]?.v ?? null;
    }
    case 'all':
      return client.query(
        sql<{ k: string; v: string }>`SELECT k, v FROM kv ORDER BY k`
      );
    case 'tx':
      return client.transaction(async (tx) => {
        for (const entry of op.entries) {
          await tx.run(
            sql`INSERT INTO kv (k, v) VALUES (${entry.k}, ${entry.v}) ON CONFLICT (k) DO UPDATE SET v = excluded.v`
          );
        }
        if (op.refuse) throw REFUSAL;
        return null;
      });
    default: {
      const exhaustive: never = op;
      return exhaustive;
    }
  }
}

async function outcomeOf(client: SqlClient, op: Op): Promise<Outcome> {
  try {
    return { ok: true, value: await applyOp(client, op) };
  } catch (error) {
    if (error === REFUSAL) return { ok: false, why: 'refused' };
    if (error === ODD) return { ok: false, why: 'odd' };
    expect(String(error)).toMatch(/UNIQUE|constraint/i);
    return { ok: false, why: 'constraint' };
  }
}

type Model = Map<string, string>;

/** What a healthy database holding `store` answers; mutates `store`. */
function modelOutcome(store: Model, op: Op): Outcome {
  switch (op.kind) {
    case 'set':
      store.set(op.k, op.v);
      return { ok: true, value: null };
    case 'insertNew':
      if (store.has(op.k)) return { ok: false, why: 'constraint' };
      store.set(op.k, op.v);
      return { ok: true, value: null };
    case 'get':
      return { ok: true, value: store.get(op.k) ?? null };
    case 'all':
      return {
        ok: true,
        value: [...store]
          .map(([k, v]) => ({ k, v }))
          .sort((a, b) => (a.k < b.k ? -1 : 1)),
      };
    case 'tx': {
      if (op.refuse) return { ok: false, why: 'refused' };
      for (const entry of op.entries) store.set(entry.k, entry.v);
      return { ok: true, value: null };
    }
    default: {
      const exhaustive: never = op;
      return exhaustive;
    }
  }
}

const opened: SqlClient[] = [];

afterEach(async () => {
  while (opened.length > 0) await opened.pop()?.disconnect();
});

async function openBare(): Promise<SqlClient> {
  const client = SqlClientImplMockingbirdSqlite.open();
  await client.connect();
  opened.push(client);
  return client;
}

async function createKv(client: SqlClient): Promise<void> {
  await client.run(sql`CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT)`);
}

test('an app never meets a storage failure, only the answers a healthy database gives', async () => {
  await assertProperty(
    'failover keeps the answers of a healthy cache',
    fc.asyncProperty(scenarioArb, async (scenario) => {
      const faulty = faultyMockingbird();
      await faulty.client.connect();
      await createKv(faulty.client);
      let failovers = 0;
      let fallbacks = 0;
      const client = createFailoverSqlClient({
        primary: faulty.client,
        openFallback: async () => {
          fallbacks += 1;
          return openBare();
        },
        prepareFallback: createKv,
        onFailover: () => {
          failovers += 1;
        },
      });
      const model: Model = new Map();
      let modelFailedOver = false;

      for (const [index, op] of scenario.ops.entries()) {
        const transient =
          scenario.transientAt === index && scenario.breakAt !== index;
        if (scenario.breakAt === index && !modelFailedOver) {
          faulty.breakWith(STORAGE_FAULTS[scenario.fault]);
          model.clear();
          modelFailedOver = true;
        }
        if (transient && !modelFailedOver) faulty.failNextCallWith(ODD);

        const expected: Outcome =
          transient && !modelFailedOver
            ? { ok: false, why: 'odd' }
            : modelOutcome(model, op);
        const actual = await outcomeOf(client, op);

        expect(actual).toEqual(expected);
        expect(client.failedOver()).toBe(modelFailedOver);
      }

      expect(failovers).toBe(modelFailedOver ? 1 : 0);
      expect(fallbacks).toBe(modelFailedOver ? 1 : 0);
      const finalRows = await client.query(
        sql<{ k: string; v: string }>`SELECT k, v FROM kv ORDER BY k`
      );
      expect(finalRows).toEqual(
        [...model]
          .map(([k, v]) => ({ k, v }))
          .sort((a, b) => (a.k < b.k ? -1 : 1))
      );
    })
  );
});

test('calls in flight together when storage dies all get an answer from one replacement', async () => {
  await assertProperty(
    'concurrent calls share one failover',
    fc.asyncProperty(
      fc.array(
        opArb.filter((op) => op.kind !== 'insertNew'),
        {
          minLength: 1,
          maxLength: 12,
        }
      ),
      fc.constantFrom(...faultNames),
      async (ops, fault) => {
        const faulty = faultyMockingbird();
        await faulty.client.connect();
        await createKv(faulty.client);
        let fallbacks = 0;
        const client = createFailoverSqlClient({
          primary: faulty.client,
          openFallback: async () => {
            fallbacks += 1;
            return openBare();
          },
          prepareFallback: createKv,
        });
        faulty.breakWith(STORAGE_FAULTS[fault]);
        const outcomes = await Promise.all(
          ops.map((op) => outcomeOf(client, op))
        );
        expect(fallbacks).toBe(1);
        for (const [index, outcome] of outcomes.entries()) {
          const op = ops[index];
          if (op?.kind === 'tx' && op.refuse) {
            expect(outcome).toEqual({ ok: false, why: 'refused' });
          } else {
            expect(outcome.ok).toBe(true);
          }
        }
      }
    )
  );
});

const noise = fc
  .string({ maxLength: 12 })
  .filter((text) => classifyLocalStorageFailure(new Error(text)) === 'unknown');

test('the wording of an error decides its kind, whatever surrounds it', () => {
  assertProperty(
    'storage codes are storage wherever they appear',
    fc.property(
      fc.constantFrom(
        'SQLITE_CORRUPT',
        'SQLITE_IOERR_SHORT_READ',
        'SQLITE_FULL',
        'SQLITE_CANTOPEN',
        'SQLITE_READONLY_DBMOVED',
        'SQLITE_NOTADB',
        'NoModificationAllowedError',
        'QuotaExceededError',
        'E_LEADER_LOST'
      ),
      noise,
      noise,
      (code, before, after) => {
        expect(
          classifyLocalStorageFailure(new Error(`${before} ${code} ${after}`))
        ).toBe('storage');
      }
    )
  );
  assertProperty(
    'a refused statement is never mistaken for dead storage',
    fc.property(
      fc.constantFrom(...Object.values(STATEMENT_ERRORS)),
      noise,
      (message, before) => {
        expect(
          classifyLocalStorageFailure(new Error(`${before} ${message}`))
        ).toBe('statement');
      }
    )
  );
  assertProperty(
    'any thrown value is classified without throwing',
    fc.property(fc.anything(), (thrown) => {
      expect(['storage', 'statement', 'unknown']).toContain(
        classifyLocalStorageFailure(thrown)
      );
    })
  );
});

function faultyMockingbird(): FaultInjectingSqlClient {
  return createFaultInjectingSqlClient(SqlClientImplMockingbirdSqlite.open());
}
