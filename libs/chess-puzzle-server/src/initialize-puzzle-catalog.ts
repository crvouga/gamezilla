import { chessPuzzlesChannels } from '@libs/chess-root-shared/sync-topics';
import type { Clock } from '@pkgs/clock-shared/types';
import type { Logger } from '@pkgs/logger-shared/logger';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import type { PubSub } from '@pkgs/pubsub-root-shared/interface';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import { notifyChannels } from '@pkgs/sync-engine-server/notify-channels';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import {
  ChessPuzzleLoadFileSeeder,
  type PuzzleIngestSummary,
} from './chess-puzzle-load-file-seeder';

export type PuzzleCatalogPorts = {
  readonly loadFileStore: ObjectStore;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly logger: Logger;
  readonly pubsub: PubSub;
};

/** Deploy reference data only into a catalog that has never held puzzles. */
export class InitializePuzzleCatalog {
  constructor(
    private readonly db: SqlClient,
    private readonly ports: PuzzleCatalogPorts
  ) {}

  async run(): Promise<PuzzleIngestSummary | null> {
    // Tombstones count too: a deploy must never undo a deliberate removal.
    const existing = await this.db.query(sql<{ id: string }>`
      SELECT id FROM chess_puzzles LIMIT 1
    `);
    if (existing.length > 0) return null;

    const summary = await new ChessPuzzleLoadFileSeeder({
      loadFileStore: this.ports.loadFileStore,
      createId: this.ports.createId,
      now: this.ports.clock.now,
    }).ingest({ sqlClient: this.db, logger: this.ports.logger });
    if (summary.validRows === 0) {
      throw new Error(
        'The initial chess puzzle catalog contains no valid puzzles'
      );
    }
    if (summary.rowsInserted > 0) {
      await notifyChannels({
        sql: this.db,
        pubsub: this.ports.pubsub,
        topics: chessPuzzlesChannels(),
        tables: ['chess_puzzles'],
        now: this.ports.clock.now,
        label: 'initialize-puzzle-catalog',
      });
    }
    return summary;
  }
}
