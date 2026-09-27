/**
 * Quint entry for this package's models (`specs/index-tuning/*.qnt`):
 * registers the tuning trace world and every model's binding.
 */

import './index-tuning.binding';

import { useTuningTraceWorld } from './world';

useTuningTraceWorld();
