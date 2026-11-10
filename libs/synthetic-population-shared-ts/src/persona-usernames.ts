import type { Random } from '@pkgs/uuid-shared-ts/create-id';

/**
 * Person-like usernames from curated word lists. Every style reads like one
 * a person picked; none carries a prefix or suffix shared across the
 * Synthetic Population. Usernames keep to what a profile accepts: letters,
 * digits and underscores, 3 to 24 characters.
 */
const FIRST_NAMES = [
  'Maya', 'Jonah', 'Lena', 'Omar', 'Priya', 'Tomas', 'Ines', 'Kofi', 'Hana',
  'Felix', 'Zara', 'Mateo', 'Ada', 'Ravi', 'Nora', 'Emeka', 'Sofia', 'Lucas',
  'Yuki', 'Amara', 'Diego', 'Elif', 'Bruno', 'Freya', 'Hugo', 'Isla', 'Jamal',
  'Keiko', 'Liam', 'Mira', 'Nikos', 'Olga', 'Pablo', 'Quinn', 'Rosa', 'Sven',
  'Talia', 'Umar', 'Vera', 'Wren', 'Xavi', 'Yara', 'Zeke', 'Anouk', 'Bilal',
  'Chloe', 'Dmitri', 'Esme', 'Farah', 'Gus', 'Ivo', 'Jules', 'Kian', 'Lotte',
  'Marco', 'Nadia', 'Otto', 'Paula', 'Rafa', 'Sana', 'Teo', 'Una', 'Viggo',
] as const;
const NICKNAMES = [
  'pixel', 'rook', 'bishop', 'knight', 'gambit', 'blitz', 'castle', 'tempo',
  'checkmate', 'domino', 'meeple', 'joker', 'ace', 'maverick', 'ziggy',
  'biscuit', 'noodle', 'pickle', 'waffle', 'mango', 'cosmo', 'echo', 'nova',
  'orbit', 'ember', 'frost', 'havoc', 'indigo', 'jinx', 'kettle', 'lumen',
  'mocha', 'nimbus', 'onyx', 'pepper', 'quartz', 'rascal', 'sprocket',
  'tango', 'umbra', 'vortex', 'whisk', 'yonder', 'zephyr', 'acorn', 'banjo',
] as const;
const ADJECTIVES = [
  'quiet', 'brave', 'sleepy', 'lucky', 'clever', 'gentle', 'sneaky', 'jolly',
  'humble', 'fuzzy', 'misty', 'rusty', 'sunny', 'witty', 'bold', 'calm',
  'dapper', 'eager', 'fancy', 'grumpy', 'hasty', 'icy', 'jazzy', 'keen',
  'lazy', 'mellow', 'nimble', 'odd', 'plucky', 'quirky', 'rapid', 'shy',
  'tidy', 'upbeat', 'vivid', 'wild', 'zesty', 'amber', 'breezy', 'crafty',
] as const;
const NOUNS = [
  'otter', 'falcon', 'badger', 'panda', 'lynx', 'heron', 'walrus', 'gecko',
  'beetle', 'koala', 'marmot', 'newt', 'osprey', 'puffin', 'quokka', 'raven',
  'sparrow', 'tapir', 'urchin', 'viper', 'wombat', 'yak', 'zebra', 'alpaca',
  'bison', 'cobra', 'dingo', 'egret', 'ferret', 'gopher', 'hyena', 'ibis',
  'jackal', 'kiwi', 'lemur', 'moose', 'narwhal', 'ocelot', 'pigeon', 'robin',
] as const;
const ENDINGS = ['games', 'plays', 'moves', 'gg', 'wins', 'irl'] as const;

type Style = (random: Random) => string;

function pick<T>(items: readonly T[], random: Random): T {
  const item = items[Math.min(items.length - 1, Math.floor(random() * items.length))];
  if (item === undefined) throw new Error('Cannot pick from an empty list');
  return item;
}
function capitalized(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
function year(random: Random): string {
  const value = 1970 + Math.floor(random() * 40);
  return random() < 0.5 ? String(value) : String(value).slice(2);
}
function letter(random: Random): string {
  return pick('ABCDEFGHIJKLMNOPRSTVWZ'.split(''), random);
}

const STYLES: readonly Style[] = [
  // First name and an initial: MayaK, maya_k
  (random) => {
    const name = pick(FIRST_NAMES, random);
    return random() < 0.5
      ? `${name}${letter(random)}`
      : `${name.toLowerCase()}_${letter(random).toLowerCase()}`;
  },
  // A nickname and a year: rook1987, Pixel_92
  (random) => {
    const nick = pick(NICKNAMES, random);
    return random() < 0.5
      ? `${nick}${year(random)}`
      : `${capitalized(nick)}_${year(random)}`;
  },
  // An adjective and a noun: quiet_otter, BraveFalcon
  (random) => {
    const adjective = pick(ADJECTIVES, random);
    const noun = pick(NOUNS, random);
    return random() < 0.5
      ? `${adjective}_${noun}`
      : `${capitalized(adjective)}${capitalized(noun)}`;
  },
  // A name and what they do: jonah_games, LenaPlays
  (random) => {
    const name = pick(FIRST_NAMES, random);
    const ending = pick(ENDINGS, random);
    return random() < 0.5
      ? `${name.toLowerCase()}_${ending}`
      : `${name}${capitalized(ending)}`;
  },
  // A plain nickname with a lucky number: mango7, Nimbus42
  (random) => {
    const nick = pick(NICKNAMES, random);
    const number = String(2 + Math.floor(random() * 98));
    return random() < 0.5 ? `${nick}${number}` : `${capitalized(nick)}${number}`;
  },
  // A first name and a nickname: Hana_rook
  (random) =>
    `${pick(FIRST_NAMES, random)}_${pick(NICKNAMES, random)}`,
];

/** One person-like username drawn from `random`. */
export function drawUsername(random: Random): string {
  return pick(STYLES, random)(random).slice(0, 24);
}

/** What two usernames would share if they differed only by a number, case or separator. */
function stem(username: string): string {
  return username.toLowerCase().replace(/[0-9_]/g, '');
}

/**
 * Whether `candidate` keeps the Synthetic Population free of shared
 * patterns: no username taken twice, no three beginning with the same three
 * letters, no two differing only by a number.
 */
export function usernameFitsPopulation(
  candidate: string,
  taken: readonly string[]
): boolean {
  const prefix = candidate.slice(0, 3).toLowerCase();
  const own = stem(candidate);
  let samePrefix = 0;
  for (const username of taken) {
    if (username.toLowerCase() === candidate.toLowerCase()) return false;
    if (stem(username) === own) return false;
    if (username.slice(0, 3).toLowerCase() === prefix) samePrefix += 1;
  }
  return samePrefix < 2;
}

const ATTEMPTS = 64;

/**
 * A username that fits the population: redrawn until it does. A very large
 * population can exhaust the patterns; then only uniqueness is kept, by a
 * distinguishing ending drawn from the identity.
 */
export function provisionUsername(
  random: Random,
  taken: readonly string[],
  identity: string
): string {
  for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
    const candidate = drawUsername(random);
    if (usernameFitsPopulation(candidate, taken)) return candidate;
  }
  const lower = new Set(taken.map((username) => username.toLowerCase()));
  const base = drawUsername(random).replace(/[0-9_]+$/, '').slice(0, 16);
  const ending = identity.replaceAll('-', '').replace(/[^a-z]/gi, '');
  for (let length = 3; length <= ending.length; length += 1) {
    const candidate = `${base}_${ending.slice(0, length)}`.slice(0, 24);
    if (!lower.has(candidate.toLowerCase())) return candidate;
  }
  return `${base}_${identity.replaceAll('-', '').slice(0, 7)}`;
}
