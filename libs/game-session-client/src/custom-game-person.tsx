import type { CustomGameParticipant } from '@libs/game-session-shared/custom-game-state';
import { UserUsername } from '@libs/profile-client/user-username';
import { Trans } from '@lingui/solid/macro';
import { type JSX, Match, Switch } from 'solid-js';

export function CustomGamePerson(props: {
  participant: CustomGameParticipant;
}): JSX.Element {
  return (
    <Switch fallback={<Trans>Closed place</Trans>}>
      <Match when={props.participant.kind === 'person'}>
        <UserUsername profileId={props.participant.person} withAt={false} />
      </Match>
      <Match when={props.participant.kind === 'invitation'}>
        <Trans>Invited:</Trans>{' '}
        <UserUsername profileId={props.participant.person} withAt={false} />
      </Match>
      <Match when={props.participant.kind === 'bot'}>
        <Trans>Bot</Trans>
      </Match>
      <Match when={props.participant.kind === 'open'}>
        <Trans>Open place</Trans>
      </Match>
    </Switch>
  );
}
