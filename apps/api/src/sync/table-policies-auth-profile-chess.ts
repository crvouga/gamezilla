import { DEVICES_TABLE, DeviceCol } from '@libs/db/shared/auth-tables';
import {
  CHESS_PUZZLE_INTERACTIONS_TABLE,
  CHESS_PUZZLE_LOAD_TABLE,
  CHESS_PUZZLE_PROFILES_TABLE,
  CHESS_PUZZLES_TABLE,
  ChessPuzzleInteractionCol,
  ChessPuzzleProfileCol,
} from '@libs/db/shared/chess-tables';
import {
  EXTERNAL_ACCOUNTS_TABLE,
  USERS_TABLE,
} from '@libs/db/shared/external-accounts-tables';
import { ProfileCol, PROFILES_TABLE } from '@libs/db/shared/profile-tables';
import {
  AUTH_DEVICE_ID_MISMATCH,
  AUTH_DEVICE_REQUIRED,
  AUTH_SERVER_MANAGED,
} from '@pkgs/rules/auth/codes';
import {
  CHESS_INTERACTION_DELETE_DENIED,
  CHESS_OWNER_MISMATCH,
  CHESS_PROFILE_DELETE_DENIED,
  CHESS_PROFILE_ID_MISMATCH,
  CHESS_PUZZLE_LOAD_SYSTEM_ONLY,
  CHESS_PUZZLES_SYSTEM_ONLY,
} from '@pkgs/rules/chess/codes';
import {
  PROFILE_DELETE_DENIED,
  PROFILE_ID_MISMATCH,
} from '@pkgs/rules/profile/codes';
import {
  denyTablePolicy,
  type TablePolicy,
} from '@pkgs/sync-engine/server/apply-batch';
import type { UploadOp } from '@pkgs/sync-engine/shared/upload-batch';

import { columnSet, deny, ok, readRowString } from './table-policy-helpers';

const PUT_PATCH_DELETE = new Set<UploadOp>(['put', 'patch', 'delete']);
const PUT_PATCH = new Set<UploadOp>(['put', 'patch']);

export function authProfileChessTablePolicies(): readonly TablePolicy[] {
  return [
    {
      table: DEVICES_TABLE.tableName,
      allowedOps: PUT_PATCH,
      allowedColumns: columnSet(DeviceCol),
      authorize: async (auth, row) => {
        if (auth.deviceId.length === 0) return deny(AUTH_DEVICE_REQUIRED);
        if (row.id !== auth.deviceId) return deny(AUTH_DEVICE_ID_MISMATCH);
        return ok();
      },
    },
    denyTablePolicy(USERS_TABLE, AUTH_SERVER_MANAGED),
    denyTablePolicy(EXTERNAL_ACCOUNTS_TABLE, AUTH_SERVER_MANAGED),
    {
      table: PROFILES_TABLE.tableName,
      allowedOps: PUT_PATCH_DELETE,
      allowedColumns: new Set([
        ProfileCol.id,
        ProfileCol.createdAt,
        ProfileCol.avatarConfig,
      ]),
      authorize: async (auth, row) => {
        if (row.op === 'delete') return deny(PROFILE_DELETE_DENIED);
        if (row.id !== auth.myId) return deny(PROFILE_ID_MISMATCH);
        return ok();
      },
    },
    denyTablePolicy(CHESS_PUZZLES_TABLE.tableName, CHESS_PUZZLES_SYSTEM_ONLY),
    denyTablePolicy(
      CHESS_PUZZLE_LOAD_TABLE.tableName,
      CHESS_PUZZLE_LOAD_SYSTEM_ONLY
    ),
    {
      table: CHESS_PUZZLE_PROFILES_TABLE.tableName,
      allowedOps: PUT_PATCH_DELETE,
      allowedColumns: columnSet(ChessPuzzleProfileCol),
      authorize: async (auth, row) => {
        if (row.op === 'delete') return deny(CHESS_PROFILE_DELETE_DENIED);
        const ownerId =
          readRowString(row, ChessPuzzleProfileCol.ownerId, 'ownerId') ??
          row.id;
        if (ownerId !== auth.myId) return deny(CHESS_OWNER_MISMATCH);
        if (row.id !== auth.myId) return deny(CHESS_PROFILE_ID_MISMATCH);
        return ok();
      },
    },
    {
      table: CHESS_PUZZLE_INTERACTIONS_TABLE.tableName,
      allowedOps: PUT_PATCH_DELETE,
      allowedColumns: columnSet(ChessPuzzleInteractionCol),
      authorize: async (auth, row) => {
        if (row.op === 'delete') return deny(CHESS_INTERACTION_DELETE_DENIED);
        const ownerId = readRowString(
          row,
          ChessPuzzleInteractionCol.ownerId,
          'ownerId'
        );
        if (ownerId !== auth.myId) return deny(CHESS_OWNER_MISMATCH);
        return ok();
      },
    },
  ];
}
