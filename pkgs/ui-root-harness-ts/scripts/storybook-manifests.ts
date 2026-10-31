// @io-wall-ok — validate Storybook's generated contracts, never a second registry
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type ManifestComponent = {
  error?: { message?: string };
  stories?: { id: string; error?: { message?: string } }[];
};
type Manifest = { components: Record<string, ManifestComponent> };

export function manifestErrors(directory: string): string[] {
  const manifest = JSON.parse(
    readFileSync(resolve(directory, 'manifests/components.json'), 'utf8')
  ) as Manifest;
  const errors: string[] = [];
  for (const [id, component] of Object.entries(manifest.components)) {
    if (component.error)
      errors.push(
        `${id}: ${component.error.message ?? 'invalid component manifest'}`
      );
    for (const story of component.stories ?? []) {
      if (story.error)
        errors.push(
          `${story.id}: ${story.error.message ?? 'invalid story snippet'}`
        );
    }
  }
  return errors;
}
