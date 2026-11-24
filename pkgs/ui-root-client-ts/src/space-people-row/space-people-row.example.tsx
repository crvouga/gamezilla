import { SpacePeopleRow } from '@pkgs/ui-root-client-ts/space-people-row';
import type {
  SpaceGameSeat,
  SpacePerson,
} from '@pkgs/ui-root-client-ts/space-types';
import type { JSX } from '@solidjs/web';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

const PERSON = { kind: 'person' } as const;

/** Every status badge, the host, the viewer, a muted mic, a bot, an open seat. */
const EVERY_STATE: readonly SpacePerson[] = [
  {
    ...PERSON,
    id: 'bob',
    name: 'bob',
    initials: 'B',
    tintKey: 'bob',
    host: true,
    status: 'choosing',
  },
  {
    ...PERSON,
    id: 'you',
    name: 'ana',
    initials: 'A',
    you: true,
    status: 'watching',
  },
  {
    ...PERSON,
    id: 'kim',
    name: 'kim',
    initials: 'K',
    tintKey: 'kim',
    status: 'settingUp',
  },
  {
    ...PERSON,
    id: 'lee',
    name: 'lee',
    initials: 'L',
    tintKey: 'lee',
    status: 'notReady',
    muted: true,
  },
  {
    ...PERSON,
    id: 'max',
    name: 'maximilian_long_name',
    initials: 'M',
    tintKey: 'max',
    status: 'ready',
  },
  {
    ...PERSON,
    id: 'sam',
    name: 'sam',
    initials: 'S',
    tintKey: 'sam',
    status: 'away',
  },
  { id: 'bot-1', kind: 'bot', name: 'Bot 1', status: 'ready' },
  { id: 'seat', kind: 'openSeat', name: 'Open seat' },
];

const IN_GAME: readonly SpacePerson[] = [
  {
    ...PERSON,
    id: 'bob',
    name: 'bob',
    initials: 'B',
    tintKey: 'bob',
    host: true,
  },
  { ...PERSON, id: 'you', name: 'ana', initials: 'A', you: true },
  { id: 'bot-1', kind: 'bot', name: 'Bot 1' },
  { id: 'bot-2', kind: 'bot', name: 'Bot 2', muted: true },
];

const SEATS: Readonly<Record<string, SpaceGameSeat>> = {
  bob: {
    color: 'player1',
    data: { value: '12 pts', description: '12 points' },
  },
  you: {
    color: 'player2',
    turn: true,
    data: { value: '5 pts', description: '5 points' },
  },
  'bot-1': {
    color: 'player3',
    data: { value: '0 pts', description: 'no points' },
  },
  'bot-2': {
    color: 'player4',
    data: { value: '26 pts', description: '26 points' },
  },
};

/** The people row in setup (every badge) and in game (player rings, turn). */
export default function SpacePeopleRowExample(props: {
  onPerson: (id: string) => void;
  onInvite: () => void;
}): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Every status, with Invite at the end">
        <div class="box h-28 border-y border-border">
          <SpacePeopleRow
            people={EVERY_STATE}
            phase="settingUp"
            data={(person) =>
              person.id === 'bob'
                ? {
                    swatch: { color: 'player1' },
                    value: '10:00',
                    description: 'playing White',
                  }
                : undefined
            }
            openId="lee"
            onPerson={(id) => props.onPerson(id)}
            onInvite={() => props.onInvite()}
          />
        </div>
      </ExampleSection>
      <ExampleSection title="In game: player colors, the turn badge, one number">
        <div class="box h-28 border-y border-border">
          <SpacePeopleRow
            people={IN_GAME}
            phase="inGame"
            seat={(person) => SEATS[person.id]}
            onPerson={(id) => props.onPerson(id)}
            onInvite={() => props.onInvite()}
          />
        </div>
      </ExampleSection>
    </ExampleRoot>
  );
}
