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
  expectNoSearchResults,
  expectPuzzlePlayable,
  expectSignInOffered,
  expectSpaceEnded,
  hostSpace,
  type JourneyBrowser,
  type JourneyWorld,
  saveAvatar,
  searchPeople,
  signOut,
  startChessPuzzle,
  startGoogleSignIn,
} from '@libs/runtime/sim/critical-journeys';
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

Given('a person opens the app on a fresh device', async (w) => {
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

Then('our sign-in launch hands them to Google with our callback', async (w) => {
  await expectGoogleHandOff(realBrowser(w));
});

When('they sign out of their account', async (w) => {
  await w.journey.act('signOut', signOut);
});

Then('their account offers to sign in again', async (w) => {
  await w.journey.act('expectSignInOffered', expectSignInOffered);
});

Step('they host a space', async (w) => {
  await w.journey.act('hostSpace', hostSpace);
  w.journey.defer(HOSTED_SPACE, endActiveSpace);
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

Then('the search settles on no results', async (w) => {
  await w.journey.act('expectNoSearchResults', expectNoSearchResults);
});
