/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Text } from '../text';
import { useScreenTitleContext } from './screen-title-context';

export type ScreenLargeTitleProps = {
  label?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

export function ScreenLargeTitle(props: ScreenLargeTitleProps): JSX.Element {
  const ctx = useScreenTitleContext();
  const resolved = (): JSX.Element => {
    const value = props.label ?? ctx?.title();
    if (value === undefined || value === null) {
      throw new Error(
        'ScreenLargeTitle requires `label` or ScreenBase `largeTitle`'
      );
    }
    return value;
  };
  return (
    <Box
      sx={{ pt: 3, mb: 4 }}
      dataSet={{ component: 'ScreenLargeTitle', ...props.dataSet }}
    >
      <Text as="h1" variant="title">
        {resolved()}
      </Text>
    </Box>
  );
}
