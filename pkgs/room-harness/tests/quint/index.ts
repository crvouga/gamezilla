/**
 * Quint entry for this package's models (`specs/room/*.qnt`): registers the room
 * trace world and every model's binding.
 */

import { useRoomTraceWorld } from './world';

// Every `*.binding.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.binding.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

useRoomTraceWorld();
