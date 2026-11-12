import { expect } from 'bun:test';
import {
  chooseWorldDevice,
  devicePlaceKept,
  provideWorldDevices,
  shownWorldDevices,
} from '@apps/harness-ts/developer-world-views';
import { Given, Then, When } from '@libs/harness-ts/define';

Given(
  "the testing tool has a test world with Alice's phone and Bob's phone",
  async (w) => {
    await w.s.apply(provideWorldDevices, true);
  }
);
Given(
  "the testing tool has a test world with Alice's phone only",
  async (w) => {
    await w.s.apply(provideWorldDevices, false);
  }
);
When("the team selects Bob's phone in the test world", async (w) => {
  await w.s.apply(chooseWorldDevice, 'bob');
});
When("the team opens the test world's address for Bob's phone", async (w) => {
  await w.s.apply(chooseWorldDevice, 'bob', true);
});
Then("the team sees Bob's app", async (w) => {
  expect(await w.s.read(shownWorldDevices)).toEqual(['bob']);
});
Then("the team sees Alice's app", async (w) => {
  expect(await w.s.read(shownWorldDevices)).toEqual(['alice']);
});
Then("Alice's phone keeps Alice's place in the app", async (w) => {
  const place = await w.s.read(devicePlaceKept, 'alice');
  expect(place.current).toBe(place.saved);
});
