import { Given, When } from '@libs/harness-ts/define';
import {
  establishQuoridorBotVictory,
  playQuoridorBot,
} from '@libs/quoridor-harness-ts/quoridor-bot-actions';

Given('a Quoridor bot has a Classic game one pawn move from victory', (w) =>
  w.s.apply(establishQuoridorBotVictory, 'classic')
);
Given('a Quoridor bot has a hill mode game one pawn move from victory', (w) =>
  w.s.apply(establishQuoridorBotVictory, 'hill')
);
When('the Quoridor bot moves its pawn', (w) => w.s.apply(playQuoridorBot));
