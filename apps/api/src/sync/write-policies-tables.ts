import type { WritePolicy } from '@pkgs/sync-engine/server/upload-handler';

import {
  allow,
  deny,
  idMatches,
  ownerMatches,
  readRowString,
} from './write-policy-helpers';

export const profilesWritePolicy: WritePolicy = (ctx, row) => {
  const mismatch = idMatches(row.id, ctx.myId, 'profile');
  if (mismatch !== null) return mismatch;
  return allow();
};

export const spacesWritePolicy: WritePolicy = (ctx, row) => {
  const hostId = readRowString(row, 'host_id');
  if (hostId !== undefined && hostId !== ctx.myId) {
    return deny('space write denied');
  }
  return allow();
};

export const spaceMembershipsWritePolicy: WritePolicy = (ctx, row) => {
  const guestId = readRowString(row, 'guest_id');
  if (guestId !== undefined && guestId !== ctx.myId) {
    return deny('space_membership guest_id mismatch');
  }
  return allow();
};

export const chessPuzzlesWritePolicy: WritePolicy = () =>
  deny('chess_puzzles is system-only');

export const chessPuzzleLoadWritePolicy: WritePolicy = () =>
  deny('chess_puzzle_load is system-only');

export const chessPuzzleProfilesWritePolicy: WritePolicy = (ctx, row) => {
  const ownerCheck = ownerMatches(readRowString(row, 'owner_id'), ctx.myId);
  if (ownerCheck !== null) return ownerCheck;
  const idCheck = idMatches(row.id, ctx.myId, 'chess_puzzle_profile');
  if (idCheck !== null) return idCheck;
  return allow();
};

export const chessPuzzleInteractionsWritePolicy: WritePolicy = (ctx, row) => {
  const ownerCheck = ownerMatches(readRowString(row, 'owner_id'), ctx.myId);
  if (ownerCheck !== null) return ownerCheck;
  return allow();
};

export const clientConfigWritePolicy: WritePolicy = () =>
  deny('client_config is system-only');
