/** Profile acceptance steps and shared platform setup. */

import '@libs/harness/spec/steps/platform';
import { useHarnessWorld } from '@libs/harness/spec/world';
import { openHarness } from '../harness/open-profile-harness';
import './profile.steps';
import './auth.steps';
import './sign-in-methods.steps';
import './sessions.steps';
import './abandoned-sign-in.steps';
import './devices.steps';

useHarnessWorld(openHarness);
