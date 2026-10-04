import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { assert } from '@pkgs/assert-shared/singleton';

import sql, { Sql } from '@pkgs/sql-shared/sql';
import { col, sqlMap } from '@pkgs/sql-map-shared/sql-map';
import { registerSqlMapCast, registerSqlMapFn, registerSqlMapOp, resetSqlMapRegistry } from '@pkgs/sql-map-shared/sql-map-registry';

/** Node crash handler calls `process.exit`; register one that throws so tests can assert failures. */
function registerThrowingCrashHandlerForTests(): () => void {
  return assert.registerCrashHandler({
    priority: 5,
    match: () => true,
    crash(message, context) {
      const err = new Error(message);
      Object.assign(err, { context });
      throw err;
    },
  });
}

let disposeCrash: () => void;
beforeAll(() => {
  disposeCrash = registerThrowingCrashHandlerForTests();
});
afterAll(() => {
  disposeCrash();
});

describe('sqlMap', () => {
  describe('SELECT', () => {
    it('compiles bare select with default star', () => {
      const q = sqlMap({ from: 'books' });
      expect(q).toBeInstanceOf(Sql);
      expect(q.text).toEqual('SELECT * FROM books');
      expect(q.values).toEqual([]);
    });

    it('compiles columns, aliases, distinct, and aggregates', () => {
      const q = sqlMap({
        select: ['id', 'name', [['count', '*'], 'n']],
        distinct: true,
        from: [['users', 'u']],
      });
      expect(q.text).toEqual(
        'SELECT DISTINCT id, name, COUNT(*) AS n FROM users AS u'
      );
      expect(q.values).toEqual([]);
    });

    it('compiles multi-table from', () => {
      const q = sqlMap({
        select: ['t1.id'],
        from: [
          ['t1', 't1'],
          ['t2', 't2'],
        ],
      });
      expect(q.text).toEqual('SELECT t1.id FROM t1 AS t1, t2 AS t2');
    });

    it('compiles groupBy, having, orderBy, limit, offset', () => {
      const q = sqlMap({
        select: [[['count', '*'], 'n']],
        from: 'users',
        groupBy: ['role'],
        having: ['>', ['count', '*'], 1],
        orderBy: [['n', 'desc'], 'role'],
        limit: 10,
        offset: 5,
      });
      expect(q.text).toEqual(
        'SELECT COUNT(*) AS n FROM users GROUP BY role HAVING COUNT(*) > $1 ORDER BY n DESC, role LIMIT $2 OFFSET $3'
      );
      expect(q.values).toEqual([1, 10, 5]);
    });
  });

  describe('JOINs', () => {
    it('compiles inner join (single JoinSpec)', () => {
      const q = sqlMap({
        select: ['u.id'],
        from: [['users', 'u']],
        join: [
          ['orders', 'o'],
          ['=', 'o.user_id', col('u.id')],
        ],
      });
      expect(q.text).toEqual(
        'SELECT u.id FROM users AS u JOIN orders AS o ON o.user_id = u.id'
      );
    });

    it('compiles left and right joins (list form)', () => {
      const q = sqlMap({
        select: ['u.id'],
        from: [['users', 'u']],
        leftJoin: [
          [
            ['profiles', 'p'],
            ['=', 'p.user_id', col('u.id')],
          ],
        ],
        rightJoin: [
          [
            ['accounts', 'a'],
            ['=', 'a.user_id', col('u.id')],
          ],
        ],
      });

      expect(q.text).toEqual(
        'SELECT u.id FROM users AS u LEFT JOIN profiles AS p ON p.user_id = u.id RIGHT JOIN accounts AS a ON a.user_id = u.id'
      );
    });
  });

  describe('WHERE / operators', () => {
    it('compiles and/or/not and infix ops', () => {
      const q = sqlMap({
        select: ['id'],
        from: 'users',
        where: [
          'and',
          ['=', 'active', true],
          ['or', ['like', 'name', '%x%'], ['not', ['=', 'role', 'guest']]],
        ],
      });
      expect(q.text).toEqual(
        'SELECT id FROM users WHERE (active = $1 AND (name LIKE $2 OR NOT role = $3))'
      );
      expect(q.values).toEqual([true, '%x%', 'guest']);
    });

    it('compiles in / not-in list, empty, and subquery', () => {
      const list = sqlMap({
        select: ['id'],
        from: 'users',
        where: ['in', 'role', ['admin', 'staff']],
      });
      expect(list.text).toEqual('SELECT id FROM users WHERE role IN ($1, $2)');
      expect(list.values).toEqual(['admin', 'staff']);

      const emptyIn = sqlMap({
        select: ['id'],
        from: 'users',
        where: ['in', 'id', []],
      });
      expect(emptyIn.text).toEqual('SELECT id FROM users WHERE 1 = 0');

      const emptyNotIn = sqlMap({
        select: ['id'],
        from: 'users',
        where: ['not-in', 'id', []],
      });
      expect(emptyNotIn.text).toEqual('SELECT id FROM users WHERE 1 = 1');

      const sub = sqlMap({
        select: ['id'],
        from: 'users',
        where: [
          'in',
          'id',
          { select: ['user_id'], from: 'orders', where: ['=', 'paid', true] },
        ],
      });
      expect(sub.text).toEqual(
        'SELECT id FROM users WHERE id IN (SELECT user_id FROM orders WHERE paid = $1)'
      );
      expect(sub.values).toEqual([true]);
    });

    it('compiles between, is-null, is-not-null, exists', () => {
      const q = sqlMap({
        select: ['id'],
        from: 'users',
        where: [
          'and',
          ['between', 'age', 18, 65],
          ['is-not-null', 'email'],
          ['is-null', 'deleted_at'],
          [
            'exists',
            {
              select: ['id'],
              from: 'orders',
              where: ['=', 'user_id', col('users.id')],
            },
          ],
        ],
      });
      expect(q.text).toEqual(
        'SELECT id FROM users WHERE (age BETWEEN $1 AND $2 AND email IS NOT NULL AND deleted_at IS NULL AND EXISTS (SELECT id FROM orders WHERE user_id = users.id))'
      );
      expect(q.values).toEqual([18, 65]);
    });

    it('compiles allowlisted functions', () => {
      const q = sqlMap({
        select: [
          ['lower', 'name'],
          ['coalesce', 'nickname', 'name'],
        ],
        from: 'users',
      });
      expect(q.text).toEqual(
        'SELECT LOWER(name), COALESCE(nickname, name) FROM users'
      );
    });
  });

  describe('DML', () => {
    it('compiles insert single and multi-row with returning', () => {
      const single = sqlMap({
        insertInto: 'users',
        values: { id: 1, name: 'Ada' },
        returning: ['id'],
      });
      expect(single.text).toEqual(
        'INSERT INTO users (id, name) VALUES ($1, $2) RETURNING id'
      );
      expect(single.values).toEqual([1, 'Ada']);

      const multi = sqlMap({
        insertInto: 'users',
        values: [
          { id: 1, name: 'Ada' },
          { id: 2, name: 'Grace' },
        ],
      });
      expect(multi.text).toEqual(
        'INSERT INTO users (id, name) VALUES ($1, $2), ($3, $4)'
      );
      expect(multi.values).toEqual([1, 'Ada', 2, 'Grace']);
    });

    it('compiles update set with scalar, col, and op', () => {
      const q = sqlMap({
        update: 'users',
        set: {
          name: 'Ada',
          updated_at: col('created_at'),
          visits: ['+', 'visits', 1],
        },
        where: ['=', 'id', 1],
        returning: ['id', 'name'],
      });
      expect(q.text).toEqual(
        'UPDATE users SET name = $1, updated_at = created_at, visits = visits + $2 WHERE id = $3 RETURNING id, name'
      );
      expect(q.values).toEqual(['Ada', 1, 1]);
    });

    it('compiles delete with where and returning', () => {
      const q = sqlMap({
        deleteFrom: 'users',
        where: ['=', 'id', 9],
        returning: ['id'],
      });
      expect(q.text).toEqual('DELETE FROM users WHERE id = $1 RETURNING id');
      expect(q.values).toEqual([9]);
    });
  });

  describe('subqueries', () => {
    it('compiles subquery in from and select', () => {
      const q = sqlMap({
        select: [
          [
            {
              select: [['count', '*']],
              from: 'orders',
              where: ['=', 'user_id', col('u.id')],
            },
            'order_count',
          ],
        ],
        from: [
          [
            { select: ['id'], from: 'users', where: ['=', 'active', true] },
            'u',
          ],
        ],
      });
      expect(q.text).toEqual(
        'SELECT (SELECT COUNT(*) FROM orders WHERE user_id = u.id) AS order_count FROM (SELECT id FROM users WHERE active = $1) AS u'
      );
      expect(q.values).toEqual([true]);
    });
  });

  describe('Sql integration', () => {
    it('exposes sql/text/statement placeholders and nests in sql<void>`...`', () => {
      const q = sqlMap({
        select: ['id'],
        from: 'users',
        where: ['=', 'name', 'Ada'],
      });
      expect(q.sql).toEqual('SELECT id FROM users WHERE name = ?');
      expect(q.text).toEqual('SELECT id FROM users WHERE name = $1');
      expect(q.statement).toEqual('SELECT id FROM users WHERE name = :1');
      expect(q.values).toEqual(['Ada']);

      const wrapped = sql<void>`EXPLAIN ${q}`;
      expect(wrapped.text).toEqual(
        'EXPLAIN SELECT id FROM users WHERE name = $1'
      );
      expect(wrapped.values).toEqual(['Ada']);
    });

    it('col() works in value position', () => {
      const q = sqlMap({
        select: ['id'],
        from: [['users', 'u']],
        where: ['=', 'u.id', col('u.owner_id')],
      });
      expect(q.text).toEqual(
        'SELECT id FROM users AS u WHERE u.id = u.owner_id'
      );
      expect(q.values).toEqual([]);
    });
  });

  describe('cast', () => {
    it('compiles nested allowlisted casts', () => {
      const q = sqlMap({
        select: [[['cast', ['cast', 'payload', 'text'], 'jsonb'], 'data']],
        from: 'kv',
      });
      expect(q.text).toEqual('SELECT $1::text::jsonb AS data FROM kv');
      expect(q.values).toEqual(['payload']);
    });

    it('compiles cast in insert values', () => {
      const q = sqlMap({
        insertInto: 'kv',
        values: {
          key: 'a',
          value: ['cast', ['cast', '{"x":1}', 'text'], 'jsonb'],
        },
      });
      expect(q.text).toEqual(
        'INSERT INTO kv (key, value) VALUES ($1, $2::text::jsonb)'
      );
      expect(q.values).toEqual(['a', '{"x":1}']);
    });

    it('crashes on unknown cast type', () => {
      expect(() =>
        sqlMap({
          select: [['cast', 1, 'bogus']],
          from: 't',
        })
      ).toThrow('sqlMap: unknown cast type');
    });
  });

  describe('onConflict', () => {
    it('compiles DO NOTHING', () => {
      const q = sqlMap({
        insertInto: 'users',
        values: { id: 1, name: 'Ada' },
        onConflict: { target: ['id'], doNothing: true },
      });
      expect(q.text).toEqual(
        'INSERT INTO users (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING'
      );
      expect(q.values).toEqual([1, 'Ada']);
    });

    it('compiles DO UPDATE SET with excluded cols', () => {
      const q = sqlMap({
        insertInto: 'kv',
        values: {
          key: 'k',
          value: ['cast', '{}', 'jsonb'],
        },
        onConflict: {
          target: ['key'],
          set: {
            value: col('excluded.value'),
            updated_at: 1,
          },
        },
      });
      expect(q.text).toEqual(
        'INSERT INTO kv (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = $3'
      );
      expect(q.values).toEqual(['k', '{}', 1]);
    });

    it('crashes on empty target or mixed doNothing/set', () => {
      expect(() =>
        sqlMap({
          insertInto: 'users',
          values: { id: 1 },
          onConflict: { target: [] },
        })
      ).toThrow('sqlMap: onConflict.target must be a non-empty column list');
      expect(() =>
        sqlMap({
          insertInto: 'users',
          values: { id: 1 },
          onConflict: {
            target: ['id'],
            doNothing: true,
            set: { name: 'x' },
          },
        })
      ).toThrow('sqlMap: onConflict cannot mix doNothing and set');
    });
  });

  describe('with / union / locking', () => {
    it('compiles WITH CTE', () => {
      const q = sqlMap({
        with: [
          [
            'active',
            { select: ['id'], from: 'users', where: ['=', 'active', true] },
          ],
        ],
        select: ['id'],
        from: 'active',
      });
      expect(q.text).toEqual(
        'WITH active AS (SELECT id FROM users WHERE active = $1) SELECT id FROM active'
      );
      expect(q.values).toEqual([true]);
    });

    it('compiles UNION ALL', () => {
      const q = sqlMap({
        unionAll: [
          { select: ['id'], from: 'a' },
          { select: ['id'], from: 'b', where: ['=', 'x', 1] },
        ],
      });
      expect(q.text).toEqual(
        '(SELECT id FROM a) UNION ALL (SELECT id FROM b WHERE x = $1)'
      );
      expect(q.values).toEqual([1]);
    });

    it('compiles FOR UPDATE SKIP LOCKED', () => {
      const q = sqlMap({
        select: ['id'],
        from: 'jobs',
        where: ['=', 'done', false],
        forUpdate: true,
        skipLocked: true,
        limit: 1,
      });
      expect(q.text).toEqual(
        'SELECT id FROM jobs WHERE done = $1 LIMIT $2 FOR UPDATE SKIP LOCKED'
      );
      expect(q.values).toEqual([false, 1]);
    });

    it('crashes when mixing union kinds or skipLocked without forUpdate', () => {
      expect(() =>
        sqlMap({
          union: [
            { select: ['id'], from: 'a' },
            { select: ['id'], from: 'b' },
          ],
          unionAll: [
            { select: ['id'], from: 'a' },
            { select: ['id'], from: 'b' },
          ],
        })
      ).toThrow('sqlMap: cannot mix union and unionAll');
      expect(() =>
        sqlMap({ select: ['id'], from: 't', skipLocked: true })
      ).toThrow('sqlMap: skipLocked requires forUpdate');
    });
  });

  describe('postgres helper fns', () => {
    it('compiles advisory lock helpers', () => {
      const q = sqlMap({
        select: [[['pg_try_advisory_lock', ['cast', 42, 'bigint']], 'ok']],
      });
      expect(q.text).toEqual('SELECT PG_TRY_ADVISORY_LOCK($1::bigint) AS ok');
      expect(q.values).toEqual([42]);
    });
  });

  describe('case', () => {
    it('compiles CASE WHEN THEN ELSE', () => {
      const q = sqlMap({
        update: 'spaces',
        set: {
          n: [
            'case',
            [
              [
                ['>', 'n', 0],
                ['-', 'n', 1],
              ],
            ],
            0,
          ],
        },
        where: ['=', 'id', 's1'],
      });
      expect(q.text).toEqual(
        'UPDATE spaces SET n = CASE WHEN n > $1 THEN n - $2 ELSE $3 END WHERE id = $4'
      );
      expect(q.values).toEqual([0, 1, 0, 's1']);
    });
  });

  describe('param', () => {
    it('binds a string scalar inside coalesce', () => {
      const q = sqlMap({
        update: 'invites',
        set: {
          accepted_at: ['coalesce', 'accepted_at', ['param', '2020-01-01']],
        },
        where: ['=', 'id', 'i1'],
      });
      expect(q.text).toEqual(
        'UPDATE invites SET accepted_at = COALESCE(accepted_at, $1) WHERE id = $2'
      );
      expect(q.values).toEqual(['2020-01-01', 'i1']);
    });
  });

  describe('safety', () => {
    it('crashes on invalid identifiers', () => {
      expect(() => sqlMap({ select: ['id;drop'], from: 'users' })).toThrow();
      expect(() => sqlMap({ from: 'users--' })).toThrow();
    });

    it('crashes on unknown operators', () => {
      expect(() =>
        sqlMap({ select: ['id'], from: 'users', where: ['weird', 'a', 1] })
      ).toThrow('sqlMap: unknown operator');
    });

    it('crashes on empty insert / update and bad limit', () => {
      expect(() => sqlMap({ insertInto: 'users' })).toThrow(
        'sqlMap: insertInto requires values or select'
      );
      expect(() => sqlMap({ update: 'users', set: {} })).toThrow(
        'sqlMap: update requires set'
      );
      expect(() =>
        sqlMap({ select: ['id'], from: 'users', limit: -1 })
      ).toThrow();
      expect(() =>
        sqlMap({ select: ['id'], from: 'users', limit: 1.5 })
      ).toThrow();
      expect(() =>
        sqlMap({
          select: ['id'],
          from: 'users',
          orderBy: [['id', 'sideways' as 'asc']],
        })
      ).toThrow('sqlMap: bad sort dir');
    });
  });

  describe('order extras / concat / tuple / registry', () => {
    it('compiles orderBy with lower, nulls, and collate', () => {
      const q = sqlMap({
        select: ['id'],
        from: 'users',
        orderBy: [
          [['lower', 'username'], 'asc'],
          ['created_at', 'desc', { nulls: 'last' }],
          ['username', 'asc', { collate: 'NOCASE' }],
        ],
      });
      expect(q.text).toEqual(
        'SELECT id FROM users ORDER BY LOWER(username) ASC, created_at DESC NULLS LAST, username COLLATE NOCASE ASC'
      );
    });

    it('compiles ||, ->>, tuple, and interval', () => {
      const concat = sqlMap({
        select: ['id'],
        from: 't',
        where: ['like', 'name', ['||', ['param', 'pre'], '%']],
      });
      expect(concat.text).toEqual('SELECT id FROM t WHERE name LIKE $1 || $2');
      expect(concat.values).toEqual(['pre', '%']);

      const arrow = sqlMap({
        select: ['id'],
        from: 't',
        where: ['=', ['->>', 'data', 'region'], 'us'],
      });
      expect(arrow.text).toEqual('SELECT id FROM t WHERE data ->> $1 = $2');
      expect(arrow.values).toEqual(['region', 'us']);

      const tup = sqlMap({
        select: ['id'],
        from: 't',
        where: [
          '<',
          ['tuple', 'a', 'b'],
          { select: ['a', 'b'], from: 'c', where: ['=', 'id', 1] },
        ],
      });
      expect(tup.text).toEqual(
        'SELECT id FROM t WHERE (a, b) < (SELECT a, b FROM c WHERE id = $1)'
      );

      const iv = sqlMap({
        select: [['interval', '30 days']],
      });
      expect(iv.text).toEqual("SELECT INTERVAL '30 days'");
    });

    it('supports registerSqlMapFn/Op/Cast, statements, and reset', () => {
      registerSqlMapFn('my_tvf');
      registerSqlMapOp('approx', (args, ctx) => {
        assert.equals(args.length, 1, 'approx');
        return sql<void>`approx(${ctx.compileExpr(args[0])})`;
      });
      registerSqlMapCast('cidr');

      const tvf = sqlMap({
        select: ['id'],
        from: [['my_tvf', 1, 2], 't'],
      });
      expect(tvf.text).toEqual('SELECT id FROM MY_TVF($1, $2) AS t');
      expect(tvf.values).toEqual([1, 2]);

      const u = sqlMap({
        unionAll: [
          { select: ['id'], from: 'a' },
          { select: ['id'], from: 'b' },
        ],
        limit: 1,
      });
      expect(u.text).toEqual(
        '(SELECT id FROM a) UNION ALL (SELECT id FROM b) LIMIT $1'
      );

      const del = sqlMap({
        deleteFrom: ['parts', 'ap'],
        where: ['=', 'ap.id', 9],
      });
      expect(del.text).toEqual('DELETE FROM parts AS ap WHERE ap.id = $1');

      const ins = sqlMap({
        insertInto: 'dest',
        columns: ['id', 'name'],
        select: ['id', 'name'],
        from: 'src',
        where: ['=', 'ok', true],
      });
      expect(ins.text).toEqual(
        'INSERT INTO dest (id, name) SELECT id, name FROM src WHERE ok = $1'
      );

      const recordset = sqlMap({
        select: ['id'],
        from: [
          ['jsonb_to_recordset', ['cast', '{}', 'jsonb']],
          'r',
          [
            ['id', 'text'],
            ['n', 'integer'],
          ],
        ],
      });
      expect(recordset.text).toEqual(
        'SELECT id FROM JSONB_TO_RECORDSET($1::jsonb) AS r (id text, n integer)'
      );

      const casted = sqlMap({
        select: [['cast', 'x', 'cidr']],
      });
      expect(casted.text).toEqual('SELECT $1::cidr');

      resetSqlMapRegistry();
      expect(() =>
        sqlMap({ select: ['id'], from: [['my_tvf', 1], 't'] })
      ).toThrow('sqlMap: unknown operator');
    });
  });
});
