import { expect } from 'bun:test';
import {
  numberlinkDefinitionUnchanged,
  numberlinkEmpty,
  numberlinkPairConnected,
  numberlinkPath,
  numberlinkPathsUnchanged,
  numberlinkRefusal,
  numberlinkStatus,
} from '@libs/numberlink-harness-ts/numberlink-observations';
import {
  arrangeNumberlinkPath,
  clearNumberlink,
  drawNumberlinkPath,
  openNumberlink,
  removeNumberlinkPath,
} from '@libs/numberlink-harness-ts/numberlink-system';
import { Given, Then, When } from './world';

Given('Alice has the Numberlink puzzle {string}', async (w, name: string) => {
  await w.run.apply(openNumberlink, name);
});

Given(
  'Alice has drawn Numberlink pair {string} through {string}',
  async (w, label: string, path: string) => {
    await w.run.apply(arrangeNumberlinkPath, label, path);
  }
);

When(
  'Alice draws Numberlink pair {string} through {string}',
  async (w, label: string, path: string) => {
    await w.run.apply(drawNumberlinkPath, label, path);
  }
);

When('Alice removes Numberlink path {string}', async (w, label: string) => {
  await w.run.apply(removeNumberlinkPath, label);
});

When('Alice clears the Numberlink board', async (w) => {
  await w.run.apply(clearNumberlink);
});

Then('Numberlink pair {string} is connected', async (w, label: string) => {
  expect(await w.run.read(numberlinkPairConnected, label)).toBe(true);
});

Then(
  'Numberlink pair {string} has the path {string}',
  async (w, label: string, path: string) => {
    expect(await w.run.read(numberlinkPath, label)).toBe(path);
  }
);

Then('Numberlink pair {string} has no path', async (w, label: string) => {
  expect(await w.run.read(numberlinkPath, label)).toBeNull();
});

Then('Numberlink is complete', async (w) => {
  expect((await w.run.read(numberlinkStatus)).complete).toBe(true);
});

Then('Numberlink is unfinished', async (w) => {
  expect((await w.run.read(numberlinkStatus)).complete).toBe(false);
});

Then('Numberlink is unfinished because cells remain uncovered', async (w) => {
  const status = await w.run.read(numberlinkStatus);
  expect(status.complete).toBe(false);
  expect(status.pairsConnected).toBe(status.pairsTotal);
  expect(status.uncovered).toBeGreaterThan(0);
});

Then('the Numberlink paths are unchanged', async (w) => {
  expect(await w.run.read(numberlinkPathsUnchanged)).toBe(true);
});

Then('every Numberlink path is removed', async (w) => {
  expect(await w.run.read(numberlinkEmpty)).toBe(true);
});

Then('the Numberlink endpoints and coverage are unchanged', async (w) => {
  expect(await w.run.read(numberlinkDefinitionUnchanged)).toBe(true);
});

Then(
  'Alice is told to start the Numberlink path at a matching endpoint',
  async (w) => {
    expect(await w.run.read(numberlinkRefusal)).toBe('start_at_endpoint');
  }
);

Then(
  'Alice is told to join neighboring Numberlink cells horizontally or vertically',
  async (w) => {
    expect(await w.run.read(numberlinkRefusal)).toBe('path_gap');
  }
);

Then('Alice is told Numberlink paths cannot cross or overlap', async (w) => {
  expect(await w.run.read(numberlinkRefusal)).toBe('path_collision');
});

Then(
  'Alice is told that Numberlink endpoint belongs to another pair',
  async (w) => {
    expect(await w.run.read(numberlinkRefusal)).toBe('other_endpoint');
  }
);

Then(
  'Alice is told to stop the Numberlink path at its matching endpoint',
  async (w) => {
    expect(await w.run.read(numberlinkRefusal)).toBe('past_endpoint');
  }
);
