/**
 * Curated lower-case list of slurs and profanity refused in usernames.
 * Data only: extending the list needs no consumer change. Keep entries
 * lower-case and free of separators — matching normalizes input first.
 */
export const BLOCKED_TERMS: readonly string[] = [
  'asshole',
  'bastard',
  'bitch',
  'cunt',
  'dickhead',
  'faggot',
  'fuck',
  'nigger',
  'nigga',
  'pussy',
  'retard',
  'shithead',
  'slut',
  'whore',
];

/**
 * Ordinary words that merely contain a blocked term (`Scunthorpe` holds
 * `cunt`). Matching skips them, so they stay clean; a blocked term outside
 * them is still refused. Lower-case, separator-free, like the blocklist.
 */
export const ALLOWED_WORDS: readonly string[] = [
  'scunthorpe',
  'retardant',
  'retardants',
];
