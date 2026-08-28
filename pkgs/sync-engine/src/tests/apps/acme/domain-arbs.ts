import fc from 'fast-check';
import type { SeededRng } from '../../../sim/rng';
import type { DomainOp, ServerOp } from '../../dst/actions';
import {
  acmeCatalogInsertSilentOp,
  acmeCreateSpaceOp,
  acmeDeleteNoteOp,
  acmeJoinSpaceOp,
  acmeLeaveSpaceOp,
  acmeSetFolderOp,
  acmeSetNoteOp,
  acmeWriteBodySilentOp,
  FOLDER_IDS,
  NOTE_IDS,
  SPACE_IDS,
} from './domain-model';

const noteArb = fc.constantFrom(...NOTE_IDS);
const folderArb = fc.constantFrom(...FOLDER_IDS);
const spaceArb = fc.constantFrom(...SPACE_IDS);

export function acmeDomainOpArbs(ctx: {
  readonly clientIds: readonly string[];
}): fc.Arbitrary<DomainOp>[] {
  const pickClient = fc.constantFrom(...ctx.clientIds);
  return [
    fc
      .tuple(pickClient, noteArb, fc.string({ maxLength: 8 }))
      .map(([c, n, b]) => acmeSetNoteOp(c, n, b)),
    fc.tuple(pickClient, noteArb).map(([c, n]) => acmeDeleteNoteOp(c, n)),
    fc.tuple(pickClient, noteArb).map(([c, n]) => acmeSetNoteOp(c, n, 'pbt')),
    fc
      .tuple(pickClient, folderArb, fc.string({ maxLength: 6 }))
      .map(([c, f, title]) => acmeSetFolderOp(c, f, title)),
    fc.tuple(pickClient, spaceArb).map(([c, s]) => acmeCreateSpaceOp(c, s)),
    fc.tuple(pickClient, spaceArb).map(([c, s]) => acmeJoinSpaceOp(c, s)),
    fc.tuple(pickClient, spaceArb).map(([c, s]) => acmeLeaveSpaceOp(c, s)),
  ];
}

export function acmeServerOpArbs(_ctx: {
  readonly clientIds: readonly string[];
}): fc.Arbitrary<ServerOp>[] {
  return [
    fc
      .tuple(noteArb, fc.string({ maxLength: 8 }))
      .map(([n, body]) => acmeWriteBodySilentOp(n, body)),
    fc
      .tuple(noteArb, fc.string({ maxLength: 8 }))
      .map(([n, body]) => acmeCatalogInsertSilentOp(n, body)),
  ];
}

/** Pick one domain or server op from a percentile roll (seeded fuzz). */
export function pickAcmeDomainOrServerOp(
  rng: SeededRng,
  clientIds: readonly string[]
): DomainOp | ServerOp {
  const roll = rng.int(100);
  const clientId = rng.pick(clientIds);
  if (roll < 38) {
    return acmeSetNoteOp(clientId, `n${rng.int(4)}`, `b${rng.int(1000)}`);
  }
  if (roll < 46) {
    return acmeSetFolderOp(clientId, `f${rng.int(3)}`, `t${rng.int(100)}`);
  }
  return acmeSetNoteOp(clientId, `n${rng.int(4)}`, `b${rng.int(1000)}`);
}
