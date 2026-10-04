import { assert } from '@pkgs/assert-shared/singleton';
import { assertKeywordRecord } from '@pkgs/keyword-shared/keyword';
import type { SearchRequest } from '@pkgs/matchmaking-shared/identity';
import { searchIdFor } from '@pkgs/matchmaking-shared/identity';
import {
  assertWireFormulasInput,
  resolveJoinAttrs,
} from '@pkgs/matchmaking-shared/join-helpers';
import type {
  JoinInputRaw,
  UpdateFormulasInputRaw,
} from '@pkgs/matchmaking-shared/matchmaking';
import type { MatchmakingSchema } from '@pkgs/matchmaking-shared/schema';
import type {
  JoinResult,
  LeaveResult,
  UpdateFormulasResult,
} from '@pkgs/matchmaking-shared/types';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import sql from '@pkgs/sql-shared/sql';
import {
  partitionSignatureFor,
  primaryBucket,
  primaryRating,
} from './matching';
import { lockOwner, readReceipt, writeReceipt } from './owner-repository';
import { lockPartition } from './partition-lock';
import { insertSearch } from './search-insert';

export type SearchPorts = {
  readonly now: () => number;
  readonly schema: MatchmakingSchema;
  /** Consumer eligibility is checked under the owner lock, after an original receipt. */
  readonly authorizeBegin?: () => Promise<void>;
};

/** Constructed inside the caller's transaction; never opens another one. */
export class SearchCommands {
  constructor(
    private readonly tx: SqlTx,
    private readonly ports: SearchPorts
  ) {}

  async begin(input: JoinInputRaw): Promise<JoinResult> {
    assertWireFormulasInput(input.formulas, 'matchmaking.begin');
    assertKeywordRecord(assert, input.data, 'matchmaking.begin: data');
    const attrs = resolveJoinAttrs(input, 'matchmaking.begin');
    const nowMs = this.ports.now();
    const iso = new Date(nowMs).toISOString();
    await lockPartition(this.tx, {
      signature: partitionSignatureFor(
        input.data,
        this.ports.schema.partitionKeys ?? []
      ),
      groupSize: attrs.groupSize,
      nowMs,
    });
    const owner = await lockOwner(this.tx, input.ownerId, iso);
    const receipt = await readReceipt<JoinResult>(this.tx, input, 'begin');
    if (receipt !== undefined) return receipt;
    await this.ports.authorizeBegin?.();
    let result: JoinResult;
    if (!owner.available)
      result = { participantId: null, outcome: 'unavailable' };
    else
      result = await this.beginAvailable(input, {
        attrs,
        nowMs,
        currentId: owner.current_id,
      });
    await writeReceipt(this.tx, { input, kind: 'begin', result, iso });
    return result;
  }

  private async beginAvailable(
    input: JoinInputRaw,
    args: {
      readonly attrs: ReturnType<typeof resolveJoinAttrs>;
      readonly nowMs: number;
      readonly currentId: string | null;
    }
  ): Promise<JoinResult> {
    if (args.currentId !== null) {
      const waiting = await this.tx.query(sql<{
        id: string;
      }>`SELECT id FROM matchmaking_waiting
        WHERE id = ${args.currentId} AND owner_id = ${input.ownerId} AND deleted_at IS NULL`);
      if (waiting.length > 0)
        return { participantId: args.currentId, outcome: 'already_waiting' };
    }
    const participantId = searchIdFor(input.ownerId, input.requestId);
    const rating = primaryRating(
      input.data,
      this.ports.schema.primaryNumericKey
    );
    await insertSearch(this.tx, {
      input,
      attrs: args.attrs,
      participantId,
      nowMs: args.nowMs,
      signature: partitionSignatureFor(
        input.data,
        this.ports.schema.partitionKeys ?? []
      ),
      rating,
      bucket: primaryBucket(rating, this.ports.schema.bucketWidth ?? 50),
    });
    return { participantId, outcome: 'started' };
  }

  async stop(input: SearchRequest): Promise<LeaveResult> {
    const nowMs = this.ports.now();
    const iso = new Date(nowMs).toISOString();
    await lockOwner(this.tx, input.ownerId, iso);
    const receipt = await readReceipt<LeaveResult>(this.tx, input, 'stop');
    if (receipt !== undefined) return receipt;
    const rows = await this.tx.query(sql<{
      id: string;
    }>`UPDATE matchmaking_waiting
      SET deleted_at = ${iso}, updated_at = ${iso}, ended_at = ${nowMs}
      WHERE id = ${input.participantId} AND owner_id = ${input.ownerId} AND deleted_at IS NULL
      RETURNING id`);
    const result = { removed: rows.length > 0 };
    await writeReceipt(this.tx, { input, kind: 'stop', result, iso });
    return result;
  }

  async change(
    input: SearchRequest,
    change: UpdateFormulasInputRaw
  ): Promise<UpdateFormulasResult> {
    assertWireFormulasInput(change.formulas, 'matchmaking.change');
    const iso = new Date(this.ports.now()).toISOString();
    await lockOwner(this.tx, input.ownerId, iso);
    const receipt = await readReceipt<UpdateFormulasResult>(
      this.tx,
      input,
      'change'
    );
    if (receipt !== undefined) return receipt;
    const rows = await this.tx.query(sql<{
      id: string;
    }>`UPDATE matchmaking_waiting
      SET formulas = ${JSON.stringify(change.formulas)}, updated_at = ${iso}
      WHERE id = ${input.participantId} AND owner_id = ${input.ownerId} AND deleted_at IS NULL
      RETURNING id`);
    const result = { updated: rows.length > 0 };
    await writeReceipt(this.tx, { input, kind: 'change', result, iso });
    return result;
  }
}
