import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import type { JSX } from 'solid-js';

export type PersonalPuzzleStatsScreenViewProps = {
  /** The route's own screen id (one per game). */
  readonly screenId: string;
  /** A logged puzzle is open for review; the stats crumb leads back. */
  readonly reviewing: boolean;
  readonly onBackToStats: () => void;
  /** The stats body, or the review body while `reviewing`. */
  readonly children: JSX.Element;
};

/**
 * A game's puzzle stats outside any space (from Settings), presentational:
 * the routed page edge and its breadcrumbs around the stats or the review
 * of one logged puzzle. `PersonalPuzzleStatsScreen` supplies the bodies.
 */
export function PersonalPuzzleStatsScreenView(
  props: PersonalPuzzleStatsScreenViewProps
): JSX.Element {
  return (
    <ContentScreen
      screenId={props.screenId}
      width="menu"
      breadcrumbs={[
        { name: <Trans>Settings</Trans>, href: '/more' },
        {
          name: <Trans>Puzzle stats</Trans>,
          ...(props.reviewing ? { onClick: () => props.onBackToStats() } : {}),
        },
        ...(props.reviewing ? [{ name: <Trans>Puzzle review</Trans> }] : []),
      ]}
    >
      {props.children}
    </ContentScreen>
  );
}
