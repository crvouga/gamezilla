import { expect } from 'bun:test';
import {
  askForExport,
  completeExport,
  openExportAddress,
  openPrivacy,
  privacyTimePasses,
  proveAccount,
} from '@libs/account-privacy/harness/privacy-actions';
import {
  downloadedExport,
  exportCategories,
  privacyText,
} from '@libs/account-privacy/harness/privacy-reads';
import { signedInAccountOf } from '@libs/harness';
import { type Actor, Given, Then, When } from '@libs/harness/spec/define';
import {
  type HarnessWorld,
  recall,
  remember,
  signedInAccountKey,
} from '@libs/harness/spec/world';

async function request(w: HarnessWorld, actor: Actor) {
  if ((await w.s.read(signedInAccountOf, actor)) === null)
    await w.s.apply(proveAccount, actor);
  remember(
    w,
    signedInAccountKey(actor),
    await w.s.read(signedInAccountOf, actor)
  );
  await w.s.apply(askForExport, actor);
}

async function ready(w: HarnessWorld, actor: Actor) {
  await request(w, actor);
  await w.s.apply(completeExport, actor);
}

Given('{actor} has asked for a personal-data export', request);
Given("{actor}'s personal-data export is ready", ready);
Given(
  '{actor} and {actor} have separate accounts with personal data',
  async (w, first: Actor, second: Actor) => {
    await w.s.apply(proveAccount, second);
    remember(
      w,
      signedInAccountKey(second),
      await w.s.read(signedInAccountOf, second)
    );
    await request(w, first);
  }
);
Given(
  "{actor}'s personal-data export has been ready for {int} days",
  async (w, actor: Actor, days: number) => {
    await ready(w, actor);
    await w.s.apply(privacyTimePasses, days * 86_400_000);
    await w.s.apply(proveAccount, actor);
    await w.s.apply(openPrivacy, actor);
  }
);
When(
  "{actor}'s personal-data export becomes ready",
  async (w, actor: Actor) => {
    await w.s.apply(completeExport, actor);
  }
);
When("{actor}'s personal-data export fails", async (w, actor: Actor) => {
  await w.s.apply(completeExport, actor, true);
});
When('{actor} downloads the personal-data export', async (w, actor: Actor) => {
  await w.s.apply(openPrivacy, actor);
});
When(
  "{actor} opens {actor}'s personal-data export address",
  async (w, actor: Actor, owner: Actor) => {
    await w.s.apply(
      openExportAddress,
      actor,
      String(recall(w, signedInAccountKey(owner)))
    );
  }
);
Then(
  '{actor} can download a readable summary and reusable detail within {int} hours of asking',
  async (w, actor: Actor, hours: number) => {
    const data = await w.s.until((s) => downloadedExport(s, actor), {
      pred: (value) => value !== null,
      maxMs: 10_000,
    });
    expect(data).not.toBeNull();
    expect(data?.export_summary).toContain('Personal data');
    expect(
      (JSON.parse(data?.export_detail ?? '{}') as { accountId: string })
        .accountId
    ).toBe(String(recall(w, signedInAccountKey(actor))));
    expect(
      Date.parse(data?.ready_at ?? '') - Date.parse(data?.requested_at ?? '')
    ).toBeLessThanOrEqual(hours * 3_600_000);
  }
);
Then(
  "the export includes every category of {actor}'s retained personal data",
  async (w, actor: Actor) => {
    const data = await w.s.read(downloadedExport, actor);
    const categories = (
      JSON.parse(data?.export_detail ?? '{}') as {
        categories: Record<string, unknown>;
      }
    ).categories;
    expect(Object.keys(categories).sort()).toEqual(
      (await w.s.read(exportCategories)).sort()
    );
  }
);
Then(
  "{actor}'s private personal data cannot appear in {actor}'s export",
  async (w, other: Actor, owner: Actor) => {
    const data = await w.s.until((s) => downloadedExport(s, owner), {
      pred: (value) => value !== null,
      maxMs: 10_000,
    });
    expect(data?.export_detail).not.toContain(
      String(recall(w, signedInAccountKey(other)))
    );
  }
);
Then(
  '{actor} is told the export failed and can ask again',
  async (w, actor: Actor) => {
    expect(
      await w.s.read(privacyText, actor, 'privacy-export-failed')
    ).toContain('You can ask again');
  }
);
Then(
  '{actor} is not offered an incomplete export as a complete answer',
  async (w, actor: Actor) => {
    expect(await w.s.read(downloadedExport, actor)).toBeNull();
  }
);
Then('{actor} receives her personal-data export', async (w, actor: Actor) => {
  expect(
    await w.s.until((s) => downloadedExport(s, actor), {
      pred: (value) => value !== null,
      maxMs: 10_000,
    })
  ).not.toBeNull();
});
Then(
  '{actor} cannot download it because the export belongs to {actor}',
  async (w, actor: Actor, _owner: Actor) => {
    expect(
      await w.s.read(privacyText, actor, 'privacy-export-owner-denial')
    ).toContain('belongs to another account');
    expect(await w.s.read(downloadedExport, actor)).toBeNull();
  }
);
Then(
  '{actor} is told the export has expired and can ask for a new one',
  async (w, actor: Actor) => {
    expect(
      await w.s.read(privacyText, actor, 'privacy-export-expired')
    ).toContain('expired');
  }
);
Then(
  '{actor} cannot download that export because the account has been deleted',
  async (w, actor: Actor) => {
    expect(await w.s.read(downloadedExport, actor)).toBeNull();
    expect(
      await w.s.read(privacyText, actor, 'privacy-deletion-outcome')
    ).toContain('confirmed');
  }
);
