/** @jsxImportSource solid-js */
/**
 * Building blocks of the explorer examples for the closed primitives: a
 * titled group of variants, and a labelled tile to stand in for content.
 * Written with the primitives themselves, as a screen would be.
 */

import type { JSX } from 'solid-js';
import { StackVertical } from './stack';
import { Surface } from './surface';
import { P, Text } from './text';

/** One variant group: what is being shown, then the variants. */
export function ExampleSection(props: {
  title: string;
  children: JSX.Element;
}): JSX.Element {
  return (
    <StackVertical gap="sm">
      <P variant="footnote" tone="secondary">
        {props.title}
      </P>
      {props.children}
    </StackVertical>
  );
}

/** A filled tile so gaps, alignment and sizing are visible. */
export function ExampleTile(props: {
  label: string;
  /** A taller tile, to show cross-axis alignment. */
  tall?: boolean | undefined;
  grow?: boolean | undefined;
}): JSX.Element {
  return (
    <Surface
      tone="tint-subtle"
      radius="sm"
      paddingX="sm"
      paddingY={props.tall === true ? 'lg' : 'xs'}
      grow={props.grow}
      align="center"
      justify="center"
    >
      <Text variant="footnote" tone="tint">
        {props.label}
      </Text>
    </Surface>
  );
}
