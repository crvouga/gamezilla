import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';

import type { MutationFailure, MutationRegistry } from '../core/types';
import type { TablePolicyLookup } from '../shared/table-policy';
import {
  type MutationRow,
  type ReplayAuth,
  replayMutation,
} from './replay-mutation';

export type UploadCrudEntry = {
  readonly table: string;
  readonly op: 'PUT' | 'PATCH' | 'DELETE' | string;
  readonly id: string;
  readonly data?: Record<string, unknown> | undefined;
};

export type ProcessUploadWithMutationsDeps = {
  readonly serverDb: SqlClient;
  readonly registry: MutationRegistry;
  readonly auth: ReplayAuth;
  readonly crud: readonly UploadCrudEntry[];
  readonly transactionId: string | number | null;
  readonly tablePolicyFor: TablePolicyLookup;
  readonly now: () => number;
  readonly createId: CreateId;
  readonly serverNow?: () => Date;
};

export type ProcessUploadWithMutationsResult = {
  readonly ok: true;
};

type ClassifiedCrud = {
  readonly mutationRows: MutationRow[];
  readonly domainWrites: UploadCrudEntry[];
  readonly illegal: UploadCrudEntry[];
};

function classifyCrud(
  crud: readonly UploadCrudEntry[],
  tablePolicyFor: TablePolicyLookup,
  now: () => number
): ClassifiedCrud {
  const mutationRows: MutationRow[] = [];
  const domainWrites: UploadCrudEntry[] = [];
  const illegal: UploadCrudEntry[] = [];
  for (const entry of crud) {
    const policy = tablePolicyFor(entry.table);
    if (policy === undefined || policy === 'SERVER_ONLY') {
      illegal.push(entry);
    } else if (
      policy === 'FRAMEWORK' &&
      entry.table === 'sync_engine_mutations'
    ) {
      mutationRows.push(parseMutationRow(entry, now));
    } else if (policy === 'DOMAIN') {
      domainWrites.push(entry);
    } else {
      illegal.push(entry);
    }
  }
  return { mutationRows, domainWrites, illegal };
}

/**
 * Classify upload CRUD: replay `sync_engine_mutations`, discard DOMAIN residue,
 * reject SERVER_ONLY / unknown / orphan DOMAIN (no mutation rows).
 */
export async function processUploadWithMutations(
  deps: ProcessUploadWithMutationsDeps
): Promise<ProcessUploadWithMutationsResult> {
  const { mutationRows, domainWrites, illegal } = classifyCrud(
    deps.crud,
    deps.tablePolicyFor,
    deps.now
  );

  const orphanDomain = domainWrites.length > 0 && mutationRows.length === 0;
  if (illegal.length > 0 || orphanDomain) {
    await recordPolicyViolation(deps, [
      ...illegal,
      ...(orphanDomain ? domainWrites : []),
    ]);
    return { ok: true };
  }

  mutationRows.sort((a, b) => a.seq - b.seq);
  for (const row of mutationRows) {
    await replayMutation(
      {
        serverDb: deps.serverDb,
        registry: deps.registry,
        auth: deps.auth,
        now: deps.now,
        createId: deps.createId,
        ...(deps.serverNow !== undefined ? { serverNow: deps.serverNow } : {}),
      },
      row
    );
  }

  return { ok: true };
}

function readDataString(
  data: Record<string, unknown>,
  snake: string,
  camel: string,
  fallback: string
): string {
  const a = data[snake];
  if (typeof a === 'string') return a;
  const b = data[camel];
  if (typeof b === 'string') return b;
  return fallback;
}

function readSeq(data: Record<string, unknown>): number {
  const seqRaw = data['seq'];
  if (typeof seqRaw === 'number') return seqRaw;
  if (typeof seqRaw === 'string') return Number(seqRaw);
  return 0;
}

function readArgsJson(data: Record<string, unknown>): string {
  const args = data['args'];
  if (typeof args === 'string') return args;
  return JSON.stringify(args ?? {});
}

function parseMutationRow(
  entry: UploadCrudEntry,
  now: () => number
): MutationRow {
  const data = entry.data ?? {};
  const id = typeof data['id'] === 'string' ? data['id'] : entry.id;
  return {
    id,
    name: String(data['name'] ?? ''),
    args: readArgsJson(data),
    clientId: readDataString(data, 'client_id', 'clientId', ''),
    seq: readSeq(data),
    createdAt: readDataString(
      data,
      'created_at',
      'createdAt',
      new Date(now()).toISOString()
    ),
  };
}

async function recordPolicyViolation(
  deps: ProcessUploadWithMutationsDeps,
  entries: readonly UploadCrudEntry[]
): Promise<void> {
  const tables = [...new Set(entries.map((e) => e.table))].join(',');
  const failure: MutationFailure = {
    rule: 'upload',
    code: 'POLICY_VIOLATION',
    message: 'Illegal or unexplained domain upload.',
    meta: {
      tables,
      transactionId:
        deps.transactionId === null ? null : String(deps.transactionId),
    },
  };
  await deps.serverDb.run(sql`
    INSERT INTO sync_engine_write_rejections (
      id, mutation_id, client_id, code, message, meta, created_at, acknowledged
    ) VALUES (
      ${deps.createId()},
      ${`policy:${String(deps.transactionId ?? deps.createId())}`},
      ${deps.auth.deviceId},
      ${failure.code},
      ${failure.message},
      ${JSON.stringify(failure.meta ?? {})},
      ${new Date(deps.now()).toISOString()},
      ${0}
    )
  `);
}
