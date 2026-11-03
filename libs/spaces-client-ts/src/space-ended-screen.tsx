import { useBreadcrumbNav } from '@pkgs/ui-root-client-ts/use-breadcrumb-nav';
import type { JSX } from 'solid-js';
import { SpaceEndedScreenView } from './space-ended-screen-view';
import { useSpaceDisplayTitle } from './use-space-display-title';
import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';
import { useSpacePerson } from './use-space-people';

export type SpaceEndedScreenProps = {
  spaceId: string;
};

/** Terminal screen after a space ends: wires `SpaceEndedScreenView`. */
export function SpaceEndedScreen(props: SpaceEndedScreenProps): JSX.Element {
  const nav = useBreadcrumbNav();
  const title = useSpaceDisplayTitle(() => props.spaceId);
  const host = useSpaceHostMembershipDisplay(() => props.spaceId);
  const hostPerson = useSpacePerson(() => {
    const id = host()?.profileId;
    return id !== undefined && id.length > 0 ? id : null;
  });
  return (
    <SpaceEndedScreenView
      title={title()}
      hostName={hostPerson()?.name ?? ''}
      onBackToSpaces={nav('/')}
    />
  );
}
