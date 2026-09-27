/**
 * Steps entry for this package's features (`specs/index-tuning/*.feature`):
 * registers the tuning world and every step definition the features use.
 */

import './index-tuning.steps';

import { useTuningWorld } from './world';

useTuningWorld();
