import { expect } from 'bun:test';
import {
  arrangeWorldDevices,
  chooseWorldDevice,
  devicePlaceKept,
  giveDevicesDifferentPlaces,
  provideWorldDevices,
  shownWorldDevices,
} from '@apps/product/harness/developer-world-views';
import { Given, Then, When } from '@libs/harness/spec/define';

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
Given("the testing tool shows Alice's phone beside Bob's phone", async (w) => {
  await w.s.apply(provideWorldDevices, true);
  await w.s.apply(arrangeWorldDevices, true);
});
Given("Bob's app has a place different from Alice's app", async (w) => {
  await w.s.apply(giveDevicesDifferentPlaces);
});
When("the team selects Bob's phone in the test world", async (w) => {
  await w.s.apply(chooseWorldDevice, 'bob');
});
When("the team opens the test world's address for Bob's phone", async (w) => {
  await w.s.apply(chooseWorldDevice, 'bob', true);
});
When('the team shows several devices in the test world', async (w) => {
  await w.s.apply(arrangeWorldDevices, true);
});
When("the team shows only Alice's phone in the test world", async (w) => {
  await w.s.apply(chooseWorldDevice, 'alice');
  await w.s.apply(arrangeWorldDevices, false);
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
Then("the team sees Alice's app beside Bob's app", async (w) => {
  expect(await w.s.read(shownWorldDevices)).toEqual(['alice', 'bob']);
});
Then("Bob's phone still keeps Bob's place in the app", async (w) => {
  const place = await w.s.read(devicePlaceKept, 'bob');
  expect(place.current).toBe(place.saved);
});
