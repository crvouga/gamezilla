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

export function Spacer() {
  return <View style={{ flex: 1 }} />;
}
