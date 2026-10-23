import '@pkgs/bun-test-solid-client-ts/preload';
import { openHarness } from '@libs/harness-ts/open-harness';
import { useHarnessWorld } from '@libs/harness-ts/spec-world';
import { APP_COMPOSITION } from '@libs/runtime-harness-ts/app-composition';

const NOTEBOOK_ACTIONS = [
  saveNotebookQuestion,
  openNotebook,
  editNotebookQuestion,
];
const TOOLS_SYSTEM = defineProductSystem({
  ...APP_COMPOSITION,
  name: 'developer-tools',
  actions: [
    ...(APP_COMPOSITION.actions ?? []),
    ...NOTEBOOK_ACTIONS,
    provideReleaseEvidence,
    runReleaseCheck,
    investigatePeople,
    saveCheckpoint,
    changeInvestigatedApp,
    checkpointOperation,
    provideWorldDevices,
    giveDevicesDifferentPlaces,
    chooseWorldDevice,
    arrangeWorldDevices,
  ],
});
export const openDeveloperHarness = (
  testId: string,
  options?: Parameters<typeof openHarness>[2]
) => openHarness(TOOLS_SYSTEM, testId, options);

useHarnessWorld(openDeveloperHarness, undefined, (ctx) =>
  ctx.featureUri.startsWith('specs/developer-tools/')
);

import { defineProductSystem } from '@libs/harness-ts/define-product-system';
import './notebook.steps';
import {
  editNotebookQuestion,
  openNotebook,
  saveNotebookQuestion,
} from '@apps/product-ts/developer-notebook';

import './release-check.steps';
import {
  provideReleaseEvidence,
  runReleaseCheck,
} from '@apps/product-ts/developer-release';

import './checkpoints.steps';
import {
  changeInvestigatedApp,
  checkpointOperation,
  investigatePeople,
  saveCheckpoint,
} from '@apps/product-ts/developer-checkpoints';

import './test-world-views.steps';
import {
  arrangeWorldDevices,
  chooseWorldDevice,
  giveDevicesDifferentPlaces,
  provideWorldDevices,
} from '@apps/product-ts/developer-world-views';
