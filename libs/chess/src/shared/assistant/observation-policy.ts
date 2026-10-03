export type ObservationFacts = {
  readonly status:
    | 'solving'
    | 'wrong'
    | 'solved'
    | 'revealed'
    | 'skipped'
    | 'unavailable';
  readonly check: boolean;
  readonly mate: boolean;
  readonly hanging: boolean;
  readonly fork: boolean;
};
export type ObservationKind =
  | 'solved'
  | 'revealed'
  | 'skipped'
  | 'unavailable'
  | 'check'
  | 'ready'
  | 'missed mate'
  | 'hanging piece'
  | 'knight fork'
  | 'wrong';

export function chooseObservation(facts: ObservationFacts): ObservationKind {
  if (
    facts.status === 'solved' ||
    facts.status === 'revealed' ||
    facts.status === 'skipped' ||
    facts.status === 'unavailable'
  )
    return facts.status;
  if (facts.check) return 'check';
  if (facts.status === 'solving') return 'ready';
  if (facts.mate) return 'missed mate';
  if (facts.hanging) return 'hanging piece';
  if (facts.fork) return 'knight fork';
  return 'wrong';
}
