import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { XIcon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from '@solidjs/web';
import { SpaceRecoveryState } from './space-recovery-state';

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
  // One centred unit, the screen's title in it; the space is named in
  // full in the message, which a header would cut.
  return (
    <ContentScreen
      screenId="space-unreachable"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: t`Can't reach this space right now` },
      ]}
      titlePlacement="content"
    >
      <SpaceRecoveryState
        icon={XIcon}
        tone="destructive"
        role="alert"
        title={t`Can't reach this space right now`}
        body={t`${props.title} didn't answer. Check your connection and try again, or go back to Spaces.`}
        testId={Handles.spaceUnreachable}
      >
        <Button
          title={<Trans>Back to Spaces</Trans>}
          intent="neutral"
          variant="outline"
          flex={1}
          onClick={() => props.onBackToSpaces()}
          dataSet={{ testid: Handles.spaceUnreachableBack }}
        />
        <Button
          title={<Trans>Try again</Trans>}
          flex={1}
          onClick={() => props.onRetry()}
          dataSet={{ testid: Handles.spaceUnreachableRetry }}
        />
      </SpaceRecoveryState>
    </ContentScreen>
  );
}
