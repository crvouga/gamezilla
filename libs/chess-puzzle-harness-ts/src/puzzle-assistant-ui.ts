import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import { legalMoves } from '@pkgs/chess-rules-shared-ts/moves';
import {
  pickUpPuzzlePieceAt,
  readPuzzleBoardFen,
} from './chess-puzzle-solve-ui';

const ASSISTANT = 'puzzle-assistant';

/** Reads the rendered message and its playback/position markers together. */
export async function readPuzzleAssistant(s: ProductHarness, actor: string) {
  const ui = await actorUi(s, actor);
  const html = await ui.snapshotHtml();
  const tag =
    html?.match(/<[^>]+data-testid="puzzle-assistant"[^>]*>/)?.[0] ?? '';
  if (tag === '') return null;
  const start = html!.indexOf(tag);
  const words =
    html!.slice(start).match(/<p[^>]*role="status"[^>]*>(.*?)<\/p>/s)?.[1] ??
    '';
  const attr = (name: string) =>
    tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? '';
  return {
    text: words.replace(/<[^>]*>/g, ''),
    kind: attr('data-observation'),
    purpose: attr('data-purpose'),
    puzzleId: attr('data-puzzle'),
    muted: attr('data-muted') === 'true',
    speaking: attr('data-speaking') === 'true',
    loading: attr('data-loading') === 'true',
  };
}

export const mutePuzzleAssistant = scenarioAction({
  name: 'mutePuzzleAssistant',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    if (!(await readPuzzleAssistant(s, actor))?.muted)
      await ui.get(`${ASSISTANT}-mute`).tap();
  },
});

export const unmutePuzzleAssistant = scenarioAction({
  name: 'unmutePuzzleAssistant',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    if ((await readPuzzleAssistant(s, actor))?.muted)
      await ui.get(`${ASSISTANT}-mute`).tap();
  },
});

/** The injected audio device, independent of the avatar's status indicator. */
export async function readAssistantAudioState(
  s: ProductHarness,
  actor: string
) {
  await actorUi(s, actor);
  return s.actors.get(actor)!.device.audioState();
}

export async function readAssistantAudioFailures(
  s: ProductHarness,
  actor: string
) {
  await actorUi(s, actor);
  return s.actors.get(actor)!.device.audioFailures();
}

export async function readReducedMotionApplied(
  s: ProductHarness,
  actor: string
) {
  const ui = await actorUi(s, actor);
  return (
    (await ui.snapshotHtml())?.includes('data-reduced-motion="true"') === true
  );
}

export async function readAssistantAudioPlaying(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  return (await readAssistantAudioState(s, actor)).some((player) => {
    const source = player.source as { uri?: string } | undefined;
    return (
      (source?.uri?.startsWith('blob:') === true ||
        source?.uri?.includes('/tts/audio/') === true) &&
      player.status.playing
    );
  });
}

export const failAssistantAudio = scenarioAction({
  name: 'failAssistantAudio',
  act: async (s, actor: string) => {
    await actorUi(s, actor);
    await s.actors.get(actor)!.device.failAudio();
  },
});

export const preferReducedMotion = scenarioAction({
  name: 'preferReducedMotion',
  act: async (s, actor: string) => {
    await actorUi(s, actor);
    await s.actors.get(actor)!.device.setReducedMotion(true);
  },
});

/** Select a movable piece from the position the person actually sees. */
export const chooseMovablePuzzlePiece = scenarioAction({
  name: 'chooseMovablePuzzlePiece',
  act: async (s, actor: string) => {
    const fen = await readPuzzleBoardFen(s, actor);
    const move = fen === null ? undefined : legalMoves(fen)[0];
    if (move === undefined)
      throw new Error('No legal move on the puzzle board');
    await pickUpPuzzlePieceAt(s, actor, move.from as Square);
  },
});
