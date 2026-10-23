import type { ContentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { defineRuntime } from '@pkgs/harness-root-shared-ts/define-runtime';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import {
  createSyncHarness,
  syncVirtual,
} from '@pkgs/sync-engine-harness-ts/scenario-boot';
import type { SyncHarness } from '@pkgs/sync-engine-harness-ts/scenario-system';
import type { MutateResult } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { ATTEMPT_ACTIONS } from './attempt-actions';
import { ATTEMPT_FIXTURES } from './attempt-fixtures';
import { playTwoStepsThroughScreen } from './attempt-screen-actions';
import { CONTENT_ACTIONS } from './content-actions';
import { contentActorId } from './content-identity';
import { PUBLICATION_ACTIONS } from './content-publication-actions';
import { createContentThroughScreen } from './content-screen-actions';
import { DRAFT_CHOICE_ACTIONS } from './draft-choice-actions';
import { contentExampleApp } from './example-app';
import { saveMetadataThroughScreen } from './metadata-screen-actions';
import { NAMED_PACK_ACTIONS } from './named-pack-actions';
import { OFFLINE_ACTIONS } from './offline-actions';
import { OFFLINE_FIXTURES } from './offline-fixtures';
import { PACK_ACTIONS } from './pack-actions';
import { PACK_PLAY_ACTIONS } from './pack-play-actions';
import {
  publishThroughScreen,
  validateThroughScreen,
} from './publication-screen-actions';

export type ContentEditor = {
  readonly documentId: string;
  readonly parentId: string;
  body: ContentBody;
};
export type PlaySelection = {
  readonly attemptId: string;
  readonly positionId: string;
};

export type ContentHarness = SyncHarness & {
  readonly documents: Map<string, string>;
  readonly editors: Map<string, ContentEditor>;
  readonly lastResult: Map<string, MutateResult>;
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
};

export const contentSystem = defineSystem<ContentHarness>({
  name: 'puzzle-content',
  actions: [
    createContentThroughScreen,
    playTwoStepsThroughScreen,
    publishThroughScreen,
    validateThroughScreen,
    saveMetadataThroughScreen,
    ...CONTENT_ACTIONS,
    ...DRAFT_CHOICE_ACTIONS,
    ...PUBLICATION_ACTIONS,
    ...PACK_ACTIONS,
    ...NAMED_PACK_ACTIONS,
    ...ATTEMPT_ACTIONS,
    ...ATTEMPT_FIXTURES,
    ...PACK_PLAY_ACTIONS,
    ...OFFLINE_ACTIONS,
    ...OFFLINE_FIXTURES,
  ],
  runtimes: [
    defineRuntime({
      name: 'virtual',
      default: true,
      create: () => syncVirtual(),
    }),
  ],
  async create(session) {
    const sync = await createSyncHarness(session, contentExampleApp, {
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
    return {
      ...sync,
      documents: new Map(),
      editors: new Map(),
      lastResult: new Map(),
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
    };
  },
});
