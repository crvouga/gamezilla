import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { H3 } from '@pkgs/ui-root-client-ts/heading';
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

/**
 * Under the search on a wide screen, past its card's hairline: what a
 * search does, in three short points side by side, quieter than the
 * choice above it so it never outweighs the decision.
 */
export function MultiplayerGuide(): JSX.Element {
  return (
    <StackVertical gap="sm" testId="multiplayer-guide">
      <H3 size="label" tone="secondary">
        <Trans>How matchmaking works</Trans>
      </H3>
      <Grid
        columns={3}
        gap="lg"
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
    </StackVertical>
  );
}
