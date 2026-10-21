import { expect } from 'bun:test';
import { restoreActorConnection } from '@libs/harness-ts/actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import type { Actor } from '@libs/harness-ts/parameter-types';
import {
  cutConnection,
  notePhoneOffline,
  otherDevice,
} from '@libs/harness-ts/platform';
import { openAccount } from '@libs/harness-ts/shell-actions';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  recall,
  remember,
  signedInAccountKey,
} from '@libs/harness-ts/spec-world';
import {
  askForExport,
  cancelDeletion,
  confirmDeletion,
  openPrivacy,
  privacyTimePasses,
  proveAccount,
  reviewDeletion,
} from './privacy-actions';
import {
  anyPrivacyNotice,
  privacyNotice,
  privacyStatus,
  privacyText,
} from './privacy-reads';

/** A stored timestamp shown as it is stored (ISO text or epoch digits). */
const RAW_DATE = /\d{4}-\d{2}-\d{2}|\d{10,}/;
/** A date as a person reads it in English, such as "Nov 19, 2026". */
const READABLE_DATE = /[A-Z][a-z]+ \d{1,2}, \d{4}/;

async function recentAccount(w: HarnessWorld, actor: Actor) {
  await w.s.apply(proveAccount, actor);
  remember(
    w,
    signedInAccountKey(actor),
    await w.s.read(signedInAccountOf, actor)
  );
}

export type PrivacySetupWorld = HarnessWorld & {
  readonly beforeAccountDeletion?: (
    actor: Actor,
    completion: 'confirmed' | 'completed'
  ) => Promise<void>;
  readonly beforePhoneOffline?: (actor: Actor) => Promise<void>;
};

async function confirmedAccount(
  w: PrivacySetupWorld,
  actor: Actor,
  completion: 'confirmed' | 'completed' = 'confirmed'
) {
  await w.beforeAccountDeletion?.(actor, completion);
  await recentAccount(w, actor);
  await w.s.apply(confirmDeletion, actor);
}

async function reviewed(w: HarnessWorld, actor: Actor) {
  if ((await w.s.read(signedInAccountOf, actor)) === null)
    await recentAccount(w, actor);
  remember(
    w,
    signedInAccountKey(actor),
    await w.s.read(signedInAccountOf, actor)
  );
  await w.s.apply(openPrivacy, actor);
}

Given('{actor} has a recently proven account', recentAccount);
Given(
  '{actor} completed signing in more than 10 minutes ago',
  async (w, actor: Actor) => {
    await recentAccount(w, actor);
    await w.s.advanceTime(600_001);
  }
);
Given(
  '{actor} completed signing in exactly 10 minutes ago',
  async (w, actor: Actor) => {
    await recentAccount(w, actor);
    await w.s.advanceTime(600_000);
  }
);
Given(
  '{actor} has reviewed the consequences of account deletion',
  async (w, actor: Actor) => {
    await reviewed(w, actor);
    await w.s.apply(reviewDeletion, actor);
  }
);
Given('{actor} is reviewing account deletion', reviewed);

When('{actor} confirms account deletion', async (w, actor: Actor) => {
  await w.s.apply(confirmDeletion, actor);
});
When('{actor} cancels account deletion', async (w, actor: Actor) => {
  await w.s.apply(cancelDeletion, actor);
});
When('{actor} asks for account deletion', async (w, actor: Actor) => {
  await w.s.apply(reviewDeletion, actor);
});
When('{actor} reviews account deletion', async (w, actor: Actor) => {
  await w.s.apply(openPrivacy, actor);
});
When('{actor} opens the retention explanation', async (w, actor: Actor) => {
  await w.s.apply(openPrivacy, actor);
});
When('{actor} asks for a personal-data export', async (w, actor: Actor) => {
  await w.s.apply(askForExport, actor);
});

Then(
  "{actor}'s account deletion is acknowledged with its completion deadline",
  async (w, actor: Actor) => {
    await w.s.apply(openPrivacy, actor);
    const outcome = await w.s.read(
      privacyText,
      actor,
      'privacy-deletion-outcome'
    );
    expect(outcome).toContain('complete by');
    // regression: privacy-dates-raw-iso
    expect(outcome).not.toMatch(RAW_DATE);
    expect(outcome).toMatch(READABLE_DATE);
    const state = await w.s.read(
      privacyStatus,
      String(recall(w, signedInAccountKey(actor)))
    );
    expect(state.eraseBy).not.toBeNull();
  }
);
Then(
  '{actor} still has the same account because deletion was not confirmed',
  async (w, actor: Actor) => {
    expect(await w.s.read(signedInAccountOf, actor)).toBe(
      String(recall(w, signedInAccountKey(actor)))
    );
  }
);
Then('{actor} still has the same account', async (w, actor: Actor) => {
  expect(await w.s.read(signedInAccountOf, actor)).toBe(
    String(recall(w, signedInAccountKey(actor)))
  );
});
Then(
  '{actor} is told to prove the account again before deletion',
  async (w, actor: Actor) => {
    // regression: deletion-permission-notice-hidden-by-dialog
    expect(
      await w.s.read(privacyNotice, actor, 'privacy-delete-denial')
    ).toContain('Prove the account again');
  }
);
Given(
  '{actor} has kept the deletion confirmation open for {int} minutes',
  async (w, actor: Actor, minutes: number) => {
    expect(
      await w.s.read(privacyText, actor, 'privacy-delete-modal')
    ).not.toBeNull();
    await w.s.advanceTime(minutes * 60_000);
  }
);
Then(
  '{actor} is told export and deletion need a sign-in from the last {int} minutes',
  async (w, actor: Actor, minutes: number) => {
    expect(
      await w.s.read(anyPrivacyNotice, actor, [
        'privacy-delete-denial',
        'privacy-export-denial',
      ])
    ).toContain(`last ${minutes} minutes`);
  }
);
Then(
  '{actor} sees that Plus ends at once without refunding the remaining paid time or Plus credit',
  async (w, actor: Actor) => {
    const text = await w.s.read(privacyText, actor, 'privacy-consequences');
    expect(text).toContain('Plus ends at once');
    expect(text).toContain(
      'remaining paid time and Plus credit are not refunded'
    );
  }
);
Then(
  '{actor} is asked to confirm that Plus ends at once without refunding the remaining paid time or Plus credit',
  async (w, actor: Actor) => {
    // regression: deletion-omits-plus-loss
    const text = await w.s.read(privacyText, actor, 'privacy-delete-modal');
    expect(text).toContain('Plus ends at once');
    expect(text).toContain(
      'remaining paid time and Plus credit are not refunded'
    );
  }
);
When('{actor} opens account settings', async (w, actor: Actor) => {
  await w.s.apply(openAccount, actor);
});
Then(
  '{actor} is offered personal-data export and account deletion there',
  async (w, actor: Actor) => {
    const text = await w.s.read(privacyText, actor, 'account-privacy');
    expect(text).toContain('export');
    expect(text).toContain('delete');
  }
);
Then(
  '{actor} is asked to sign in because deletion needs an account',
  async (w, actor: Actor) => {
    expect(
      await w.s.read(privacyText, actor, 'privacy-delete-denial')
    ).toContain('Sign in');
  }
);
Then(
  '{actor} is told account deletion needs a connection',
  async (w, actor: Actor) => {
    expect(
      await w.s.read(privacyText, actor, 'privacy-delete-denial')
    ).toContain('needs a connection');
  }
);
Then(
  '{actor} sees that account deletion is permanent and signs out every device',
  async (w, actor: Actor) => {
    const text = await w.s.read(privacyText, actor, 'privacy-consequences');
    expect(text).toContain('permanent');
    expect(text).toContain('Every device');
  }
);
Then(
  '{actor} sees the personal-data export choice and the retention exceptions',
  async (w, actor: Actor) => {
    const text = await w.s.read(privacyText, actor, 'privacy-consequences');
    expect(text).toContain('personal-data export');
    expect(text).toContain('7 years');
  }
);
Then(
  '{actor} sees that hosted spaces and future membership charges will end',
  async (w, actor: Actor) => {
    const text = await w.s.read(privacyText, actor, 'privacy-consequences');
    expect(text).toContain('Hosted spaces will end');
    expect(text).toContain('Future membership charges will stop');
  }
);
Then(
  '{actor} sees the minimum payment records kept for accounting and disputes',
  async (w, actor: Actor) => {
    expect(await w.s.read(privacyText, actor, 'privacy-retention')).toContain(
      'minimum payment evidence for accounting and disputes for 7 years'
    );
  }
);
Then(
  '{actor} sees any specific legal preservation obligation and its end condition',
  async (w, actor: Actor) => {
    expect(await w.s.read(privacyText, actor, 'privacy-retention')).toContain(
      'until that obligation ends'
    );
  }
);
Then(
  '{actor} sees that the export is being prepared',
  async (w, actor: Actor) => {
    await w.s.until((s) => privacyText(s, actor, 'privacy-export-preparing'), {
      pred: (text) => text !== null,
      maxMs: 10_000,
    });
  }
);
Then('{actor} sees when it must be ready', async (w, actor: Actor) => {
  const deadline = await w.s.read(
    privacyText,
    actor,
    'privacy-export-deadline'
  );
  expect(deadline).toContain('Ready by');
  // regression: privacy-dates-raw-iso
  expect(deadline).not.toMatch(RAW_DATE);
  expect(deadline).toMatch(READABLE_DATE);
});
Then(
  '{actor} is told to prove the account again before exporting personal data',
  async (w, actor: Actor) => {
    expect(
      await w.s.read(privacyText, actor, 'privacy-export-denial')
    ).toContain('Prove the account again');
  }
);
Then(
  '{actor} is told the personal-data export needs a connection',
  async (w, actor: Actor) => {
    expect(
      await w.s.read(privacyText, actor, 'privacy-export-denial')
    ).toContain('needs a connection');
  }
);

Given(
  "{actor}'s account deletion has been confirmed",
  async (w, actor: Actor) => confirmedAccount(w, actor)
);
Given("{actor}'s account deletion has completed", async (w, actor: Actor) => {
  await confirmedAccount(w, actor, 'completed');
  await w.s.apply(privacyTimePasses, 30 * 86_400_000);
});
Given(
  "{actor}'s account deletion has been confirmed on another device",
  async (w, actor: Actor) => {
    // Already signed in (perhaps offline): keep that device as it is.
    const account = await w.s.read(signedInAccountOf, actor);
    if (account === null) await recentAccount(w, actor);
    else remember(w, signedInAccountKey(actor), account);
    await w.s.apply(proveAccount, otherDevice(actor), actor);
    await w.s.apply(confirmDeletion, otherDevice(actor));
  }
);
Then('{actor} has a new account', async (w, actor: Actor) => {
  const account = await w.s.read(signedInAccountOf, actor);
  expect(account).not.toBeNull();
  expect(account).not.toBe(recall(w, signedInAccountKey(actor)));
});
Then(
  "{actor}'s deleted personal data cannot be recovered by that sign-in",
  async (w, actor: Actor) => {
    const account = await w.s.read(signedInAccountOf, actor);
    expect(account).not.toBe(recall(w, signedInAccountKey(actor)));
    expect(
      (
        await w.s.read(
          privacyStatus,
          String(recall(w, signedInAccountKey(actor)))
        )
      ).deletion
    ).toBe('Deleted');
  }
);

Given("{actor}'s phone is offline", async (w, actor: Actor) => {
  await (w as PrivacySetupWorld).beforePhoneOffline?.(actor);
  await notePhoneOffline(w, actor);
  await cutConnection(w, actor);
});
When("{actor}'s phone comes back online", async (w, actor: Actor) => {
  await w.s.apply(restoreActorConnection, actor);
  await w.s.advanceTime(150_000);
});
Then("{actor}'s phone is signed out", async (w, actor: Actor) => {
  expect(await w.s.read(signedInAccountOf, actor)).toBeNull();
});
Then(
  "{actor}'s other device cannot make changes as the deleted account",
  async (w, actor: Actor) => {
    expect(await w.s.read(signedInAccountOf, otherDevice(actor))).toBeNull();
  }
);
Then(
  "{actor}'s phone cannot restore the deleted account's personal data",
  async (w, actor: Actor) => {
    expect(await w.s.read(signedInAccountOf, actor)).toBeNull();
    expect(
      (
        await w.s.read(
          privacyStatus,
          String(recall(w, signedInAccountKey(actor)))
        )
      ).deletion
    ).toBe('Deleting');
  }
);
