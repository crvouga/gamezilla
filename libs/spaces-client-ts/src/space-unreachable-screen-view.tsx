import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from '@solidjs/web';
import { SpaceRecoveryBar } from './space-recovery-bar';

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
      {/* The ways on stand right under the message they answer, not
          a screen away at the bottom edge. */}
      <StackVertical gap="lg">
        <ErrorState
          title={t`Can't reach this space right now`}
          // The space by name, in full: the header may cut a long one short.
          body={t`${props.title} didn't answer. Check your connection and try again, or go back to Spaces.`}
          dataSet={{ testid: Handles.spaceUnreachable }}
        />
        <SpaceRecoveryBar>
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
        </SpaceRecoveryBar>
      </StackVertical>
    </ContentScreen>
  );
}
