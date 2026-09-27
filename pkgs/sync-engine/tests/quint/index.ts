/**
 * Quint entry for this package's models (`specs/sync/*.qnt`): registers the
 * note trace world and every model's binding.
 */

import './note-replication.binding';

import { useNoteWorld } from './note-world';

useNoteWorld();
