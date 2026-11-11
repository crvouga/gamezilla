/**
 * The Synthetic Population's personas as an authorized person sees them in
 * the Synthetic Population panel: each Synthetic User row on their screen,
 * with the persona the panel's directory shows for it.
 */

import { GAME_AUTOMATIONS } from '@libs/game-catalog-shared-ts/game-automations';
import { HARNESS_GAMES } from '@libs/games-harness-ts/harness-games';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import {
  SYNTHETIC_USER_DIRECTORY_PATH,
  SYNTHETIC_USERS_PATH,
} from '@libs/observatory-shared-ts/observatory-routes';
import { readSyntheticPopulationDirectory } from '@libs/synthetic-population-server-ts/synthetic-population-user-directory';
import {
  type Persona,
  parsePersona,
} from '@libs/synthetic-population-shared-ts/persona';
import {
  desiredSyntheticPopulation,
  givenDesiredSyntheticPopulation,
} from './observatory-actions';
import {
  claimSyntheticUsers,
  deployedWorkerHeartbeat,
  releaseHeldSyntheticUsers,
} from './population-worker';

export type PersonaSeen = {
  readonly username: string;
  readonly persona: Persona | null;
  /** The persona's favorite games the directory row itself shows. */
  readonly favoriteGamesShown: readonly string[];
};

/** A registered game's name, as the game menu and the panel show it. */
function gameName(id: string): string {
  return (
    HARNESS_GAMES.find((game) => game.client.id === id)?.client.title ?? id
  );
}

/** The favorite games a row's favorite games cell names, of those the persona has. */
function favoriteGamesIn(listed: string, persona: Persona | null): string[] {
  if (persona === null) return [];
  return persona.favoriteGames.filter((game) =>
    listed.includes(gameName(game))
  );
}

/** Every Synthetic User row the person's Synthetic Users table shows, with its persona. */
export async function personasSeen(
  s: ProductHarness,
  actor: string
): Promise<PersonaSeen[]> {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  // The person opens the Synthetic Users table afresh, to see it as it is now.
  await s.actors.get(actor)!.openLink(SYNTHETIC_USERS_PATH);
  await s.actors.get(actor)!.openLink(SYNTHETIC_USER_DIRECTORY_PATH);
  await s.session.waitForIdle();
  if (!(await ui.get('synthetic-population-user').isVisible())) return [];
  const directory = await readSyntheticPopulationDirectory(
    s.harness.serverSql.sqlClient,
    { q: '', limit: 100 }
  );
  const seen: PersonaSeen[] = [];
  for (const user of directory.users) {
    const row = ui.get(`synthetic-population-user-${user.id}`);
    if (!(await row.isVisible())) continue;
    const persona = parsePersona(
      (user as { persona?: unknown }).persona ?? null
    );
    seen.push({
      username: user.username,
      persona,
      favoriteGamesShown: favoriteGamesIn(
        (await row.get('synthetic-user-favorite-games').text()) ?? '',
        persona
      ),
    });
  }
  return seen;
}

/** Whether a persona has everything a persona has: an avatar, a home region, favorite games… */
export function personaComplete(seen: Pick<PersonaSeen, 'persona'>): boolean {
  const persona = seen.persona;
  return (
    persona !== null &&
    persona.username.length > 0 &&
    persona.avatar.length > 0 &&
    persona.homeRegion.length > 0 &&
    persona.favoriteGames.length > 0 &&
    persona.dailySchedule.timeZone.length > 0
  );
}

/** The Synthetic Population has `count` Synthetic Users, provisioned as a deployed worker does. */
export const givenSyntheticPopulationOf = scenarioAction({
  name: 'givenSyntheticPopulationOf',
  act: async (s, count: number) => {
    await Promise.resolve(givenDesiredSyntheticPopulation.act(s, count));
    await deployedWorkerHeartbeat(s);
  },
});

/** The registered games Synthetic Users play, by id. */
export function offeredGameIds(): string[] {
  return GAME_AUTOMATIONS.map((game) => game.rules.id);
}

/** Every Synthetic User's username, as the Synthetic Population panel's directory lists them. */
export async function populationUsernames(
  s: ProductHarness
): Promise<string[]> {
  const directory = await readSyntheticPopulationDirectory(
    s.harness.serverSql.sqlClient,
    { q: '', limit: 100 }
  );
  return directory.users.map((user) => user.username);
}

/** Each Synthetic User's persona as first seen, so a persona that ever changes shows. */
const firstSeen = new WeakMap<ProductHarness, Map<string, string>>();

/** The Synthetic Population as its panel lists it, as the personas model names it. */
export async function observePersonaPopulation(s: ProductHarness) {
  const first = firstSeen.get(s) ?? new Map<string, string>();
  firstSeen.set(s, first);
  const directory = await readSyntheticPopulationDirectory(
    s.harness.serverSql.sqlClient,
    { q: '', limit: 100 }
  );
  const personas = directory.users.map((user) => ({
    id: user.id,
    username: user.username,
    persona: parsePersona((user as { persona?: unknown }).persona ?? null),
  }));
  let kept = true;
  for (const user of personas) {
    const shown = JSON.stringify(user.persona);
    if (!first.has(user.id)) first.set(user.id, shown);
    if (first.get(user.id) !== shown) kept = false;
  }
  const levels = new Set(personas.map((user) => user.persona?.skillLevel));
  const games = new Set(
    personas.flatMap((u) => u.persona?.favoriteGames ?? [])
  );
  return {
    populationSize: personas.length,
    desiredPopulation: await desiredSyntheticPopulation(s),
    usernamesDistinct:
      new Set(personas.map((user) => user.username.toLowerCase())).size ===
      personas.length,
    personasComplete: personas.every(personaComplete),
    personaKept: kept,
    populationVaried:
      personas.length < 12 || (levels.size >= 3 && games.size >= 3),
  };
}

/**
 * One of the Synthetic Users closes its app and opens it again: a worker
 * brings it online, then lets it go.
 */
export const reopenSomeSyntheticApp = scenarioAction({
  name: 'reopenSomeSyntheticApp',
  act: async (s) => {
    await claimSyntheticUsers(s, 1);
    await releaseHeldSyntheticUsers(s);
  },
});
