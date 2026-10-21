import { expect } from 'bun:test';
import {
  changeInvestigatedApp,
  checkpointCanRestore,
  checkpointChoices,
  checkpointOperation,
  failCheckpointRestore,
  interruptNextCheckpointSave,
  investigatePeople,
  reopenTestingTool,
  restoredApps,
  restoreFailureOf,
  saveCheckpoint,
  stillBeforeRestore,
  stillKept,
} from '@apps/product-ts/developer-checkpoints';
import { Given, Then, When } from '@libs/harness-ts/define';

Given(
  'the team is investigating a test world with Alice and Bob',
  async (w) => {
    await w.s.apply(investigatePeople);
  }
);
Given(
  'the team has saved checkpoint {string} with Alice and Bob',
  async (w, label: string) => {
    await w.s.apply(investigatePeople);
    await w.s.apply(saveCheckpoint, label);
  }
);
Given('the team has saved checkpoint {string}', async (w, label: string) => {
  await w.s.apply(saveCheckpoint, label);
});
Given('the team has restored checkpoint {string}', async (w, label: string) => {
  await w.s.apply(checkpointOperation, 'restore', label);
});
Given("Alice's test world has changed since that checkpoint", async (w) => {
  await w.s.apply(changeInvestigatedApp);
});
Given(
  'checkpoint {string} cannot be used by this version of the app',
  async (w, label: string) => {
    await w.s.apply(investigatePeople);
    await w.s.apply(saveCheckpoint, label, true);
  }
);
Given(
  'checkpoint {string} can be used by this version of the app',
  async (w, label: string) => {
    await w.s.apply(investigatePeople);
    await w.s.apply(saveCheckpoint, label);
  }
);
Given(
  'the team has selected checkpoint {string} for deletion',
  async (w, label: string) => {
    await w.s.apply(investigatePeople);
    await w.s.apply(saveCheckpoint, label);
    await w.s.apply(checkpointOperation, 'delete', label);
  }
);
When('the team restores checkpoint {string}', async (w, label: string) => {
  await w.s.apply(checkpointOperation, 'restore', label);
});
When('the team selects checkpoint {string}', async (w, label: string) => {
  await w.s.apply(checkpointOperation, 'select', label);
});
When('the team saves checkpoint {string}', async (w, label: string) => {
  await w.s.apply(saveCheckpoint, label);
});
When('saving checkpoint {string} is interrupted', async (w, label: string) => {
  await w.s.apply(interruptNextCheckpointSave);
  await w.s.apply(saveCheckpoint, label).catch(() => undefined);
});
When('the team confirms deleting the selected checkpoints', async (w) => {
  await w.s.apply(checkpointOperation, 'confirm-delete');
});
When('the team cancels deleting the selected checkpoints', async (w) => {
  await w.s.apply(checkpointOperation, 'cancel-delete');
});
When('the team confirms removing incompatible checkpoints', async (w) => {
  await w.s.apply(checkpointOperation, 'purge');
});
When('restoring checkpoint {string} fails', async (w, label: string) => {
  await w.s.apply(failCheckpointRestore, label);
});
Given('the investigated app has changed', async (w) => {
  await w.s.apply(changeInvestigatedApp);
});
Given('the team has deleted checkpoint {string}', async (w, label: string) => {
  await w.s.apply(investigatePeople);
  await w.s.apply(saveCheckpoint, label);
  await w.s.apply(checkpointOperation, 'delete', label);
  await w.s.apply(checkpointOperation, 'confirm-delete');
});
When('the testing tool closes and opens again', async (w) => {
  await w.s.apply(reopenTestingTool);
});
Then(
  'Alice and Bob see the apps saved in checkpoint {string}',
  async (w, label: string) => {
    const apps = await w.s.read(restoredApps, label);
    expect(apps).toHaveLength(2);
    for (const app of apps) expect(app.shown).toBe(app.saved);
  }
);
Then(
  'the team is not offered restoring because the checkpoint is incompatible',
  async (w) => {
    expect(await w.s.read(checkpointCanRestore)).toBe(false);
  }
);
Then('the team can select checkpoint {string}', async (w, label: string) => {
  expect(
    (await w.s.read(checkpointChoices)).some((choice) => choice.label === label)
  ).toBe(true);
});
Then(
  'the team cannot select checkpoint {string} because it was deleted',
  async (w, label: string) => {
    expect(
      (await w.s.read(checkpointChoices)).some(
        (choice) => choice.label === label
      )
    ).toBe(false);
  }
);
Then(
  'the team cannot select checkpoint {string} because it was not saved',
  async (w, label: string) => {
    expect(
      (await w.s.read(checkpointChoices)).some(
        (choice) => choice.label === label
      )
    ).toBe(false);
  }
);
Then('the team is told the restore failed', async (w) => {
  expect(await w.s.read(restoreFailureOf)).toBe('failed');
});
Then(
  'Alice and Bob are still on the apps they had before the restore',
  async (w) => {
    expect(await w.s.read(stillBeforeRestore)).toBe(true);
  }
);
Then('Alice and Bob see the apps the testing tool kept', async (w) => {
  expect(await w.s.read(stillKept)).toBe(true);
});
Then(
  'the team cannot select checkpoint {string} because it was removed',
  async (w, label: string) => {
    expect(
      (await w.s.read(checkpointChoices)).some(
        (choice) => choice.label === label
      )
    ).toBe(false);
  }
);
