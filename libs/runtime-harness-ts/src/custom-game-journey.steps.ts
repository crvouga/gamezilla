import type { Actor } from '@libs/harness-ts/parameter-types';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  acceptBlack,
  becomeReady,
  expectBlackNamed,
  expectBoardFacing,
  expectCustomGameBotReply,
  expectCustomGameReady,
  expectCustomGameResigned,
  expectInvitationToBlack,
  expectMoveListed,
  expectOutcome,
  expectStartable,
  inviteToBlack,
  playCustomGameE4,
  prepareCustomGame,
  readOwnBlackName,
  readWhiteName,
  resignCustomGame,
  startCustomGame,
  startCustomGameAgainstBot,
  startReadyGame,
} from './custom-game-journey';
import { prepareCustomGamePair } from './custom-game-pair';
import { hostDeferringEnd } from './journey-space';
import {
  type JourneyHost,
  type JourneyWorld,
  journeyDevice,
} from './journey-types';
import { joinFromLink } from './space-gestures';

const { Given, When, Then } = stepsFor<JourneyWorld>();

When('they start a custom game against a bot', async (w) => {
  await w.journey.act('startCustomGameAgainstBot', startCustomGameAgainstBot);
});
Then('their custom game board is ready for White', async (w) => {
  await w.journey.act('expectCustomGameReady', expectCustomGameReady);
});
When('they play e2-e4 in the custom game', async (w) => {
  await w.journey.act('playCustomGameE4', playCustomGameE4);
});
Then("a legal bot reply returns White's turn", async (w) => {
  await w.journey.act('expectCustomGameBotReply', expectCustomGameBotReply);
});
When('they resign the custom game', async (w) => {
  await w.journey.act('resignCustomGame', resignCustomGame);
});
Then('their custom game is completed by resignation', async (w) => {
  await w.journey.act('expectCustomGameResigned', expectCustomGameResigned);
});
Given('they have a ready custom game against a bot', async (w) => {
  await w.journey.act('prepareCustomGame', prepareCustomGame);
});
When('they start the custom game', async (w) => {
  await w.journey.act('startCustomGame', startCustomGame);
});

/** This journey seats its host on White and invites the other person to Black. */
function seatOf(actor: Actor): 'White' | 'Black' {
  return actor === 'alice' ? 'White' : 'Black';
}

/** What `read` finds on the device `act` drives. */
async function readWith(
  act: JourneyHost['act'],
  name: string,
  read: (ui: Driver) => Promise<string>
): Promise<string> {
  let value = '';
  await act(name, async (ui) => {
    value = await read(ui);
  });
  return value;
}

Given(
  '{actor} is hosting a space that {actor} joined from the link',
  async (w, host: Actor, guest: Actor) => {
    // Precondition: the host and the guest are the journey's two devices.
    journeyDevice(w.journey, host);
    journeyDevice(w.journey, guest);
    await w.journey.open('anonymous');
    await hostDeferringEnd(w);
    await w.journey.openGuest(await w.journey.spaceLink());
    await w.journey.actAsGuest('joinFromLink', joinFromLink);
  }
);
When(
  '{actor} invites {actor} to Black in a new custom game',
  async (w, host: Actor) => {
    await journeyDevice(w.journey, host)('inviteToBlack', inviteToBlack);
  }
);
Then(
  "{actor} sees {actor}'s invitation to play Black",
  async (w, invited: Actor, creator: Actor) => {
    const name = await readWith(
      journeyDevice(w.journey, creator),
      'readWhiteName',
      readWhiteName
    );
    await journeyDevice(w.journey, invited)(
      'expectInvitationToBlack',
      expectInvitationToBlack(name)
    );
  }
);
When('{actor} accepts Black in the custom game', async (w, actor: Actor) => {
  await journeyDevice(w.journey, actor)('acceptBlack', acceptBlack);
});
Then('Black is {actor} in the custom game', async (w, actor: Actor) => {
  const name = await readWith(
    journeyDevice(w.journey, actor),
    'readOwnBlackName',
    readOwnBlackName
  );
  await journeyDevice(w.journey, actor === 'alice' ? 'bob' : 'alice')(
    'expectBlackNamed',
    expectBlackNamed(name)
  );
});
When(
  '{actor} and {actor} become ready for the custom game',
  async (w, first: Actor, second: Actor) => {
    await journeyDevice(w.journey, first)('becomeReady', becomeReady);
    await journeyDevice(w.journey, second)('becomeReady', becomeReady);
  }
);
Then('The custom game is startable', async (w) => {
  await w.journey.act('expectStartable', expectStartable);
});
Given(
  '{actor} and {actor} are ready for a custom game with {actor} as Black',
  async (w, _host: Actor, _guest: Actor, black: Actor) => {
    if (black !== 'bob') throw new Error('the journey seats Bob as Black');
    await prepareCustomGamePair(w.journey);
  }
);
When('{actor} starts the custom game', async (w, actor: Actor) => {
  await journeyDevice(w.journey, actor)('startReadyGame', startReadyGame);
});
Then("{actor}'s board faces {word}", async (w, actor: Actor, side: string) => {
  await journeyDevice(w.journey, actor)(
    'expectBoardFacing',
    expectBoardFacing(side === 'Black' ? 'black' : 'white')
  );
});
When('{actor} plays e2-e4 in the custom game', async (w, actor: Actor) => {
  await journeyDevice(w.journey, actor)('playCustomGameE4', playCustomGameE4);
});
Then(
  '{actor} sees {word} in the custom game move list',
  async (w, actor: Actor, san: string) => {
    await journeyDevice(w.journey, actor)(
      'expectMoveListed',
      expectMoveListed(san)
    );
  }
);
When('{actor} resigns the custom game', async (w, actor: Actor) => {
  await journeyDevice(w.journey, actor)('resignCustomGame', resignCustomGame);
});
Then(
  'both people see {actor} wins the custom game by resignation',
  async (w, winner: Actor) => {
    const outcome = expectOutcome(`${seatOf(winner)} wins by resignation.`);
    await w.journey.act('expectOutcome', outcome);
    await w.journey.actAsGuest('expectOutcome', outcome);
  }
);

import '@libs/harness-ts/define';
