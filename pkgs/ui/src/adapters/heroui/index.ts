/**
 * HeroUI Native adapter -- alternative `UIAdapter` implementation.
 *
 * Implemented slots so far:
 *   Button, Checkbox, Chip, Divider, Skeleton, Spinner, Switch, Text.
 *
 * Every other slot falls through to the in-house adapter via the spread
 * merge in `../../adapter-registry.ts`. This lets us roll the HeroUI
 * implementation out one component at a time without leaving holes in the
 * public API.
 *
 * Activation (Phase 2b -- not yet automated):
 *   1. Add Uniwind + Tailwind v4 to `apps/client`:
 *        - Create `apps/client/global.css` with:
 *            `@import 'tailwindcss';`
 *            `@import 'uniwind';`
 *            `@import 'heroui-native/styles';`
 *            `@source './node_modules/heroui-native/lib';`
 *        - Wire Uniwind into Metro + Babel per https://docs.uniwind.dev/quickstart .
 *   2. Mount `HeroUIThemeBridge` (`./theme-bridge`) inside `app-providers.tsx`,
 *      under the existing `ThemeProvider` and the `GestureHandlerRootView`.
 *   3. Set `EXPO_PUBLIC_UI_IMPL=heroui` (locally or via Doppler) and rebuild.
 *
 * `heroui-native`, `uniwind`, `tailwind-merge`, and `tailwind-variants` are
 * confined to this folder by `.dependency-cruiser.cjs` and
 * `pkgs/ui/eslint.config.js`; consumers never see them.
 */

import { Button } from './button';
import { Checkbox } from './checkbox';
import { Chip } from './chip';
import { Divider } from './divider';
import { Skeleton } from './skeleton';
import { Spinner } from './spinner';
import { Switch } from './switch';
import { Text } from './text';
import type { UIAdapter } from '../../ports';

export const heroUIAdapter: Partial<UIAdapter> = {
  Button,
  Checkbox,
  Chip,
  Divider,
  Skeleton,
  Spinner,
  Switch,
  Text,
};

export { HeroUIThemeBridge } from './theme-bridge';
