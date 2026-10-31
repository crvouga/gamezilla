import type {
  CustomGame,
  CustomGameSide,
} from '@libs/game-session-shared-ts/custom-game-state';
import { type Accessor, createMemo } from 'solid-js';

/**
 * Who is looking at a custom game while it is set up, as the frame words
 * it. Read only from the screen's permission decisions (`canConfigure`,
 * `canJoin`) and where the person sits: never from who they are.
 *
 * - `host`: may set up everything.
 * - `seated`: holds a seat at someone else's table.
 * - `member`: may take one of the open seats.
 * - `watcher`: holds no seat and may take none.
 */
export type FrameViewerRole = 'host' | 'seated' | 'member' | 'watcher';

/** What the role is read from. */
export type FrameViewerFacts = {
  readonly configures: boolean;
  readonly joins: boolean;
  readonly seated: boolean;
  readonly openSeats: number;
};

export function frameViewerRole(facts: FrameViewerFacts): FrameViewerRole {
  if (facts.configures) return 'host';
  if (facts.seated) return 'seated';
  if (facts.joins && facts.openSeats > 0) return 'member';
  return 'watcher';
}

/** The seats nobody holds yet that anyone in the space may take. */
export function frameOpenSides(game: CustomGame | null): CustomGameSide[] {
  return game === null
    ? []
    : game.sides.filter((side) => game[side].kind === 'open');
}

/** The facts the screen's model offers, read reactively. */
export type FrameViewerModel = {
  readonly current: Accessor<CustomGame | null>;
  readonly mySide: Accessor<CustomGameSide | null>;
  readonly canConfigure: Accessor<boolean>;
  readonly canJoin: Accessor<boolean>;
};

export function useFrameViewer(model: FrameViewerModel): {
  readonly role: Accessor<FrameViewerRole>;
  readonly openSides: Accessor<CustomGameSide[]>;
} {
  const openSides = createMemo(() => frameOpenSides(model.current()));
  const role = createMemo(() =>
    frameViewerRole({
      configures: model.canConfigure(),
      joins: model.canJoin(),
      seated: model.mySide() !== null,
      openSeats: openSides().length,
    })
  );
  return { role, openSides };
}
