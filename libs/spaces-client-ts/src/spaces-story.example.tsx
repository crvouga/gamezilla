import { serializeDefaultAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { resolveParticipantColor } from '@pkgs/collab-root-shared-ts/participant-color';
import {
  GameTile,
  type GameTileMotif,
} from '@pkgs/ui-root-client-ts/game-tile';
import type { JSX } from 'solid-js';
import type { SpaceCardData } from './space-card-view';
import type { SpaceMemberRow } from './space-members-sheet-view';
import type { SpacePerson } from './space-person-view';
import type { SpacePresenceFace } from './space-presence-strip-view';

/** Story-only fixtures for space screens: fixed ids, synced avatars. */

function person(
  suffix: string,
  name: string,
  options: { readonly bot?: boolean; readonly synced?: boolean } = {}
): SpacePerson {
  const id = `5a1e0000-0000-4000-8000-0000000000${suffix}`;
  return {
    id,
    name,
    avatarConfig:
      options.synced === false ? null : serializeDefaultAvatarConfig(id),
    bot: options.bot ?? false,
  };
}

export const AVERY = person('01', 'avery');
export const JORDAN = person('02', 'jordan_plays');
export const MORGAN = person('03', 'morgan');
export const ROBIN = person('04', 'robin_42');
export const SAM = person('05', 'sam');
export const PLAYBOT = person('06', 'helper_bot', { bot: true });
export const UNSYNCED = person('07', '', { synced: false });
export const LONG_NAME = person(
  '08',
  'a_really_long_username_that_keeps_going_and_going'
);

export const GUESTS: readonly SpacePerson[] = [JORDAN, MORGAN, ROBIN, SAM];

function space(
  suffix: string,
  host: SpacePerson,
  fields: Partial<SpaceCardData> = {}
): SpaceCardData {
  return {
    spaceId: `5bace000-0000-4000-8000-0000000000${suffix}`,
    title: `${host.name}'s space`,
    host,
    hostUsername: host.name,
    badge: 'live',
    active: false,
    hostedByViewer: host === AVERY,
    guests: [],
    ...fields,
  };
}

/** The viewer's own space, open on this device, with guests. */
export const HOSTED_SPACE = space('01', AVERY, {
  title: 'Friday game night',
  badge: 'current',
  active: true,
  guests: [JORDAN, MORGAN],
});

/** A friend's live space nobody has joined yet. */
export const FRIEND_SPACE = space('02', ROBIN);

/** A live space the viewer was added to, crowded past the avatar stack. */
export const JOINED_SPACE = space('03', SAM, {
  guests: [AVERY, JORDAN, MORGAN, ROBIN, PLAYBOT, LONG_NAME, UNSYNCED],
});

/** Long custom title and host name, to stress truncation. */
export const LONG_SPACE = space('04', LONG_NAME, {
  title:
    'The extremely long and very descriptive name of a space about board games',
  guests: [LONG_NAME, JORDAN],
});

/** A second space the viewer hosts, kept after paid access ended. */
export const SECOND_HOSTED_SPACE = space('05', AVERY, {
  title: 'Sunday puzzle club',
  guests: [ROBIN],
});

export const SPACES: readonly SpaceCardData[] = [
  HOSTED_SPACE,
  FRIEND_SPACE,
  JOINED_SPACE,
];

/** One connected face per person, in roster order. */
export function faces(people: readonly SpacePerson[]): SpacePresenceFace[] {
  return people.map((p, index) => ({
    actor: { id: p.id, clientId: `client-${String(index + 1)}` },
    person: p,
    color: resolveParticipantColor(p.id),
  }));
}

/** The members list as the host sees it, with an idle guest and a bot. */
export const MEMBERS: readonly SpaceMemberRow[] = faces([
  AVERY,
  JORDAN,
  MORGAN,
  PLAYBOT,
]).map((face, index) => ({
  ...face,
  isYou: index === 0,
  isThisTab: index === 0,
  idle: index === 2,
  isHost: index === 0,
}));

/** A made-up game's picture, as `defineGameClient` gives a registered game one. */
export function storyTile(
  motif: GameTileMotif
): (props: { readonly size?: 'md' | 'lg' }) => JSX.Element {
  return (props) => <GameTile motif={motif} size={props.size} />;
}

/**
 * Games a space offers, as the composition root would register them: real
 * games' names and lines, so a story reads as the product does. Ids are
 * made up: platform code never spells a registered game's id.
 */
export const GAMES = [
  {
    id: 'example-board',
    title: 'Chess',
    caption: 'Two players, one board, turn by turn.',
    players: 2,
    Tile: storyTile('checkered'),
  },
  {
    id: 'example-cards',
    title: 'Hearts',
    caption: 'Avoid hearts and the queen of spades.',
    players: 4,
    Tile: storyTile('cards'),
  },
  {
    id: 'example-race',
    title: 'Light Cycles',
    caption: 'Steer your trail and outlast everyone.',
    players: 4,
    Tile: storyTile('trails'),
  },
  {
    id: 'example-puzzle',
    title: 'Numberlink',
    caption: 'Join each pair of dots without crossing a line.',
    players: 1,
    Tile: storyTile('paths'),
  },
] as const;
