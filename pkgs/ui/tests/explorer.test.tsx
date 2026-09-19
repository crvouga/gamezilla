/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  type ComponentEntry,
  componentRegistry,
  ExplorerDetail,
  ExplorerList,
  registryEntries,
  registryGroups,
  SchemePreview,
  SurfaceStackProvider,
  toCatalogItems,
} from '@pkgs/ui';
import { fireEvent, screen } from '@solidjs/testing-library';
import { renderUi } from './support/render';

const COMPONENTS_DIR = join(import.meta.dirname, '../src/components');

function exampleFolders(): string[] {
  return readdirSync(COMPONENTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) =>
      readdirSync(join(COMPONENTS_DIR, d.name)).some((f) =>
        f.endsWith('.example.tsx')
      )
    )
    .map((d) => d.name);
}

const DEMO_ENTRIES: readonly ComponentEntry[] = [
  {
    id: 'alpha',
    title: 'Alpha',
    group: 'Group A',
    Example: () => <p class="text">{'alpha example body'}</p>,
  },
  {
    id: 'beta',
    title: 'Beta',
    group: 'Group A',
    Example: () => <p class="text">{'beta example body'}</p>,
  },
  {
    id: 'gamma',
    title: 'Gamma',
    group: 'Group B',
    Example: () => <p class="text">{'gamma example body'}</p>,
  },
];

describe('componentRegistry', () => {
  test('has one entry per component folder that ships an example', () => {
    const folders = exampleFolders();
    expect(Object.keys(componentRegistry)).toHaveLength(folders.length);
    for (const folder of folders) {
      expect(componentRegistry[folder], folder).toBeDefined();
    }
  });

  test('entries are keyed by id with title, group and an Example component', () => {
    for (const [id, entry] of Object.entries(componentRegistry)) {
      expect(entry.id).toBe(id);
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.group.length).toBeGreaterThan(0);
      expect(typeof entry.Example).toBe('function');
    }
  });

  test('helpers preserve display order and derive groups / catalog items', () => {
    const entries = registryEntries(componentRegistry);
    expect(entries[0]?.id).toBe('theme-tokens');
    expect(registryGroups(DEMO_ENTRIES)).toEqual(['Group A', 'Group B']);
    expect(toCatalogItems(DEMO_ENTRIES)[0]).toEqual({
      id: 'alpha',
      label: 'Alpha',
      category: 'Group A',
    });
  });
});

describe('ExplorerList', () => {
  test('renders grouped rows and calls onSelect with the id', () => {
    const onSelect = mock();
    renderUi(() => <ExplorerList entries={DEMO_ENTRIES} onSelect={onSelect} />);
    expect(
      screen.getByRole('heading', { name: 'Group A' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Group B' })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Gamma/ }));
    expect(onSelect).toHaveBeenCalledWith('gamma');
  });

  test('shows Back when a navigable parent crumb is provided', () => {
    renderUi(
      () => (
        <ExplorerList
          entries={DEMO_ENTRIES}
          onSelect={() => {}}
          breadcrumbs={[
            { name: 'Settings', onClick: () => {} },
            { name: 'Components' },
          ]}
        />
      ),
      { width: 390, height: 800 }
    );
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  test('hides Back with the default single-crumb trail', () => {
    renderUi(
      () => <ExplorerList entries={DEMO_ENTRIES} onSelect={() => {}} />,
      {
        width: 390,
        height: 800,
      }
    );
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});

describe('ExplorerDetail', () => {
  test('renders the chosen example', () => {
    renderUi(() => (
      <ExplorerDetail componentId="beta" entries={DEMO_ENTRIES} />
    ));
    expect(screen.getByText('beta example body')).toBeInTheDocument();
    expect(screen.queryByText('alpha example body')).not.toBeInTheDocument();
  });

  test('shows a not-found state for unknown ids', () => {
    renderUi(() => (
      <ExplorerDetail componentId="nope" entries={DEMO_ENTRIES} />
    ));
    expect(screen.getByText('Component not found')).toBeInTheDocument();
    expect(
      screen.getByText(/No example registered for "nope"/)
    ).toBeInTheDocument();
  });

  test('renders a real registry example through the surface stack', () => {
    renderUi(() => (
      <SurfaceStackProvider>
        <ExplorerDetail componentId="badge" />
      </SurfaceStackProvider>
    ));
    expect(
      document.querySelector('[data-component="ExampleRoot"]')
    ).not.toBeNull();
  });
});

describe('SchemePreview', () => {
  test('renders children under both light and dark data-theme panes', () => {
    renderUi(() => (
      <SchemePreview>
        <p class="text">{'preview child'}</p>
      </SchemePreview>
    ));
    const light = document.querySelector('[data-theme="light"]');
    const dark = document.querySelector('[data-theme="dark"]');
    expect(light).not.toBeNull();
    expect(dark).not.toBeNull();
    expect(light?.textContent).toContain('preview child');
    expect(dark?.textContent).toContain('preview child');
    expect(screen.getAllByText('preview child')).toHaveLength(2);
  });
});
