/**
 * Critical journey steps (`specs/journeys/`). Written once against the
 * world's {@link JourneyHost}, so the same definitions drive the simulated
 * app here (`@libs/runtime#test:spec`) and a real browser against production
 * (`@apps/product-ts#health` imports this file).
 */

import './custom-game-journey.steps';
import './game-journey.steps';
import './multiplayer-journey.steps';
import './numberlink-journey.steps';

import { hostLimit, stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import {
  expectAvatarSeed,
  expectNoSearchResults,
  expectSignInOffered,
  saveAvatar,
  searchPeople,
  signOut,
} from './account-gestures';
import {
  appBooted,
  expectGoogleHandOff,
  startGoogleSignIn,
} from './anonymous-gestures';
import { expectPlusPrices, viewBillingPlans } from './billing-gestures';
import { endHostedSpace, hostDeferringEnd } from './journey-space';
import type { JourneyBrowser, JourneyWorld } from './journey-types';
import { expectNextPuzzleReady, solveChessPuzzle } from './puzzle-gestures';
import {
  expectGamesOffered,
  expectInSpace,
  expectPuzzlePlayable,
  expectSpaceEnded,
  joinFromLink,
  startChessPuzzle,
} from './space-gestures';

const { Given, When, Then, Step } = stepsFor<JourneyWorld>();

function avatarSeed(w: JourneyWorld): string {
  return `synthetic-${w.journey.runId}`;
}

/** Only a real browser can follow the identity provider out of the app. */
function realBrowser(w: JourneyWorld): JourneyBrowser {
  if (w.journey.browser === null) {
    throw hostLimit('no real browser to follow the identity provider');
  }
  return w.journey.browser;
}

/** Solving needs the puzzle's answer, which only a test build shows. */
function answersShown(w: JourneyWorld): void {
  if (!w.journey.showsPuzzleAnswers) {
    throw hostLimit('this app build does not show puzzle answers');
  }
}

Step('a person opens the app on a fresh device', async (w) => {
  await w.journey.open('anonymous');
});

Given('a person is signed in on a fresh device', async (w) => {
  await w.journey.open('signed-in');
});

Then('the app gets past its opening screen onto the tabs', async (w) => {
  await w.journey.act('appBooted', appBooted);
});

When('they start signing in with Google', async (w) => {
  realBrowser(w);
  await w.journey.act('startGoogleSignIn', startGoogleSignIn);
});

Then(
  'Google is asked to sign them in and send them back to the app',
  async (w) => {
    await expectGoogleHandOff(realBrowser(w));
  }
);

When('they sign out of their account', async (w) => {
  await w.journey.act('signOut', signOut);
});

Then('their account offers to sign in again', async (w) => {
  await w.journey.act('expectSignInOffered', expectSignInOffered);
});

When('they host a space', async (w) => {
  await hostDeferringEnd(w);
});

Given('they are hosting a space', async (w) => {
  await hostDeferringEnd(w);
});

Then('the space offers games to play', async (w) => {
  await w.journey.act('expectGamesOffered', expectGamesOffered);
});

When('they end the space', async (w) => {
  await endHostedSpace(w);
});

Given('a person is hosting a space', async (w) => {
  await hostDeferringEnd(w);
});

Given('a person has ended the space', async (w) => {
  await hostDeferringEnd(w);
  await endHostedSpace(w);
});

When('a guest joins the space from the link', async (w) => {
  const link = await w.journey.spaceLink();
  await w.journey.openGuest(link);
  await w.journey.actAsGuest('joinFromLink', joinFromLink);
});

Then('the guest is in the space', async (w) => {
  await w.journey.actAsGuest('expectInSpace', expectInSpace);
});

Then('the guest is told the space has ended', async (w) => {
  await w.journey.actAsGuest('expectSpaceEnded', expectSpaceEnded);
});

Given('the app has been opened on a fresh device', async (w) => {
  await w.journey.open('anonymous');
});

Given('the device is offline', async (w) => {
  await w.journey.offline();
});

When('the app reopens', async (w) => {
  await w.journey.reopen();
});

Then('the space shows it has ended', async (w) => {
  await w.journey.act('expectSpaceEnded', expectSpaceEnded);
});

When('they start a chess puzzle in the space', async (w) => {
  await w.journey.act('startChessPuzzle', startChessPuzzle);
});

Given('they have started a chess puzzle in the space', async (w) => {
  await w.journey.act('startChessPuzzle', startChessPuzzle);
});

When('they solve the puzzle', async (w) => {
  answersShown(w);
  await w.journey.act('solveChessPuzzle', solveChessPuzzle);
});

Then('the next puzzle is ready to play', async (w) => {
  await w.journey.act('expectNextPuzzleReady', expectNextPuzzleReady);
});

Then('a puzzle board is laid out and ready to play', async (w) => {
  await w.journey.act('expectPuzzlePlayable', expectPuzzlePlayable);
});

When('they save a new avatar', async (w) => {
  await w.journey.act('saveAvatar', saveAvatar(avatarSeed(w)));
});

Then('editing their avatar again shows the new one', async (w) => {
  await w.journey.act('expectAvatarSeed', expectAvatarSeed(avatarSeed(w)));
});

When('they search for people with a name nobody has', async (w) => {
  await w.journey.act(
    'searchPeople',
    searchPeople(`zz-nobody-${w.journey.runId}`)
  );
});

Then('the search finishes with no results', async (w) => {
  await w.journey.act('expectNoSearchResults', expectNoSearchResults);
});

When('they look at the billing plans', async (w) => {
  await w.journey.act('viewBillingPlans', viewBillingPlans);
});

Then('Plus is offered at its monthly and yearly prices', async (w) => {
  await w.journey.act('expectPlusPrices', expectPlusPrices);
});
