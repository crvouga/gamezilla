import { puzzleCatalogueChannels } from '@libs/game-puzzle-shared-ts/puzzle-catalogue';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { Logger } from '@pkgs/logger-shared-ts/logger';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import type { PubSub } from '@pkgs/pubsub-root-shared-ts/interface';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { notifyChannels } from '@pkgs/sync-engine-server-ts/notify-channels';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
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
        topics: puzzleCatalogueChannels(),
        tables: ['chess_puzzles'],
        now: this.ports.clock.now,
        label: 'initialize-puzzle-catalog',
      });
    }
    return summary;
  }
}
