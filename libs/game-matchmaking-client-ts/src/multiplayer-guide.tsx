import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { GameDisclosure } from '@pkgs/ui-root-client-ts/game-disclosure';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { H3 } from '@pkgs/ui-root-client-ts/heading';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';

/** One thing a search does: a short title over one plain line. */
function GuidePoint(props: {
  readonly title: JSX.Element;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <StackVertical gap="xs" role="listitem">
      <P variant="label">{props.title}</P>
      <P variant="caption" tone="secondary">
        {props.children}
      </P>
    </StackVertical>
  );
}

/** The three things a search does, one under another. */
function GuidePoints(props: { readonly columns: 1 }): JSX.Element {
  return (
    <Grid
      columns={props.columns}
      gap="md"
      role="list"
      aria-label={t`How matchmaking works`}
    >
      <GuidePoint title={<Trans>Every match is rated</Trans>}>
        <Trans>Win, lose or draw, your rating moves once.</Trans>
      </GuidePoint>
      <GuidePoint title={<Trans>Stop whenever you like</Trans>}>
        <Trans>A search waits until you stop it or are matched.</Trans>
      </GuidePoint>
      <GuidePoint title={<Trans>Only people you can play</Trans>}>
        <Trans>Never someone you've blocked, or who blocked you.</Trans>
      </GuidePoint>
    </Grid>
  );
}

/**
 * What a search does. On a phone, under the search past its card's
 * hairline, behind one closed disclosure, so the explanation never
 * outweighs the decision above it. Wide, the card's own third column
 * beside the search and the ratings, headed like them, its three short
 * points one under another, so a short search fills the game column.
 */
export function MultiplayerGuide(props: {
  readonly wide?: boolean | undefined;
}): JSX.Element {
  return (
    <StackVertical testId="multiplayer-guide" gap="md">
      <Show
        when={props.wide === true}
        fallback={
          <GameDisclosure
            title={<Trans>How matchmaking works</Trans>}
            rule={false}
            dataSet={{ testid: 'multiplayer-guide-toggle' }}
          >
            <GuidePoints columns={1} />
          </GameDisclosure>
        }
      >
        <H3 size="label">
          <Trans>How matchmaking works</Trans>
        </H3>
        <GuidePoints columns={1} />
      </Show>
    </StackVertical>
  );
}
