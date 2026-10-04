import type { JourneyWorld } from './journey-types';
import { expectCustomGameBotReply, expectCustomGameOffline, expectCustomGameReady, expectCustomGameResigned, expectCustomGameUnstarted, playCustomGameE4, prepareCustomGame, resignCustomGame, startCustomGame, startCustomGameAgainstBot } from './custom-game-journey';
import { stepsFor } from '@pkgs/gherkin-shared/registry';

const { Given, When, Then } = stepsFor<JourneyWorld>();

When('they start a Custom Game against a bot', async (w) => {
  await w.journey.act('startCustomGameAgainstBot', startCustomGameAgainstBot);
});
Then('their Custom Game board is ready for White', async (w) => {
  await w.journey.act('expectCustomGameReady', expectCustomGameReady);
});
When('they play e2-e4 in the Custom Game', async (w) => {
  await w.journey.act('playCustomGameE4', playCustomGameE4);
});
Then("a legal bot reply returns White's turn", async (w) => {
  await w.journey.act('expectCustomGameBotReply', expectCustomGameBotReply);
});
When('they resign the Custom Game', async (w) => {
  await w.journey.act('resignCustomGame', resignCustomGame);
});
Then('their Custom Game is completed by resignation', async (w) => {
  await w.journey.act('expectCustomGameResigned', expectCustomGameResigned);
});
Given('they have a ready Custom Game against a bot', async (w) => {
  await w.journey.act('prepareCustomGame', prepareCustomGame);
});
When('they start the Custom Game', async (w) => {
  await w.journey.act('startCustomGame', startCustomGame);
});
Then('they are told Custom Games need a connection', async (w) => {
  await w.journey.act('expectCustomGameOffline', expectCustomGameOffline);
});
Then('their Custom Game has not started', async (w) => {
  await w.journey.act('expectCustomGameUnstarted', expectCustomGameUnstarted);
});
