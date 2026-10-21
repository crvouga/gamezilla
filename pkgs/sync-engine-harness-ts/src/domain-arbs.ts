import fc from 'fast-check';
import {
  exampleCatalogInsertSilentOp,
  exampleCreateSpaceOp,
  exampleDeleteNoteOp,
  exampleJoinSpaceOp,
  exampleLeaveSpaceOp,
  exampleSetFolderOp,
  exampleSetNoteOp,
  exampleWriteBodySilentOp,
  FOLDER_IDS,
  NOTE_IDS,
  SPACE_IDS,
} from './domain-model';
import type { DomainOp, ServerOp } from './scenario-app';

const noteArb = fc.constantFrom(...NOTE_IDS);
const folderArb = fc.constantFrom(...FOLDER_IDS);
const spaceArb = fc.constantFrom(...SPACE_IDS);

export function exampleDomainOpArbs(ctx: {
  readonly clientIds: readonly string[];
}): fc.Arbitrary<DomainOp>[] {
  const pickClient = fc.constantFrom(...ctx.clientIds);
  return [
    fc
      .tuple(pickClient, noteArb, fc.string({ maxLength: 8 }))
      .map(([c, n, b]) => exampleSetNoteOp(c, n, b)),
    fc.tuple(pickClient, noteArb).map(([c, n]) => exampleDeleteNoteOp(c, n)),
    fc
      .tuple(pickClient, noteArb)
      .map(([c, n]) => exampleSetNoteOp(c, n, 'pbt')),
    fc
      .tuple(pickClient, folderArb, fc.string({ maxLength: 6 }))
      .map(([c, f, title]) => exampleSetFolderOp(c, f, title)),
    fc.tuple(pickClient, spaceArb).map(([c, s]) => exampleCreateSpaceOp(c, s)),
    fc.tuple(pickClient, spaceArb).map(([c, s]) => exampleJoinSpaceOp(c, s)),
    fc.tuple(pickClient, spaceArb).map(([c, s]) => exampleLeaveSpaceOp(c, s)),
  ];
}

export function exampleServerOpArbs(_ctx: {
  readonly clientIds: readonly string[];
}): fc.Arbitrary<ServerOp>[] {
  return [
    fc
      .tuple(noteArb, fc.string({ maxLength: 8 }))
      .map(([n, body]) => exampleWriteBodySilentOp(n, body)),
    fc
      .tuple(noteArb, fc.string({ maxLength: 8 }))
      .map(([n, body]) => exampleCatalogInsertSilentOp(n, body)),
  ];
}
