import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import { type Accessor, createMemo } from 'solid-js';
import { frameViewerNotice } from './game-frame-setup-copy';
import { frameStartReason } from './game-frame-start-reason';
import type {
  FrameOptions,
  FrameSetup,
  FrameStart,
} from './game-frame-view-types';
import { useFrameViewer } from './game-frame-viewer';
import type { CustomGameScreenModel } from './use-custom-game-screen';
import { useFrameSetupSeats } from './use-frame-seats';

/**
 * The game's options: its player count for a game offered for several, its
 * own options and, for a host of a game played by turns, the clock; `null`
 * when it has none of them.
 */
function useFrameOptions(
  model: CustomGameScreenModel
): Accessor<FrameOptions | null> {
  const presentation = useGamePresentation();
  const rules = useTurnGames();
  return createMemo(() => {
    const game = model.current();
    if (game === null) return null;
    const frame = presentation(game.fen).frame;
    const players = frame.players;
    const several = players.min < players.max;
    const clock =
      rules.turnsForPosition(game.fen) !== undefined && model.canConfigure();
    if (frame.options.length === 0 && !several && !clock) return null;
    return {
      players: several
        ? { count: game.sides.length, min: players.min, max: players.max }
        : null,
      groups: frame.options,
      position: game.fen,
      editable: model.canConfigure(),
      clock: clock
        ? { minutes: game.minutes, increment: game.increment }
        : null,
    };
  });
}

function useFrameStart(
  model: CustomGameScreenModel,
  role: ReturnType<typeof useFrameViewer>['role']
): Accessor<FrameStart | null> {
  return createMemo(() => {
    const game = model.current();
    if (game === null) return null;
    const side = model.mySide();
    return {
      reason: frameStartReason(game),
      hostStarts: role() === 'seated' && !model.canStart(),
      readiness:
        side !== null && model.canJoin()
          ? {
              ready: game.ready.includes(side),
              blocked:
                model.privateSetup.has() && !model.privateSetup.complete(),
            }
          : null,
      canStart: model.canStart(),
    };
  });
}

/** Everything the frame shows while the custom game is set up. */
export function useFrameSetup(
  model: CustomGameScreenModel
): Accessor<FrameSetup | null> {
  const viewer = useFrameViewer(model);
  const seats = useFrameSetupSeats(model);
  const options = useFrameOptions(model);
  const start = useFrameStart(model, viewer.role);
  return createMemo(() => {
    const game = model.current();
    const begin = start();
    if (game === null || begin === null) return null;
    const side = model.mySide();
    const ready = side !== null && game.ready.includes(side);
    return {
      viewerNotice: frameViewerNotice(viewer.role(), viewer.openSides().length),
      takeSeat:
        viewer.role() === 'member' ? (viewer.openSides()[0] ?? null) : null,
      seats: seats(),
      privateSetup:
        model.privateSetup.has() && side !== null
          ? {
              complete: model.privateSetup.complete(),
              locked: ready || !model.connected(),
            }
          : null,
      options: options(),
      start: begin,
    };
  });
}
