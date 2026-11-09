import { describe, expect, test } from 'bun:test';
import {
  CHECKOUT_RETURN_KEPT_MS,
  storedReturnFor,
} from '../src/checkout-return';

const AT = Date.UTC(2026, 10, 8);

describe('a checkout return saved on the device', () => {
  test('belongs only to the account that paid', () => {
    const stored = { accountId: 'alice', atMs: AT };
    expect(storedReturnFor(stored, 'alice', AT + 1_000)).toBe(AT);
    expect(storedReturnFor(stored, 'bob', AT + 1_000)).toBeNull();
    expect(storedReturnFor(stored, null, AT + 1_000)).toBeNull();
  });

  test('is forgotten a day after the return', () => {
    const stored = { accountId: 'alice', atMs: AT };
    expect(storedReturnFor(stored, 'alice', AT + CHECKOUT_RETURN_KEPT_MS)).toBe(
      AT
    );
    expect(
      storedReturnFor(stored, 'alice', AT + CHECKOUT_RETURN_KEPT_MS + 1)
    ).toBeNull();
  });

  test('an empty record is no return', () => {
    expect(storedReturnFor({ accountId: '', atMs: 0 }, '', 1)).toBeNull();
  });
});
