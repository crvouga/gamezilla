import { describe, expect, test } from 'bun:test';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared-ts/plus-membership-offer';
import { validatePlusMembershipOffer } from '@libs/billing-shared-ts/validate-offer';
import type {
  CancellationReason,
  PlusMembershipOffer,
} from '@pkgs/billing-root-shared-ts/offer';

function offer(patch: (draft: Draft) => void): PlusMembershipOffer {
  const draft = structuredClone(PLUS_MEMBERSHIP_OFFER) as unknown as Draft;
  patch(draft);
  return draft as PlusMembershipOffer;
}

type Draft = {
  product: { catalogProductId: string; name: string; description: string };
  prices: Record<
    string,
    {
      key: string;
      catalogPriceId: string;
      unitAmount: number;
      currency: string;
      interval: 'month' | 'year';
      trialPeriodDays?: number;
      currencyOptions: Record<string, { unitAmount: number }>;
    }
  >;
  defaultPriceKey: string;
  switchablePriceKeys: string[];
  portal: {
    defaultReturnUrlPath: string;
    businessProfileHeadline: string;
    cancellationReasons: CancellationReason[];
  };
  callbackPath: string;
  callbackDescription: string;
};

/** The one assertion the gate actually makes. */
test('the shipped offer is sound', () => {
  expect(validatePlusMembershipOffer(PLUS_MEMBERSHIP_OFFER)).toEqual([]);
});

describe('things that would produce a broken provider catalogue', () => {
  test('a default price that is not on the menu', () => {
    const problems = validatePlusMembershipOffer(
      offer((d) => {
        d.defaultPriceKey = 'nope';
      })
    );
    expect(problems.join('\n')).toContain("defaultPriceKey: 'nope'");
  });

  test('a switchable key that is not a declared price', () => {
    const problems = validatePlusMembershipOffer(
      offer((d) => {
        d.switchablePriceKeys = [...d.switchablePriceKeys, 'ghost'];
      })
    );
    expect(problems.join('\n')).toContain("'ghost' is not a declared price");
  });

  test('a default nobody can switch back to', () => {
    const problems = validatePlusMembershipOffer(
      offer((d) => {
        d.switchablePriceKeys = ['subscription_yearly'];
      })
    );
    expect(problems.join('\n')).toContain('must include the default');
  });

  test('two prices sharing one provider lookup key', () => {
    const problems = validatePlusMembershipOffer(
      offer((d) => {
        d.prices['subscription_yearly']!.catalogPriceId =
          'subscription_monthly';
      })
    );
    expect(problems.join('\n')).toContain('is already used by');
  });

  test('a price stored under a key it does not claim', () => {
    const problems = validatePlusMembershipOffer(
      offer((d) => {
        d.prices['subscription_monthly']!.key = 'something_else';
      })
    );
    expect(problems.join('\n')).toContain('but it is stored under');
  });

  test('an amount that is not positive minor units', () => {
    for (const bad of [0, -700, 7.5]) {
      const problems = validatePlusMembershipOffer(
        offer((d) => {
          d.prices['subscription_monthly']!.unitAmount = bad;
        })
      );
      expect(problems.join('\n')).toContain('positive integer in minor units');
    }
  });

  test('a currency override repeating the price currency', () => {
    const problems = validatePlusMembershipOffer(
      offer((d) => {
        d.prices['subscription_monthly']!.currencyOptions['usd'] = {
          unitAmount: 800,
        };
      })
    );
    expect(problems.join('\n')).toContain("repeats the price's own currency");
  });

  test('a malformed currency code', () => {
    const problems = validatePlusMembershipOffer(
      offer((d) => {
        d.prices['subscription_monthly']!.currency = 'USD';
      })
    );
    expect(problems.join('\n')).toContain('lowercase ISO code');
  });

  test('an origin where a path belongs', () => {
    const problems = validatePlusMembershipOffer(
      offer((d) => {
        d.callbackPath = 'https://api.example.com/api/billing/callback';
      })
    );
    expect(problems.join('\n')).toContain('must be an absolute path');
  });

  test('a portal with no cancellation reasons', () => {
    const problems = validatePlusMembershipOffer(
      offer((d) => {
        d.portal.cancellationReasons = ['other', 'other'];
      })
    );
    expect(problems.join('\n')).toContain('listed twice');
  });
});
