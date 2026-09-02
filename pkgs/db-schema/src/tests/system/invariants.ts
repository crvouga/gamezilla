import { raw } from '@pkgs/sql';
import { advancePeer, type SchemaPeer } from './peers';
import { liveColumns } from './schemas';

async function hasColumn(peer: SchemaPeer, column: string): Promise<boolean> {
  const escaped = column.replace(/'/g, "''");
  const found = await peer.client.query<{ column_name: string }>(
    raw(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'items' AND column_name = '${escaped}'`
    )
  );
  return found.length > 0;
}

export async function assertServerLiveColumns(
  server: SchemaPeer
): Promise<void> {
  for (const column of liveColumns(server.version)) {
    if (await hasColumn(server, column)) continue;
    throw new Error(
      `server_keeps_live_columns: server lost live column '${column}' at version ${server.version}`
    );
  }
}

/** Lagging clients stay valid: they must be able to catch up to the server. */
export async function assertClientAlignedWithServer(
  client: SchemaPeer,
  server: SchemaPeer
): Promise<void> {
  if (client.version > server.version) {
    throw new Error(
      `client ${client.id}@v${client.version} ahead of server@v${server.version}`
    );
  }
  if (client.version < server.version) {
    await advancePeer(client, server.version);
  }
  const a = liveColumns(client.version).join(',');
  const b = liveColumns(server.version).join(',');
  if (a !== b) {
    throw new Error(
      `live column mismatch at v${client.version}: client=${a} server=${b}`
    );
  }
}
