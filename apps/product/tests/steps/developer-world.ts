import '@pkgs/bun-test-solid-client/preload';
import { openHarness } from '@libs/harness/open-harness';
import { useHarnessWorld } from '@libs/harness/spec-world';
import { APP_COMPOSITION } from '@libs/runtime-harness/app-composition';

const NOTEBOOK_ACTIONS = [
  saveNotebookQuestion,
  openNotebook,
  editNotebookQuestion,
];
const REPORT_ACTIONS = [
  provideRecordedReport,
  selectRecordedMoment,
  moveRecordedMoment,
  showRecordedControl,
];
const TOOLS_SYSTEM = defineProductSystem({
  ...APP_COMPOSITION,
  name: 'developer-tools',
  actions: [
    ...(APP_COMPOSITION.actions ?? []),
    ...NOTEBOOK_ACTIONS,
    ...REPORT_ACTIONS,
    provideReleaseEvidence,
    runReleaseCheck,
    investigatePeople,
    saveCheckpoint,
    changeInvestigatedApp,
    checkpointOperation,
    provideCatalog,
    openCatalog,
    filterCatalog,
    openCompletedReport,
    provideWorldDevices,
    giveDevicesDifferentPlaces,
    chooseWorldDevice,
    arrangeWorldDevices,
  ],
});
useHarnessWorld(
  (testId, options) => openHarness(TOOLS_SYSTEM, testId, options),
  undefined,
  (ctx) => ctx.featureUri.startsWith('specs/developer-tools/')
);

import { defineProductSystem } from '@libs/harness/define-product-system';
import './notebook.steps';
import './recorded-moments.steps';
import './report-navigation.steps';
import {
  editNotebookQuestion,
  openNotebook,
  saveNotebookQuestion,
} from '@apps/product/developer-notebook';
import {
  moveRecordedMoment,
  provideRecordedReport,
  selectRecordedMoment,
  showRecordedControl,
} from '@apps/product/developer-report';

import './release-check.steps';
import {
  provideReleaseEvidence,
  runReleaseCheck,
} from '@apps/product/developer-release';

import './checkpoints.steps';
import {
  changeInvestigatedApp,
  checkpointOperation,
  investigatePeople,
  saveCheckpoint,
} from '@apps/product/developer-checkpoints';

import './report-catalog.steps';
import {
  filterCatalog,
  openCatalog,
  openCompletedReport,
  provideCatalog,
} from '@apps/product/developer-catalog';

import './test-world-views.steps';
import {
  arrangeWorldDevices,
  chooseWorldDevice,
  giveDevicesDifferentPlaces,
  provideWorldDevices,
} from '@apps/product/developer-world-views';
