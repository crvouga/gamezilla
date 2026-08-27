import type { DstApp } from '../../dst/app';
import { insertCatalogNote } from './insert-catalog-note';
import { acmeDomainPack } from './domain-pack';
import {
  initialAcmeDomainModel,
  acmeDomainAllows,
  acmeDomainApply,
  acmeDomainOnHeal,
  type AcmeDomainModel,
} from './domain-model';
import {
  acmeDomainOpArbs,
  acmeServerOpArbs,
  pickAcmeDomainOrServerOp,
} from './domain-arbs';
import { writeNoteBody } from './write-note-body';

export const acmeDstApp: DstApp = {
  pack: acmeDomainPack,
  domainOpArbs: acmeDomainOpArbs,
  serverOpArbs: acmeServerOpArbs,
  pickDomainOrServerOp: pickAcmeDomainOrServerOp,
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
  },
  domainModel: {
    initial: initialAcmeDomainModel,
    allows: (model, op) =>
      acmeDomainAllows(model as AcmeDomainModel, op),
    apply: (model, op) => acmeDomainApply(model as AcmeDomainModel, op),
    onHeal: (model) => acmeDomainOnHeal(model as AcmeDomainModel),
  },
};
