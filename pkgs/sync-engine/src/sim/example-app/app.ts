import type { SyncApp } from '../../../sim/scenario/app';
import { acmeDomainOpArbs, acmeServerOpArbs } from './domain-arbs';
import { acmeDomainPack } from './domain-pack';
import { insertCatalogNote } from './insert-catalog-note';
import {
  type AcmeSchemaVariant,
  acmeRestartOptsForVariant,
} from './schema-variants';
import { seedLargeCatalogNotes } from './seed-large-catalog';
import { writeNoteBody } from './write-note-body';

export const acmeApp: SyncApp = {
  pack: acmeDomainPack,
  domainOpArbs: acmeDomainOpArbs,
  serverOpArbs: acmeServerOpArbs,
  restartOptsForVariant: (variant) =>
    acmeRestartOptsForVariant(variant as AcmeSchemaVariant),
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
