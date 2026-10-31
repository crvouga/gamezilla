import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

type Story = { id: string; description?: string; snippet?: string };
type Component = {
  description?: string;
  jsDocTags: { summary?: string[] };
  reactComponentMeta: {
    props: Record<string, { required: boolean; description: string }>;
  };
  stories: Story[];
};
const manifestUrl = new URL(
  '../.cache/storybook/manifests/components.json',
  import.meta.url
);

function readJson(url: URL): unknown {
  return JSON.parse(readFileSync(url, 'utf8'));
}

// regression: storybook-component-descriptions-detached
test('every generated component has its production purpose available to agents', () => {
  const { components } = readJson(manifestUrl) as {
    components: Record<string, Component>;
  };
  expect(Object.keys(components).length).toBeGreaterThan(0);
  const missing = Object.entries(components)
    .filter(([, component]) => !component.description?.trim())
    .map(([id]) => id);
  expect(missing).toEqual([]);
  const button = components['components-inputs-button'];
  if (!button) throw new Error('Button is missing from the manifest');
  expect(button.jsDocTags.summary).toContain(
    'Run an action in the current view'
  );
  const contract = button.reactComponentMeta.props;
  expect(contract['title']?.required).toBe(true);
  expect(contract['title']?.description).toContain('Visible action label');
  expect(contract['onClick']?.description).toContain('Link for navigation');
});

// regression: storybook-docgen-server-ignores-manifest-tags
test('native manifest curation keeps focused examples and preserves gallery URLs', () => {
  const { components } = readJson(manifestUrl) as {
    components: Record<string, Component>;
  };
  const index = readJson(
    new URL('../.cache/storybook/index.json', import.meta.url)
  ) as { entries: Record<string, unknown> };
  for (const [id, component] of Object.entries(components)) {
    const stories = component.stories;
    const gallery = `${id}--states`;
    if (
      index.entries[gallery] &&
      !stories.some((story) => story.id === gallery)
    ) {
      expect(stories.length).toBeGreaterThan(0);
      for (const story of stories) {
        expect(story.description?.trim()).toBeTruthy();
      }
    }
  }
  const id = 'components-inputs-button';
  const button = components[id];
  if (!button) throw new Error('Button is missing from the manifest');
  expect(
    button.stories.find((story) => story.id === `${id}--states`)
  ).toBeUndefined();
  expect(
    button.stories.find((story) => story.id === `${id}--arg-updates`)
  ).toBeUndefined();
  expect(index.entries[`${id}--states`]).toBeDefined();
  expect(index.entries[`${id}--arg-updates`]).toBeDefined();
  const interactive = button.stories.find(
    (story) => story.id === `${id}--interactive`
  );
  expect(interactive?.description).toContain('main action in a view');
  expect(interactive?.snippet).toContain('title="Save"');
});

test('the docs manifest carries the explicit guide summary and static guidance', () => {
  const docsUrl = new URL('./docs.json', manifestUrl);
  const { docs } = readJson(docsUrl) as {
    docs: Record<string, { summary: string; content: string }>;
  };
  const guide = docs['start-here--docs'];
  if (!guide) throw new Error('Start here is missing from the docs manifest');
  expect(guide.summary).toBe(
    'Build and review production Solid UI with native Storybook features and automated evidence.'
  );
  expect(guide.content).toContain(
    'The component manifest embeds prop descriptions and focused usage examples;'
  );
});
