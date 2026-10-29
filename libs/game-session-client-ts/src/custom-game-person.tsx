import type {
  CustomGameParticipant,
  CustomGameSide,
} from '@libs/game-session-shared-ts/custom-game-state';
import { UserUsername } from '@libs/profile-client-ts/user-username';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import type { BotDifficulty } from '@pkgs/turn-game-shared-ts/game-rules';
import { type JSX, Match, Switch } from 'solid-js';
import type { CustomGameScreenModel } from './use-custom-game-screen';

/** A bot, with its level when the game offers more than one. */
export function botName(level: BotDifficulty | undefined): string {
  switch (level) {
    case 'easy':
      return t`Bot (easy)`;
    case 'medium':
      return t`Bot (medium)`;
    case 'hard':
      return t`Bot (hard)`;
    case undefined:
      return t`Bot`;
  }
}

/** The level of the seat's bot, when the game's bots have levels. */
export function useBotLevel(props: {
  readonly model: CustomGameScreenModel;
  readonly side: CustomGameSide;
}): () => BotDifficulty | undefined {
  const rules = useTurnGames();
  return () => {
    const game = props.model.current();
    if (game === null) return undefined;
    const levels =
      rules.capability(rules.forPosition(game.fen).id, 'custom-games')?.bots
        .difficulties ?? [];
    return levels.length > 1 ? game.difficulty[props.side] : undefined;
  };
}

export function CustomGamePerson(props: {
  participant: CustomGameParticipant;
  /** The bot's level, for a game whose bots have levels. */
  level?: BotDifficulty | undefined;
}): JSX.Element {
  return (
    <Switch fallback={<Trans>Closed seat</Trans>}>
      <Match when={props.participant.kind === 'person'}>
        <UserUsername profileId={props.participant.person} withAt={false} />
      </Match>
      <Match when={props.participant.kind === 'invitation'}>
        <Trans>Invited:</Trans>{' '}
        <UserUsername profileId={props.participant.person} withAt={false} />
      </Match>
      <Match when={props.participant.kind === 'bot'}>
        {botName(props.level)}
      </Match>
      <Match when={props.participant.kind === 'local'}>
        <Trans>Player on this device</Trans>
      </Match>
      <Match when={props.participant.kind === 'open'}>
        <Trans>Open seat</Trans>
      </Match>
    </Switch>
  );
}
