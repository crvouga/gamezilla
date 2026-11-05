import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { GameDisclosure } from '@pkgs/ui-root-client-ts/game-disclosure';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';

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

/** The three things a search does, one per line on a phone, side by side when wide. */
function GuidePoints(props: { readonly columns: 1 | 3 }): JSX.Element {
  return (
    <Grid
      columns={props.columns}
      gap={props.columns === 1 ? 'md' : 'lg'}
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
 * Under the search, past its card's hairline: what a search does, behind
 * one closed disclosure on every size, so the explanation never outweighs
 * the decision above it and both sizes say the same things the same way.
 * Opened, the three short points sit side by side when `wide`, one per
 * line on a phone.
 */
export function MultiplayerGuide(props: {
  readonly wide?: boolean | undefined;
}): JSX.Element {
  return (
    <StackVertical testId="multiplayer-guide">
      <GameDisclosure
        title={<Trans>How matchmaking works</Trans>}
        rule={false}
        dataSet={{ testid: 'multiplayer-guide-toggle' }}
      >
        <GuidePoints columns={props.wide === true ? 3 : 1} />
      </GameDisclosure>
    </StackVertical>
  );
}
