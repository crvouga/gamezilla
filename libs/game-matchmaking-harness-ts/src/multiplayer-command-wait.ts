import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MultiplayerCommand } from './multiplayer-commands';

/** Read only after the deadline. The request identifies the local choice;
 * its durable mutation ID identifies the same upload on the server. */
export async function describeCommandWait(
  device: SqlTx | null,
  server: SqlTx,
  command: MultiplayerCommand
): Promise<string> {
  const requestId = command.args['requestId'];
  const prefix = `the multiplayer command verdict for ${command.name}`;
  if (typeof requestId !== 'string') return `${prefix} (no request ID)`;
  const request = `${prefix} request=${requestId}`;
  if (device === null) return `${request} (device database unavailable)`;
  let observed = request;
  try {
    const [choice] = await device.query(sql<{
      id: string;
      created_at: string;
      deleted_at: string | null;
      code: string | null;
    }>`
      SELECT m.id, m.created_at, m.deleted_at, r.code FROM sync_engine_mutations m
      LEFT JOIN sync_engine_write_rejections r ON r.mutation_id = m.id AND r.deleted_at IS NULL
      WHERE m.name = ${command.name} AND json_extract(m.args, '$.requestId') = ${requestId}
      ORDER BY m.seq DESC LIMIT 1`);
    if (choice === undefined) return `${request} (no matching device mutation)`;
    observed = `${request} mutation=${choice.id} queue=${choice.deleted_at === null ? 'pending' : 'retired'} deviceRejection=${choice.code ?? 'none'}`;
    const [verdict] = await server.query(sql<{
      status: string;
      code: string | null;
    }>`
      SELECT a.status, r.code FROM sync_engine_mutations_applied a
      LEFT JOIN sync_engine_write_rejections r ON r.mutation_id = a.mutation_id
      WHERE a.mutation_id = ${choice.id} LIMIT 1`);
    return `${observed} server=${verdict?.status ?? 'unrecorded'} serverRejection=${verdict?.code ?? 'none'} queuedAt=${choice.created_at} retiredAt=${choice.deleted_at ?? 'none'}`;
  } catch (error) {
    return `${observed} (diagnostic read failed: ${String(error)})`;
  }
}
