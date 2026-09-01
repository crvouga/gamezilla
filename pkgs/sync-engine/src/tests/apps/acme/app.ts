import type { SyncApp } from '../../../sim/system/app';
import {
  acmeDomainOpArbs,
  acmeServerOpArbs,
  pickAcmeDomainOrServerOp,
} from './domain-arbs';
import {
  type AcmeDomainModel,
  acmeDomainAllows,
  acmeDomainApply,
  acmeDomainOnHeal,
  initialAcmeDomainModel,
} from './domain-model';
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
  pickDomainOrServerOp: pickAcmeDomainOrServerOp,
  restartOptsForVariant: (variant) =>
    acmeRestartOptsForVariant(variant as AcmeSchemaVariant),
  serverOps: {
    writeNoteBodySilent: async (world, args) => {
      const noteId = args['noteId'];
      const body = args['body'];
      if (typeof noteId !== 'string' || typeof body !== 'string') return;
      await writeNoteBody(world.server, { id: noteId, body, notify: false });
    },
    insertCatalogNoteSilent: async (world, args) => {
      const noteId = args['noteId'];
      const body = args['body'];
      if (typeof noteId !== 'string' || typeof body !== 'string') return;
      await insertCatalogNote(world.server, {
        id: noteId,
        body,
        notify: false,
      });
    },
    seedLargeCatalogSilent: async (world, args) => {
      const count = args['count'];
      if (typeof count !== 'number') return;
      await seedLargeCatalogNotes(world.server, { count, notify: true });
    },
  },
  domainModel: {
    initial: initialAcmeDomainModel,
    allows: (model, op) => acmeDomainAllows(model as AcmeDomainModel, op),
    apply: (model, op) => acmeDomainApply(model as AcmeDomainModel, op),
    onHeal: (model) => acmeDomainOnHeal(model as AcmeDomainModel),
  },
};
