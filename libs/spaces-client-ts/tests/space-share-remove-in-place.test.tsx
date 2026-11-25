/** @jsxImportSource @solidjs/web */
/** Share's Remove asks in the Share dialog itself, never a second dialog on top. */

import { afterEach, expect, test } from 'bun:test';
import { useRemoveSpacePersonStep } from '@libs/spaces-client-ts/remove-space-person-step';
import type { SpacePerson } from '@libs/spaces-client-ts/space-person-view';
import { SpaceShareSheetView } from '@libs/spaces-client-ts/space-share-sheet-view';
import { AVERY, JORDAN } from '@libs/spaces-client-ts/spaces-story.example';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { createSignal, flush } from 'solid-js';

afterEach(cleanup);

function SharingAsHost(): JSX.Element {
  const [removing, setRemoving] = createSignal<SpacePerson | null>(null);
  const removal = useRemoveSpacePersonStep({
    get name() {
      return removing()?.name ?? '';
    },
    onClose: () => setRemoving(null),
    operation: () => Promise.resolve(),
  });
  return (
    <SpaceShareSheetView
      open
      onClose={() => undefined}
      onCopyLink={() => Promise.resolve()}
      canManage
      peopleStatus="ready"
      people={[AVERY, JORDAN]}
      hostId={AVERY.id}
      viewerId={AVERY.id}
      onRemovePerson={(person) => {
        removal.reset();
        setRemoving(person);
      }}
      removal={removing() === null ? undefined : removal}
    />
  );
}

// regression: share-remove-confirm-stacked-dialogs
test('Remove swaps the Share dialog to the confirm, and Cancel brings the list back', () => {
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <SurfaceStackProvider>
          <SharingAsHost />
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  fireEvent.click(screen.getByTestId(Handles.spaceRemovePerson(JORDAN.id)));
  flush();

  // One dialog, one close: the Share dialog itself, now asking.
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getAllByTestId(Handles.spaceShareClose)).toHaveLength(1);
  expect(screen.getByRole('dialog', { name: 'Remove person?' })).toBeDefined();
  expect(screen.getByTestId(Handles.spaceRemoveConfirm)).toBeDefined();
  expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
  expect(screen.getByText(JORDAN.name)).toBeDefined();

  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  flush();
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog', { name: 'Share space' })).toBeDefined();
  expect(
    screen.getByTestId(Handles.spaceRemovePerson(JORDAN.id))
  ).toBeDefined();
});
