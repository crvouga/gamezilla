/**
 * Story-only: who sits at a game's table in its stories. Each side is held
 * by one of the space stories' people, so a game's board stories, the game
 * frame and the space screens show the same people with the same seeded
 * avatars. Production never imports this module.
 */
import { SpacePersonAvatar } from '@libs/spaces-client-ts/space-person-view';
import {
  AVERY,
  JORDAN,
  MORGAN,
  ROBIN,
} from '@libs/spaces-client-ts/spaces-story.example';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from 'solid-js';

/** The person holding each side: Avery plays the first side, and so on. */
export const STORY_TABLE_PEOPLE = {
  white: AVERY,
  black: JORDAN,
  red: MORGAN,
  blue: ROBIN,
} as const satisfies Record<GameSide, { readonly name: string }>;

/** The name of whoever holds `side` in a story. */
export function storyTableName(side: GameSide): string {
  return STORY_TABLE_PEOPLE[side].name;
}

/** The seeded avatar of whoever holds `side` in a story. */
export function StoryTableAvatar(props: {
  readonly side: GameSide;
  readonly size: number;
}): JSX.Element {
  return (
    <SpacePersonAvatar
      person={STORY_TABLE_PEOPLE[props.side]}
      size={props.size}
    />
  );
}
