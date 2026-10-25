import { UserUsername } from '@libs/profile-client-ts/user-username';
import { Trans } from '@lingui/solid/macro';
import { type JSX, Show } from 'solid-js';

/** An unfilled place in a cancelled configuration is not a bot participant. */
export function GameHistoryParticipant(props: {
  readonly id: string;
  readonly bot: boolean;
  readonly local: boolean;
}): JSX.Element {
  return (
    <Show
      when={props.id !== ''}
      fallback={
        <Show
          when={props.local}
          fallback={
            <Show when={props.bot} fallback={<Trans>No participant</Trans>}>
              <Trans>Bot</Trans>
            </Show>
          }
        >
          <Trans>Player on this device</Trans>
        </Show>
      }
    >
      <UserUsername profileId={props.id} withAt={false} />
    </Show>
  );
}
