import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import { HistoryIcon, ListIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { type JSX, Show } from 'solid-js';
import { createFrameChoices, FrameChoiceRow } from './game-frame-choice';
import { recordPlayed } from './game-frame-moves-view';
import type { FramePlaceProps } from './game-frame-screen-view';
import { FramePlacePage } from './game-frame-shell';

type Props = FramePlaceProps;

/**
 * The game's commands while it is played, each a row: offering a draw,
 * looking back at the moves or the space's history, and, apart and
 * confirmed first, resigning or cancelling. The game goes on behind it.
 */
export function FrameCommandsPlace(props: Props): JSX.Element {
  const choices = createFrameChoices(() => props.onClose());
  const ending = (): boolean => props.play.canResign || props.play.canCancel;
  const looking = (): boolean =>
    recordPlayed(props.record) || props.record?.history === true;
  return (
    <FramePlacePage
      {...props}
      screenId="custom-game-commands"
      title={<Trans>Game menu</Trans>}
      subtitle={props.title}
    >
      <Show when={props.play.canOfferDraw || props.play.offerAgainLater}>
        <MenuSection>
          <FrameChoiceRow
            choices={choices}
            id="custom-game-offer"
            title={<Trans>Offer a draw</Trans>}
            caption={
              <Show when={props.play.offerAgainLater}>
                <Trans>You may offer again after your next move.</Trans>
              </Show>
            }
            disabled={!props.play.canOfferDraw}
            operation={() => props.onChoose({ operation: 'offer' })}
          />
        </MenuSection>
      </Show>
      <Show when={looking()}>
        <MenuSection>
          <Show when={recordPlayed(props.record)}>
            <MenuRow
              leading={<ListIcon size={24} />}
              title={<Trans>Review moves</Trans>}
              onClick={() => props.onOpen({ screen: 'moves' })}
              dataSet={{ testid: 'custom-game-review-moves' }}
            />
          </Show>
          <Show when={props.record?.history}>
            <MenuRow
              leading={<HistoryIcon size={24} />}
              title={<Trans>History and stats</Trans>}
              onClick={() => props.onOpenHistory()}
              dataSet={{ testid: 'custom-game-history-stats' }}
            />
          </Show>
        </MenuSection>
      </Show>
      <Show when={ending()}>
        <MenuSection>
          <Show when={props.play.canResign}>
            <MenuRow
              title={<Trans>Resign</Trans>}
              tone="destructive"
              hideChevron
              onClick={() => props.onConfirm('resign')}
              dataSet={{ testid: 'custom-game-resign' }}
            />
          </Show>
          <Show when={props.play.canCancel}>
            <MenuRow
              title={<Trans>Cancel game</Trans>}
              tone="destructive"
              hideChevron
              onClick={() => props.onConfirm('cancel')}
              dataSet={{ testid: 'custom-game-cancel' }}
            />
          </Show>
        </MenuSection>
      </Show>
      <GameActions sizing="share">
        <Button
          title={<Trans>Back to the game</Trans>}
          variant="solid"
          onClick={() => props.onClose()}
          dataSet={{ testid: 'custom-game-resume' }}
        />
      </GameActions>
    </FramePlacePage>
  );
}
