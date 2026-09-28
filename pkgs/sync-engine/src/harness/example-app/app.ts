import type { SyncApp } from '../scenario/app';
import { exampleDomainOpArbs, exampleServerOpArbs } from './domain-arbs';
import { exampleDomainPack } from './domain-pack';
import { insertCatalogNote } from './insert-catalog-note';
import {
  type ExampleSchemaVariant,
  exampleRestartOptsForVariant,
} from './schema-variants';
import { seedLargeCatalogNotes } from './seed-large-catalog';
import { writeNoteBody } from './write-note-body';

export const exampleApp: SyncApp = {
  pack: exampleDomainPack,
  domainOpArbs: exampleDomainOpArbs,
  serverOpArbs: exampleServerOpArbs,
  restartOptsForVariant: (variant) =>
    exampleRestartOptsForVariant(variant as ExampleSchemaVariant),
  serverOps: {
    writeNoteBodySilent: async (surface, args) => {
      const noteId = args['noteId'];
      const body = args['body'];
      if (typeof noteId !== 'string' || typeof body !== 'string') return;
      await writeNoteBody(surface.server, { id: noteId, body, notify: false });
    },
    insertCatalogNoteSilent: async (surface, args) => {
      const noteId = args['noteId'];
      const body = args['body'];
      if (typeof noteId !== 'string' || typeof body !== 'string') return;
      await insertCatalogNote(surface.server, {
        id: noteId,
        body,
        notify: false,
      });
    },
    insertCatalogNoteNotify: async (surface, args) => {
      const noteId = args['noteId'];
      const body = args['body'];
      if (typeof noteId !== 'string' || typeof body !== 'string') return;
      await insertCatalogNote(surface.server, {
        id: noteId,
        body,
        notify: true,
      });
    },
    seedLargeCatalogSilent: async (surface, args) => {
      const count = args['count'];
      if (typeof count !== 'number') return;
      await seedLargeCatalogNotes(surface.server, { count, notify: true });
    },
  },
};
