import fc from 'fast-check';
import type { SeededRng } from '../../../sim/rng';
import type { DomainOp, ServerOp } from '../../scenario/actions';
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
  if (roll < 22) {
    return acmeSetNoteOp(clientId, `n${rng.int(8)}`, `b${rng.int(1000)}`);
  }
  if (roll < 30) {
    return acmeDeleteNoteOp(clientId, `n${rng.int(8)}`);
  }
  if (roll < 36) {
    return acmeSetFolderOp(clientId, `f${rng.int(4)}`, `t${rng.int(100)}`);
  }
  if (roll < 42) {
    return acmeCreateSpaceOp(clientId, `s${rng.int(4)}`);
  }
  if (roll < 48) {
    return acmeJoinSpaceOp(clientId, `s${rng.int(4)}`);
  }
  if (roll < 54) {
    return acmeLeaveSpaceOp(clientId, `s${rng.int(4)}`);
  }
  if (roll < 62) {
    return acmeWriteBodySilentOp(`n${rng.int(8)}`, `s${rng.int(1000)}`);
  }
  return acmeCatalogInsertSilentOp(`n${rng.int(8)}`, `c${rng.int(1000)}`);
}
