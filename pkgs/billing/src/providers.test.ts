import { describe, expect, test } from 'bun:test';

import { CONTRACT_OFFER } from './contract-fixtures';
import type { MembershipBilling } from './membership';
import { createMembershipProviders, membershipCallbackPath } from './providers';

function adapter(provider: string): MembershipBilling {
  const unused = () => Promise.reject(new Error('unused'));
  return {
    provider,
    startCheckout: unused,
    openPortal: unused,
    readCallback: unused,
  };
}

describe('createMembershipProviders', () => {
  test('indexes every adapter and picks the checkout one', () => {
    const a = adapter('alpha');
    const b = adapter('beta');
    const providers = createMembershipProviders({
      all: [a, b],
      checkout: 'beta',
    });
    expect(providers.checkout).toBe(b);
    expect([...providers.byId.keys()]).toEqual(['alpha', 'beta']);
  });

  test('two adapters may not share an id', () => {
    expect(() =>
      createMembershipProviders({
        all: [adapter('alpha'), adapter('alpha')],
        checkout: 'alpha',
      })
    ).toThrow("two adapters claim provider id 'alpha'");
  });

  test('the checkout provider must be configured', () => {
    expect(() =>
      createMembershipProviders({ all: [adapter('alpha')], checkout: 'beta' })
    ).toThrow("checkout provider 'beta' is not configured");
  });

  test('ids must be slugs', () => {
    for (const bad of ['', 'Stripe', 'a/b', '1st', 'a b']) {
      expect(() =>
        createMembershipProviders({ all: [adapter(bad)], checkout: bad })
      ).toThrow('must be a lowercase slug');
    }
  });
});

describe('membershipCallbackPath', () => {
  test('one path per provider below the offer callback path', () => {
    expect(membershipCallbackPath(CONTRACT_OFFER, 'paddle')).toBe(
      '/api/billing/callback/paddle'
    );
    expect(() => membershipCallbackPath(CONTRACT_OFFER, '../x')).toThrow();
  });
});
