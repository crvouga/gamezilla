import { SPACE_PERSON_CAPABILITIES } from '@pkgs/ui-root-client-ts/space-person-actions';
import { SpacePeople } from '@pkgs/ui-root-client-ts/space-person-menu/space-people';
import type { SpacePerson } from '@pkgs/ui-root-client-ts/space-types';
import type { JSX } from '@solidjs/web';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

const PERSON = { kind: 'person' } as const;

/** The host looking at a guest, a bot and an open seat. */
const PEOPLE: readonly SpacePerson[] = [
  { ...PERSON, id: 'you', name: 'ana', initials: 'A', you: true, host: true },
  {
    ...PERSON,
    id: 'bob',
    name: 'bob',
    initials: 'B',
    tintKey: 'bob',
    status: 'notReady',
  },
  { id: 'bot-1', kind: 'bot', name: 'Bot 1', status: 'ready' },
  { id: 'seat', kind: 'openSeat', name: 'Open seat' },
];

/** The people row with each entry's menu, as the host sees it in setup. */
export default function SpacePersonMenuExample(props: {
  onPersonAction: (personId: string, action: string) => void;
  onInvite: () => void;
}): JSX.Element {
  return (
    <ExampleRoot>
      <ExampleSection title="Press a person for what the host can do">
        <div class="box h-28 border-y border-border">
          <SpacePeople
            people={PEOPLE}
            viewer="host"
            phase="settingUp"
            capabilities={SPACE_PERSON_CAPABILITIES}
            onPersonAction={(id, action) => props.onPersonAction(id, action)}
            onInvite={() => props.onInvite()}
          />
        </div>
      </ExampleSection>
    </ExampleRoot>
  );
}
