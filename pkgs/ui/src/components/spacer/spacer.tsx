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

import { View } from 'react-native';
import { type ComponentDataSet, componentDataSet } from '../../component-id';

export type SpacerProps = {
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function Spacer({ dataSet }: SpacerProps = {}) {
  return <View style={{ flex: 1 }} {...componentDataSet('Spacer', dataSet)} />;
}
