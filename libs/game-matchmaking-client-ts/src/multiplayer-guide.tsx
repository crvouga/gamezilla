import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { GameDisclosure } from '@pkgs/ui-root-client-ts/game-disclosure';
import { Grid } from '@pkgs/ui-root-client-ts/grid';
import { H3 } from '@pkgs/ui-root-client-ts/heading';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';

/**
 * One thing a search does: its short title, then one plain line. On a
 * phone the line sits under the title; wide, both read as one friendly
 * sentence on one line, the title a step brighter than the line.
 */
function GuidePoint(props: {
  readonly title: JSX.Element;
  readonly children: JSX.Element;
  readonly inline: boolean;
}): JSX.Element {
  return (
    <Show
      when={props.inline}
      fallback={
        <StackVertical gap="xs" role="listitem">
          <P variant="caption">{props.title}</P>
          <P variant="caption" tone="secondary">
            {props.children}
          </P>
        </StackVertical>
      }
    >
      <StackVertical role="listitem">
        <P variant="caption" tone="secondary">
          <Text variant="inherit" tone="default">
            {props.title}
          </Text>
          {'. '}
          {props.children}
        </P>
      </StackVertical>
    </Show>
  );
}

/** The three things a search does, one under another. */
function GuidePoints(props: { readonly inline: boolean }): JSX.Element {
  return (
    <Grid
      columns={1}
      gap={props.inline ? 'xs' : 'md'}
      role="list"
      aria-label={t`How matchmaking works`}
    >
      <GuidePoint
        inline={props.inline}
        title={<Trans>Every match is rated</Trans>}
      >
        <Trans>Win, lose or draw, your rating moves once.</Trans>
      </GuidePoint>
      <GuidePoint
        inline={props.inline}
        title={<Trans>Stop whenever you like</Trans>}
      >
        <Trans>A search waits until you stop it or are matched.</Trans>
      </GuidePoint>
      <GuidePoint
        inline={props.inline}
        title={<Trans>Only people you can play</Trans>}
      >
        <Trans>Never someone you've blocked, or who blocked you.</Trans>
      </GuidePoint>
    </Grid>
  );
}

/**
 * What a search does. On a phone, under the search past its card's
 * hairline, behind one closed disclosure, so the explanation never
 * outweighs the decision above it. Wide, plain quiet text across the
 * card's foot under the search and the ratings: its heading, then three
 * short lines, one under another, each one sentence in caption type,
 * never a box of its own or columns of fine print, so the search stays
 * the first thing read.
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
            <GuidePoints inline={false} />
          </GameDisclosure>
        }
      >
        <H3 size="label" tone="secondary">
          <Trans>How matchmaking works</Trans>
        </H3>
        <GuidePoints inline />
      </Show>
    </StackVertical>
  );
}
