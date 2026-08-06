import { describe, expect, test } from 'bun:test';
import { listProjectsQuerySource } from '../railway-api-project';

describe('ListProjectsQuery', () => {
  test('uses flat me.workspaces (not Relay edges on Workspace)', () => {
    const source = listProjectsQuerySource();
    expect(source).toContain('workspaces');
    expect(source).toContain('projects');
    expect(source).not.toMatch(/workspaces\s*\{\s*edges/);
  });
});
