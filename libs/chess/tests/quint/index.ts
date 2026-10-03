/**
 * Quint entry for the `specs/<domain>/*.qnt` models this package runs
 * (`specDomains`): registers the world (this package's harness composition) and
 * every model's binding.
 */

import './puzzle-attempt.binding';
import './puzzle-result-recovery.binding';
import './multiplayer.binding';
import './puzzle-sound.binding';

import { useQuintHarness } from '@libs/harness/quint/world';
import { openHarness } from '../harness/open-chess-harness';

useQuintHarness(openHarness);
