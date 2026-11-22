import type {
  SpacePerson,
  SpacePersonStatus,
  SpacePhase,
  SpaceRole,
} from '../../src/space-types';

/**
 * The people of every space story, keyed by id: `bob` hosts, `you` (named
 * ana) is the guest, bots fill seats. Fixtures key their data by these ids
 * and never by the `you` / `host` flags, which `spaceExampleViewer` sets.
 */
export const SPACE_EXAMPLE_HOST_NAME = 'bob';

/** The viewer's person id: the host is bob, a guest is `you`. */
export function spaceExampleViewerId(role: SpaceRole): string {
  return role === 'host' ? 'bob' : 'you';
}

function statusOf(
  phase: SpacePhase,
  host: boolean,
  ready: boolean
): SpacePersonStatus | undefined {
  if (phase === 'choosing') return host ? 'choosing' : 'watching';
  if (phase === 'settingUp') {
    if (host) return 'settingUp';
    return ready ? 'ready' : 'notReady';
  }
  return undefined;
}

export type SpaceExamplePeopleOptions = {
  role: SpaceRole;
  phase: SpacePhase;
  /** Bots in seats (`bot-1`, `bot-2`, …), ready from the start. */
  bots?: number | undefined;
  /** Whether ana said she is ready (setup). */
  ready?: boolean | undefined;
  /** An open seat at the end (setup). */
  openSeat?: boolean | undefined;
  /** Mic muted for ana. */
  muted?: boolean | undefined;
};

/** bob, ana, the bots and an open seat, seen by `role`, in `phase`. */
export function spaceExamplePeople(
  options: SpaceExamplePeopleOptions
): readonly SpacePerson[] {
  const viewer = spaceExampleViewerId(options.role);
  const people: SpacePerson[] = [
    { id: 'bob', kind: 'person', name: 'bob', initials: 'B', tintKey: 'bob' },
    {
      id: 'you',
      kind: 'person',
      name: 'ana',
      initials: 'A',
      tintKey: 'ana',
      muted: options.muted,
    },
  ];
  for (let n = 1; n <= (options.bots ?? 0); n++) {
    people.push({ id: `bot-${n}`, kind: 'bot', name: `Bot ${n}` });
  }
  if (options.openSeat === true) {
    people.push({ id: 'seat-open', kind: 'openSeat', name: 'Open seat' });
  }
  return people.map((person) => {
    const host = person.id === 'bob';
    const ready = person.kind === 'bot' || options.ready === true;
    return {
      ...person,
      host,
      you: person.id === viewer,
      status:
        person.kind === 'openSeat'
          ? undefined
          : statusOf(options.phase, host, ready),
    };
  });
}
