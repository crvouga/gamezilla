import { describe, expect, test } from 'bun:test';
import { specLocationProblems } from './spec-location';

const domains = new Set(['specs/friends', 'specs/profile']);

describe('specLocationProblems', () => {
  test('keeps code and interpretations out of the canonical spec tree', () => {
    const files = [
      ...['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs'].map(
        (extension) => ({
          path: `specs/friends/binding.${extension}`,
          text: 'export const binding = {};',
        })
      ),
      {
        path: 'specs/friends/interpreted.qnt',
        text: '// @spec-interpretation\nmodule interpreted {}',
      },
      {
        path: 'specs/friends/fixture.qnt',
        text: '// @spec-meta\nmodule fixture {}',
      },
    ];
    expect(specLocationProblems(files, domains)).toEqual([
      ...files
        .slice(0, 8)
        .map(
          (file) =>
            `${file.path}: specs/ contains no implementation code — bindings, runners and interpretation live outside specs/`
        ),
      'specs/friends/interpreted.qnt: test machinery and spec interpretations live outside specs/',
      'specs/friends/fixture.qnt: test machinery and spec interpretations live outside specs/',
    ]);
  });

  test('accepts canonical specs and marked test-only Quint models', () => {
    expect(
      specLocationProblems(
        [
          {
            path: 'specs/friends/friendship.qnt',
            text: 'module friendship {}',
          },
          {
            path: 'pkgs/quint/tests/fixtures/door.qnt',
            text: '// @spec-meta — parser fixture\nmodule door {}',
          },
          {
            path: 'apps/product/tests/quint/whole-system.qnt',
            text: '// @spec-interpretation\n// Sources: specs/friends, specs/profile\nmodule whole_system {}',
          },
        ],
        domains
      )
    ).toEqual([]);
  });

  test('rejects product specs and ambiguous exceptions outside specs', () => {
    expect(
      specLocationProblems(
        [
          {
            path: 'libs/friends/tests/friend.feature',
            text: 'Feature: Friends',
          },
          { path: 'libs/friends/src/friendship.qnt', text: '// @spec-meta' },
          {
            path: 'libs/friends/tests/friendship.qnt',
            text: 'module friendship {}',
          },
          {
            path: 'libs/friends/tests/both.qnt',
            text: '// @spec-meta\n// @spec-interpretation',
          },
        ],
        domains
      )
    ).toEqual([
      'libs/friends/tests/friend.feature: Gherkin product specifications live in specs/<domain>/',
      'libs/friends/src/friendship.qnt: Quint outside specs/ is allowed only as test machinery under tests/',
      'libs/friends/tests/friendship.qnt: begin with exactly one of "// @spec-meta" or "// @spec-interpretation"',
      'libs/friends/tests/both.qnt: begin with exactly one of "// @spec-meta" or "// @spec-interpretation"',
    ]);
  });

  test('requires every interpretation source to be a real spec domain', () => {
    expect(
      specLocationProblems(
        [
          {
            path: 'apps/product/tests/quint/missing.qnt',
            text: '// @spec-interpretation\nmodule missing {}',
          },
          {
            path: 'apps/product/tests/quint/foreign.qnt',
            text: '// @spec-interpretation\n// Sources: specs/friends, specs/missing\nmodule foreign {}',
          },
        ],
        domains
      )
    ).toEqual([
      'apps/product/tests/quint/missing.qnt: a spec interpretation must declare "// Sources: specs/<domain>[, specs/<domain>...]"',
      'apps/product/tests/quint/foreign.qnt: interpretation source specs/missing/ does not exist',
    ]);
  });
});
