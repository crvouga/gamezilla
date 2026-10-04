import type { PubSub } from '@pkgs/pubsub-shared/interface';
import type { Sql, Value } from '@pkgs/sql-shared/sql';
import type { PreparedStatement, RunResult, SqlClient } from './interface';

export type SqlClientEvent =
  | {
      type: 'connect';
    }
  | {
      type: 'disconnect';
    }
  | {
      type: 'query';
      sql: string;
      params: unknown[];
      rowCount: number;
      durationMs: number;
    }
  | {
      type: 'run';
      sql: string;
      params: unknown[];
      result: RunResult;
      durationMs: number;
    }
  | {
      type: 'transaction:begin';
    }
  | {
      type: 'transaction:commit';
      durationMs: number;
    }
  | {
      type: 'transaction:rollback';
      durationMs: number;
      error: unknown;
    };

export const SQL_CLIENT_TOPIC = 'sql-client';

export class SqlClientWithPubSub implements SqlClient {
  constructor(
    private client: SqlClient,
    private pubSub: PubSub,
    private now: () => number,
    private topic: string = SQL_CLIENT_TOPIC
  ) {}

  async connect(): Promise<void> {
    await this.client.connect();
    await this.pubSub.publish(this.topic, {
      type: 'connect',
    } satisfies SqlClientEvent);
  }

  async disconnect(): Promise<void> {
    await this.client.disconnect();
    await this.pubSub.publish(this.topic, {
      type: 'disconnect',
    } satisfies SqlClientEvent);
  }

  async query<T extends Record<string, unknown>>(query: Sql<T>): Promise<T[]> {
    const start = this.now();
    const rows = await this.client.query(query);
    const durationMs = this.now() - start;
    await this.pubSub.publish(this.topic, {
      type: 'query',
      sql: query.sql,
      params: [...query.values],
      rowCount: rows.length,
      durationMs,
    } satisfies SqlClientEvent);
    return rows;
  }

  async run(query: Sql<unknown>): Promise<RunResult> {
    const start = this.now();
    const result = await this.client.run(query);
    const durationMs = this.now() - start;
    await this.pubSub.publish(this.topic, {
      type: 'run',
      sql: query.sql,
      params: [...query.values],
      result,
      durationMs,
    } satisfies SqlClientEvent);
    return result;
  }

  prepare<T extends Record<string, unknown>>(
    query: Sql<T>
  ): PreparedStatement<T> {
    const stmt = this.client.prepare(query);
    const text = query.sql;
    return {
      query: async (params?: Value[]) => {
        const start = this.now();
        const rows = await stmt.query(params);
        const durationMs = this.now() - start;
        await this.pubSub.publish(this.topic, {
          type: 'query',
          sql: text,
          params: params ?? [],
          rowCount: rows.length,
          durationMs,
        } satisfies SqlClientEvent);
        return rows;
      },
      run: async (params?: Value[]) => {
        const start = this.now();
        const result = await stmt.run(params);
        const durationMs = this.now() - start;
        await this.pubSub.publish(this.topic, {
          type: 'run',
          sql: text,
          params: params ?? [],
          result,
          durationMs,
        } satisfies SqlClientEvent);
        return result;
      },
    };
  }

  async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
    await this.pubSub.publish(this.topic, {
      type: 'transaction:begin',
    } satisfies SqlClientEvent);
    const start = this.now();
    try {
      const result = await this.client.transaction(async (tx) => {
        const wrappedTx = new SqlClientWithPubSub(
          tx,
          this.pubSub,
          this.now,
          this.topic
        );
        return fn(wrappedTx);
      });
      const durationMs = this.now() - start;
      await this.pubSub.publish(this.topic, {
        type: 'transaction:commit',
        durationMs,
      } satisfies SqlClientEvent);
      return result;
    } catch (error) {
      const durationMs = this.now() - start;
      await this.pubSub.publish(this.topic, {
        type: 'transaction:rollback',
        durationMs,
        error,
      } satisfies SqlClientEvent);
      throw error;
    }
  }
}
