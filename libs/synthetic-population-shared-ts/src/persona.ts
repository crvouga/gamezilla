import type { Random } from '@pkgs/uuid-shared-ts/create-id';
import { createHarnessIds } from '@pkgs/uuid-shared-ts/seeded-create-id';
import { z } from 'zod';
import { localHourAt } from './daily-schedule';
import { HOME_REGIONS } from './persona-regions';
import { provisionUsername } from './persona-usernames';

/**
 * The contract every Synthetic User persona satisfies. Provisioning, the
 * Worker's behavior and the Synthetic Population panel all read this one shape; the
 * persisted `population_users.personality` column holds it as JSON.
 */
export const SKILL_LEVELS = [
  'beginner',
  'casual',
  'intermediate',
  'strong',
] as const;
export const skillLevelSchema = z.enum(SKILL_LEVELS);
export type SkillLevel = z.infer<typeof skillLevelSchema>;

export const dailyScheduleSchema = z.object({
  /** IANA time zone of the home region, e.g. `America/Chicago`. */
  timeZone: z.string().min(1).max(64),
  /** Local hour [0, 24) the Synthetic User tends to come online. */
  startHour: z.number().int().min(0).max(23),
  /** Local hour [0, 24) it tends to go offline; may wrap past midnight. */
  endHour: z.number().int().min(0).max(23),
});
export type DailySchedule = z.infer<typeof dailyScheduleSchema>;

export const personaSchema = z.object({
  schemaVersion: z.literal(2),
  /** Display-ready, person-like username (no shared prefix across the population). */
  username: z.string().min(3).max(24),
  /** Serialized profile avatar config (`serializeAvatarConfig` shape). */
  avatar: z.string().min(1).max(2048),
  /** Human-readable home region, e.g. `Chicago, US`. */
  homeRegion: z.string().min(1).max(64),
  skillLevel: skillLevelSchema,
  /**
   * Game rule ids in preference order: 1 to 3 entries, none only when no
   * game was on offer when the persona was provisioned.
   */
  favoriteGames: z.array(z.string().min(1).max(64)).max(3),
  dailySchedule: dailyScheduleSchema,
  /** Thinking time bounds per move in ms; always within [2000, 20000]. */
  thinkingTime: z.object({
    minMs: z.number().int().min(2000).max(20_000),
    maxMs: z.number().int().min(2000).max(20_000),
  }),
  /** Probability [0, 1] of accepting or offering a rematch (max 3 in a row). */
  rematchWeight: z.number().min(0).max(1),
  /** Probability [0, 1] of hosting a space instead of searching. */
  hostingWeight: z.number().min(0).max(1),
});
export type Persona = z.infer<typeof personaSchema>;

/** Avatar styles a person would pick for a face, by the profile's style key. */
export const PERSONA_AVATAR_STYLES = [
  'adventurer',
  'avataaars',
  'lorelei',
  'micah',
  'miniavs',
  'notionists',
  'personas',
  'thumbs',
  'bottts',
  'croodles',
  'dylan',
] as const;

/** What provisioning needs to know about the population it joins. */
export type PersonaContext = {
  /** The games on offer, by registered game id. */
  readonly games: readonly string[];
  /** The personas the Synthetic Population already has. */
  readonly population: readonly (Pick<Persona, 'username'> &
    Partial<Pick<Persona, 'skillLevel' | 'favoriteGames'>>)[];
  /** When the persona is provisioned: its daily schedule includes this moment. */
  readonly nowMs: number;
};

function pick<T>(items: readonly T[], random: Random): T {
  const item =
    items[Math.min(items.length - 1, Math.floor(random() * items.length))];
  if (item === undefined) throw new Error('Cannot pick from an empty list');
  return item;
}
/** The candidates the population has least of, so a population stays varied. */
function leastRepresented<T>(
  candidates: readonly T[],
  counts: (c: T) => number
) {
  const fewest = Math.min(...candidates.map(counts));
  return candidates.filter((candidate) => counts(candidate) === fewest);
}
function favoriteGames(context: PersonaContext, random: Random): string[] {
  if (context.games.length === 0) return [];
  const first = pick(
    leastRepresented(
      context.games,
      (game) =>
        context.population.filter((p) => p.favoriteGames?.includes(game)).length
    ),
    random
  );
  const favorites = [first];
  const more = Math.floor(random() * 3);
  const others = context.games.filter((game) => game !== first);
  for (let index = 0; index < more && others.length > 0; index += 1) {
    const [next] = others.splice(Math.floor(random() * others.length), 1);
    if (next !== undefined) favorites.push(next);
  }
  return favorites;
}
function dailySchedule(
  timeZone: string,
  nowMs: number,
  random: Random
): DailySchedule {
  const length = 3 + Math.floor(random() * 7);
  const hour = Math.floor(localHourAt(timeZone, nowMs));
  // Online now, with at least an hour of its schedule still to come.
  const startHour = (hour - Math.floor(random() * (length - 1)) + 24) % 24;
  return { timeZone, startHour, endHour: (startHour + length) % 24 };
}

/**
 * A complete persona for the Synthetic User `id`, drawn from `random`: the
 * same seed always provisions the same persona. It fits the population it
 * joins (a username of its own, skill levels and favorite games spread out)
 * and its daily schedule has it online now.
 */
export function provisionPersona(
  id: string,
  random: Random,
  context: PersonaContext
): Persona {
  const home = pick(HOME_REGIONS, random);
  const fastest = 2_000 + Math.floor(random() * 4) * 1_000;
  return {
    schemaVersion: 2,
    username: provisionUsername(
      random,
      context.population.map((p) => p.username),
      id
    ),
    avatar: JSON.stringify({
      style: pick(PERSONA_AVATAR_STYLES, random),
      seed: createHarnessIds(id).createId().replaceAll('-', '').slice(0, 12),
      options: {},
    }),
    homeRegion: home.region,
    skillLevel: pick(
      leastRepresented(
        SKILL_LEVELS,
        (level) =>
          context.population.filter((p) => p.skillLevel === level).length
      ),
      random
    ),
    favoriteGames: favoriteGames(context, random),
    dailySchedule: dailySchedule(home.timeZone, context.nowMs, random),
    thinkingTime: {
      minMs: fastest,
      maxMs: fastest + 4_000 + Math.floor(random() * 7) * 1_000,
    },
    rematchWeight: Math.round((0.2 + random() * 0.6) * 100) / 100,
    hostingWeight: Math.round((0.15 + random() * 0.35) * 100) / 100,
  };
}

/** A persona's seeded draws: the same identity always draws the same persona. */
export function personaRandom(id: string): Random {
  return createHarnessIds(`persona:${id}`).random;
}

/**
 * The persona a stored row holds. A row written before personas (only a
 * hosting weight and a skill) is upgraded to a complete persona drawn from
 * its identity, keeping its username and hosting weight; so is a row with
 * no persona at all.
 */
export function readPersona(
  value: unknown,
  row: { readonly id: string; readonly username: string },
  context: PersonaContext
): Persona {
  const decoded = typeof value === 'string' ? safeJson(value) : value;
  const current = personaSchema.safeParse(decoded);
  if (current.success) return current.data;
  const legacy = legacyPersonalitySchema.safeParse(decoded);
  const upgraded = provisionPersona(row.id, personaRandom(row.id), context);
  return {
    ...upgraded,
    username: personaSchema.shape.username.safeParse(row.username).success
      ? row.username
      : upgraded.username,
    hostingWeight: legacy.success
      ? legacy.data.hostingWeight
      : upgraded.hostingWeight,
  };
}

/** The persona a stored value holds, or `null` when it holds none yet. */
export function parsePersona(value: unknown): Persona | null {
  const decoded = typeof value === 'string' ? safeJson(value) : value;
  const parsed = personaSchema.safeParse(decoded);
  return parsed.success ? parsed.data : null;
}

const legacyPersonalitySchema = z.object({
  hostingWeight: z.number().min(0).max(1),
  skill: z.string(),
});

function safeJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}
