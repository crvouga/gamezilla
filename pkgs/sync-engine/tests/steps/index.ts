/**
 * Steps entry for `specs/sync-engine/` (this package's `specDomains`): the
 * parameter types, the world, and every step its features use.
 */

import './parameter-types';
import './notes.steps';
import './devices.steps';
import './spaces.steps';
import './notices.steps';
import './checked-notes.steps';
import './many-notes.steps';
import './app-updates.steps';

import { useSyncWorld } from './world';

useSyncWorld();
