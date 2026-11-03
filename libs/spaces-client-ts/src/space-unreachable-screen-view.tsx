import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import type { JSX } from 'solid-js';

export type SpaceUnreachableScreenViewProps = {
  /** Custom title, or the localized "<host>'s space" fallback. */
  readonly title: string;
  /** Waits for the space afresh. */
  readonly onRetry: () => void;
  readonly onBackToSpaces: () => void;
};

/**
 * `/space/:id` when the space has not answered for a while with a
 * connection, presentational: word of that, Try again, and the way back to
 * Spaces, so nobody waits on a space without end.
 */
export function SpaceUnreachableScreenView(
  props: SpaceUnreachableScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <ContentScreen
      screenId="space-unreachable"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: props.title },
      ]}
    >
      <ErrorState
        title={t`This space can't be reached right now`}
        body={t`It may no longer exist. Try again, or go back to Spaces.`}
        retry={{
          label: t`Try again`,
          onClick: () => props.onRetry(),
          dataSet: { testid: Handles.spaceUnreachableRetry },
        }}
        secondary={{
          label: t`Back to Spaces`,
          onClick: () => props.onBackToSpaces(),
          dataSet: { testid: Handles.spaceUnreachableBack },
        }}
        dataSet={{ testid: Handles.spaceUnreachable }}
      />
    </ContentScreen>
  );
}
