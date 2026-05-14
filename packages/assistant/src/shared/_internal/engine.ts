import type { AssistantAction } from './action';
import type { GameAdapter, PlayerView } from './adapter';
import type { AssistantClock } from './clock';
import { readCandidate, type CandidateCore } from './candidates';
import {
  computeEffectiveWeights,
  filterAffordable,
  filterAfterCooldown,
  filterGatedCandidates,
} from './engine-filters';
import { createPlayerModel } from './player-model';
import { createPlayerView } from './player-view';
import { createSplitMix32, hashSeedString } from './rng';
import type { AssistantRenderer } from './renderer';
import {
  createSessionState,
  pushRecentRef,
  regenerateBudget,
} from './session-model';
import { readAssistantSignal, type AssistantSignal } from './signals';
import {
  deserializeSnapshotV1,
  makeSnapshot,
  serializeSnapshotV1,
  snapshotData,
  type AssistantSnapshot,
} from './snapshot';
import { pickWeightedIndex } from './ranker';

const SILENCE_TTL_MS = 500;

export type AssistantConfig<TPayload> = {
  readonly adapter: GameAdapter<TPayload>;
  readonly renderer: AssistantRenderer;
  readonly clock: AssistantClock;
  readonly seed: string;
  readonly restoreFrom?: AssistantSnapshot | undefined;
};

export type Assistant<TPayload> = {
  observe(signal: AssistantSignal<TPayload>): AssistantAction;
  clear(): void;
  snapshot(): AssistantSnapshot;
};

class AssistantImpl<TPayload> implements Assistant<TPayload> {
  private readonly adapter: GameAdapter<TPayload>;
  private readonly renderer: AssistantRenderer;
  private readonly clock: AssistantClock;
  private readonly seedHash: number;
  private rng: ReturnType<typeof createSplitMix32>;
  private signalSeq = 0;
  private readonly playerModel: ReturnType<typeof createPlayerModel>;
  private readonly playerView: PlayerView;
  private session: ReturnType<typeof createSessionState>;

  constructor(config: AssistantConfig<TPayload>) {
    this.adapter = config.adapter;
    this.renderer = config.renderer;
    this.clock = config.clock;
    this.seedHash = hashSeedString(config.seed);
    const now = this.clock.now();
    if (config.restoreFrom !== undefined) {
      const restored = deserializeSnapshotV1(snapshotData(config.restoreFrom));
      this.signalSeq = restored.signalSeq;
      this.rng = createSplitMix32(this.seedHash);
      this.rng.setState(restored.rng);
      this.playerModel = createPlayerModel(restored.player.lastActionAt);
      Object.assign(this.playerModel.state, restored.player);
      this.session = restored.session;
      this.playerView = createPlayerView({
        getState: () => this.playerModel.state,
        clockNow: () => this.clock.now(),
      });
      return;
    }
    this.rng = createSplitMix32(this.seedHash);
    this.playerModel = createPlayerModel(now);
    this.session = createSessionState(now);
    this.playerView = createPlayerView({
      getState: () => this.playerModel.state,
      clockNow: () => this.clock.now(),
    });
  }

  observe(signal: AssistantSignal<TPayload>): AssistantAction {
    const now = this.clock.now();
    this.signalSeq += 1;
    regenerateBudget(this.session, now);
    const envelope = readAssistantSignal(signal);
    this.playerModel.applyTags(envelope.tags, now);

    const raw = this.adapter
      .proposeCandidates(signal, this.playerView)
      .map(readCandidate);

    const gated = filterGatedCandidates(raw, this.playerView);
    if (gated.length === 0) {
      return this.emitSilence('gate');
    }

    const postCooldown = filterAfterCooldown(gated, this.session, now);
    if (postCooldown.length === 0) {
      return this.emitSilence('cooldown');
    }

    const affordable = filterAffordable(postCooldown, this.session.budget);
    if (affordable.length === 0) {
      return this.emitSilence('budget');
    }

    const weights = computeEffectiveWeights(
      affordable,
      this.session,
      this.playerView
    );
    const idx = pickWeightedIndex(weights, () => this.rng.nextU01());
    if (idx < 0) {
      return this.emitSilence('no-candidate');
    }

    const picked = affordable[idx] ?? affordable[0];
    if (picked === undefined) {
      return this.emitSilence('no-candidate');
    }
    return this.finalizeSpeak(picked, envelope.tags, now);
  }

  private finalizeSpeak(
    picked: CandidateCore,
    envelopeTags: readonly string[],
    now: number
  ): AssistantAction {
    this.session.budget -= picked.cost;
    this.session.lastPayloadAt.set(picked.payloadRef, now);
    this.session.lastIntentAt.set(picked.intent, now);
    pushRecentRef(this.session, picked.payloadRef);
    const tags = [...envelopeTags, ...picked.tags];
    const action: AssistantAction = {
      kind: 'speak',
      intent: picked.intent,
      payloadRef: picked.payloadRef,
      tags,
      ttlMs: 12_000,
    };
    this.renderer.render(action);
    return action;
  }

  clear(): void {
    const now = this.clock.now();
    this.signalSeq = 0;
    this.rng = createSplitMix32(this.seedHash);
    const freshPlayer = createPlayerModel(now);
    const freshSession = createSessionState(now);
    Object.assign(this.playerModel.state, freshPlayer.state);
    this.session = freshSession;
  }

  snapshot(): AssistantSnapshot {
    const data = serializeSnapshotV1({
      signalSeq: this.signalSeq,
      rng: this.rng.getState(),
      player: this.playerModel.state,
      session: this.session,
    });
    return makeSnapshot(data);
  }

  private emitSilence(
    reason: 'budget' | 'cooldown' | 'no-candidate' | 'gate'
  ): AssistantAction {
    const a = this.silence(reason);
    this.renderer.render(a);
    return a;
  }

  private silence(
    reason: 'budget' | 'cooldown' | 'no-candidate' | 'gate'
  ): AssistantAction {
    return { kind: 'silence', reason, ttlMs: SILENCE_TTL_MS };
  }
}

export function createAssistant<TPayload>(
  config: AssistantConfig<TPayload>
): Assistant<TPayload> {
  return new AssistantImpl(config);
}
