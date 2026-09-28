/**
 * Critical journey steps (`specs/journeys/`). Written once against the
 * world's {@link JourneyHost}, so the same definitions drive the simulated
 * app here (`@libs/runtime#test:e2e`) and a real browser against production
 * (`@apps/product#health` imports this file).
 */

import {
  appBooted,
  endActiveSpace,
  expectAvatarSeed,
  expectGamesOffered,
  expectGoogleHandOff,
  expectNextPuzzleReady,
  expectNoSearchResults,
  expectPlusPrices,
  expectPuzzlePlayable,
  expectSignInOffered,
  expectSpaceEnded,
  hostSpace,
  type JourneyBrowser,
  type JourneyWorld,
  saveAvatar,
  searchPeople,
  signOut,
  solveChessPuzzle,
  startChessPuzzle,
  startGoogleSignIn,
  viewBillingPlans,
} from '@libs/runtime/harness/critical-journeys';
import { hostLimit, stepsFor } from '@pkgs/gherkin/registry';

const { Given, When, Then, Step } = stepsFor<JourneyWorld>();

/** Cleanup key of a hosted space the scenario has not ended yet. */
const HOSTED_SPACE = 'hosted-space';

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

Then('the app finishes booting into the tabs', async (w) => {
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

/** Host a space and end it when the scenario closes, unless it ended it. */
async function hostDeferringEnd(w: JourneyWorld): Promise<void> {
  await w.journey.act('hostSpace', hostSpace);
  w.journey.defer(HOSTED_SPACE, endActiveSpace);
}

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
  await w.journey.act('endActiveSpace', endActiveSpace);
  w.journey.settle(HOSTED_SPACE);
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
