import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { CONTENT_MUTATIONS } from '@libs/game-puzzle-shared-ts/content-mutations';
import { CONTENT_TABLES } from '@libs/game-puzzle-shared-ts/content-tables';
import { CONTENT_TOPIC_MAP } from '@libs/game-puzzle-shared-ts/content-topic-map';
import { uniqueTables } from '@libs/permissions-shared-ts/world';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import type { SyncApp } from '@pkgs/sync-engine-harness-ts/scenario-app';
import { mutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-registry';
import type { Mutation } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { queryRegistry } from '@pkgs/sync-engine-shared-ts/queries-registry';
import { createPuzzleContentCatalog } from '@pkgs/turn-game-shared-ts/puzzle-content-catalog';
import fc from 'fast-check';
import { contentClientsConverged } from './example-app-convergence';
import { exampleContentQuery } from './example-app-query';
import { examplePuzzleContent } from './example-app-rules';

export const exampleContentCatalog = createPuzzleContentCatalog([
  { id: 'counting', puzzleContent: examplePuzzleContent },
  { id: 'other-counting', puzzleContent: examplePuzzleContent },
]);

const definitions: readonly Mutation<unknown>[] = CONTENT_MUTATIONS;
const mutations = mutationRegistry(
  definitions.map(
    (definition): Mutation<unknown> => ({
      ...definition,
      run: (ctx, args) =>
        definition.run(
          {
            ...ctx,
            env: { ...ctx.env, puzzleContents: exampleContentCatalog },
          },
          args
        ),
    })
  )
);
const tables = uniqueTables([...CONTENT_TABLES, ...BILLING_TABLES]);

export const contentExampleApp: SyncApp = {
  pack: {
    localSchema: {
      domainSchema: registerTables(tables),
      cacheTableNames: tables.map((table) => table.name),
    },
    mutationRegistry: mutations,
    queryRegistry: queryRegistry([exampleContentQuery]),
    sessionQuery: { name: exampleContentQuery.name, params: {} },
    topicMap: CONTENT_TOPIC_MAP,
    checkAllInSync: contentClientsConverged,
  },
  domainOpArbs: ({ clientIds }) => [
    fc.record({
      clientId: fc.constantFrom(...clientIds),
      mutation: fc.constant('createPuzzleContent'),
      args: fc.nat({ max: 1_000 }).map((id) => ({
        documentId: `puzzle-${id}`,
        draftId: `draft-${id}`,
        gameId: 'counting',
        kind: 'puzzle',
        body: {
          title: 'River',
          description: '',
          difficulty: '',
          definition: 'target:2',
        },
      })),
    }),
  ],
};
