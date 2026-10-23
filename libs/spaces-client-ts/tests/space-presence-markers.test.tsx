import { afterEach, expect, test } from 'bun:test';
import { SpacePresenceMarkers } from '@libs/spaces-client-ts/space-presence-markers';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { cleanup, render } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

test('idle presence observations stay hidden and update without rendering badges', () => {
  // regression: space-idle-probe-visible
  const memberId = '0b140341-7634-469b-9768-68f0475df42d';
  const [idle, setIdle] = createSignal([memberId]);
  const { container } = render(() => (
    <SpacePresenceMarkers activity="120000" people={[memberId]} idle={idle()} />
  ));
  const marker = container.querySelector(
    `[data-testid="${Handles.spaceMemberIdle(memberId)}"]`
  );
  expect(marker?.textContent).toBe('1');
  expect(marker?.closest('[hidden][aria-hidden="true"]')).not.toBeNull();
  expect(container.querySelector('[data-component="Badge"]')).toBeNull();
  expect(container.textContent).not.toContain('Idle');
  expect(
    container.querySelector(`[data-testid="${Handles.spacePerson(memberId)}"]`)
      ?.textContent
  ).toBe('1');
  setIdle([]);
  expect(
    container.querySelector(
      `[data-testid="${Handles.spaceMemberIdle(memberId)}"]`
    )
  ).toBeNull();
});
