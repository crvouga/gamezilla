/** @jsxImportSource solid-js */
import { For, type JSX } from 'solid-js';
import type { ElevationLevel } from '../../theme';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Card } from './card';

const LEVELS: readonly ElevationLevel[] = [0, 1, 2, 3, 4, 5];

export default function CardExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <div class="box flex-col gap-3">
          <For each={LEVELS}>
            {(level) => (
              <Card class="p-4" elevation={level}>
                <h2 class="text textSubtitle">{`Elevation ${level}`}</h2>
                <p class="text text-text-secondary">
                  {'Scheme-aware shadow + dark-mode surface lift'}
                </p>
              </Card>
            )}
          </For>
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
