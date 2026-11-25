import { expect, test } from 'bun:test';
import { subscribeToPlus } from '@libs/billing-harness-ts/billing-actions';
import { TEST_CARD } from '@libs/billing-harness-ts/billing-gestures';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';

const app = 'http://127.0.0.1:34305';
const stripe = 'http://127.0.0.1:34310';

// regression: checkout-input-during-document-replacement
test('a native subscriber reaches Stripe before typing and returns to the app to read paid access', async () => {
  let destination = app;
  let loaded = app;
  const values: string[] = [];
  const driver = {
    snapshotHtml: async () =>
      `<button data-testid="${Handles.billingSubscribe}"></button>`,
    get: (id: string) => ({
      tap: async () => {
        destination =
          id === Handles.billingSubscribe
            ? stripe + '/c/pay/cs_test_person'
            : app + '/more/billing';
      },
      input: async (value: string) => {
        if (loaded !== destination || !loaded.startsWith(stripe + '/')) {
          throw new Error(
            `node ${id} input: the checkout document is unavailable`
          );
        }
        values.push(value);
      },
      expect: {
        visible: async () => {
          expect(loaded).toBe(destination);
        },
        hidden: async () => {},
      },
      text: async () => 'paid',
    }),
  };
  const browser = {
    waitForNavigation: async (match: (url: string) => boolean) => {
      expect(match(loaded)).toBe(false);
      expect(match(destination)).toBe(true);
      loaded = destination;
      return loaded;
    },
  };
  const world = {
    actors: new Map([['alice', { ui: driver, browser }]]),
    session: {
      ports: {
        http: { kind: 'stack', billingOrigin: stripe },
        ui: { kind: 'bun-webview', webOrigin: app },
      },
      scheduler: { virtual: true },
      network: { partitions: () => [] },
    },
    harness: { billing: { all: () => [] } },
  } as unknown as ProductHarness;
  await Promise.resolve(subscribeToPlus.act(world, 'alice'));
  expect(values).toEqual([
    TEST_CARD.number,
    TEST_CARD.expiry,
    TEST_CARD.cvc,
    TEST_CARD.zip,
  ]);
  expect(loaded).toBe(app + '/more/billing');
});
