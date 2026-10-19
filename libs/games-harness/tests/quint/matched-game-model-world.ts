/**
 * The people and devices of `specs/games/matched-game.qnt`, the matched
 * games it numbers and the product's games they stand for, in the trace's
 * game. Its moves follow the game's known victory (`model-game.ts`).
 */

import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import type { MatchFormation } from '@pkgs/matchmaking-sql-shared/match-pass';
import type { Picks, QuintBinding } from '@pkgs/quint-shared/registry';

export const PLAY_PEOPLE = ['alice', 'bob', 'carol'] as const;
export const PLAY_PLACES = ['phone', 'computer'] as const;
/** The model numbers a pairing's matched game 1 or 2, and its rematch two after it. */
export const REMATCH_OFFSET = 2;

export type PlayFact = {
  readonly formation: MatchFormation;
  readonly sides: readonly string[];
};
export type PlayTrace = QuintHarnessWorld;
export type PlayAction = QuintBinding<PlayTrace>['actions'][string];
export type PlayDevice = { readonly person: string; readonly place: string };

export function deviceActor(d: PlayDevice): string {
  return d.place === 'phone' ? d.person : `${d.person}_computer`;
}

export function playActor(picks: Picks, key = 'device'): string {
  return deviceActor(picks[key] as PlayDevice);
}

export function playFacts(w: PlayTrace): Map<number, PlayFact> {
  let facts = w.memo.get('play:facts') as Map<number, PlayFact> | undefined;
  if (facts === undefined) {
    facts = new Map();
    w.memo.set('play:facts', facts);
  }
  return facts;
}

/** The product's game for the model's game number (0 is no game). */
export function playId(w: PlayTrace, number: number): string {
  const match = number > REMATCH_OFFSET ? number - REMATCH_OFFSET : number;
  const id =
    playFacts(w).get(match)?.formation.matchId ?? `unreceived-match-${match}`;
  return number > REMATCH_OFFSET ? `rematch:${id}` : id;
}

/** The model's number for a product game id, or -1 for one it never named. */
export function playNumberOf(w: PlayTrace, gameId: string): number {
  const rematch = gameId.startsWith('rematch:');
  const matchId = rematch ? gameId.slice('rematch:'.length) : gameId;
  const fact = [...playFacts(w)].find(
    ([, f]) => f.formation.matchId === matchId
  );
  if (fact === undefined) return -1;
  return rematch ? fact[0] + REMATCH_OFFSET : fact[0];
}

export function playRequest(w: PlayTrace): string {
  const n = Number(w.memo.get('play:requests') ?? 0) + 1;
  w.memo.set('play:requests', n);
  return `command-${n}`;
}

export function playOwners(w: PlayTrace): Map<string, string> {
  return w.memo.get('play:owners') as Map<string, string>;
}

export function playPerson(w: PlayTrace, owner: string): string {
  return playOwners(w).get(owner) ?? 'nobody';
}

export function playOwner(w: PlayTrace, person: string): string {
  for (const [owner, name] of playOwners(w)) if (name === person) return owner;
  return `missing-${person}`;
}
