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
            `${file.path}: specs/ contains no implementation code — bindings and runners live outside specs/`
        ),
      'specs/friends/interpreted.qnt: marked Quint modules require a registered spec campaign domain',
      'specs/friends/fixture.qnt: marked Quint modules require a registered spec campaign domain',
    ]);
  });

  test('accepts canonical specs and marked test-only Quint fixtures', () => {
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
        ],
        domains
      )
    ).toEqual([]);
  });

  test('keeps composed product models and their helpers in a registered spec campaign', () => {
    const files = [
      {
        path: 'specs/system/whole-system.qnt',
        text: '// @spec-interpretation\n// Sources: specs/friends, specs/profile\nmodule whole_system {}',
      },
      {
        path: 'specs/system/universe.qnt',
        text: '// @spec-meta — finite model bounds\nmodule universe {}',
      },
    ];
    expect(specLocationProblems(files, domains, new Set(['system']))).toEqual(
      []
    );
    expect(specLocationProblems(files, domains)).toHaveLength(2);
    expect(
      specLocationProblems(
        [
          {
            ...files[0]!,
            path: 'apps/product/tests/quint/system/whole-system.qnt',
          },
        ],
        domains
      )
    ).toEqual([
      'apps/product/tests/quint/system/whole-system.qnt: product Quint interpretations live in specs/<domain>/',
    ]);
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
            path: 'specs/system/missing.qnt',
            text: '// @spec-interpretation\nmodule missing {}',
          },
          {
            path: 'specs/system/foreign.qnt',
            text: '// @spec-interpretation\n// Sources: specs/friends, specs/missing\nmodule foreign {}',
          },
        ],
        domains,
        new Set(['system'])
      )
    ).toEqual([
      'specs/system/missing.qnt: a spec interpretation must declare "// Sources: specs/<domain>[, specs/<domain>...]"',
      'specs/system/foreign.qnt: interpretation source specs/missing/ does not exist',
    ]);
  });
});
