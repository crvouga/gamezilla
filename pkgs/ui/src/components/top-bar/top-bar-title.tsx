/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { Text } from '../text';

export type TopBarTitleProps = {
  label: JSX.Element;
};

/** Single-line, centered navigation title (`h1`). */
export function TopBarTitle(props: TopBarTitleProps): JSX.Element {
  return (
    <Text
      as="h1"
      numberOfLines={1}
      variant="navigationTitle"
      sx={{ textAlign: 'center' }}
      label={props.label}
    />
  );
}
