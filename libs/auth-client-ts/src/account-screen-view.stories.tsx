import { Handles } from '@libs/test-ids-shared-ts/handles';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { AccountScreenView } from './account-screen-view';
import type { SignInMethodsView } from './sign-in-methods-section';
import type { LinkedIdentity } from './use-linked-identities';

const GOOGLE: LinkedIdentity = {
  provider: 'google',
  email: 'avery@example.com',
  emailVerified: true,
  isPrivateEmail: false,
  emailForwarding: true,
};

const APPLE_HIDDEN: LinkedIdentity = {
  provider: 'apple',
  email: 'x7k2p9q4mz@privaterelay.appleid.com',
  emailVerified: true,
  isPrivateEmail: true,
  emailForwarding: true,
};

/** Google linked, Apple enabled but not connected. */
const ONE_METHOD: SignInMethodsView = {
  status: 'ready',
  syncFailed: false,
  identities: [GOOGLE],
  providers: ['google', 'apple'],
};

function methods(patch: Partial<SignInMethodsView>): SignInMethodsView {
  return { ...ONE_METHOD, ...patch };
}

const meta = {
  id: 'screens-account',
  title: 'Screens/Account/Account',
  component: AccountScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['identity', 'methods'] },
  },
  args: {
    signedIn: true,
    methods: ONE_METHOD,
    removingMethod: null,
    signingOutEverywhere: false,
    onOpenDevices: fn(),
    onOpenPrivacy: fn(),
    onOpenDeletion: fn(),
    onSignIn: fn(),
    onSignOut: fn(),
    onConnectMethod: fn(async () => undefined),
    onRemoveMethod: fn(),
    onCancelRemoveMethod: fn(),
    onConfirmRemoveMethod: fn(async () => undefined),
    onSignOutEverywhere: fn(),
    onCancelSignOutEverywhere: fn(),
    onConfirmSignOutEverywhere: fn(async () => undefined),
  },
} satisfies Meta<typeof AccountScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Signed in with one method: it cannot be removed; Apple can be connected. */
export const SignedIn: Story = {};

/** A guest: no methods or privacy entry, just devices and Sign in. */
export const Anonymous: Story = { args: { signedIn: false } };

/** The linked methods are still being read from this device's copy. */
export const MethodsLoading: Story = {
  args: { methods: methods({ status: 'loading', identities: [] }) },
};

/** The first sync failed: methods may be missing, and the notice says so. */
export const MethodsSyncFailed: Story = {
  args: { methods: methods({ syncFailed: true }) },
};

/** Two methods: either can be removed; Apple shares a hidden relay address. */
export const BothProvidersLinked: Story = {
  args: { methods: methods({ identities: [GOOGLE, APPLE_HIDDEN] }) },
};

/** Apple's hidden address with forwarding turned off says so instead. */
export const HiddenEmailForwardingOff: Story = {
  args: {
    methods: methods({
      identities: [GOOGLE, { ...APPLE_HIDDEN, emailForwarding: false }],
    }),
  },
};

/** Apple is not enabled on the server and not linked: it is not offered. */
export const AppleNotOffered: Story = {
  args: { methods: methods({ providers: ['google'] }) },
};

/** A Synthetic User's account signs in by emailed link. */
export const EmailMethod: Story = {
  args: {
    methods: methods({
      identities: [
        {
          provider: 'email',
          email: 'synthetic-user-0042@example.test',
          emailVerified: true,
          isPrivateEmail: false,
          emailForwarding: true,
        },
        GOOGLE,
      ],
    }),
  },
};

/** Removing a method is confirm-first. */
export const ConfirmRemoveMethod: Story = {
  args: {
    methods: methods({ identities: [GOOGLE, APPLE_HIDDEN] }),
    removingMethod: 'apple',
  },
};

/** Signing out of every device is confirm-first. */
export const ConfirmSignOutEverywhere: Story = {
  args: { signingOutEverywhere: true },
};

/** Long addresses truncate instead of pushing the row's action off. */
export const LongEmail: Story = {
  args: {
    methods: methods({
      identities: [
        {
          ...GOOGLE,
          email:
            'a.really.long.email.address.that.keeps.going@subdomain.example.com',
        },
      ],
    }),
  },
};

/** A failed connect says why under the row's caption; the row keeps its shape. */
export const ConnectFailed: Story = {
  args: {
    onConnectMethod: fn(async () => {
      throw new Error("Couldn't reach Apple. Try again in a moment.");
    }),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId(Handles.accountLinkProvider('apple'))
    );
    await expect(args.onConnectMethod).toHaveBeenCalledWith('apple');
    await expect(await canvas.findByRole('alert')).toHaveTextContent(
      "Couldn't reach Apple. Try again in a moment."
    );
  },
};
