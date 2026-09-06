/**
 * `Spacer` -- flexible space that pushes siblings apart.
 *
 * Renders a `flex: 1` view. Useful inside `Stack` for toolbar-style layouts.
 *
 * @example
 * ```tsx
 * <Stack direction="horizontal" align="center">
 *   <Text>Title</Text>
 *   <Spacer />
 *   <Button title="Action" onPress={handlePress} />
 * </Stack>
 * ```
 */

import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';

export type SpacerProps = {
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function Spacer({ dataSet }: SpacerProps = {}) {
  return <Box sx={{ flex: 1 }} dataSet={{ component: 'Spacer', ...dataSet }} />;
}
