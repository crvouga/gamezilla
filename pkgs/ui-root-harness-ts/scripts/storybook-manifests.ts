// @io-wall-ok — validate Storybook's generated contracts, never a second registry
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type ManifestComponent = {
  docgen?: { $ref: string };
  error?: { message?: string };
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
    const ref = component.docgen?.$ref.split('#')[0];
    if (!ref) continue;
    const docgen = JSON.parse(
      readFileSync(resolve(directory, 'manifests', ref), 'utf8')
    ) as Manifest;
    for (const contract of Object.values(docgen.components)) {
      if (contract.error)
        errors.push(`${id}: ${contract.error.message ?? 'docgen failed'}`);
    }
  }
  return errors;
}
