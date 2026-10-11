/**
 * The server auth port's contract, as a test suite every adapter runs.
 *
 * The product treats every auth service the same way: it hands the service a
 * bearer, gets back a user id in the service's namespace, and reads that
 * user's sign-in methods. This suite is how that stays true — each adapter
 * package calls {@link describeAuthServerContract} with a harness over its
 * own service, and the assertions are identical for all of them.
 */
import { describe, expect, test } from 'bun:test';

import type { AuthProvider, AuthProviderModule } from './auth-provider-module';
import type { OauthProviderId } from './sign-in-method';
import { isSignInMethodId } from './sign-in-method';

/** A person the harness signs in, as the provider would vouch for them. */
export type ContractPerson = {
  readonly provider: OauthProviderId;
  /** The subject at that provider. */
  readonly subject: string;
  readonly email: string;
  readonly name: string;
};

/** A session the harness minted for a {@link ContractPerson}. */
export type ContractSession = {
  /** The bearer a client would send. */
  readonly token: string;
  readonly externalUserId: string;
};

/** A service, as far as the contract needs to drive one. */
export type AuthServerContractHarness = {
  readonly module: AuthProviderModule;
  /** The service built by `module.create` over the harness's configuration. */
  readonly provider: AuthProvider;
  /** Sign `person` in the way a client would, returning the minted session. */
  signIn(person: ContractPerson): Promise<ContractSession>;
  /** End `session` at the service (a sign-out). */
  signOut(session: ContractSession): Promise<void>;
  /** Move the service's clock past every session's lifetime. */
  expireSessions(): Promise<void>;
  close(): Promise<void>;
};

const ALICE: ContractPerson = {
  provider: 'google',
  subject: 'contract-alice',
  email: 'alice@contract.example',
  name: 'Alice',
};

const BOB: ContractPerson = {
  provider: 'google',
  subject: 'contract-bob',
  email: 'bob@contract.example',
  name: 'Bob',
};

type ContractCase = {
  readonly name: string;
  run(harness: AuthServerContractHarness): Promise<void>;
};

function reportsModuleIdAndMethods({
  module,
  provider,
}: AuthServerContractHarness): Promise<void> {
  expect(provider.server.provider).toBe(module.provider);
  expect(module.provider.length).toBeGreaterThan(0);
  for (const method of provider.signInMethods) {
    expect(isSignInMethodId(method)).toBe(true);
  }
  expect(new Set(provider.signInMethods).size).toBe(
    provider.signInMethods.length
  );
  return Promise.resolve();
}

async function refusesForeignTokens({
  provider,
}: AuthServerContractHarness): Promise<void> {
  expect(
    await provider.server.verifySessionToken('not-a-real-token')
  ).toBeNull();
  expect(await provider.server.verifySessionToken('')).toBeNull();
}

async function verifiesMintedSession(
  harness: AuthServerContractHarness
): Promise<void> {
  const session = await harness.signIn(ALICE);
  const verified = await harness.provider.server.verifySessionToken(
    session.token
  );
  expect(verified?.externalUserId).toBe(session.externalUserId);
  expect(verified?.email).toBe(ALICE.email);
  expect(verified?.accountId ?? null).toBeNull();
}

async function keepsPeopleApart(
  harness: AuthServerContractHarness
): Promise<void> {
  const alice = await harness.signIn(ALICE);
  const bob = await harness.signIn(BOB);
  expect(alice.externalUserId).not.toBe(bob.externalUserId);
  const verified = await harness.provider.server.verifySessionToken(bob.token);
  expect(verified?.externalUserId).toBe(bob.externalUserId);
}

async function signingInAgainIsSameUser(
  harness: AuthServerContractHarness
): Promise<void> {
  const first = await harness.signIn(ALICE);
  const second = await harness.signIn(ALICE);
  expect(second.externalUserId).toBe(first.externalUserId);
}

async function readsUserWithIdentity(
  harness: AuthServerContractHarness
): Promise<void> {
  const session = await harness.signIn(ALICE);
  const user = await harness.provider.server.getUser(session.externalUserId);
  expect(user?.externalUserId).toBe(session.externalUserId);
  expect(user?.email).toBe(ALICE.email);
  const identity = user?.identities.find(
    (row) => row.provider === ALICE.provider
  );
  expect(identity?.providerUserId).toBe(ALICE.subject);
  expect(Number.isNaN(Date.parse(identity?.linkedAt ?? ''))).toBe(false);
  for (const row of user?.identities ?? []) {
    expect(isSignInMethodId(row.provider)).toBe(true);
  }
}

async function unknownUserIsNull({
  provider,
}: AuthServerContractHarness): Promise<void> {
  expect(await provider.server.getUser('contract-nobody')).toBeNull();
}

async function signedOutSessionFails(
  harness: AuthServerContractHarness
): Promise<void> {
  const session = await harness.signIn(ALICE);
  await harness.signOut(session);
  expect(
    await harness.provider.server.verifySessionToken(session.token)
  ).toBeNull();
}

async function expiredSessionFails(
  harness: AuthServerContractHarness
): Promise<void> {
  const session = await harness.signIn(ALICE);
  await harness.expireSessions();
  expect(
    await harness.provider.server.verifySessionToken(session.token)
  ).toBeNull();
}

const CASES: readonly ContractCase[] = [
  {
    name: 'reports the module id and only product sign-in methods',
    run: reportsModuleIdAndMethods,
  },
  { name: 'refuses a token it never minted', run: refusesForeignTokens },
  { name: 'verifies a minted session as its user', run: verifiesMintedSession },
  { name: 'keeps two people apart', run: keepsPeopleApart },
  { name: 'signing in again is the same user', run: signingInAgainIsSameUser },
  {
    name: 'reads the user with the identity they signed in with',
    run: readsUserWithIdentity,
  },
  { name: 'an unknown user reads as null', run: unknownUserIsNull },
  {
    name: 'a signed-out session no longer verifies',
    run: signedOutSessionFails,
  },
  { name: 'an expired session no longer verifies', run: expiredSessionFails },
];

async function runCase(
  open: () => Promise<AuthServerContractHarness>,
  contractCase: ContractCase
): Promise<void> {
  const harness = await open();
  try {
    await contractCase.run(harness);
  } finally {
    await harness.close();
  }
}

export function describeAuthServerContract(
  name: string,
  open: () => Promise<AuthServerContractHarness>
): void {
  describe(`${name} satisfies the auth server contract`, () => {
    for (const contractCase of CASES) {
      test(contractCase.name, () => runCase(open, contractCase));
    }
  });
}
