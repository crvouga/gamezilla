import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import {
  ListEntry,
  UnorderedList,
} from '@pkgs/ui-root-client-ts/semantic-list';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';

/** One thing a search does, as a short title over its plain explanation. */
function GuidePoint(props: {
  readonly title: JSX.Element;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <ListEntry>
      <StackVertical gap="xs">
        <P variant="bodyBold">{props.title}</P>
        <P variant="caption" tone="secondary">
          {props.children}
        </P>
      </StackVertical>
    </ListEntry>
  );
}

/**
 * Beside the search on a wide screen: what a search does, in three plain
 * points, so the person knows what they start before they press Find.
 */
export function MultiplayerGuide(): JSX.Element {
  return (
    <GameSection
      title={<Trans>How matchmaking works</Trans>}
      dataSet={{ testid: 'multiplayer-guide' }}
    >
      <StackVertical gap="md">
        <UnorderedList aria-label={t`How matchmaking works`}>
          <GuidePoint title={<Trans>Every match is rated</Trans>}>
            <Trans>
              Each finished game moves your rating once, win, lose or draw.
            </Trans>
          </GuidePoint>
          <GuidePoint title={<Trans>Stop whenever you like</Trans>}>
            <Trans>
              A search waits as long as it takes. Stop it any time before you're
              matched.
            </Trans>
          </GuidePoint>
          <GuidePoint title={<Trans>Only people you can play</Trans>}>
            <Trans>
              You're never paired with someone you've blocked, or who blocked
              you.
            </Trans>
          </GuidePoint>
        </UnorderedList>
      </StackVertical>
    </GameSection>
  );
}
