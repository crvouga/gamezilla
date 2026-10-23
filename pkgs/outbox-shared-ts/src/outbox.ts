import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';

import type { OutboxSendCtx, OutboxSendInput } from './types';

/**
 * Transaction-scoped outbox writer for isomorphic mutations.
 * Construct inside `defineMutation` `run` — do not store on long-lived fields.
 */
export class Outbox {
  constructor(private readonly ctx: OutboxSendCtx) {}

  async send(input: OutboxSendInput): Promise<void> {
    assert.ok(input.id.length > 0, 'outbox event id required');
    assert.ok(input.message.type.length > 0, 'outbox message type required');
    const nowIso = this.ctx.env.now().toISOString();
    const payloadJson = JSON.stringify(input.message.payload);
    const availableIso = input.availableAt?.toISOString() ?? nowIso;
    await this.ctx.tx.run(sql`
      INSERT INTO outbox_events (
        id, type, payload, created_at, updated_at, deleted_at, available_at
      )
      VALUES (
        ${input.id},
        ${input.message.type},
        ${payloadJson},
        ${nowIso},
        ${nowIso},
        ${null},
        ${availableIso}
      )
      ON CONFLICT (id) DO NOTHING
    `);
  }
}

export async function insertOutboxEvent(
  tx: SqlTx,
  input: OutboxSendInput & { readonly nowIso: string }
): Promise<void> {
  await new Outbox({
    tx,
    env: {
      now: () => new Date(input.nowIso),
      createId: () => input.id,
    },
  }).send(input);
}
