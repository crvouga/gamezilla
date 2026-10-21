/**
 * The checkout and portal routes when the provider is slow, down, or still
 * confirming a payment: two first checkouts at once share one customer, an
 * outage answers a plain 503 the app can explain, and a payment still being
 * confirmed opens no second checkout.
 */
import { describe, expect, test } from 'bun:test';
import { AUTH_TABLES } from '@libs/auth-shared/tables';
import { BillingApp } from '@libs/billing-server/billing-app';
import { BILLING_TABLES } from '@libs/billing-shared/tables';
import type {
  MembershipBilling,
  StartCheckoutInput,
  StartCheckoutResult,
} from '@pkgs/billing-root-shared/membership';
import { createMembershipProviders } from '@pkgs/billing-root-shared/providers';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import type { Logger } from '@pkgs/logger-shared/logger';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared/sql';
import { createHarnessAdapters } from '@pkgs/uuid-shared/harness-adapters';

const ACCOUNT = '11111111-1111-4111-8111-111111111201';
const RETURN = { returnUrl: 'https://app.test/more/billing' };

type Logged = { readonly msg: string; readonly context: unknown };

function recordingLogger(into: Logged[]): Logger {
  const logger: Logger = {
    debug: () => {},
    info: () => {},
    warn: (msg, context) => into.push({ msg, context }),
    error: (msg, context) => into.push({ msg, context }),
    child: () => logger,
  };
  return logger;
}

async function openDb(): Promise<SqlClient> {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  await reconcileSqliteSchema(
    db,
    registerTables([...AUTH_TABLES, ...BILLING_TABLES])
  );
  return db;
}

function stubProvider(
  overrides: Partial<MembershipBilling> = {}
): MembershipBilling {
  return {
    provider: 'stub',
    startCheckout: async (input) => ({
      kind: 'checkout',
      customerId: input.customerId ?? 'cus_new',
      url: 'https://pay.test/cs_1',
    }),
    openPortal: async () => ({ url: 'https://pay.test/portal' }),
    cancelMembership: async () => {},
    refundPayment: async () => {},
    readCallback: async () => ({ kind: 'ignored' }),
    readPayments: async () => [],
    ...overrides,
  };
}

function appFor(
  db: SqlClient,
  provider: MembershipBilling,
  log: Logger = createNoopLogger()
) {
  const ports = createHarnessAdapters({ seed: 7 });
  return new BillingApp({
    getSqlClient: () => db,
    clock: ports.clock,
    createId: ports.createId,
    requireAuth: async () => ({ accountId: ACCOUNT, deviceId: 'device-1' }),
    log,
    billing: createMembershipProviders({ all: [provider], checkout: 'stub' }),
    notifyUser: async () => {},
  }).build();
}

function post(app: ReturnType<typeof appFor>, path: string) {
  return app.request(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(RETURN),
  });
}

async function linkCustomer(db: SqlClient, customerId: string) {
  await db.run(
    sql`INSERT INTO auth_external_accounts (id, user_id, provider, external_id) VALUES (${`billing:stub:${customerId}`}, ${ACCOUNT}, ${'billing:stub'}, ${customerId})`
  );
}

describe('two first checkouts at once', () => {
  test('the second reuses the customer the first linked', async () => {
    // regression: billing-concurrent-first-checkout-500
    const db = await openDb();
    try {
      let minted = 0;
      let release: () => void = () => {};
      const bothMinted = new Promise<void>((resolve) => {
        release = resolve;
      });
      const calls: (string | null)[] = [];
      const provider = stubProvider({
        startCheckout: async (
          input: StartCheckoutInput
        ): Promise<StartCheckoutResult> => {
          calls.push(input.customerId);
          if (input.customerId !== null) {
            return {
              kind: 'checkout',
              customerId: input.customerId,
              url: `https://pay.test/${input.customerId}`,
            };
          }
          minted += 1;
          const customerId = `cus_${String(minted)}`;
          if (minted === 2) release();
          await bothMinted;
          return {
            kind: 'checkout',
            customerId,
            url: `https://pay.test/${customerId}`,
          };
        },
      });
      const app = appFor(db, provider);
      const [first, second] = await Promise.all([
        post(app, '/billing/checkout'),
        post(app, '/billing/checkout'),
      ]);
      expect([first.status, second.status]).toEqual([200, 200]);
      const urls = [
        ((await first.json()) as { url: string }).url,
        ((await second.json()) as { url: string }).url,
      ];
      expect(urls).toEqual([
        'https://pay.test/cus_1',
        'https://pay.test/cus_1',
      ]);
      expect(calls).toEqual([null, null, 'cus_1']);
      expect(
        await db.query(
          sql<{
            external_id: string;
          }>`SELECT external_id FROM auth_external_accounts WHERE user_id = ${ACCOUNT}`
        )
      ).toEqual([{ external_id: 'cus_1' }]);
    } finally {
      await db.disconnect();
    }
  });
});

describe('a payment the provider has not confirmed to the app yet', () => {
  test('opens no second checkout and says the membership is pending', async () => {
    // regression: billing-second-checkout-before-webhook
    const db = await openDb();
    try {
      await linkCustomer(db, 'cus_paid');
      const provider = stubProvider({
        startCheckout: async (input) => ({
          kind: 'live_membership',
          customerId: input.customerId ?? 'cus_paid',
        }),
      });
      const response = await post(appFor(db, provider), '/billing/checkout');
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({
        code: 'membership_pending',
      });
    } finally {
      await db.disconnect();
    }
  });
});

describe('a provider outage', () => {
  const down = () => Promise.reject(new Error('connect ECONNREFUSED'));

  test('checkout answers 503 provider_unavailable and records it', async () => {
    // regression: billing-provider-outage-500
    const db = await openDb();
    try {
      const logged: Logged[] = [];
      const app = appFor(
        db,
        stubProvider({ startCheckout: down }),
        recordingLogger(logged)
      );
      const response = await post(app, '/billing/checkout');
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        code: 'provider_unavailable',
      });
      expect(logged).toEqual([
        {
          msg: 'billing provider unavailable',
          context: {
            provider: 'stub',
            operation: 'checkout',
            errorType: 'Error',
          },
        },
      ]);
    } finally {
      await db.disconnect();
    }
  });

  test('the portal answers 503 provider_unavailable and records it', async () => {
    // regression: billing-provider-outage-500
    const db = await openDb();
    try {
      await linkCustomer(db, 'cus_member');
      const logged: Logged[] = [];
      const app = appFor(
        db,
        stubProvider({ openPortal: down }),
        recordingLogger(logged)
      );
      const response = await post(app, '/billing/portal');
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        code: 'provider_unavailable',
      });
      expect(logged).toEqual([
        {
          msg: 'billing provider unavailable',
          context: {
            provider: 'stub',
            operation: 'portal',
            errorType: 'Error',
          },
        },
      ]);
    } finally {
      await db.disconnect();
    }
  });
});
