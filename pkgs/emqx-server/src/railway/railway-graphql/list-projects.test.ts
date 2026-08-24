import { describe, expect, test } from 'bun:test';
import {
  listProjectsQuerySource,
  pickRailwayWorkspaceId,
} from '../railway-api-project';

describe('ListProjectsQuery', () => {
  test('uses flat me.workspaces (not Relay edges on Workspace)', () => {
    const source = listProjectsQuerySource();
    expect(source).toContain('workspaces');
    expect(source).toContain('projects');
    expect(source).not.toMatch(/workspaces\s*\{\s*edges/);
  });

  test('selects workspace id and name for projectCreate', () => {
    const source = listProjectsQuerySource();
    expect(source).toMatch(/workspaces\s*\{\s*id\s+name/);
  });
});

describe('pickRailwayWorkspaceId', () => {
  test('uses sole workspace when no preferred name', () => {
    expect(pickRailwayWorkspaceId([{ id: 'ws-1', name: 'Hobby' }])).toBe(
      'ws-1'
    );
  });

  test('matches preferred workspace name', () => {
    expect(
      pickRailwayWorkspaceId(
        [
          { id: 'ws-a', name: 'Other' },
          { id: 'ws-b', name: 'gamezilla' },
        ],
        'gamezilla'
      )
    ).toBe('ws-b');
  });

  test('requires preferred name when multiple workspaces', () => {
    expect(() =>
      pickRailwayWorkspaceId([
        { id: 'ws-a', name: 'Other' },
        { id: 'ws-b', name: 'gamezilla' },
      ])
    ).toThrow(/preferredWorkspaceName/);
  });
});
