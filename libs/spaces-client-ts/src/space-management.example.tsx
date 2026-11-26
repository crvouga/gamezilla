import type { MutationStep } from '@pkgs/ui-root-client-ts/mutation-step';
import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';
import type { SpaceManagementPage } from './space-management-context';
import { SpaceManagementView } from './space-management-view';
import {
  SpaceMemberRosterView,
  type SpaceMemberRosterViewProps,
} from './space-member-roster-view';
import {
  SpaceSharingPanel,
  type SpaceSharingPanelProps,
} from './space-sharing-panel';
import { AVERY, HOSTED_SPACE, JORDAN, MEMBERS } from './spaces-story.example';

export type SharingExampleProps = SpaceSharingPanelProps & {
  readonly onClose: () => void;
  readonly removal?: MutationStep | undefined;
};

export function SharingExample(props: SharingExampleProps): JSX.Element {
  const [page, navigate] = createSignal<SpaceManagementPage>({
    area: 'people',
    tab: 'sharing',
  });
  return (
    <SpaceManagementView
      page={page()}
      onNavigate={(next) => navigate(next)}
      onClose={() => props.onClose()}
      spaceName={HOSTED_SPACE.title}
      people={<SpaceMemberRosterView members={MEMBERS} />}
      sharing={<SpaceSharingPanel {...props} />}
      removal={props.removal}
    />
  );
}

export function PeopleExample(
  props: SpaceMemberRosterViewProps & {
    readonly onClose: () => void;
    readonly settings?: boolean;
    readonly onRename?: (() => void) | undefined;
  }
): JSX.Element {
  const [page, navigate] = createSignal<SpaceManagementPage>(
    (): SpaceManagementPage =>
      props.settings
        ? { area: 'settings', tab: 'general' }
        : { area: 'people', tab: 'people' }
  );
  return (
    <SpaceManagementView
      page={page()}
      onNavigate={(next) => navigate(next)}
      onClose={() => props.onClose()}
      spaceName={HOSTED_SPACE.title}
      onRename={props.onRename}
      people={
        <SpaceMemberRosterView
          {...props}
          onShare={() => {
            props.onShare?.();
            navigate({ area: page().area, tab: 'sharing' });
          }}
        />
      }
      sharing={
        <SpaceSharingPanel
          canManage={props.settings === true}
          peopleStatus="ready"
          people={[AVERY, JORDAN]}
          hostId={AVERY.id}
          viewerId={props.settings ? AVERY.id : JORDAN.id}
          onRemovePerson={(person) => props.onRemove?.(person)}
          onCopyLink={() => Promise.resolve()}
        />
      }
    />
  );
}
