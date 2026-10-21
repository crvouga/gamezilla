import { expect, test } from 'bun:test';
import { SpaceOpenSessionStore } from '@libs/spaces-shared-ts/space-open-session-store';

test('independent app roots retain independent space session identities', () => {
  // regression: space-session-identities-cross-app-roots
  const first = new SpaceOpenSessionStore(() => 'first-tab');
  const second = new SpaceOpenSessionStore(() => 'second-tab');
  expect(first.getOrCreate('shared-space', 'same-install')).toBe('first-tab');
  expect(second.getOrCreate('shared-space', 'same-install')).toBe('second-tab');
  expect(first.getOrCreate('shared-space', 'same-install')).toBe('first-tab');
});
