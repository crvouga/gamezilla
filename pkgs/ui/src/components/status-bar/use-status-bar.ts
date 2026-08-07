import { useStatusBarRegistry } from './status-bar-registry-context';

/**
 * Open / close / toggle the expanded status-bar surface (control-center style).
 */
export function useStatusBar() {
  const { isOpen, open, close, toggle } = useStatusBarRegistry();
  return { isOpen, open, close, toggle };
}
