/** Profile acceptance steps and shared platform setup. */

import '@libs/sim-harness/spec/steps/platform';
import { useSimWorld } from '@libs/sim-harness/spec/world';
import { openSim } from '../e2e/support/open-profile-sim';
import './profile.steps';
import './auth.steps';
import './sign-in-methods.steps';
import './sessions.steps';
import './offline-sign-in.steps';

useSimWorld((testId) => openSim(testId));
