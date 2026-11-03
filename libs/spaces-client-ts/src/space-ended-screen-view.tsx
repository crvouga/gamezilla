import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { Gamepad2Icon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from 'solid-js';

export type SpaceEndedScreenViewProps = {
  /** Custom title, or the localized "<host>'s space" fallback. */
  readonly title: string;
  /** Who hosted it, as others may see the name; empty when unknown. */
  readonly hostName: string;
  readonly onBackToSpaces: () => void;
};

/**
 * `/space/:id` once the space has ended (the host ended it, or a link to an
 * ended space), presentational: what it was and the way back to Spaces.
 * `SpaceEndedScreen` wires it to the space's data.
 */
export function SpaceEndedScreenView(
  props: SpaceEndedScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  const body = (): string => {
    const label = props.title;
    const username = props.hostName;
    return username.length > 0 ? t`${label}, hosted by ${username}` : label;
  };
  return (
    <ContentScreen
      screenId="space-ended"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: props.title },
      ]}
      dataSet={{ testid: Handles.spaceEnded }}
    >
      <EmptyState
        icon={Gamepad2Icon}
        title={<Trans>This space has ended</Trans>}
        body={body()}
        action={{
          label: t`Back to Spaces`,
          onClick: () => props.onBackToSpaces(),
        }}
      />
    </ContentScreen>
  );
}
