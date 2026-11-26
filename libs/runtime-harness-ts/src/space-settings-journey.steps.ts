import { Handles } from '@libs/test-ids-shared-ts/handles';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import { expectVisible, JOURNEY_WAIT_MS, tap } from './journey-gestures';
import type { JourneyWorld } from './journey-types';

const { When, Then } = stepsFor<JourneyWorld>();
const tab = (section: 'general' | 'people' | 'sharing'): string =>
  `${Handles.spaceManagementTabs}-${section}`;

When('Alice opens the people in her space', (w) =>
  w.journey.act('showPeople', async (ui) => {
    await tap(ui, Handles.spaceMembersButton);
    await expectVisible(ui, Handles.spaceMembersClose);
    await expectVisible(ui, tab('sharing'));
  })
);

Then('Alice can share the space link from the same place', (w) =>
  w.journey.act('showPeopleSharing', async (ui) => {
    await tap(ui, tab('sharing'));
    await expectVisible(ui, Handles.spaceCopyLink);
  })
);

When('Alice opens her space settings', (w) =>
  w.journey.act('showSpaceSettings', async (ui) => {
    await tap(ui, Handles.spaceShareClose);
    await tap(ui, Handles.spaceSettings);
    await expectVisible(ui, Handles.spaceRename);
  })
);

Then('Alice can change the space name and manage its people and sharing', (w) =>
  w.journey.act('manageSpace', async (ui) => {
    await tap(ui, tab('people'));
    await expectVisible(ui, Handles.spaceMembersClose);
    await tap(ui, tab('sharing'));
    await expectVisible(ui, Handles.spaceCopyLink);
    await expectVisible(ui, Handles.searchDenied);
    await tap(ui, tab('general'));
    await tap(ui, Handles.spaceRename);
    const input = ui.get(Handles.spaceRenameInput);
    await input.clear();
    await input.input('Quoridor club');
    await tap(ui, Handles.spaceRenameConfirm);
    await tap(ui, Handles.spaceMutationDismiss);
    await ui
      .get(Handles.spaceSettingsName)
      .expect.text('Quoridor club', { timeoutMs: JOURNEY_WAIT_MS });
  })
);

When('Alice returns from settings to her board', (w) =>
  w.journey.act('closeSpaceSettings', (ui) =>
    tap(ui, Handles.spaceMembersClose)
  )
);
