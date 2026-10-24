import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { openConnection } from './pg-client-fixture';

type Model = { failure: Error | undefined; queries: number; faults: number };
type Connection = ReturnType<typeof openConnection>;
type Command = fc.AsyncCommand<Model, Connection>;

function read(): Command {
  return {
    check: () => true,
    toString: () => 'query',
    async run(model, connection) {
      const result = connection.session.query('SELECT 1');
      if (model.failure !== undefined) {
        await expect(result).rejects.toBe(model.failure);
      } else {
        expect(await result).toEqual({ rows: [{ value: 1 }], rowCount: 1 });
        model.queries += 1;
      }
    },
  };
}

function callbackRead(): Command {
  return {
    check: () => true,
    toString: () => 'callback-query',
    async run(model, connection) {
      const reply = Promise.withResolvers<{
        error: unknown;
        result: unknown;
      }>();
      const returned = connection.session.query(
        'SELECT 1',
        (error: unknown, result: unknown) => reply.resolve({ error, result })
      );
      expect(returned).toBeUndefined();
      const value = await reply.promise;
      expect(value.error).toBe(model.failure);
      if (model.failure === undefined) {
        expect(value.result).toEqual({ rows: [{ value: 1 }], rowCount: 1 });
        model.queries += 1;
      }
    },
  };
}

function disconnect(): Command {
  return {
    check: () => true,
    toString: () => 'transport-failure',
    async run(model, connection) {
      const failure = new Error(`Connection failed ${model.faults}`);
      model.faults += 1;
      expect(() => connection.fail(failure)).not.toThrow();
      model.failure ??= failure;
    },
  };
}

test('query interleavings retain the first transport failure through owner cleanup', async () => {
  await assertProperty(
    'postgres-session-transport-lifetime',
    fc.asyncProperty(
      fc.commands(
        [
          fc.constant(read()),
          fc.constant(callbackRead()),
          fc.constant(disconnect()),
        ],
        {
          maxCommands: 20,
        }
      ),
      async (commands) => {
        const model: Model = { failure: undefined, queries: 0, faults: 0 };
        const connection = openConnection();
        await fc.asyncModelRun(() => ({ model, real: connection }), commands);
        expect(connection.queries()).toBe(model.queries);
        if (model.failure === undefined) await connection.session.end();
        else await expect(connection.session.end()).rejects.toBe(model.failure);
        expect(connection.ended()).toBe(true);
      }
    )
  );
});
