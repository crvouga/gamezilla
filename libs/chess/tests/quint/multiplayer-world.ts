import type { QuintHarnessWorld } from '@libs/harness/quint/world';
import type { MatchFormation } from '@pkgs/matchmaking-sql';
import type { Picks, QuintBinding } from '@pkgs/quint/registry';

export const PLAY_PEOPLE = ['alice', 'bob', 'carol', 'dave'] as const;
export const PLAY_PLACES = ['phone', 'computer'] as const;
export const PLAY_LINES = [
  ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5', 'a7a6', 'b5a4', 'g8f6'],
  ['f2f3', 'e7e5', 'g2g4', 'd8h4'],
  ['g1f3', 'g8f6', 'f3g1', 'f6g8', 'g1f3', 'g8f6', 'f3g1', 'f6g8'],
] as const;
export type PlayFact = {
  readonly formation: MatchFormation;
  readonly sides: readonly string[];
};
export type PlayTrace = QuintHarnessWorld;
export type PlayAction = QuintBinding<PlayTrace>['actions'][string];

export function playActor(picks: Picks, key = 'device'): string {
  const d = picks[key] as { person: string; place: string };
  return d.place === 'phone' ? d.person : `${d.person}_computer`;
}

export function playFacts(w: PlayTrace): Map<number, PlayFact> {
  let facts = w.memo.get('play:facts') as Map<number, PlayFact> | undefined;
  if (facts === undefined) {
    facts = new Map();
    w.memo.set('play:facts', facts);
  }
  return facts;
}

export function playId(w: PlayTrace, number: number): string {
  return (
    playFacts(w).get(number)?.formation.matchId ?? `unreceived-match-${number}`
  );
}

export function playRequest(w: PlayTrace): string {
  const n = Number(w.memo.get('play:requests') ?? 0) + 1;
  w.memo.set('play:requests', n);
  return `command-${n}`;
}

export function playPerson(w: PlayTrace, owner: string): string {
  const people = w.memo.get('play:owners') as Map<string, string>;
  return people.get(owner) ?? 'nobody';
}
