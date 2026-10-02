import '@pkgs/bun-test-solid/preload';
import { openHarness } from '@libs/harness/open-harness/open-harness';
import { useHarnessWorld } from '@libs/harness/spec/world';
import { APP_COMPOSITION } from '@libs/runtime/harness/app-composition';

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

import { defineProductSystem } from '@libs/harness/system/define-product-system';
import './notebook.steps';
import './recorded-moments.steps';
import './report-navigation.steps';
import {
  editNotebookQuestion,
  openNotebook,
  saveNotebookQuestion,
} from '@apps/product/harness/developer-notebook';
import {
  moveRecordedMoment,
  provideRecordedReport,
  selectRecordedMoment,
  showRecordedControl,
} from '@apps/product/harness/developer-report';

import './release-check.steps';
import {
  provideReleaseEvidence,
  runReleaseCheck,
} from '@apps/product/harness/developer-release';

import './checkpoints.steps';
import {
  changeInvestigatedApp,
  checkpointOperation,
  investigatePeople,
  saveCheckpoint,
} from '@apps/product/harness/developer-checkpoints';

import './report-catalog.steps';
import {
  filterCatalog,
  openCatalog,
  openCompletedReport,
  provideCatalog,
} from '@apps/product/harness/developer-catalog';

import './test-world-views.steps';
import {
  arrangeWorldDevices,
  chooseWorldDevice,
  giveDevicesDifferentPlaces,
  provideWorldDevices,
} from '@apps/product/harness/developer-world-views';

import '@libs/runtime/steps/journeys.steps';
import './api.steps';
import './billing.steps';
import './client-config.steps';
import './finding-a-person.steps';
import './google-oauth.steps';
import './infrastructure.steps';
import './object-store.steps';
import './postgres.steps';
import './realtime-broker.steps';
import './rooms.steps';
import './secrets.steps';
import './traces.steps';
import './web-app.steps';
import { useLiveWorld } from './live-world';

useLiveWorld();
