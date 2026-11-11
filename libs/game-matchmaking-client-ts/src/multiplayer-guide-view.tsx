import { Trans } from '@lingui/solid/macro';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import type { JSX } from 'solid-js';
import {
  MultiplayerMenuPlace,
  type MultiplayerPlaceFrame,
} from './multiplayer-place-frame';

/**
 * What a search does, in three short points, each a title over one plain
 * line. Nothing here is pressed: it is read, then Back.
 */
export function MultiplayerGuideView(
  props: MultiplayerPlaceFrame
): JSX.Element {
  return (
    <MultiplayerMenuPlace {...props} title={<Trans>How it works</Trans>}>
      <MenuSection dataSet={{ testid: 'multiplayer-guide' }}>
        <MenuRow
          title={<Trans>Every match is rated</Trans>}
          caption={<Trans>Win, lose or draw, your rating moves once.</Trans>}
        />
        <MenuRow
          title={<Trans>Stop whenever you like</Trans>}
          caption={
            <Trans>A search waits until you stop it or are matched.</Trans>
          }
        />
        <MenuRow
          title={<Trans>Only people you can play</Trans>}
          caption={
            <Trans>Never someone you've blocked, or who blocked you.</Trans>
          }
        />
      </MenuSection>
    </MultiplayerMenuPlace>
  );
}
