/**
 * Quint entry for `specs/developer-tools/*.qnt`. The same testing-tool
 * harness the feature scenarios open.
 */

import { useQuintHarness } from '@libs/harness-ts/quint-world';
import { openDeveloperHarness } from '../steps/developer-world';

import './checkpoints.binding';
import './data-notebook.binding';

useQuintHarness(openDeveloperHarness);
