import { expect, test } from 'bun:test';
import { createAvatarDraft } from '@libs/profile-client-ts/avatar-draft';
import { createDefaultAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import { createRoot, createSignal, flush } from 'solid-js';

// regression: saved-avatar-still-asks-to-discard
test('leaving after save sees a clean avatar before the profile query refreshes', async () => {
  const original = createDefaultAvatarConfig('original');
  const submitted = { ...original, seed: 'synthetic-harness' };
  const [row, refresh] = createSignal(original);
  const { editor, dispose } = createRoot((dispose) => ({
    editor: createAvatarDraft({
      ready: () => true,
      persisted: row,
      write: async (config) => {
        expect(config).toEqual(submitted);
      },
    }),
    dispose,
  }));
  try {
    flush();
    editor.setDraft(submitted);
    flush();
    expect(editor.dirty()).toBe(true);
    await editor.save();
    flush();
    expect(editor.dirty()).toBe(false);
    editor.setDraft({ ...submitted, seed: 'next edit' });
    refresh(submitted);
    flush();
    expect(editor.dirty()).toBe(true);
    expect(editor.draft().seed).toBe('next edit');
  } finally {
    dispose();
  }
});
