import { expect, test } from 'bun:test';
import { harnessEmulators } from '@libs/harness-ts/emulators';
import {
  createHarnessIdps,
  harnessAppleClientKeys,
} from '@libs/harness-ts/idp';
import { createHarnessLlm } from '@libs/harness-ts/mockingbird-llm';
import { createHarnessObjectStore } from '@libs/harness-ts/mockingbird-object-store';

const clock = { now: () => 1_700_000_000_000 };

test('every vendor emulator is listed and answers its own administration', async () => {
  const idps = createHarnessIdps({
    clock,
    appleKeys: await harnessAppleClientKeys(),
    toApi: () => async () => new Response(null, { status: 204 }),
  });
  const emulators = harnessEmulators({
    idps,
    billing: null,
    shared: [
      createHarnessObjectStore(clock).emulator,
      createHarnessLlm({ clock }).emulator,
    ],
  });
  expect(emulators.map((emulator) => emulator.id)).toEqual([
    'google',
    'apple',
    's3',
    'openai',
  ]);
  for (const emulator of emulators) {
    // What a dashboard reads first; the language model's asks for a key,
    // which the operator's access supplies.
    const state = await emulator.fetch(`${emulator.origin}/__admin/state`);
    expect([emulator.id, state.status]).toEqual([emulator.id, 200]);
    const page = await emulator.fetch(`${emulator.origin}/__admin/ui`);
    expect(page.headers.get('content-type')).toContain('text/html');
  }
});
