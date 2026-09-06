/** @jsxImportSource solid-js */
import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Text } from '../text';

export type MainMenuScreenHeaderProps = {
  title?: JSX.Element | undefined;
  subtitle?: JSX.Element | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/** Shared title and subtitle treatment for screens inside a main-menu flow. */
export function MainMenuScreenHeader(
  props: MainMenuScreenHeaderProps
): JSX.Element {
  const hasTitle = (): boolean => props.title !== undefined;
  const hasSubtitle = (): boolean => props.subtitle !== undefined;
  return (
    <Show when={hasTitle() || hasSubtitle()}>
      <Box
        dataSet={{ component: 'MainMenuScreenHeader', ...props.dataSet }}
        sx={{ gap: 1, alignItems: 'center', py: 2 }}
      >
        <Show when={hasTitle()}>
          <Text
            as="h1"
            variant="heading"
            sx={{ textAlign: 'center' }}
            label={props.title}
          />
        </Show>
        <Show when={hasSubtitle()}>
          <Text
            variant="body"
            sx={{ color: 'textSecondary', textAlign: 'center', opacity: 0.75 }}
            label={props.subtitle}
          />
        </Show>
      </Box>
    </Show>
  );
}
