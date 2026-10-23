import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { useProfileRow } from './claim-username-use-profile-row';
import { useMyProfileId } from './public-use-my-profile-id';
import { useStandInName } from './use-stand-in-name';

/**
 * Tells a person whose username is no longer allowed which stand-in name
 * everyone sees instead, until they rename themselves.
 */
export function StandInNotice(): JSX.Element {
  const { t } = useLingui();
  const profileId = useMyProfileId();
  const { row } = useProfileRow(profileId);
  const standIn = useStandInName(row);
  const notice = (alias: string) =>
    t`Other people see you as ${alias} until you choose a new username`;
  return (
    <Show when={standIn()}>
      {(alias) => (
        <P
          variant="caption"
          align="center"
          testId={Handles.profileStandInNotice}
        >
          {notice(alias())}
        </P>
      )}
    </Show>
  );
}
