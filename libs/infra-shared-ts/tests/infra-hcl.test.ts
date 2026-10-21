import { describe, expect, test } from 'bun:test';
import type { Env } from '@libs/infra-shared-ts/hcl-eval';
import { evaluate } from '@libs/infra-shared-ts/hcl-eval';
import { HclSyntaxError } from '@libs/infra-shared-ts/hcl-lex';
import { parseConfig, parseExpression } from '@libs/infra-shared-ts/hcl-parse';
import { bodyRefs, exprRefs } from '@libs/infra-shared-ts/hcl-refs';
import type { Value } from '@libs/infra-shared-ts/hcl-value';
import { UNKNOWN } from '@libs/infra-shared-ts/hcl-value';
import { sourceFiles } from '@libs/infra-shared-ts/infra-source';

const FILES = new Map([
  ['m/patterns.json', '{"a":"{p}-{s}","b":"x-{s}"}'],
  ['m/dashboards/one.json.tftpl', '{}'],
  ['m/dashboards/two.json.tftpl', '{}'],
  ['m/readme.md', '#'],
]);

function envOf(names: Record<string, Value>): Env {
  return { names, files: sourceFiles(FILES) };
}

function run(source: string, names: Record<string, Value> = {}): Value {
  return evaluate(parseExpression(source), envOf(names));
}

describe('HCL parsing', () => {
  test('reads blocks, labels, attributes and nested blocks', () => {
    const body = parseConfig(`
      # a comment
      resource "aws_iam_role" "r" {
        name = "x" // trailing
        lifecycle {
          prevent_destroy = true
        }
      }
      variable "v" { type = string }
    `);
    expect(body.blocks.map((b) => [b.type, ...b.labels])).toEqual([
      ['resource', 'aws_iam_role', 'r'],
      ['variable', 'v'],
    ]);
    const resource = body.blocks[0];
    expect(resource?.body.blocks[0]?.type).toBe('lifecycle');
  });

  test('reads a heredoc as a template', () => {
    const body = parseConfig('x = <<-EOT\n  hello ${var.n}\n  EOT\n');
    const expr = body.attributes.get('x');
    expect(evaluate(expr as never, envOf({ var: { n: 'world' } }))).toBe(
      'hello world\n'
    );
  });

  test('reports a syntax error with its line', () => {
    expect(() => parseConfig('a = 1\nb = (\n')).toThrow(HclSyntaxError);
  });

  test('keeps dashes in identifiers and splits operators on spaces', () => {
    expect(run('a-b', { 'a-b': 1 })).toBe(1);
    expect(run('a - b', { a: 5, b: 2 })).toBe(3);
  });
});

describe('HCL evaluation', () => {
  test('interpolates templates and escapes literal ${', () => {
    expect(run('"${var.p}-${var.s}"', { var: { p: 'g', s: 'prd' } })).toBe(
      'g-prd'
    );
    expect(run('"$${literal}"')).toBe('${literal}');
  });

  test('evaluates conditionals, comparison and logic', () => {
    expect(run('var.x == null ? 1 : 2', { var: { x: null } })).toBe(1);
    expect(run('1 < 2 && !false')).toBe(true);
    expect(run('var.a || var.b', { var: { a: true, b: UNKNOWN } })).toBe(true);
    expect(run('var.a && var.b', { var: { a: false, b: UNKNOWN } })).toBe(
      false
    );
  });

  test('keeps unknowns unknown through operators and functions', () => {
    expect(run('var.u == 1', { var: { u: UNKNOWN } })).toBe(UNKNOWN);
    expect(run('upper(var.u)', { var: { u: UNKNOWN } })).toBe(UNKNOWN);
    expect(run('"${var.u}-x"', { var: { u: UNKNOWN } })).toBe(UNKNOWN);
    expect(run('var.missing.deeper', { var: {} })).toBe(UNKNOWN);
  });

  test('builds for-expressions over lists and objects', () => {
    expect(
      run('[for s in var.l : upper(s) if s != "b"]', {
        var: { l: ['a', 'b', 'c'] },
      })
    ).toEqual(['A', 'C']);
    const map = run('{for k, v in var.m : k => "${v}!"}', {
      var: { m: { x: '1', y: '2' } },
    }) as Record<string, string>;
    expect({ ...map }).toEqual({ x: '1!', y: '2!' });
  });

  test('applies the name patterns the naming module uses', () => {
    const source =
      '{for k, p in jsondecode(file("m/patterns.json")) : k => replace(replace(p, "{p}", "g"), "{s}", "prd")}';
    const out = run(source) as Record<string, string>;
    expect({ ...out }).toEqual({ a: 'g-prd', b: 'x-prd' });
  });

  test('lists files by glob, relative to the directory', () => {
    expect(run('fileset("m", "dashboards/*.json.tftpl")')).toEqual([
      'dashboards/one.json.tftpl',
      'dashboards/two.json.tftpl',
    ]);
  });

  test('tries alternatives and sorts set and key output', () => {
    expect(run('try(var.a.b.c, "fallback")', { var: { a: {} } })).toBe(UNKNOWN);
    expect(run('toset(["b","a","b"])')).toEqual(['a', 'b']);
    expect(run('keys({z = 1, a = 2})')).toEqual(['a', 'z']);
  });
});

describe('HCL references', () => {
  test('finds roots and attribute chains, not index keys or iterators', () => {
    const refs = exprRefs(
      parseExpression('{for n in var.names : n => module.db.url[local.k]}')
    );
    expect(refs.map((r) => `${r.root}.${r.path.join('.')}`).sort()).toEqual([
      'local.k',
      'module.db.url',
      'var.names',
    ]);
  });

  test('ignores lifecycle blocks and reads depends_on', () => {
    const block = parseConfig(`
      resource "t" "n" {
        a = aws_x.y.id
        depends_on = [aws_z.w]
        lifecycle { ignore_changes = [name] }
      }
    `).blocks[0];
    const refs = bodyRefs((block as NonNullable<typeof block>).body);
    expect(refs.map((r) => `${r.root}.${r.path.join('.')}`).sort()).toEqual([
      'aws_x.y.id',
      'aws_z.w',
    ]);
  });
});
