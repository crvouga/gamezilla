import { AUTH_TABLES } from '@libs/auth-shared-ts/tables';
import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { createContentMutations } from '@libs/game-puzzle-shared-ts/content-mutations';
import { CONTENT_QUERIES } from '@libs/game-puzzle-shared-ts/content-query-registry';
import { CONTENT_TABLES } from '@libs/game-puzzle-shared-ts/content-tables';
import { CONTENT_TOPIC_MAP } from '@libs/game-puzzle-shared-ts/content-topic-map';
import { uniqueTables } from '@libs/permissions-shared-ts/world';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import type { SyncApp } from '@pkgs/sync-engine-harness-ts/scenario-app';
import { mutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-registry';
import { queryRegistry } from '@pkgs/sync-engine-shared-ts/queries-registry';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { createPuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import fc from 'fast-check';
import { contentClientsConverged } from './example-app-convergence';
import {
  contentSessionQuery,
  exampleContentBootstrapQuery,
} from './example-app-query';
import { examplePuzzleContent } from './example-app-rules';

function catalogFor(content: PuzzleContent) {
  return createPuzzleContentCatalog([
    { id: 'counting', puzzleContent: content },
    { id: 'other-counting', puzzleContent: content },
  ]);
}

export const exampleContentCatalog = catalogFor(examplePuzzleContent);
const tables = uniqueTables([
  ...CONTENT_TABLES,
  ...BILLING_TABLES,
  ...AUTH_TABLES,
]);

/** A harness app over its games' real content sub, as each run's world has. */
export function createContentApp(
  games: readonly {
    readonly id: string;
    readonly content: PuzzleContent;
    /** A valid definition, for generated concurrent creations. */
    readonly sample: string;
  }[]
): SyncApp {
  const first = games[0];
  const sessionQuery = contentSessionQuery(games.map((game) => game.id));
  const catalog = createPuzzleContentCatalog(
    games.map((game) => ({ id: game.id, puzzleContent: game.content }))
  );
  return {
    pack: {
      localSchema: {
        domainSchema: registerTables(tables),
        cacheTableNames: tables.map((table) => table.name),
      },
      mutationRegistry: mutationRegistry(createContentMutations(catalog)),
      queryRegistry: queryRegistry([
        sessionQuery,
        exampleContentBootstrapQuery,
        ...CONTENT_QUERIES,
      ]),
      sessionQuery: { name: sessionQuery.name, params: {} },
      topicMap: CONTENT_TOPIC_MAP,
      checkAllInSync: contentClientsConverged(games.map((game) => game.id)),
    },
    domainOpArbs: ({ clientIds }) => [
      fc.record({
        clientId: fc.constantFrom(...clientIds),
        mutation: fc.constant('createPuzzleContent'),
        args: fc.nat({ max: 1_000 }).map((id) => ({
          documentId: `puzzle-${id}`,
          draftId: `draft-${id}`,
          gameId: first?.id ?? '',
          kind: 'puzzle',
          body: {
            title: 'River',
            description: '',
            difficulty: '',
            definition: first?.sample ?? '',
          },
        })),
      }),
    ],
  };
}

/** The counting reference app over one rules version. */
export function createContentExampleApp(content: PuzzleContent): SyncApp {
  return createContentApp([
    { id: 'counting', content, sample: 'target:2' },
    { id: 'other-counting', content, sample: 'target:2' },
  ]);
}

export const contentExampleApp = createContentExampleApp(examplePuzzleContent);
