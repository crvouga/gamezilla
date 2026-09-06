/**
 * `@pkgs/ui` public API.
 *
 * Consumers import every component, prop type, hook, and theme helper from
 * here. Implementations live under `./components/**` and are re-exported
 * directly -- there is no adapter indirection.
 *
 *   import { Button, Text, useTheme, type BoxProps } from '@pkgs/ui';
 */

import './lingui-augmentation';

export * from './component-id';
export * from './components';
export * from './explorer';
export {
  isAutoplayBlockedError,
  isReleasedSharedObjectError,
  playAudioOrIgnoreAutoplayBlock,
} from './expo/safe-audio-play';
export { hideSplash, preventSplashAutoHide } from './expo/splash-screen';
export {
  type AppNavigationRef,
  type AppRouter,
  type Href,
  type HrefObject,
  hrefToPath,
  NavigationRefProvider,
  navigationRef,
  router,
  setAppLinkingConfig,
  useLocalSearchParams,
  useNavigationRef,
  usePathname,
  useRouter,
} from './navigation/app-router';
export * from './theme';
export { releaseWebFocus } from './web/release-web-focus';
