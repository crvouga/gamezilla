import { t } from '@lingui/core/macro';
import type { BotDifficulty } from '@pkgs/turn-game-shared-ts/game-rules';

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
