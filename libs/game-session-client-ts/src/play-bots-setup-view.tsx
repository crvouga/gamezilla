import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameModeCard } from '@pkgs/ui-root-client-ts/game-lobby';
import { GameSeatSwatch } from '@pkgs/ui-root-client-ts/game-seat-swatch';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import {
  ClockIcon,
  LockIcon,
  SlidersHorizontalIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import type { JSX } from '@solidjs/web';
import { For, Show } from 'solid-js';
import { FrameHolderAvatar, FrameHolderName } from './game-frame-people';
import { FrameLobbyPage } from './game-frame-shell';
import { FrameStartView } from './game-frame-start-line-view';
import { FrameClockWords } from './game-frame-status-view';
import type {
  FrameOptions,
  FrameSetup,
  FrameSetupSeat,
} from './game-frame-view-types';
import type { FramePlaceProps } from './game-session-screen-view';

type Props = FramePlaceProps & { readonly setup: FrameSetup };

const SEAT_AVATAR_SIZE = 32;

/** Under the holder's name: the side's look and name. */
function SeatFacts(props: { readonly seat: FrameSetupSeat }): JSX.Element {
  return (
    <StackHorizontal gap="sm" align="center" wrap>
      <GameSeatSwatch look={props.seat.swatch} />
      <Text variant="caption">{props.seat.sideLabel}</Text>
    </StackHorizontal>
  );
}

/**
 * One seat at a bot table. The player's own seat only reads. Every other
 * seat is a bot and opens how that bot plays.
 */
function BotSeatRow(
  props: Props & { readonly seat: FrameSetupSeat }
): JSX.Element {
  const side = () => props.seat.side;
  const bot = () => props.seat.holder.kind === 'bot';
  return (
    <MenuRow
      leading={
        <FrameHolderAvatar
          holder={props.seat.holder}
          plainName={props.seat.plainName}
          size={SEAT_AVATAR_SIZE}
          setup
          people={props.people}
        />
      }
      title={
        <Text variant="inherit" testId={`play-bots-${side()}-person`}>
          <FrameHolderName
            holder={props.seat.holder}
            plainName={props.seat.plainName}
            people={props.people}
          />
        </Text>
      }
      caption={<SeatFacts seat={props.seat} />}
      value={
        <Show when={bot()}>
          <Badge intent="neutral" label={<Trans>Bot</Trans>} />
        </Show>
      }
      onClick={
        bot() && props.seat.choices !== null
          ? () => props.onOpen({ screen: 'seat', side: side() })
          : undefined
      }
      dataSet={{
        testid:
          bot() && props.seat.choices !== null
            ? `play-bots-${side()}-choices`
            : `play-bots-${side()}`,
      }}
    />
  );
}

function optionsSummary(options: FrameOptions): string {
  return options.groups
    .map((group) => {
      if (group.kind === 'count') return String(group.read(options.position));
      const value = group.read(options.position);
      return (
        group.options.find((choice) => choice.value === value)?.label() ?? value
      );
    })
    .join(' · ');
}

/** Rules, the clock, and the player's private setup. */
function AgreedRows(props: Props): JSX.Element {
  const options = () => props.setup.options;
  const rules = (): FrameOptions | null => {
    const shown = options();
    return shown !== null && (shown.groups.length > 0 || shown.players !== null)
      ? shown
      : null;
  };
  return (
    <Show
      when={
        rules() !== null ||
        options()?.clock != null ||
        props.setup.privateSetup !== null
      }
    >
      <MenuSection title={<Trans>Game</Trans>}>
        <Show when={rules()}>
          {(shown) => (
            <MenuRow
              leading={<SlidersHorizontalIcon size={24} />}
              title={<Trans>Options</Trans>}
              value={optionsSummary(shown())}
              onClick={() => props.onOpen({ screen: 'options' })}
              dataSet={{ testid: 'play-bots-rules' }}
            />
          )}
        </Show>
        <Show when={options()?.clock}>
          {(clock) => (
            <MenuRow
              leading={<ClockIcon size={24} />}
              title={<Trans>Clock and sides</Trans>}
              value={
                <FrameClockWords
                  minutes={clock().minutes}
                  increment={clock().increment}
                />
              }
              onClick={() => props.onOpen({ screen: 'clock' })}
              dataSet={{ testid: 'play-bots-options' }}
            />
          )}
        </Show>
        <Show when={props.setup.privateSetup}>
          {(own) => (
            <MenuRow
              leading={<LockIcon size={24} />}
              title={<Trans>Your private setup</Trans>}
              caption={<Trans>Only you see it</Trans>}
              value={
                <Text
                  variant="inherit"
                  role="status"
                  dataSet={{ testid: 'play-bots-setup-status' }}
                >
                  <Show
                    when={own().complete}
                    fallback={
                      <Trans>
                        <VisuallyHidden>Your private setup is </VisuallyHidden>
                        incomplete<VisuallyHidden>.</VisuallyHidden>
                      </Trans>
                    }
                  >
                    <Trans>
                      <VisuallyHidden>Your private setup is </VisuallyHidden>
                      complete<VisuallyHidden>.</VisuallyHidden>
                    </Trans>
                  </Show>
                </Text>
              }
              onClick={() => props.onOpen({ screen: 'private-setup' })}
              dataSet={{ testid: 'play-bots-setup-open' }}
            />
          )}
        </Show>
      </MenuSection>
    </Show>
  );
}

/**
 * Play Bots' lobby. Every other seat is a bot. The only thing a seat
 * opens is how that bot plays. There is no invitation and no open seat.
 */
export function PlayBotsSetupPlace(props: Props): JSX.Element {
  return (
    <FrameLobbyPage
      {...props}
      screenId="vs-bot-setup"
      dock={
        <FrameStartView
          start={props.setup.start}
          watching={props.setup.start.readiness === null}
          onChoose={props.onChoose}
          onReady={props.onReady}
          offline={props.connection === 'needed'}
          onArrange={
            props.setup.privateSetup === null
              ? undefined
              : () => props.onOpen({ screen: 'private-setup' })
          }
        />
      }
    >
      <GameModeCard
        eyebrow={
          <>
            <Trans>Play Bots</Trans>
            {'\u00a0· '}
            <Text variant="inherit" testId="play-bots-unrated">
              <Trans>Unrated</Trans>
            </Text>
            <Show when={props.setup.options?.clock == null}>
              {'\u00a0· '}
              <FrameClockWords
                minutes={props.status?.minutes ?? 0}
                increment={props.status?.increment ?? 0}
              />
            </Show>
          </>
        }
        title={props.title}
        summary={props.goal}
        dataSet={{ testid: 'play-bots-mode' }}
      />
      <Show when={props.setup.viewerNotice}>
        {(text) => (
          <P tone="secondary" testId="play-bots-viewer">
            {text()}
          </P>
        )}
      </Show>
      <MenuSection
        title={<Trans>Bots</Trans>}
        dataSet={{ testid: 'play-bots-setup-seats' }}
      >
        <For keyed={false} each={props.setup.seats}>
          {(seat) => <BotSeatRow {...props} seat={seat()} />}
        </For>
      </MenuSection>
      <AgreedRows {...props} />
      <Show when={props.play.canCancel}>
        <GameActions sizing="fill">
          <Button
            title={<Trans>Cancel game</Trans>}
            variant="ghost"
            intent="danger"
            size="md"
            onClick={() => props.onConfirm('cancel')}
            dataSet={{ testid: 'play-bots-cancel' }}
          />
        </GameActions>
      </Show>
    </FrameLobbyPage>
  );
}
