import type { CleanedWhere, JoinConfig } from '@better-auth/core/db/adapter';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';

import {
  betterAuthSqlCount,
  betterAuthSqlFindMany,
  betterAuthSqlFindOne,
} from './sql-client-better-auth-queries';
import {
  betterAuthSqlCreate,
  betterAuthSqlDelete,
  betterAuthSqlDeleteMany,
  betterAuthSqlUpdate,
  betterAuthSqlUpdateMany,
} from './sql-client-better-auth-mutations';

type GetFieldName = (args: { model: string; field: string }) => string;

export function createBetterAuthSqlDbOps(
  sql: SqlClient,
  getFieldName: GetFieldName
) {
  return {
    create: <T extends Record<string, unknown>>(args: {
      model: string;
      data: T;
      select?: string[] | undefined;
    }) => betterAuthSqlCreate(sql, args),

    findOne: <T>(args: {
      model: string;
      where: CleanedWhere[];
      select?: string[] | undefined;
      join?: JoinConfig | undefined;
    }) => betterAuthSqlFindOne<T>(sql, getFieldName, args),

    findMany: <T>(args: {
      model: string;
      where?: CleanedWhere[] | undefined;
      limit: number;
      select?: string[] | undefined;
      sortBy?: { field: string; direction: 'asc' | 'desc' } | undefined;
      offset?: number | undefined;
      join?: JoinConfig | undefined;
    }) => betterAuthSqlFindMany<T>(sql, getFieldName, args),

    count: (args: { model: string; where?: CleanedWhere[] | undefined }) =>
      betterAuthSqlCount(sql, args),

    update: <T>(args: { model: string; where: CleanedWhere[]; update: T }) =>
      betterAuthSqlUpdate(sql, args),

    updateMany: (args: {
      model: string;
      where: CleanedWhere[];
      update: Record<string, unknown>;
    }) => betterAuthSqlUpdateMany(sql, args),

    delete: (args: { model: string; where: CleanedWhere[] }) =>
      betterAuthSqlDelete(sql, args),

    deleteMany: (args: { model: string; where: CleanedWhere[] }) =>
      betterAuthSqlDeleteMany(sql, args),
  };
}
