import type { PuzzleContentClient } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import type { ContentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { defineRuntime } from '@pkgs/harness-root-shared-ts/define-runtime';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { SyncApp } from '@pkgs/sync-engine-harness-ts/scenario-app';
import {
  createSyncHarness,
  syncVirtual,
} from '@pkgs/sync-engine-harness-ts/scenario-boot';
import type { SyncHarness } from '@pkgs/sync-engine-harness-ts/scenario-system';
import type { MutateResult } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { PuzzleContent } from '@pkgs/turn-game-shared-ts/puzzle-content';
import { ATTEMPT_ACTIONS } from './attempt-actions';
import { ATTEMPT_FIXTURES } from './attempt-fixtures';
import { ATTEMPT_LIFECYCLE_ACTIONS } from './attempt-lifecycle-actions';
import {
  loadEarlierAttemptsThroughScreen,
  seedEqualTimeAttempts,
} from './attempt-page-actions';
import { playTwoStepsThroughScreen } from './attempt-screen-actions';
import { AUTHORING_LIFECYCLE_ACTIONS } from './authoring-lifecycle-actions';
import { BUILDER_ACTIONS, type BuilderSession } from './builder-session';
import { CONTENT_ACTIONS } from './content-actions';
import { countingContentClient } from './content-example-client';
import { contentActorId } from './content-identity';
import { PUBLICATION_ACTIONS } from './content-publication-actions';
import { createContentThroughScreen } from './content-screen-actions';
import { DRAFT_CHOICE_ACTIONS } from './draft-choice-actions';
import { DRAFT_HISTORY_ACTIONS } from './draft-history-actions';
import { EDITION_RULES_ACTIONS } from './edition-rules-actions';
import { EDITION_RULES_LIFECYCLE_ACTIONS } from './edition-rules-lifecycle';
import { createContentExampleApp } from './example-app';
import { exampleContentBootstrapQuery } from './example-app-query';
import {
  type ExampleRules,
  examplePuzzleContentFor,
} from './example-app-rules';
import { saveMetadataThroughScreen } from './metadata-screen-actions';
import { NAMED_PACK_ACTIONS } from './named-pack-actions';
import { OFFLINE_ACTIONS } from './offline-actions';
import { OFFLINE_FIXTURES } from './offline-fixtures';
import { PACK_ACTIONS } from './pack-actions';
import { PACK_AUTHORING_LIFECYCLE_ACTIONS } from './pack-authoring-lifecycle-actions';
import { PACK_PLAY_ACTIONS } from './pack-play-actions';
import { PACK_PUBLICATION_LIFECYCLE_ACTIONS } from './pack-publication-lifecycle-actions';
import { previewDuringPackReorder } from './pack-workspace-actions';
import { PROGRESSION_LIFECYCLE_ACTIONS } from './progression-lifecycle-actions';
import { PUBLICATION_LIFECYCLE_ACTIONS } from './publication-lifecycle-actions';
import { PUBLICATION_RECOVERY_ACTIONS } from './publication-recovery-actions';
import {
  publishThroughScreen,
  validateThroughScreen,
} from './publication-screen-actions';
import { RETAINED_CONTENT_ACTIONS } from './retained-content-actions';
import { STALE_EDITOR_ACTIONS } from './stale-editor-actions';
import { startPublishedThroughScreen } from './start-screen-actions';

export type ContentEditor = {
  readonly documentId: string;
  readonly parentId: string;
  body: ContentBody;
};
export type PlaySelection = {
  readonly attemptId: string;
  readonly positionId: string;
};

/** One puzzle game as a harness world composes it: real rules, client and sub. */
export type ContentHarnessGame = {
  readonly id: string;
  readonly title: string;
  readonly client: PuzzleContentClient;
  /** The game's rules under a run's changeable rules version. */
  readonly content: (rules: ExampleRules) => PuzzleContent;
  readonly app: (content: PuzzleContent) => SyncApp;
};

export const COUNTING_GAME: ContentHarnessGame = {
  id: 'counting',
  title: 'Counting',
  client: countingContentClient,
  content: examplePuzzleContentFor,
  app: createContentExampleApp,
};

export type ContentHarness = SyncHarness & {
  readonly game: ContentHarnessGame;
  /** This run's game rules; an app update may change their version. */
  readonly rules: ExampleRules;
  readonly content: PuzzleContent;
  readonly documents: Map<string, string>;
  readonly editors: Map<string, ContentEditor>;
  readonly builders: Map<string, BuilderSession>;
  readonly lastResult: Map<string, MutateResult>;
  readonly publicationResults: Map<string, MutateResult>;
  readonly notices: Map<string, string>;
  readonly offline: Set<string>;
  readonly games: Map<string, string>;
  readonly selectedPuzzles: Map<string, string>;
  readonly selectedPacks: Map<string, string>;
  readonly playSelections: Map<string, PlaySelection>;
  readonly earlierPlay: Map<string, PlaySelection>;
  readonly packViews: Map<string, string>;
  readonly rememberedStates: Map<string, string>;
  readonly rememberedEditions: Map<string, string>;
  readonly publishedDrafts: Map<
    string,
    { readonly documentId: string; readonly draftId: string }
  >;
  readonly lifecycleDrafts: string[];
  readonly lifecyclePuzzles: string[];
  readonly lifecycleAttempts: string[];
};

export const contentSystem = defineSystem<
  ContentHarness,
  { initialContent: boolean }
>({
  name: 'puzzle-content',
  args: { initialContent: true },
  actions: [
    createContentThroughScreen,
    previewDuringPackReorder,
    playTwoStepsThroughScreen,
    publishThroughScreen,
    validateThroughScreen,
    saveMetadataThroughScreen,
    startPublishedThroughScreen,
    seedEqualTimeAttempts,
    loadEarlierAttemptsThroughScreen,
    ...CONTENT_ACTIONS,
    ...DRAFT_CHOICE_ACTIONS,
    ...DRAFT_HISTORY_ACTIONS,
    ...PUBLICATION_ACTIONS,
    ...PACK_ACTIONS,
    ...NAMED_PACK_ACTIONS,
    ...ATTEMPT_ACTIONS,
    ...ATTEMPT_FIXTURES,
    ...PACK_PLAY_ACTIONS,
    ...OFFLINE_ACTIONS,
    ...OFFLINE_FIXTURES,
    ...RETAINED_CONTENT_ACTIONS,
    ...PUBLICATION_LIFECYCLE_ACTIONS,
    ...PACK_PUBLICATION_LIFECYCLE_ACTIONS,
    ...ATTEMPT_LIFECYCLE_ACTIONS,
    ...AUTHORING_LIFECYCLE_ACTIONS,
    ...PACK_AUTHORING_LIFECYCLE_ACTIONS,
    ...STALE_EDITOR_ACTIONS,
    ...PROGRESSION_LIFECYCLE_ACTIONS,
    ...PUBLICATION_RECOVERY_ACTIONS,
    ...BUILDER_ACTIONS,
    ...EDITION_RULES_ACTIONS,
    ...EDITION_RULES_LIFECYCLE_ACTIONS,
  ],
  runtimes: [
    defineRuntime({
      name: 'virtual',
      default: true,
      create: () => syncVirtual(),
    }),
  ],
  create: (session, args) => createContentWorld(session, args, COUNTING_GAME),
});

/** Four devices over one game's real sub, sync engine and screens. */
export async function createContentWorld(
  session: Parameters<typeof createSyncHarness>[0],
  args: { readonly initialContent: boolean },
  game: ContentHarnessGame
): Promise<ContentHarness> {
  const rules: ExampleRules = { version: 1 };
  const content = game.content(rules);
  const contentExampleApp = game.app(content);
  const app = args.initialContent
    ? contentExampleApp
    : {
        ...contentExampleApp,
        pack: {
          ...contentExampleApp.pack,
          sessionQuery: {
            name: exampleContentBootstrapQuery.name,
            params: {},
          },
        },
      };
  const sync = await createSyncHarness(session, app, {
    clientCount: 0,
    rowImageFanout: false,
    liveResendOnReconnect: false,
    bufferOutboundLive: false,
  });
  for (const id of ['alice:phone', 'alice:tablet', 'bob:phone', 'bob:tablet'])
    await sync.addClient({
      id,
      actorId: contentActorId(id.split(':')[0] ?? ''),
    });
  const harness: ContentHarness = {
    ...sync,
    game,
    rules,
    content,
    documents: new Map(),
    editors: new Map(),
    builders: new Map(),
    lastResult: new Map(),
    publicationResults: new Map(),
    notices: new Map(),
    offline: new Set(),
    games: new Map(),
    selectedPuzzles: new Map(),
    selectedPacks: new Map(),
    playSelections: new Map(),
    earlierPlay: new Map(),
    packViews: new Map(),
    rememberedStates: new Map(),
    rememberedEditions: new Map(),
    publishedDrafts: new Map(),
    lifecycleDrafts: [],
    lifecyclePuzzles: [],
    lifecycleAttempts: [],
  };
  return harness;
}
