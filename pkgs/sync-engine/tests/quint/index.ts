/**
 * Quint entry for this package's models (`specs/sync-engine/*.qnt`): registers the
 * note trace world and every model's binding.
 */

import './note-replication.binding';
import './note-conflicts.binding';
import './note-recovery.binding';

import { useNoteWorld } from './note-world';

useNoteWorld();
